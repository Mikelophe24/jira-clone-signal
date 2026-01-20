import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withComputed,
  withHooks,
} from '@ngrx/signals';
import { inject, computed, effect } from '@angular/core';
import { IssueService } from '../issue/issue.service';
import { Issue } from '../issue/issue.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError } from 'rxjs';
import { of } from 'rxjs';
import { produce } from 'immer';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../../core/services/error-notification.service';
import { AuthStore } from '../../core/auth/auth.store';
import { SprintStore } from './sprint.store';

type BoardFilter = {
  searchQuery: string;
  onlyMyIssues: boolean;
  userId: string | null;
  assignee: string[];
  status: string[];
  priority: string[];
};

type BoardState = {
  issues: Issue[];
  filter: BoardFilter;
};

const initialState: BoardState = {
  issues: [],
  filter: {
    searchQuery: '',
    onlyMyIssues: false,
    userId: null,
    assignee: [],
    status: [],
    priority: [],
  },
};

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(({ issues, filter }) => {
    const sprintStore = inject(SprintStore);
    // Hỗ trợ lọc các công việc
    const filteredIssues = computed(() => {
      const { searchQuery, onlyMyIssues, userId, assignee, status, priority } = filter();
      const query = searchQuery.toLowerCase();

      return issues().filter((issue) => {
        const matchesSearch =
          issue.title.toLowerCase().includes(query) || issue.key.toLowerCase().includes(query);

        const matchesUser = onlyMyIssues ? issue.assigneeId === userId : true;

        const matchesAssignee =
          assignee.length === 0 || (issue.assigneeId && assignee.includes(issue.assigneeId));
        const matchesStatus = status.length === 0 || status.includes(issue.statusColumnId);
        const matchesPriority = priority.length === 0 || priority.includes(issue.priority);

        const activeSprintIds = sprintStore.activeSprints().map((s) => s.id);
        const matchesSprint = issue.sprintId ? activeSprintIds.includes(issue.sprintId) : true;

        const isNotBacklog = !issue.isInBacklog;

        return (
          matchesSearch &&
          matchesUser &&
          matchesAssignee &&
          matchesStatus &&
          matchesPriority &&
          isNotBacklog &&
          matchesSprint
        );
      });
    });
    const sortedFilteredIssues = computed(() => {
      return [...filteredIssues()].sort((a, b) => a.order - b.order);
    });

    return {
      todoIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo')),
      inProgressIssues: computed(() =>
        sortedFilteredIssues().filter((i) => i.statusColumnId === 'in-progress'),
      ),
      doneIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'done')),
    };
  }),
  withMethods(
    (
      store,
      issueService: IssueService = inject(IssueService),
      errorService: ErrorNotificationService = inject(ErrorNotificationService),
    ) => ({
      updateFilter: (newFilter: Partial<BoardFilter>) => {
        patchState(store, (state) => ({
          filter: { ...state.filter, ...newFilter },
        }));
      },
      /**
       * Generate the next issue key for a project
       * Format: ${projectKey}-${issueCount + 1}
       * Example: "PROJ-1", "PROJ-2", etc.
       */
      getNextIssueKey: (projectKey: string): string => {
        const projectIssues = store.issues().filter((issue) => issue.key.startsWith(projectKey));

        if (projectIssues.length === 0) {
          return `${projectKey}-1`;
        }

        // Extract issue numbers and find the maximum
        const issueNumbers = projectIssues
          .map((issue) => {
            const match = issue.key.match(new RegExp(`^${projectKey}-(\\d+)$`));
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((num) => !isNaN(num));

        const maxIssueNumber = Math.max(...issueNumbers, 0);
        return `${projectKey}-${maxIssueNumber + 1}`;
      },
      loadIssues: rxMethod<string | null>(
        pipe(
          tap(() => {
            store.setLoading(true);
          }),
          switchMap((projectId) => {
            if (!projectId) {
              patchState(store, { issues: [] });
              store.setLoading(false);
              return of([]);
            }
            return issueService.getIssues(projectId).pipe(
              tap((issues) => {
                const activeIssues = issues.filter((i) => !i.isArchived);
                patchState(store, { issues: activeIssues });
                store.setLoading(false);
              }),
              catchError((error) => {
                const errorMessage = error?.message || 'Failed to load issues';
                errorService.showError(errorMessage);
                return of([]);
              }),
            );
          }),
        ),
      ),
      moveIssue: (event: CdkDragDrop<Issue[]>, newStatus: string) => {
        const movedIssue = event.item.data as Issue;
        const allIssues = [...store.issues()];

        if (event.previousContainer === event.container) {
          // 1. Sắp xếp lại trong cùng một cột
          const columnIssues = [...event.container.data];
          moveItemInArray(columnIssues, event.previousIndex, event.currentIndex);

          // 2. Tính toán lại thứ tự (Order) cho cột này
          const updates: { id: string; data: Partial<Issue> }[] = [];

          columnIssues.forEach((issue, index) => {
            const newOrder = index * 1000; // Thứ tự được giãn cách (ví dụ nhân với 1000)
            if (issue.order !== newOrder) {
              updates.push({ id: issue.id, data: { order: newOrder } });
            }
          });

          // 3. Cập nhật lạc quan (Optimistic Update)
          if (updates.length > 0) {
            patchState(store, (state) =>
              produce(state, (draft) => {
                updates.forEach((update) => {
                  const issue = draft.issues.find((i) => i.id === update.id);
                  if (issue) {
                    issue.order = update.data.order!;
                  }
                });
              }),
            );

            // 4. Cập nhật hàng loạt (Batch Update) lên Firestore
            issueService.batchUpdateIssues(updates);
          }
        } else {
          const targetColumnIssues = [...event.container.data];

          targetColumnIssues.splice(event.currentIndex, 0, movedIssue);

          let newOrder = 0;
          const prevItem = targetColumnIssues[event.currentIndex - 1];
          const nextItem = targetColumnIssues[event.currentIndex + 1];

          if (!prevItem && !nextItem) {
            newOrder = 0;
          } else if (!prevItem) {
            newOrder = (nextItem.order || 0) - 1000;
          } else if (!nextItem) {
            newOrder = (prevItem.order || 0) + 1000;
          } else {
            newOrder = (prevItem.order + nextItem.order) / 2;
          }

          // Cập nhật trạng thái cục bộ
          patchState(store, (state) =>
            produce(state, (draft) => {
              const issue = draft.issues.find((i) => i.id === movedIssue.id);
              if (issue) {
                issue.statusColumnId = newStatus;
                issue.order = newOrder;
              }
            }),
          );

          // Cập nhật lên Firestore
          issueService.updateIssue(movedIssue.id, {
            statusColumnId: newStatus,
            order: newOrder,
          });
        }
      },
      addIssue: async (issue: Partial<Issue>) => {
        try {
          await issueService.addIssue(issue);
          errorService.showSuccess('Issue created successfully');
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to add issue';
          errorService.showError(errorMessage);
        }
      },
      deleteIssue: async (issueId: string) => {
        try {
          await issueService.deleteIssue(issueId);
          errorService.showSuccess('Issue deleted successfully');
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to delete issue';
          errorService.showError(errorMessage);
        }
      },

      updateIssue: async (issueId: string, updates: Partial<Issue>) => {
        // luu state goc
        const originalIssues = [...store.issues()];
        // optimistic update

        patchState(store, (state) => ({
          issues: state.issues.map((issue) =>
            issue.id === issueId ? { ...issue, ...updates } : issue,
          ),
        }));

        try {
          await issueService.updateIssue(issueId, updates);
          errorService.showSuccess('Issue updated successfully');
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to update issue';
          errorService.showError(errorMessage);
          // Hoàn tác cập nhật lạc quan nếu xảy ra lỗi
          patchState(store, { issues: originalIssues });
        }
      },
    }),
  ),

  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);
      effect(() => {
        if (!authStore.user()) {
          store.loadIssues(null);
        }
      });
    },
  }),
);
