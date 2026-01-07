import { signalStore, withState, withMethods, patchState, withComputed } from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { IssueService } from '../issue/issue.service';
import { Issue } from '../issue/issue.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError } from 'rxjs';
import { of } from 'rxjs';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../../core/services/error-notification.service';

type BoardFilter = {
  searchQuery: string;
  onlyMyIssues: boolean;
  ignoreResolved: boolean;
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
    ignoreResolved: false,
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
    // Helper to filter issues
    const filteredIssues = computed(() => {
      const { searchQuery, onlyMyIssues, ignoreResolved, userId, assignee, status, priority } =
        filter();
      const query = searchQuery.toLowerCase();

      return issues().filter((issue) => {
        const matchesSearch =
          issue.title.toLowerCase().includes(query) || issue.key.toLowerCase().includes(query);

        const matchesUser = onlyMyIssues ? issue.assigneeId === userId : true;

        const matchesAssignee =
          assignee.length === 0 || (issue.assigneeId && assignee.includes(issue.assigneeId));
        const matchesStatus = status.length === 0 || status.includes(issue.statusColumnId);
        const matchesPriority = priority.length === 0 || priority.includes(issue.priority);

        // const matchesResolved = ignoreResolved ? issue.status !== 'Done' : true; // Assuming 'Done' is the resolved status
        const isNotBacklog = !issue.isInBacklog;

        return (
          matchesSearch &&
          matchesUser &&
          matchesAssignee &&
          matchesStatus &&
          matchesPriority &&
          isNotBacklog
        );
      });
    });

    const sortedFilteredIssues = computed(() => {
      // Create a copy before sorting to avoid mutating original state if something goes wrong
      return [...filteredIssues()].sort((a, b) => a.order - b.order);
    });

    return {
      todoIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo')),
      inProgressIssues: computed(() =>
        sortedFilteredIssues().filter((i) => i.statusColumnId === 'in-progress')
      ),
      doneIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'done')),
    };
  }),
  withMethods(
    (
      store,
      issueService: IssueService = inject(IssueService),
      errorService: ErrorNotificationService = inject(ErrorNotificationService)
    ) => ({
      updateFilter: (newFilter: Partial<BoardFilter>) => {
        patchState(store, { filter: { ...store.filter(), ...newFilter } });
      },
      loadIssues: rxMethod<string>(
        pipe(
          tap(() => {
            store.setLoading(true);
            store.clearError();
          }),
          switchMap((projectId) => issueService.getIssues(projectId)),
          tap((issues) => {
            patchState(store, { issues });
            store.setLoading(false);
          }),
          catchError((error) => {
            const errorMessage = error?.message || 'Failed to load issues';
            store.setError(errorMessage);
            errorService.showError(errorMessage);
            return of([]);
          })
        )
      ),
      moveIssue: (event: CdkDragDrop<Issue[]>, newStatus: string) => {
        const movedIssue = event.item.data as Issue;
        const allIssues = [...store.issues()];

        if (event.previousContainer === event.container) {
          // 1. Reorder in Same Column
          const columnIssues = [...event.container.data];
          moveItemInArray(columnIssues, event.previousIndex, event.currentIndex);

          // 2. Recalculate Order for this column
          const updates: { id: string; data: Partial<Issue> }[] = [];

          columnIssues.forEach((issue, index) => {
            const newOrder = index * 1000; // Spaced out order
            if (issue.order !== newOrder) {
              updates.push({ id: issue.id, data: { order: newOrder } });

              // Update local state copy
              const globalIndex = allIssues.findIndex((i) => i.id === issue.id);
              if (globalIndex > -1) {
                allIssues[globalIndex] = { ...allIssues[globalIndex], order: newOrder };
              }
            }
          });

          // 3. Optimistic Update
          patchState(store, { issues: allIssues });

          // 4. Batch Update Firestore
          if (updates.length > 0) {
            issueService.batchUpdateIssues(updates);
          }
        } else {
          // 1. Move to Different Column

          // Remove from old pos ??? No, we just need to update property.
          // But we also need to know the NEW index in the NEW column to set the correct order.

          const targetColumnIssues = [...event.container.data]; // This is the list BEFORE the drop
          // Use transferArrayItem to simulate what happened visually so we know the new order
          // Note: We are working with copies to determine order values
          const sourceColumnIssues = [...event.previousContainer.data];

          // We don't actually need to use transferArrayItem on the Store state because we use Computed signals based on statusColumnId.
          // We just need to figure out the new `order` value for the moved item.

          // Insert into target/simulated array to find neighbors
          targetColumnIssues.splice(event.currentIndex, 0, movedIssue);

          // Calculate new order based on neighbors
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

          // Update local state
          const issueIndex = allIssues.findIndex((i) => i.id === movedIssue.id);
          if (issueIndex > -1) {
            const updatedIssue = {
              ...allIssues[issueIndex],
              statusColumnId: newStatus,
              order: newOrder,
            };
            allIssues[issueIndex] = updatedIssue;
            patchState(store, { issues: allIssues });
          }

          // Firestore Update
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
          store.setError(errorMessage);
          errorService.showError(errorMessage);
        }
      },
      deleteIssue: async (issueId: string) => {
        try {
          await issueService.deleteIssue(issueId);
          errorService.showSuccess('Issue deleted successfully');
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to delete issue';
          store.setError(errorMessage);
          errorService.showError(errorMessage);
        }
      },
      updateIssue: async (issueId: string, updates: Partial<Issue>) => {
        // Save original state for potential rollback
        const originalIssues = [...store.issues()];

        // Optimistic Update
        const allIssues = [...originalIssues];
        const issueIndex = allIssues.findIndex((i) => i.id === issueId);
        if (issueIndex > -1) {
          allIssues[issueIndex] = { ...allIssues[issueIndex], ...updates };
          patchState(store, { issues: allIssues });
        }

        try {
          await issueService.updateIssue(issueId, updates);
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to update issue';
          store.setError(errorMessage);
          errorService.showError(errorMessage);
          // Revert optimistic update on error
          patchState(store, { issues: originalIssues });
        }
      },
    })
  )
);
