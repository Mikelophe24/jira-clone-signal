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
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../../core/services/error-notification.service';
import { AuthStore } from '../../core/auth/auth.store';

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

        // const matchesResolved = ignoreResolved ? issue.status !== 'Done' : true; // Giả định 'Done' là trạng thái đã giải quyết
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
      // Tạo một bản sao trước khi sắp xếp để tránh làm thay đổi trạng thái gốc nếu có lỗi xảy ra
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
      loadIssues: rxMethod<string | null>(
        pipe(
          tap(() => {
            store.setLoading(true);
            store.clearError();
          }),
          switchMap((projectId) => {
            if (!projectId) {
              patchState(store, { issues: [] });
              store.setLoading(false);
              return of([]);
            }
            return issueService.getIssues(projectId).pipe(
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
            );
          })
        )
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

              // Cập nhật bản sao trạng thái cục bộ
              const globalIndex = allIssues.findIndex((i) => i.id === issue.id);
              if (globalIndex > -1) {
                allIssues[globalIndex] = { ...allIssues[globalIndex], order: newOrder };
              }
            }
          });

          // 3. Cập nhật lạc quan (Optimistic Update)
          patchState(store, { issues: allIssues });

          // 4. Cập nhật hàng loạt (Batch Update) lên Firestore
          if (updates.length > 0) {
            issueService.batchUpdateIssues(updates);
          }
        } else {
          // 1. Di chuyển sang cột khác

          // Xóa khỏi vị trí cũ ??? Không, chúng ta chỉ cần cập nhật thuộc tính.
          // Nhưng chúng ta cũng cần biết chỉ số (index) MỚI trong cột MỚI để thiết lập thứ tự chính xác.

          const targetColumnIssues = [...event.container.data]; // Đây là danh sách TRƯỚC khi thả
          // Sử dụng transferArrayItem để mô phỏng những gì đã xảy ra về mặt hình ảnh để chúng ta biết thứ tự mới
          // Lưu ý: Chúng ta đang làm việc với các bản sao để xác định giá trị thứ tự
          const sourceColumnIssues = [...event.previousContainer.data];

          // Chúng ta thực sự không cần sử dụng transferArrayItem trên trạng thái Store vì chúng ta sử dụng các Computed signal dựa trên statusColumnId.
          // Chúng ta chỉ cần tính toán giá trị 'order' mới cho mục đã di chuyển.

          // Chèn vào mảng mục tiêu/mô phỏng để tìm các mục lân cận
          targetColumnIssues.splice(event.currentIndex, 0, movedIssue);

          // Tính toán thứ tự mới dựa trên các mục lân cận
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
        // Lưu trạng thái gốc để có thể hoàn tác (rollback) nếu cần
        const originalIssues = [...store.issues()];

        // Cập nhật lạc quan (Optimistic Update)
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
          // Hoàn tác cập nhật lạc quan nếu xảy ra lỗi
          patchState(store, { issues: originalIssues });
        }
      },
    })
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
  })
);
