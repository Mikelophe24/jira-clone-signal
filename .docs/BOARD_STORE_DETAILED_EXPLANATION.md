# 🗄️ Board Store - Giải Thích Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#tổng-quan)
2. [Type Definitions](#type-definitions)
3. [Store Structure](#store-structure)
4. [Computed Signals](#computed-signals)
5. [Methods Deep Dive](#methods-deep-dive)
6. [Drag & Drop Logic](#drag--drop-logic)
7. [Optimistic Updates](#optimistic-updates)
8. [Error Handling](#error-handling)
9. [Performance Optimization](#performance-optimization)

---

## 🎯 Tổng Quan

**BoardStore** là NgRx Signal Store quản lý toàn bộ state cho Kanban Board, bao gồm:

### **Trách Nhiệm Chính**

1. 📊 **State Management**: Quản lý issues và filters
2. 🔍 **Filtering & Sorting**: Filter và sort issues theo nhiều criteria
3. 🖱️ **Drag & Drop**: Xử lý logic di chuyển issues
4. ⚡ **Optimistic Updates**: Update UI ngay lập tức, sync với Firestore sau
5. 🔄 **Real-time Sync**: Tự động cập nhật khi Firestore thay đổi

### **File Size: 276 dòng**

```
Imports & Types:    48 lines (17%)
Computed Signals:   48 lines (17%)
Methods:           160 lines (58%)
Hooks:              20 lines (8%)
```

---

## 📝 Type Definitions

### **Dòng 21-29: BoardFilter Type**

```typescript
type BoardFilter = {
  searchQuery: string;
  onlyMyIssues: boolean;
  ignoreResolved: boolean;
  userId: string | null;
  assignee: string[];
  status: string[];
  priority: string[];
};
```

**Chi tiết từng field:**

#### **searchQuery: string**

```typescript
searchQuery: 'bug';

// Filter issues where:
// - title contains "bug" (case-insensitive)
// - OR key contains "bug"
```

#### **onlyMyIssues: boolean**

```typescript
onlyMyIssues: true;
userId: 'abc123';

// Filter issues where:
// - assigneeId === userId
```

#### **ignoreResolved: boolean**

```typescript
ignoreResolved: true;

// Filter issues where:
// - status !== 'Done'
// (Currently commented out in code)
```

#### **userId: string | null**

```typescript
userId: 'abc123'; // Current user ID for onlyMyIssues filter
```

#### **assignee: string[]**

```typescript
assignee: ['user1', 'user2'];

// Filter issues where:
// - assigneeId in ["user1", "user2"]
```

#### **status: string[]**

```typescript
status: ['todo', 'in-progress'];

// Filter issues where:
// - statusColumnId in ["todo", "in-progress"]
// (Excludes "done")
```

#### **priority: string[]**

```typescript
priority: ['high', 'medium'];

// Filter issues where:
// - priority in ["high", "medium"]
// (Excludes "low")
```

---

### **Dòng 31-34: BoardState Type**

```typescript
type BoardState = {
  issues: Issue[];
  filter: BoardFilter;
};
```

**Đơn giản nhưng mạnh mẽ:**

- **issues**: Mảng tất cả issues từ Firestore
- **filter**: Current filter settings

**Tại sao không lưu filtered issues?**

```typescript
// ❌ BAD: Lưu filtered issues trong state
type BoardState = {
  issues: Issue[];
  filteredIssues: Issue[];  // Duplicate data!
  filter: BoardFilter;
};

// ✅ GOOD: Dùng computed signals
type BoardState = {
  issues: Issue[];  // Source of truth
  filter: BoardFilter;
};

// Computed signals tự động derive:
filteredIssues = computed(() => /* filter logic */);
todoIssues = computed(() => /* filter by status */);
```

**Ưu điểm:**

- ✅ Single source of tnruth
- ✅ No data duplicatio
- ✅ Auto-update khi issues hoặc filter thay đổi

---

### **Dòng 36-47: Initial State**

```typescript
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
```

**Default state khi store khởi tạo:**

- Empty issues array
- No filters applied (show all issues)

---

## 🏗️ Store Structure

### **Dòng 49-275: signalStore Definition**

```typescript
export const BoardStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(({ issues, filter }) => { ... }),
  withMethods((store, issueService, errorService) => ({ ... })),
  withHooks({ onInit(store) { ... } })
);
```

**Cấu trúc:**

```
signalStore
  ├─ providedIn: 'root' (Singleton)
  ├─ withLoadingError() (Custom feature)
  ├─ withState(initialState)
  ├─ withComputed() (Derived state)
  ├─ withMethods() (Actions)
  └─ withHooks() (Lifecycle)
```

---

### **{ providedIn: 'root' }**

```typescript
{
  providedIn: 'root';
}
```

**Singleton pattern:**

- ✅ Chỉ có 1 instance trong toàn app
- ✅ Shared state giữa các components
- ✅ Tự động inject vào root injector

**Ví dụ:**

```typescript
// Component A
export class BoardComponent {
  store = inject(BoardStore); // Instance #1
}

// Component B
export class BacklogComponent {
  store = inject(BoardStore); // Same instance #1
}
```

---

### **withLoadingError()**

```typescript
withLoadingError();
```

**Custom feature cung cấp:**

```typescript
// State
loading: signal<boolean>
error: signal<string | null>

// Methods
setLoading(loading: boolean)
setError(error: string | null)
```

**Usage:**

```typescript
store.setLoading(true);
// ... load data
store.setLoading(false);

if (error) {
  store.setError('Failed to load issues');
}
```

---

## 🧮 Computed Signals

### **Dòng 53-96: withComputed**

```typescript
withComputed(({ issues, filter }) => {
  const filteredIssues = computed(() => { ... });
  const sortedFilteredIssues = computed(() => { ... });

  return {
    todoIssues: computed(() => ...),
    inProgressIssues: computed(() => ...),
    doneIssues: computed(() => ...),
  };
})
```

**Hierarchy:**

```
issues (signal)
   ↓
filteredIssues (computed)
   ↓
sortedFilteredIssues (computed)
   ↓
┌─────────────┬──────────────────┬─────────────┐
│ todoIssues  │ inProgressIssues │ doneIssues  │
└─────────────┴──────────────────┴─────────────┘
```

---

### **A. filteredIssues (Dòng 55-82)**

```typescript
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
```

**Phân tích từng filter:**

#### **1. matchesSearch**

```typescript
const matchesSearch =
  issue.title.toLowerCase().includes(query) || issue.key.toLowerCase().includes(query);
```

**Ví dụ:**

```typescript
searchQuery = "bug"

Issue 1: { title: "Fix login bug", key: "PROJ-123" }
  → "fix login bug".includes("bug") = true ✅

Issue 2: { title: "Add feature", key: "BUG-456" }
  → "add feature".includes("bug") = false
  → "bug-456".includes("bug") = true ✅

Issue 3: { title: "Update docs", key: "PROJ-789" }
  → false ❌
```

---

#### **2. matchesUser**

```typescript
const matchesUser = onlyMyIssues ? issue.assigneeId === userId : true;
```

**Logic:**

```typescript
if (onlyMyIssues === true) {
  // Chỉ show issues assigned to current user
  return issue.assigneeId === userId;
} else {
  // Show all issues
  return true;
}
```

**Ví dụ:**

```typescript
onlyMyIssues = true
userId = "abc123"

Issue 1: { assigneeId: "abc123" } → true ✅
Issue 2: { assigneeId: "xyz789" } → false ❌
Issue 3: { assigneeId: null }     → false ❌
```

---

#### **3. matchesAssignee**

```typescript
const matchesAssignee =
  assignee.length === 0 || (issue.assigneeId && assignee.includes(issue.assigneeId));
```

**Logic:**

```typescript
if (assignee.length === 0) {
  // No assignee filter → show all
  return true;
} else {
  // Filter by selected assignees
  return issue.assigneeId && assignee.includes(issue.assigneeId);
}
```

**Ví dụ:**

```typescript
assignee = ["user1", "user2"]

Issue 1: { assigneeId: "user1" } → true ✅
Issue 2: { assigneeId: "user3" } → false ❌
Issue 3: { assigneeId: null }    → false ❌

assignee = []  // No filter
Issue 1: { assigneeId: "user1" } → true ✅
Issue 2: { assigneeId: "user3" } → true ✅
Issue 3: { assigneeId: null }    → true ✅
```

---

#### **4. matchesStatus**

```typescript
const matchesStatus = status.length === 0 || status.includes(issue.statusColumnId);
```

**Ví dụ:**

```typescript
status = ["todo", "in-progress"]

Issue 1: { statusColumnId: "todo" }        → true ✅
Issue 2: { statusColumnId: "in-progress" } → true ✅
Issue 3: { statusColumnId: "done" }        → false ❌
```

---

#### **5. matchesPriority**

```typescript
const matchesPriority = priority.length === 0 || priority.includes(issue.priority);
```

**Ví dụ:**

```typescript
priority = ["high"]

Issue 1: { priority: "high" }   → true ✅
Issue 2: { priority: "medium" } → false ❌
Issue 3: { priority: "low" }    → false ❌
```

---

#### **6. isNotBacklog**

```typescript
const isNotBacklog = !issue.isInBacklog;
```

**Board chỉ hiển thị issues KHÔNG ở backlog:**

```typescript
Issue 1: { isInBacklog: false } → true ✅ (show on board)
Issue 2: { isInBacklog: true }  → false ❌ (hide, show in backlog page)
```

---

#### **Combined Filter**

```typescript
return (
  matchesSearch &&
  matchesUser &&
  matchesAssignee &&
  matchesStatus &&
  matchesPriority &&
  isNotBacklog
);
```

**Tất cả conditions phải TRUE:**

```typescript
Issue must satisfy ALL:
  ✅ Title/key contains search query
  ✅ Assigned to current user (if onlyMyIssues)
  ✅ Assignee in selected list (if filter applied)
  ✅ Status in selected list (if filter applied)
  ✅ Priority in selected list (if filter applied)
  ✅ NOT in backlog
```

---

### **B. sortedFilteredIssues (Dòng 84-87)**

```typescript
const sortedFilteredIssues = computed(() => {
  // Tạo một bản sao trước khi sắp xếp để tránh làm thay đổi trạng thái gốc
  return [...filteredIssues()].sort((a, b) => a.order - b.order);
});
```

**Tại sao spread operator `[...]`?**

```typescript
// ❌ BAD: Mutate original array
filteredIssues().sort((a, b) => a.order - b.order);
// → Thay đổi array gốc (side effect!)

// ✅ GOOD: Create copy first
[...filteredIssues()].sort((a, b) => a.order - b.order);
// → Không ảnh hưởng array gốc
```

**Sort by order field:**

```typescript
Issues before sort:
[
  { id: "1", order: 2000 },
  { id: "2", order: 1000 },
  { id: "3", order: 3000 }
]

After sort (ascending):
[
  { id: "2", order: 1000 },
  { id: "1", order: 2000 },
  { id: "3", order: 3000 }
]
```

---

### **C. Column Signals (Dòng 89-95)**

```typescript
return {
  todoIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo')),
  inProgressIssues: computed(() =>
    sortedFilteredIssues().filter((i) => i.statusColumnId === 'in-progress')
  ),
  doneIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'done')),
};
```

**3 computed signals cho 3 columns:**

```typescript
sortedFilteredIssues = [
  { id: '1', statusColumnId: 'todo', order: 1000 },
  { id: '2', statusColumnId: 'in-progress', order: 2000 },
  { id: '3', statusColumnId: 'todo', order: 3000 },
  { id: '4', statusColumnId: 'done', order: 4000 },
];

todoIssues = [
  { id: '1', statusColumnId: 'todo', order: 1000 },
  { id: '3', statusColumnId: 'todo', order: 3000 },
];

inProgressIssues = [{ id: '2', statusColumnId: 'in-progress', order: 2000 }];

doneIssues = [{ id: '4', statusColumnId: 'done', order: 4000 }];
```

**Reactivity chain:**

```
issues signal thay đổi
   ↓
filteredIssues re-compute
   ↓
sortedFilteredIssues re-compute
   ↓
todoIssues, inProgressIssues, doneIssues re-compute
   ↓
Template re-render
```

---

## 🛠️ Methods Deep Dive

### **Dòng 97-262: withMethods**

```typescript
withMethods(
  (
    store,
    issueService: IssueService = inject(IssueService),
    errorService: ErrorNotificationService = inject(ErrorNotificationService)
  ) => ({
    updateFilter,
    loadIssues,
    moveIssue,
    addIssue,
    deleteIssue,
    updateIssue,
  })
);
```

**6 methods chính:**

---

### **A. updateFilter (Dòng 103-109)**

```typescript
updateFilter: (newFilter: Partial<BoardFilter>) => {
  patchState(store, (state) =>
    produce(state, (draft) => {
      Object.assign(draft.filter, newFilter);
    })
  );
};
```

**Sử dụng Immer's `produce`:**

```typescript
// Without Immer (manual immutability)
patchState(store, {
  filter: {
    ...store.filter(),
    ...newFilter,
  },
});

// With Immer (mutable-style code)
patchState(store, (state) =>
  produce(state, (draft) => {
    Object.assign(draft.filter, newFilter);
  })
);
```

**Ví dụ:**

```typescript
// Current state
filter = {
  searchQuery: '',
  onlyMyIssues: false,
  assignee: [],
  ...
}

// Update
store.updateFilter({ searchQuery: 'bug', onlyMyIssues: true });

// New state
filter = {
  searchQuery: 'bug',
  onlyMyIssues: true,
  assignee: [],
  ...
}
```

**Luồng:**

```
updateFilter({ searchQuery: 'bug' })
   ↓
patchState updates filter signal
   ↓
filteredIssues computed re-run
   ↓
Filter issues where title/key contains 'bug'
   ↓
sortedFilteredIssues re-compute
   ↓
todoIssues, inProgressIssues, doneIssues re-compute
   ↓
Template re-render với filtered issues
```

---

### **B. loadIssues (Dòng 110-134)**

```typescript
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
          patchState(store, { issues });
          store.setLoading(false);
        }),
        catchError((error) => {
          const errorMessage = error?.message || 'Failed to load issues';
          errorService.showError(errorMessage);
          return of([]);
        })
      );
    })
  )
);
```

**rxMethod pattern:**

```typescript
// rxMethod tự động:
// 1. Subscribe to input stream
// 2. Unsubscribe khi component destroy
// 3. Handle multiple calls (switchMap cancels previous)

loadIssues: rxMethod<string | null>(
  pipe()
  // RxJS operators
);

// Usage:
store.loadIssues(projectId); // Trigger load
```

**Luồng chi tiết:**

```
1. store.loadIssues('abc123') called
   ↓
2. tap(() => store.setLoading(true))
   → Set loading = true
   → Show spinner in UI
   ↓
3. switchMap((projectId) => ...)
   → Cancel previous request if any
   ↓
4. if (!projectId) → Clear issues and return
   ↓
5. issueService.getIssues(projectId)
   → Call Firestore collectionData()
   → Return Observable<Issue[]>
   ↓
6. tap((issues) => ...)
   → patchState(store, { issues })
   → Update issues signal
   → store.setLoading(false)
   → Hide spinner
   ↓
7. Computed signals auto-update
   → filteredIssues
   → sortedFilteredIssues
   → todoIssues, inProgressIssues, doneIssues
   ↓
8. Template re-render
   → Display issues in columns
```

**Error handling:**

```typescript
catchError((error) => {
  const errorMessage = error?.message || 'Failed to load issues';
  errorService.showError(errorMessage);
  return of([]); // Return empty array to prevent stream break
});
```

**switchMap behavior:**

```
User navigate to Project A
   ↓
loadIssues('project-a') starts
   ↓ (loading...)
User quickly navigate to Project B
   ↓
loadIssues('project-b') starts
   ↓
switchMap CANCELS 'project-a' request
   ↓
Only 'project-b' request completes
   ↓
Prevents race condition ✅
```

---

### **C. moveIssue (Dòng 135-219)**

**Đây là method phức tạp nhất!** Xử lý 2 scenarios:

1. **Reorder trong cùng column**
2. **Move giữa các columns**

Tôi sẽ phân tích chi tiết ở phần [Drag & Drop Logic](#drag--drop-logic).

---

### **D. addIssue (Dòng 220-228)**

```typescript
addIssue: async (issue: Partial<Issue>) => {
  try {
    await issueService.addIssue(issue);
    errorService.showSuccess('Issue created successfully');
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to add issue';
    errorService.showError(errorMessage);
  }
};
```

**Luồng:**

```
1. store.addIssue({ title: "Fix bug", ... })
   ↓
2. issueService.addIssue(issue)
   → Firestore addDoc()
   ↓
3. Document created in Firestore
   ↓
4. collectionData() detects change (trong loadIssues)
   ↓
5. Observable emits new issues array
   ↓
6. tap() updates store.issues signal
   ↓
7. Computed signals re-compute
   ↓
8. Template re-render
   ↓
9. New issue appears in column
   ↓
10. Show success notification
```

**Tại sao không optimistic update?**

```typescript
// Current: Wait for Firestore
await issueService.addIssue(issue);
// → Firestore generates ID
// → collectionData() emits với ID mới
// → UI updates

// Nếu optimistic:
const tempId = 'temp-' + Date.now();
patchState(store, {
  issues: [...store.issues(), { ...issue, id: tempId }],
});
await issueService.addIssue(issue);
// → Phải replace tempId với real ID
// → Phức tạp hơn, không cần thiết vì add nhanh
```

---

### **E. deleteIssue (Dòng 229-237)**

```typescript
deleteIssue: async (issueId: string) => {
  try {
    await issueService.deleteIssue(issueId);
    errorService.showSuccess('Issue deleted successfully');
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to delete issue';
    errorService.showError(errorMessage);
  }
};
```

**Luồng:**

```
1. store.deleteIssue('issue-123')
   ↓
2. issueService.deleteIssue('issue-123')
   → Firestore deleteDoc()
   ↓
3. Document deleted in Firestore
   ↓
4. collectionData() detects change
   ↓
5. Observable emits new issues array (without deleted issue)
   ↓
6. tap() updates store.issues signal
   ↓
7. Computed signals re-compute
   ↓
8. Template re-render
   ↓
9. Issue disappears from column
   ↓
10. Show success notification
```

**Cũng không optimistic update:**

```typescript
// Lý do tương tự addIssue
// Delete nhanh, không cần optimistic
// collectionData() tự động update UI
```

---

### **F. updateIssue (Dòng 238-261)**

```typescript
updateIssue: async (issueId: string, updates: Partial<Issue>) => {
  // Lưu trạng thái gốc để có thể hoàn tác (rollback) nếu cần
  const originalIssues = [...store.issues()];

  // Cập nhật lạc quan (Optimistic Update)
  patchState(store, (state) =>
    produce(state, (draft) => {
      const issue = draft.issues.find((i) => i.id === issueId);
      if (issue) {
        Object.assign(issue, updates);
      }
    })
  );

  try {
    await issueService.updateIssue(issueId, updates);
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to update issue';
    errorService.showError(errorMessage);
    // Hoàn tác cập nhật lạc quan nếu xảy ra lỗi
    patchState(store, { issues: originalIssues });
  }
};
```

**Optimistic Update Pattern!**

**Luồng thành công:**

```
1. store.updateIssue('issue-123', { title: 'New title' })
   ↓
2. Save original state: originalIssues = [...store.issues()]
   ↓
3. Optimistic update:
   patchState → Find issue → Update locally
   ↓
4. UI updates IMMEDIATELY (không đợi Firestore)
   ↓
5. issueService.updateIssue()
   → Firestore updateDoc()
   ↓
6. Success → Keep optimistic update
   ↓
7. collectionData() confirms change
```

**Luồng lỗi:**

```
1. store.updateIssue('issue-123', { title: 'New title' })
   ↓
2. Save original state
   ↓
3. Optimistic update → UI shows new title
   ↓
4. issueService.updateIssue()
   → Firestore updateDoc() FAILS
   ↓
5. catch block:
   → Show error message
   → patchState(store, { issues: originalIssues })
   → ROLLBACK to original state
   ↓
6. UI reverts to old title
```

**Ví dụ:**

```
User edits issue title: "Fix bug" → "Fix login bug"
   ↓
Optimistic update: UI shows "Fix login bug" IMMEDIATELY
   ↓
Firestore update in background
   ↓
If success: Keep "Fix login bug" ✅
If error: Revert to "Fix bug" ❌ + Show error
```

---

## 🖱️ Drag & Drop Logic

### **moveIssue Method (Dòng 135-219)**

**2 Scenarios:**

---

### **Scenario 1: Reorder trong cùng column (Dòng 139-169)**

```typescript
if (event.previousContainer === event.container) {
  // 1. Sắp xếp lại trong cùng một cột
  const columnIssues = [...event.container.data];
  moveItemInArray(columnIssues, event.previousIndex, event.currentIndex);

  // 2. Tính toán lại thứ tự (Order) cho cột này
  const updates: { id: string; data: Partial<Issue> }[] = [];

  columnIssues.forEach((issue, index) => {
    const newOrder = index * 1000; // Thứ tự được giãn cách
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
      })
    );

    // 4. Cập nhật hàng loạt (Batch Update) lên Firestore
    issueService.batchUpdateIssues(updates);
  }
}
```

**Chi tiết từng bước:**

#### **Step 1: Reorder array**

```typescript
const columnIssues = [...event.container.data];
moveItemInArray(columnIssues, event.previousIndex, event.currentIndex);
```

**Ví dụ:**

```
Before drag:
TODO Column:
[0] Issue A (order: 0)
[1] Issue B (order: 1000)
[2] Issue C (order: 2000)

User drags Issue C to position 0:
previousIndex = 2
currentIndex = 0

After moveItemInArray:
[0] Issue C (order: 2000) ← Moved here
[1] Issue A (order: 0)
[2] Issue B (order: 1000)
```

---

#### **Step 2: Recalculate orders**

```typescript
columnIssues.forEach((issue, index) => {
  const newOrder = index * 1000;
  if (issue.order !== newOrder) {
    updates.push({ id: issue.id, data: { order: newOrder } });
  }
});
```

**Tại sao nhân 1000?**

```typescript
// Spacing cho phép insert giữa các items sau này
index * 1000:
  [0] → order: 0
  [1] → order: 1000
  [2] → order: 2000
  [3] → order: 3000

// Nếu cần insert giữa [1] và [2]:
// → order: 1500 (giữa 1000 và 2000)
```

**Ví dụ:**

```
After moveItemInArray:
[0] Issue C (order: 2000) → newOrder: 0    → Changed! Add to updates
[1] Issue A (order: 0)    → newOrder: 1000 → Changed! Add to updates
[2] Issue B (order: 1000) → newOrder: 2000 → Changed! Add to updates

updates = [
  { id: "C", data: { order: 0 } },
  { id: "A", data: { order: 1000 } },
  { id: "B", data: { order: 2000 } }
]
```

---

#### **Step 3: Optimistic Update**

```typescript
patchState(store, (state) =>
  produce(state, (draft) => {
    updates.forEach((update) => {
      const issue = draft.issues.find((i) => i.id === update.id);
      if (issue) {
        issue.order = update.data.order!;
      }
    });
  })
);
```

**Update local state ngay lập tức:**

```
store.issues before:
[
  { id: "A", order: 0, statusColumnId: "todo" },
  { id: "B", order: 1000, statusColumnId: "todo" },
  { id: "C", order: 2000, statusColumnId: "todo" }
]

After optimistic update:
[
  { id: "A", order: 1000, statusColumnId: "todo" },
  { id: "B", order: 2000, statusColumnId: "todo" },
  { id: "C", order: 0, statusColumnId: "todo" }
]

sortedFilteredIssues re-compute:
[
  { id: "C", order: 0 },     ← First
  { id: "A", order: 1000 },
  { id: "B", order: 2000 }
]

UI updates IMMEDIATELY
```

---

#### **Step 4: Batch Update Firestore**

```typescript
issueService.batchUpdateIssues(updates);
```

**Batch update = 1 network request:**

```typescript
// Without batch (3 requests):
await updateDoc(docC, { order: 0 });
await updateDoc(docA, { order: 1000 });
await updateDoc(docB, { order: 2000 });

// With batch (1 request):
const batch = writeBatch(firestore);
batch.update(docC, { order: 0 });
batch.update(docA, { order: 1000 });
batch.update(docB, { order: 2000 });
await batch.commit();
```

**Ưu điểm:**

- ✅ Faster (1 request thay vì 3)
- ✅ Atomic (all or nothing)
- ✅ Less Firestore reads/writes

---

### **Scenario 2: Move giữa columns (Dòng 170-218)**

```typescript
else {
  // 1. Di chuyển sang cột khác
  const movedIssue = event.item.data as Issue;
  const targetColumnIssues = [...event.container.data];

  // 2. Chèn vào mảng mục tiêu để tìm các mục lân cận
  targetColumnIssues.splice(event.currentIndex, 0, movedIssue);

  // 3. Tính toán thứ tự mới dựa trên các mục lân cận
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

  // 4. Cập nhật trạng thái cục bộ
  patchState(store, (state) =>
    produce(state, (draft) => {
      const issue = draft.issues.find((i) => i.id === movedIssue.id);
      if (issue) {
        issue.statusColumnId = newStatus;
        issue.order = newOrder;
      }
    })
  );

  // 5. Cập nhật lên Firestore
  issueService.updateIssue(movedIssue.id, {
    statusColumnId: newStatus,
    order: newOrder,
  });
}
```

**Chi tiết từng bước:**

#### **Step 1: Get moved issue**

```typescript
const movedIssue = event.item.data as Issue;
```

**event.item.data chứa issue được drag:**

```typescript
// Từ template:
<mat-card cdkDrag [cdkDragData]="issue">
  <!-- cdkDragData binds issue to drag item -->
</mat-card>

// Trong drop event:
const movedIssue = event.item.data;  // → issue object
```

---

#### **Step 2: Simulate insert**

```typescript
const targetColumnIssues = [...event.container.data];
targetColumnIssues.splice(event.currentIndex, 0, movedIssue);
```

**Tại sao?** Để tìm items lân cận (prevItem, nextItem).

**Ví dụ:**

```
IN PROGRESS Column (before):
[0] Issue X (order: 0)
[1] Issue Y (order: 2000)

User drops Issue B at position 1:
currentIndex = 1

After splice:
[0] Issue X (order: 0)
[1] Issue B (order: ???) ← Inserted here
[2] Issue Y (order: 2000)
```

---

#### **Step 3: Calculate new order**

```typescript
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
```

**4 Cases:**

##### **Case 1: Empty column**

```typescript
if (!prevItem && !nextItem) {
  newOrder = 0;
}
```

```
Column is empty:
[0] Issue B ← First item

newOrder = 0
```

---

##### **Case 2: Drop at beginning**

```typescript
else if (!prevItem) {
  newOrder = (nextItem.order || 0) - 1000;
}
```

```
Column:
[0] Issue B ← Drop here (no prevItem)
[1] Issue X (order: 1000)

newOrder = 1000 - 1000 = 0
```

---

##### **Case 3: Drop at end**

```typescript
else if (!nextItem) {
  newOrder = (prevItem.order || 0) + 1000;
}
```

```
Column:
[0] Issue X (order: 1000)
[1] Issue B ← Drop here (no nextItem)

newOrder = 1000 + 1000 = 2000
```

---

##### **Case 4: Drop in middle**

```typescript
else {
  newOrder = (prevItem.order + nextItem.order) / 2;
}
```

```
Column:
[0] Issue X (order: 1000)
[1] Issue B ← Drop here
[2] Issue Y (order: 3000)

newOrder = (1000 + 3000) / 2 = 2000
```

**Fractional orders:**

```
Column:
[0] Issue X (order: 1000)
[1] Issue B ← Drop here
[2] Issue Y (order: 2000)

newOrder = (1000 + 2000) / 2 = 1500

Result:
[0] Issue X (order: 1000)
[1] Issue B (order: 1500) ← Between X and Y
[2] Issue Y (order: 2000)
```

---

#### **Step 4: Optimistic Update**

```typescript
patchState(store, (state) =>
  produce(state, (draft) => {
    const issue = draft.issues.find((i) => i.id === movedIssue.id);
    if (issue) {
      issue.statusColumnId = newStatus;
      issue.order = newOrder;
    }
  })
);
```

**Update 2 fields:**

- **statusColumnId**: 'todo' → 'in-progress'
- **order**: New calculated order

**Luồng:**

```
store.issues before:
[
  { id: "B", statusColumnId: "todo", order: 1000 },
  { id: "X", statusColumnId: "in-progress", order: 0 },
  { id: "Y", statusColumnId: "in-progress", order: 2000 }
]

After optimistic update:
[
  { id: "B", statusColumnId: "in-progress", order: 1500 }, ← Updated
  { id: "X", statusColumnId: "in-progress", order: 0 },
  { id: "Y", statusColumnId: "in-progress", order: 2000 }
]

Computed signals re-compute:
todoIssues = []  ← Issue B removed
inProgressIssues = [
  { id: "X", order: 0 },
  { id: "B", order: 1500 },  ← Issue B added
  { id: "Y", order: 2000 }
]

UI updates IMMEDIATELY
```

---

#### **Step 5: Update Firestore**

```typescript
issueService.updateIssue(movedIssue.id, {
  statusColumnId: newStatus,
  order: newOrder,
});
```

**Single update (không batch vì chỉ 1 issue):**

```typescript
// Firestore updateDoc
await updateDoc(doc(firestore, 'issues', issueId), {
  statusColumnId: 'in-progress',
  order: 1500,
});
```

---

## ⚡ Optimistic Updates

### **Tại Sao Cần Optimistic Updates?**

**Without optimistic:**

```
User drags issue
   ↓
Wait for Firestore update (~200ms)
   ↓
collectionData() emits
   ↓
UI updates
   ↓
User sees lag 😞
```

**With optimistic:**

```
User drags issue
   ↓
Update local state IMMEDIATELY (~1ms)
   ↓
UI updates instantly ✨
   ↓
Firestore update in background (~200ms)
   ↓
collectionData() confirms (no visual change)
```

---

### **Optimistic Update Pattern**

```typescript
// 1. Save original state (for rollback)
const originalIssues = [...store.issues()];

// 2. Update local state immediately
patchState(store, (state) =>
  produce(state, (draft) => {
    // Mutate draft
  })
);

// 3. Update Firestore
try {
  await issueService.updateIssue(id, updates);
  // Success → Keep optimistic update
} catch (err) {
  // Error → Rollback
  patchState(store, { issues: originalIssues });
  errorService.showError(err.message);
}
```

---

### **Methods Sử Dụng Optimistic Updates**

| Method       | Optimistic? | Rollback?               |
| ------------ | ----------- | ----------------------- |
| updateFilter | ✅ Yes      | ❌ No (local only)      |
| loadIssues   | ❌ No       | N/A                     |
| moveIssue    | ✅ Yes      | ❌ No (assumes success) |
| addIssue     | ❌ No       | N/A                     |
| deleteIssue  | ❌ No       | N/A                     |
| updateIssue  | ✅ Yes      | ✅ Yes                  |

**Tại sao moveIssue không rollback?**

```typescript
// moveIssue assumes success
// Nếu fail, collectionData() sẽ revert về state cũ
// User sẽ thấy issue "jump back" (acceptable UX)

// updateIssue có rollback vì:
// - User edit form data (expect immediate feedback)
// - Rollback provides better UX for form edits
```

---

## 🔧 Error Handling

### **Error Handling Strategies**

#### **1. loadIssues - catchError**

```typescript
catchError((error) => {
  const errorMessage = error?.message || 'Failed to load issues';
  errorService.showError(errorMessage);
  return of([]); // Return empty array
});
```

**Tại sao return `of([])`?**

```typescript
// Without of([]):
catchError((error) => {
  errorService.showError(error.message);
  // Stream breaks → No more updates
});

// With of([]):
catchError((error) => {
  errorService.showError(error.message);
  return of([]); // Stream continues with empty array
});
```

---

#### **2. addIssue, deleteIssue - try/catch**

```typescript
try {
  await issueService.addIssue(issue);
  errorService.showSuccess('Issue created successfully');
} catch (err: any) {
  const errorMessage = err?.message || 'Failed to add issue';
  errorService.showError(errorMessage);
}
```

**Show error nhưng không rollback:**

```
Firestore add/delete fail
   ↓
Show error notification
   ↓
collectionData() không emit
   ↓
UI không thay đổi
   ↓
User có thể retry
```

---

#### **3. updateIssue - Rollback**

```typescript
const originalIssues = [...store.issues()];

patchState(store /* optimistic update */);

try {
  await issueService.updateIssue(issueId, updates);
} catch (err: any) {
  errorService.showError(err.message);
  patchState(store, { issues: originalIssues }); // Rollback
}
```

**Best UX cho form edits:**

```
User edits title
   ↓
Optimistic update → UI shows new title
   ↓
Firestore update fails
   ↓
Rollback → UI reverts to old title
   ↓
Show error
   ↓
User can re-edit
```

---

## 🚀 Performance Optimization

### **1. Computed Signal Chaining**

```typescript
issues (signal)
   ↓
filteredIssues (computed)
   ↓
sortedFilteredIssues (computed)
   ↓
todoIssues, inProgressIssues, doneIssues (computed)
```

**Tại sao không flat?**

```typescript
// ❌ BAD: Duplicate logic
todoIssues: computed(() => {
  const filtered = issues().filter(/* filter logic */);
  const sorted = filtered.sort(/* sort logic */);
  return sorted.filter(i => i.statusColumnId === 'todo');
});

inProgressIssues: computed(() => {
  const filtered = issues().filter(/* SAME filter logic */);
  const sorted = filtered.sort(/* SAME sort logic */);
  return sorted.filter(i => i.statusColumnId === 'in-progress');
});

// ✅ GOOD: Reuse intermediate signals
const filteredIssues = computed(() => /* filter once */);
const sortedFilteredIssues = computed(() => /* sort once */);

todoIssues: computed(() => sortedFilteredIssues().filter(...));
inProgressIssues: computed(() => sortedFilteredIssues().filter(...));
```

**Performance:**

```
issues change (100 items)
   ↓
filteredIssues re-compute (1 time)
   → Filter 100 items → 50 items
   ↓
sortedFilteredIssues re-compute (1 time)
   → Sort 50 items
   ↓
todoIssues re-compute (1 time)
   → Filter 50 items → 20 items
inProgressIssues re-compute (1 time)
   → Filter 50 items → 15 items
doneIssues re-compute (1 time)
   → Filter 50 items → 15 items

Total: 1 filter + 1 sort + 3 small filters
```

---

### **2. Immer for Immutability**

```typescript
import { produce } from 'immer';

patchState(store, (state) =>
  produce(state, (draft) => {
    const issue = draft.issues.find((i) => i.id === issueId);
    if (issue) {
      issue.order = newOrder; // Mutable-style code
    }
  })
);
```

**Tại sao dùng Immer?**

```typescript
// Without Immer (manual immutability):
patchState(store, {
  issues: store
    .issues()
    .map((issue) => (issue.id === issueId ? { ...issue, order: newOrder } : issue)),
});
// → Verbose, error-prone

// With Immer (mutable-style):
patchState(store, (state) =>
  produce(state, (draft) => {
    const issue = draft.issues.find((i) => i.id === issueId);
    if (issue) {
      issue.order = newOrder;
    }
  })
);
// → Clean, easy to read
// → Immer handles immutability internally
```

---

### **3. Batch Updates**

```typescript
// Reorder trong cùng column
issueService.batchUpdateIssues(updates);

// Instead of:
updates.forEach((update) => {
  issueService.updateIssue(update.id, update.data);
});
```

**Performance:**

```
Without batch:
  3 issues reordered
  → 3 Firestore requests
  → 3 network round-trips
  → ~600ms total

With batch:
  3 issues reordered
  → 1 Firestore batch request
  → 1 network round-trip
  → ~200ms total
```

---

### **4. switchMap for Request Cancellation**

```typescript
loadIssues: rxMethod<string | null>(
  pipe(
    switchMap((projectId) => {
      // Cancel previous request if new one comes
    })
  )
);
```

**Prevents race conditions:**

```
User navigates: Project A → Project B → Project C
   ↓
Without switchMap:
  Request A starts
  Request B starts (A still running)
  Request C starts (A, B still running)
  Response B arrives → Update UI
  Response C arrives → Update UI
  Response A arrives → Update UI (WRONG!)
  → UI shows Project A issues 😞

With switchMap:
  Request A starts
  Request B starts → Cancel A
  Request C starts → Cancel B
  Response C arrives → Update UI
  → UI shows Project C issues ✅
```

---

## 🎓 Tóm Tắt

### **BoardStore Làm Gì?**

1. **State Management**: Quản lý issues và filters
2. **Filtering**: Filter issues theo search, assignee, status, priority
3. **Sorting**: Sort issues theo order field
4. **Column Separation**: Tách issues thành 3 columns (TODO, IN PROGRESS, DONE)
5. **Drag & Drop**: Xử lý reorder và move giữa columns
6. **Optimistic Updates**: Update UI ngay lập tức
7. **Real-time Sync**: Tự động sync với Firestore

---

### **Key Concepts**

#### **Computed Signal Chain**

```
issues → filteredIssues → sortedFilteredIssues → column signals
```

#### **Optimistic Updates**

```
Update local state → Update UI → Sync Firestore → Confirm/Rollback
```

#### **Drag & Drop**

```
Same column: Batch update orders
Different column: Calculate new order between neighbors
```

---

### **Performance Optimizations**

- ✅ Computed signal chaining (no duplicate work)
- ✅ Immer for clean immutable updates
- ✅ Batch Firestore updates
- ✅ switchMap for request cancellation
- ✅ Spread operator for safe array mutations

---

### **Error Handling**

- ✅ catchError in loadIssues (keep stream alive)
- ✅ try/catch in CRUD methods
- ✅ Rollback in updateIssue
- ✅ User-friendly error messages

---

**Tạo bởi:** Antigravity AI Assistant  
**Ngày:** 2026-01-12
