# Code Examples & Troubleshooting Guide

## 📋 Mục Lục

1. [Code Examples Chi Tiết](#1-code-examples-chi-tiết)
2. [Common Issues & Solutions](#2-common-issues--solutions)
3. [Advanced Patterns](#3-advanced-patterns)
4. [Migration Guide](#4-migration-guide)

---

## 1. Code Examples Chi Tiết

### 1.1. Tạo Store Mới

**Ví dụ: Tạo NotificationStore**

```typescript
// features/notifications/notification.model.ts
export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
}

// features/notifications/notification.store.ts
import { signalStore, withState, withMethods, withComputed } from '@ngrx/signals';
import { computed } from '@angular/core';

type NotificationState = {
  notifications: Notification[];
  loading: boolean;
};

const initialState: NotificationState = {
  notifications: [],
  loading: false,
};

export const NotificationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // Computed signals
  withComputed(({ notifications }) => ({
    unreadCount: computed(() => notifications().filter((n) => !n.read).length),

    unreadNotifications: computed(() => notifications().filter((n) => !n.read)),
  })),

  // Methods
  withMethods((store) => ({
    addNotification: (notification: Notification) => {
      patchState(store, {
        notifications: [...store.notifications(), notification],
      });
    },

    markAsRead: (notificationId: string) => {
      patchState(store, {
        notifications: store
          .notifications()
          .map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      });
    },

    markAllAsRead: () => {
      patchState(store, {
        notifications: store.notifications().map((n) => ({ ...n, read: true })),
      });
    },

    clearAll: () => {
      patchState(store, { notifications: [] });
    },
  }))
);
```

**Sử dụng trong Component:**

```typescript
import { Component, inject } from '@angular/core';
import { NotificationStore } from './notification.store';

@Component({
  selector: 'app-notification-bell',
  template: `
    <button (click)="togglePanel()">
      <mat-icon>notifications</mat-icon>
      @if (store.unreadCount() > 0) {
      <span class="badge">{{ store.unreadCount() }}</span>
      }
    </button>

    @if (showPanel) {
    <div class="notification-panel">
      @for (notification of store.unreadNotifications(); track notification.id) {
      <div class="notification" [class]="notification.type">
        <p>{{ notification.message }}</p>
        <button (click)="markAsRead(notification.id)">Mark as read</button>
      </div>
      } @if (store.unreadCount() > 0) {
      <button (click)="markAllAsRead()">Mark all as read</button>
      }
    </div>
    }
  `,
})
export class NotificationBell {
  store = inject(NotificationStore);
  showPanel = false;

  togglePanel() {
    this.showPanel = !this.showPanel;
  }

  markAsRead(id: string) {
    this.store.markAsRead(id);
  }

  markAllAsRead() {
    this.store.markAllAsRead();
  }
}
```

### 1.2. Tích Hợp Firebase Real-time Listener

**Ví dụ: Real-time Issues Updates**

```typescript
// features/board/board.store.ts
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap } from 'rxjs';

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withMethods((store, issueService = inject(IssueService)) => ({
    // Real-time subscription
    subscribeToIssues: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((projectId) => issueService.getIssuesRealtime(projectId)),
        tap((issues) => {
          console.log('Real-time update received:', issues.length);
          patchState(store, { issues, loading: false });
        })
      )
    ),
  }))
);

// features/issue/issue.service.ts
import { collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export class IssueService {
  private firestore = inject(Firestore);

  // Real-time listener
  getIssuesRealtime(projectId: string): Observable<Issue[]> {
    const issuesRef = collection(this.firestore, 'issues');
    const q = query(issuesRef, where('projectId', '==', projectId), orderBy('order', 'asc'));

    // collectionData automatically subscribes to snapshots
    return collectionData(q, { idField: 'id' }) as Observable<Issue[]>;
  }
}

// Component usage
export class Board implements OnInit {
  store = inject(BoardStore);

  ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('projectId')!;

    // Subscribe to real-time updates
    this.store.subscribeToIssues(projectId);
  }
}
```

### 1.3. Optimistic Updates với Rollback

**Ví dụ: Update Issue với Error Handling**

```typescript
// features/board/board.store.ts
withMethods((store, issueService = inject(IssueService)) => ({
  updateIssueWithRollback: async (issueId: string, updates: Partial<Issue>) => {
    // 1. Lưu state cũ để rollback
    const oldIssues = [...store.issues()];
    const issueIndex = oldIssues.findIndex((i) => i.id === issueId);

    if (issueIndex === -1) {
      console.error('Issue not found');
      return;
    }

    const oldIssue = oldIssues[issueIndex];

    // 2. Optimistic update
    const newIssues = [...oldIssues];
    newIssues[issueIndex] = { ...oldIssue, ...updates };
    patchState(store, { issues: newIssues });

    // 3. Sync to backend
    try {
      await issueService.updateIssue(issueId, updates);
      console.log('✅ Update successful');
    } catch (error) {
      console.error('❌ Update failed, rolling back...', error);

      // 4. Rollback on error
      patchState(store, { issues: oldIssues });

      // 5. Show error notification
      // notificationStore.addNotification({
      //   type: 'error',
      //   message: 'Failed to update issue. Please try again.'
      // });

      throw error;
    }
  },
}));
```

### 1.4. Complex Filtering với Multiple Conditions

**Ví dụ: Advanced Search**

```typescript
// features/board/board.store.ts
type AdvancedFilter = {
  searchQuery: string;
  assignees: string[];
  priorities: string[];
  types: string[];
  statuses: string[];
  dateRange?: { start: Date; end: Date };
  hasComments?: boolean;
};

withComputed(({ issues, filter }) => ({
  filteredIssues: computed(() => {
    const f = filter();

    return issues().filter((issue) => {
      // Text search
      if (f.searchQuery) {
        const query = f.searchQuery.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesKey = issue.key.toLowerCase().includes(query);
        const matchesDescription = issue.description.toLowerCase().includes(query);

        if (!matchesTitle && !matchesKey && !matchesDescription) {
          return false;
        }
      }

      // Assignee filter
      if (f.assignees.length > 0) {
        if (!issue.assigneeId || !f.assignees.includes(issue.assigneeId)) {
          return false;
        }
      }

      // Priority filter
      if (f.priorities.length > 0 && !f.priorities.includes(issue.priority)) {
        return false;
      }

      // Type filter
      if (f.types.length > 0 && !f.types.includes(issue.type)) {
        return false;
      }

      // Status filter
      if (f.statuses.length > 0 && !f.statuses.includes(issue.statusColumnId)) {
        return false;
      }

      // Date range filter
      if (f.dateRange) {
        const issueDate = new Date(issue.createdAt);
        if (issueDate < f.dateRange.start || issueDate > f.dateRange.end) {
          return false;
        }
      }

      // Has comments filter
      if (f.hasComments !== undefined) {
        const hasComments = (issue.comments?.length ?? 0) > 0;
        if (f.hasComments !== hasComments) {
          return false;
        }
      }

      return true;
    });
  }),
}));
```

### 1.5. Batch Operations

**Ví dụ: Bulk Update Issues**

```typescript
// features/issue/issue.service.ts
import { writeBatch } from '@angular/fire/firestore';

export class IssueService {
  async batchUpdateIssues(updates: { id: string; data: Partial<Issue> }[]) {
    const batch = writeBatch(this.firestore);

    updates.forEach(({ id, data }) => {
      const docRef = doc(this.firestore, 'issues', id);
      batch.update(docRef, data);
    });

    await batch.commit();
    console.log(`✅ Batch updated ${updates.length} issues`);
  }

  async batchDeleteIssues(issueIds: string[]) {
    const batch = writeBatch(this.firestore);

    issueIds.forEach((id) => {
      const docRef = doc(this.firestore, 'issues', id);
      batch.delete(docRef);
    });

    await batch.commit();
    console.log(`✅ Batch deleted ${issueIds.length} issues`);
  }
}

// Component usage
export class Board {
  async bulkAssign(issueIds: string[], assigneeId: string) {
    const updates = issueIds.map((id) => ({
      id,
      data: { assigneeId },
    }));

    await this.issueService.batchUpdateIssues(updates);

    // Optimistic update
    this.store.patchState({
      issues: this.store
        .issues()
        .map((issue) => (issueIds.includes(issue.id) ? { ...issue, assigneeId } : issue)),
    });
  }
}
```

---

## 2. Common Issues & Solutions

### 2.1. "Property does not exist on type" Errors

**Problem:**

```typescript
// Error: Property 'id' does not exist on type 'User'
const userId = user.id;
```

**Solution:**

```typescript
// Firebase User type doesn't have 'id', it has 'uid'
const userId = user.uid;

// Or create a custom type
interface AppUser {
  id: string; // Map from uid
  email: string;
  displayName: string;
}

// Convert Firebase User to AppUser
function toAppUser(firebaseUser: User): AppUser {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email!,
    displayName: firebaseUser.displayName || 'Anonymous',
  };
}
```

### 2.2. Signals Not Updating UI

**Problem:**

```typescript
// UI doesn't update when signal changes
items.push(newItem); // ❌ Mutating array directly
```

**Solution:**

```typescript
// Create new array reference
patchState(store, {
  items: [...store.items(), newItem],
});

// Or use computed
const items = computed(() => [...originalItems(), newItem]);
```

### 2.3. Firebase Permission Denied

**Problem:**

```
FirebaseError: Missing or insufficient permissions
```

**Solution:**

**Check 1: User is authenticated**

```typescript
const user = this.authStore.user();
if (!user) {
  console.error('User not authenticated');
  return;
}
```

**Check 2: Firestore rules**

```javascript
// Make sure rules allow the operation
match /issues/{issueId} {
  allow read, write: if request.auth != null;
}
```

**Check 3: User is member of project**

```typescript
// Query with proper filter
const q = query(collection(firestore, 'projects'), where('memberIds', 'array-contains', userId));
```

### 2.4. Memory Leaks với Subscriptions

**Problem:**

```typescript
// Subscription not cleaned up
ngOnInit() {
  this.issueService.getIssues().subscribe(issues => {
    // ...
  });
  // ❌ Memory leak!
}
```

**Solution 1: Use rxMethod (Recommended)**

```typescript
// In Store
loadIssues: rxMethod<string>(
  pipe(
    switchMap(projectId => issueService.getIssues(projectId)),
    tap(issues => patchState(store, { issues }))
  )
)

// In Component
ngOnInit() {
  this.store.loadIssues(projectId);
  // ✅ Automatically cleaned up
}
```

**Solution 2: Use takeUntilDestroyed**

```typescript
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export class MyComponent {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.issueService
      .getIssues()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((issues) => {
        // ...
      });
    // ✅ Automatically unsubscribed on destroy
  }
}
```

### 2.5. Drag & Drop Not Working

**Problem:**

```html
<!-- Issues not draggable -->
<div cdkDrag>Issue</div>
```

**Solution:**

**Check 1: Import CDK modules**

```typescript
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';

@Component({
  imports: [CdkDrag, CdkDropList, ...]
})
```

**Check 2: Proper structure**

```html
<div cdkDropList [cdkDropListData]="issues()" (cdkDropListDropped)="drop($event)">
  @for (issue of issues(); track issue.id) {
  <div cdkDrag [cdkDragData]="issue">{{ issue.title }}</div>
  }
</div>
```

**Check 3: Connect lists for cross-column drag**

```html
<div
  cdkDropList
  #todoList="cdkDropList"
  [cdkDropListData]="todoIssues()"
  [cdkDropListConnectedTo]="[inProgressList, doneList]"
>
  <!-- ... -->
</div>

<div
  cdkDropList
  #inProgressList="cdkDropList"
  [cdkDropListData]="inProgressIssues()"
  [cdkDropListConnectedTo]="[todoList, doneList]"
>
  <!-- ... -->
</div>
```

### 2.6. Avatar Không Hiển Thị Sau F5

**Problem:**

```
Issues load nhưng không có avatar của assignee
```

**Solution:**

**Root cause:** Projects chưa load → Members chưa có data

**Fix:**

```typescript
// In Board component constructor
constructor() {
  effect(() => {
    const user = this.authStore.user();

    // Auto-load projects if missing
    if (user && this.projectsStore.projects().length === 0) {
      this.projectsStore.loadProjects(user.uid);
    }
  });
}
```

### 2.7. Firestore Query Returns Empty

**Problem:**

```typescript
// Query returns empty array
const issues = await getDocs(
  query(collection(firestore, 'issues'), where('projectId', '==', projectId), orderBy('order'))
);
// issues.empty === true
```

**Solution:**

**Check 1: Create composite index**

```
Error: The query requires an index. Follow the link to create it:
https://console.firebase.google.com/...
```

→ Click link and create index

**Check 2: Data exists**

```typescript
// Check if documents exist
const allIssues = await getDocs(collection(firestore, 'issues'));
console.log('Total issues:', allIssues.size);
```

**Check 3: Field names match**

```typescript
// Make sure field names are correct
where('projectId', '==', projectId); // ✅
where('project_id', '==', projectId); // ❌ Wrong field name
```

---

## 3. Advanced Patterns

### 3.1. Undo/Redo Functionality

```typescript
type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export const createHistoryStore = <T>(initialState: T) => {
  return signalStore(
    withState<HistoryState<T>>({
      past: [],
      present: initialState,
      future: [],
    }),

    withMethods((store) => ({
      setState: (newState: T) => {
        patchState(store, {
          past: [...store.past(), store.present()],
          present: newState,
          future: [],
        });
      },

      undo: () => {
        const { past, present, future } = store;
        if (past().length === 0) return;

        const previous = past()[past().length - 1];
        const newPast = past().slice(0, -1);

        patchState(store, {
          past: newPast,
          present: previous,
          future: [present(), ...future()],
        });
      },

      redo: () => {
        const { past, present, future } = store;
        if (future().length === 0) return;

        const next = future()[0];
        const newFuture = future().slice(1);

        patchState(store, {
          past: [...past(), present()],
          present: next,
          future: newFuture,
        });
      },
    })),

    withComputed((store) => ({
      canUndo: computed(() => store.past().length > 0),
      canRedo: computed(() => store.future().length > 0),
    }))
  );
};

// Usage
const BoardHistoryStore = createHistoryStore<Issue[]>([]);

// In component
updateIssue(issue: Issue) {
  const newIssues = this.store.issues().map(i =>
    i.id === issue.id ? issue : i
  );
  this.historyStore.setState(newIssues);
}

undo() {
  this.historyStore.undo();
  this.store.patchState({ issues: this.historyStore.present() });
}
```

### 3.2. Debounced Search

```typescript
import { debounceTime, distinctUntilChanged } from 'rxjs';

export const BoardStore = signalStore(
  withState(initialState),

  withMethods((store) => ({
    // Debounced search
    searchIssues: rxMethod<string>(
      pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(), // Only if value changed
        tap(query => {
          patchState(store, {
            filter: { ...store.filter(), searchQuery: query }
          });
        })
      )
    ),
  }))
);

// In component
<input
  type="text"
  (input)="store.searchIssues($any($event.target).value)"
/>
```

### 3.3. Pagination

```typescript
type PaginationState = {
  items: Issue[];
  pageSize: number;
  currentPage: number;
  totalItems: number;
};

export const PaginatedBoardStore = signalStore(
  withState<PaginationState>({
    items: [],
    pageSize: 20,
    currentPage: 1,
    totalItems: 0,
  }),

  withComputed(({ items, pageSize, currentPage }) => ({
    paginatedItems: computed(() => {
      const start = (currentPage() - 1) * pageSize();
      const end = start + pageSize();
      return items().slice(start, end);
    }),

    totalPages: computed(() => Math.ceil(items().length / pageSize())),

    hasNextPage: computed(() => currentPage() < Math.ceil(items().length / pageSize())),

    hasPreviousPage: computed(() => currentPage() > 1),
  })),

  withMethods((store) => ({
    nextPage: () => {
      if (store.hasNextPage()) {
        patchState(store, { currentPage: store.currentPage() + 1 });
      }
    },

    previousPage: () => {
      if (store.hasPreviousPage()) {
        patchState(store, { currentPage: store.currentPage() - 1 });
      }
    },

    goToPage: (page: number) => {
      patchState(store, { currentPage: page });
    },
  }))
);
```

### 3.4. Caching Strategy

```typescript
type CachedData<T> = {
  data: T;
  timestamp: number;
  expiresIn: number; // milliseconds
};

export const createCachedStore = <T>(
  initialData: T,
  expiresIn: number = 5 * 60 * 1000 // 5 minutes
) => {
  return signalStore(
    withState<CachedData<T>>({
      data: initialData,
      timestamp: 0,
      expiresIn,
    }),

    withComputed((store) => ({
      isExpired: computed(() => {
        const now = Date.now();
        return now - store.timestamp() > store.expiresIn();
      }),
    })),

    withMethods((store) => ({
      setData: (data: T) => {
        patchState(store, {
          data,
          timestamp: Date.now(),
        });
      },

      invalidate: () => {
        patchState(store, { timestamp: 0 });
      },
    }))
  );
};

// Usage
const ProjectsCacheStore = createCachedStore<Project[]>([], 5 * 60 * 1000);

async loadProjects(userId: string) {
  // Check cache first
  if (!this.cacheStore.isExpired()) {
    console.log('Using cached data');
    return this.cacheStore.data();
  }

  // Fetch fresh data
  const projects = await this.projectsService.getProjects(userId);
  this.cacheStore.setData(projects);
  return projects;
}
```

---

## 4. Migration Guide

### 4.1. From RxJS BehaviorSubject to Signals

**Before (RxJS):**

```typescript
export class OldBoardService {
  private issuesSubject = new BehaviorSubject<Issue[]>([]);
  issues$ = this.issuesSubject.asObservable();

  loadIssues(projectId: string) {
    this.http.get<Issue[]>(`/api/issues?projectId=${projectId}`)
      .subscribe(issues => {
        this.issuesSubject.next(issues);
      });
  }

  addIssue(issue: Issue) {
    const current = this.issuesSubject.value;
    this.issuesSubject.next([...current, issue]);
  }
}

// Component
export class OldBoard {
  issues$ = this.boardService.issues$;

  ngOnInit() {
    this.boardService.loadIssues(this.projectId);
  }
}

// Template
<div *ngFor="let issue of issues$ | async">
  {{ issue.title }}
</div>
```

**After (Signals):**

```typescript
export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState({ issues: [] }),

  withMethods((store, http = inject(HttpClient)) => ({
    loadIssues: rxMethod<string>(
      pipe(
        switchMap(projectId =>
          http.get<Issue[]>(`/api/issues?projectId=${projectId}`)
        ),
        tap(issues => patchState(store, { issues }))
      )
    ),

    addIssue: (issue: Issue) => {
      patchState(store, {
        issues: [...store.issues(), issue]
      });
    },
  }))
);

// Component
export class NewBoard {
  store = inject(BoardStore);

  ngOnInit() {
    this.store.loadIssues(this.projectId);
  }
}

// Template
@for (issue of store.issues(); track issue.id) {
  {{ issue.title }}
}
```

**Benefits:**

- ✅ No need for `async` pipe
- ✅ No memory leaks (no manual unsubscribe)
- ✅ Better performance
- ✅ Simpler code

### 4.2. From NgRx Store to NgRx Signals

**Before (NgRx Store):**

```typescript
// Actions
export const loadIssues = createAction('[Board] Load Issues', props<{ projectId: string }>());

export const loadIssuesSuccess = createAction(
  '[Board] Load Issues Success',
  props<{ issues: Issue[] }>()
);

// Reducer
export const boardReducer = createReducer(
  initialState,
  on(loadIssues, (state) => ({ ...state, loading: true })),
  on(loadIssuesSuccess, (state, { issues }) => ({
    ...state,
    issues,
    loading: false,
  }))
);

// Effects
export class BoardEffects {
  loadIssues$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loadIssues),
      switchMap(({ projectId }) =>
        this.issueService.getIssues(projectId).pipe(map((issues) => loadIssuesSuccess({ issues })))
      )
    )
  );
}

// Selectors
export const selectIssues = createSelector(selectBoardState, (state) => state.issues);

// Component
export class Board {
  issues$ = this.store.select(selectIssues);

  ngOnInit() {
    this.store.dispatch(loadIssues({ projectId: this.projectId }));
  }
}
```

**After (NgRx Signals):**

```typescript
export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState({ issues: [], loading: false }),

  withMethods((store, issueService = inject(IssueService)) => ({
    loadIssues: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((projectId) => issueService.getIssues(projectId)),
        tap((issues) => patchState(store, { issues, loading: false }))
      )
    ),
  }))
);

// Component
export class Board {
  store = inject(BoardStore);

  ngOnInit() {
    this.store.loadIssues(this.projectId);
  }
}
```

**Benefits:**

- ✅ 90% less boilerplate
- ✅ No actions, reducers, effects, selectors
- ✅ Easier to understand
- ✅ Still type-safe

---

## 📚 Tài Liệu Bổ Sung

### Debugging Tools

**1. Angular DevTools**

```bash
# Install Chrome extension
# Then open DevTools → Angular tab
# View component tree and signals
```

**2. Redux DevTools (for NgRx Signals)**

```typescript
// app.config.ts
import { provideStoreDevtools } from '@ngrx/store-devtools';

export const appConfig = {
  providers: [provideStoreDevtools({ maxAge: 25 })],
};
```

**3. Firebase Emulator**

```bash
# Install
npm install -g firebase-tools

# Init
firebase init emulators

# Run
firebase emulators:start
```

### Performance Monitoring

```typescript
// Measure signal computation time
effect(() => {
  const start = performance.now();
  const result = expensiveComputation();
  const end = performance.now();
  console.log(`Computation took ${end - start}ms`);
});

// Track re-renders
let renderCount = 0;
effect(() => {
  renderCount++;
  console.log(`Component rendered ${renderCount} times`);
});
```

---

**Tác giả:** [Your Name]
**Ngày cập nhật:** 2026-01-07
**Phiên bản:** 1.0.0
