# Sprint Workflow - Hướng dẫn toàn diện

## Mục lục

1. [Tổng quan về Sprint](#1-tổng-quan-về-sprint)
2. [Kiến trúc dữ liệu](#2-kiến-trúc-dữ-liệu)
3. [Luồng làm việc chi tiết](#3-luồng-làm-việc-chi-tiết)
4. [Các thành phần kỹ thuật](#4-các-thành-phần-kỹ-thuật)
5. [Quy trình từng bước](#5-quy-trình-từng-bước)
6. [Tương tác giữa các thành phần](#6-tương-tác-giữa-các-thành-phần)

---

## 1. Tổng quan về Sprint

### Sprint là gì?

Sprint là một khoảng thời gian cố định (thường 1-4 tuần) trong đó team phát triển hoàn thành một tập hợp các công việc đã được lên kế hoạch. Đây là đơn vị cơ bản trong phương pháp Scrum.

### Vòng đời của Sprint trong dự án

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   FUTURE    │ ───> │   ACTIVE    │ ───> │  COMPLETED  │
│  (Kế hoạch) │      │ (Đang chạy) │      │  (Kết thúc) │
└─────────────┘      └─────────────┘      └─────────────┘
```

### 3 trạng thái của Sprint

| Trạng thái    | Mô tả                                 | Hành động có thể thực hiện                                                    |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| **FUTURE**    | Sprint đã được tạo nhưng chưa bắt đầu | - Thêm/xóa issues<br>- Chỉnh sửa thông tin<br>- Start Sprint                  |
| **ACTIVE**    | Sprint đang được thực hiện            | - Di chuyển issues giữa các cột<br>- Cập nhật trạng thái<br>- Complete Sprint |
| **COMPLETED** | Sprint đã kết thúc                    | - Chỉ xem (read-only)<br>- Phân tích kết quả                                  |

---

## 2. Kiến trúc dữ liệu

### 2.1. Sprint Model

```typescript
export interface Sprint {
  id: string; // ID duy nhất (auto-generated bởi Firestore)
  projectId: string; // Sprint thuộc project nào
  name: string; // Tên sprint (VD: "Sprint 1", "Sprint 2")
  goal?: string; // Mục tiêu của sprint (optional)
  startDate: string; // Ngày bắt đầu (ISO String)
  endDate: string; // Ngày kết thúc (ISO String)
  status: 'active' | 'future' | 'completed'; // Trạng thái hiện tại
}
```

**Lưu trữ:** Collection `sprints` trong Firestore

### 2.2. Issue Model (đã cập nhật)

```typescript
export interface Issue {
  id: string;
  projectId: string;
  boardId: string;
  key: string; // VD: "PROJ-123"
  title: string;
  description: string;
  type: IssueType;
  statusColumnId: string; // 'todo', 'in-progress', 'done'
  priority: IssuePriority;

  // ⭐ Trường mới để liên kết với Sprint
  sprintId?: string | null; // null = trong Backlog, có giá trị = thuộc Sprint

  reporterId?: string;
  assigneeId?: string;
  order: number;
  comments?: Comment[];

  // ⭐ Xác định issue có nằm trong backlog không
  isInBacklog?: boolean; // true = ẩn khỏi Board, false = hiển thị trên Board

  dueDate?: string;
  subtasks?: Subtask[];
}
```

### 2.3. Mối quan hệ giữa Sprint và Issue

```
Project
  │
  ├── Sprint 1 (FUTURE)
  │     ├── Issue A (isInBacklog: true)
  │     └── Issue B (isInBacklog: true)
  │
  ├── Sprint 2 (ACTIVE) ⭐
  │     ├── Issue C (isInBacklog: false) → Hiển thị trên Board
  │     ├── Issue D (isInBacklog: false) → Hiển thị trên Board
  │     └── Issue E (isInBacklog: false) → Hiển thị trên Board
  │
  └── Backlog (sprintId: null)
        ├── Issue F (isInBacklog: true)
        └── Issue G (isInBacklog: true)
```

**Quy tắc quan trọng:**

- Một Issue chỉ thuộc về **một Sprint** hoặc **Backlog** tại một thời điểm
- `sprintId = null` → Issue nằm trong Backlog
- `sprintId = "xyz"` → Issue thuộc Sprint có ID "xyz"
- `isInBacklog = false` → Issue hiển thị trên Board (chỉ áp dụng cho Active Sprint)
- `isInBacklog = true` → Issue ẩn khỏi Board, chỉ thấy trong Backlog view

---

## 3. Luồng làm việc chi tiết

### 3.1. Workflow tổng quan

```
┌──────────────────────────────────────────────────────────────────┐
│                        BACKLOG PAGE                              │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ [Create Sprint] Button                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Sprint 1 (FUTURE)                    [Start Sprint]        │ │
│  │ ┌────────┐ ┌────────┐ ┌────────┐                          │ │
│  │ │Issue A │ │Issue B │ │Issue C │                          │ │
│  │ └────────┘ └────────┘ └────────┘                          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Backlog (5 issues)                   [Create Issue]        │ │
│  │ ┌────────┐ ┌────────┐ ┌────────┐                          │ │
│  │ │Issue D │ │Issue E │ │Issue F │ ...                      │ │
│  │ └────────┘ └────────┘ └────────┘                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

                            ↓ [Start Sprint]

┌──────────────────────────────────────────────────────────────────┐
│                         BOARD PAGE                               │
│                                                                  │
│  Sprint 1 (ACTIVE)                      [Complete Sprint]       │
│                                                                  │
│  ┌──────────┐      ┌──────────┐      ┌──────────┐             │
│  │  TODO    │      │IN PROGRESS│      │   DONE   │             │
│  ├──────────┤      ├──────────┤      ├──────────┤             │
│  │ Issue A  │      │ Issue B  │      │ Issue C  │             │
│  │          │      │          │      │          │             │
│  └──────────┘      └──────────┘      └──────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2. Chi tiết từng bước

#### Bước 1: Tạo Sprint mới

**Người dùng thực hiện:**

1. Vào trang **Backlog**
2. Click nút **"Create Sprint"**

**Hệ thống xử lý:**

```typescript
createSprint() {
  const projectId = this.projectsStore.selectedProjectId();
  const count = this.sprintStore.sprints().length;
  const name = `Sprint ${count + 1}`;

  this.sprintStore.addSprint({
    projectId,
    name,
    status: 'future',  // ⭐ Mặc định là FUTURE
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  });
}
```

**Kết quả:**

- Một Sprint mới xuất hiện ở đầu trang Backlog
- Trạng thái: **FUTURE**
- Chưa có Issue nào

---

#### Bước 2: Thêm Issues vào Sprint

**Cách 1: Kéo thả (Drag & Drop)**

```typescript
drop(event: CdkDragDrop<Issue[]>, targetSprintId: string | null) {
  // Transfer issue từ container này sang container khác
  transferArrayItem(
    event.previousContainer.data,
    event.container.data,
    event.previousIndex,
    event.currentIndex
  );

  const issue = event.item.data as Issue;
  const updates: Partial<Issue> = {
    sprintId: targetSprintId,  // ⭐ Gán Sprint ID
  };

  if (targetSprintId) {
    const sprint = this.sprintStore.sprints().find(s => s.id === targetSprintId);
    // Nếu kéo vào Active Sprint → hiển thị trên Board
    // Nếu kéo vào Future Sprint → vẫn ẩn trong Backlog
    updates.isInBacklog = sprint?.status !== 'active';
  }

  this.boardStore.updateIssue(issue.id, updates);
}
```

**Cách 2: Chọn Sprint khi tạo/sửa Issue**

Trong **Issue Dialog**, người dùng có thể chọn Sprint từ dropdown:

```html
<mat-form-field appearance="outline">
  <mat-label>Sprint</mat-label>
  <mat-select formControlName="sprintId">
    <mat-option [value]="null">Backlog</mat-option>
    @for (sprint of sprintStore.sprints(); track sprint.id) {
    <mat-option [value]="sprint.id"> {{ sprint.name }} ({{sprint.status}}) </mat-option>
    }
  </mat-select>
</mat-form-field>
```

---

#### Bước 3: Start Sprint

**Người dùng thực hiện:**

1. Click nút **"Start Sprint"** bên cạnh Sprint
2. Xác nhận trong dialog

**Hệ thống xử lý:**

```typescript
startSprint(sprint: any) {
  if (confirm(`Start ${sprint.name}?`)) {
    // 1. Cập nhật trạng thái Sprint → ACTIVE
    this.sprintStore.startSprint(sprint.id);

    // 2. Di chuyển tất cả Issues trong Sprint lên Board
    const issues = this.getSprintIssues(sprint.id);
    const updates = issues.map(i => ({
      id: i.id,
      data: { isInBacklog: false }  // ⭐ Hiển thị trên Board
    }));

    if (updates.length > 0) {
      this.issueService.batchUpdateIssues(updates);
    }
  }
}
```

**Kết quả:**

- Sprint chuyển sang trạng thái **ACTIVE**
- Tất cả Issues trong Sprint xuất hiện trên **Board**
- Chỉ có thể có **1 Active Sprint** tại một thời điểm

---

#### Bước 4: Làm việc trên Board

**Người dùng:**

- Vào tab **Board**
- Kéo thả Issues giữa các cột (TODO → IN PROGRESS → DONE)
- Cập nhật thông tin Issues

**Board chỉ hiển thị:**

```typescript
// Trong BoardStore
const filteredIssues = computed(() => {
  const activeSprintId = sprintStore.activeSprint()?.id;

  return issues().filter((issue) => {
    const matchesSprint = issue.sprintId ? issue.sprintId === activeSprintId : true;
    const isNotBacklog = !issue.isInBacklog;

    return isNotBacklog && matchesSprint;
  });
});
```

**Điều này có nghĩa:**

- Chỉ hiển thị Issues có `isInBacklog = false`
- Chỉ hiển thị Issues thuộc Active Sprint
- Issues trong Backlog hoặc Future Sprints **không hiển thị**

---

#### Bước 5: Complete Sprint

**Người dùng thực hiện:**

1. Quay lại trang **Backlog**
2. Click nút **"Complete Sprint"**
3. Xác nhận

**Hệ thống xử lý:**

```typescript
completeSprint(sprint: any) {
  if (confirm(`Complete ${sprint.name}?`)) {
    // 1. Cập nhật trạng thái Sprint → COMPLETED
    this.sprintStore.completeSprint(sprint.id);

    // 2. Xử lý Issues chưa hoàn thành
    const issues = this.getSprintIssues(sprint.id);
    const incompleteIssues = issues.filter(i => i.statusColumnId !== 'done');

    const updates = incompleteIssues.map(i => ({
      id: i.id,
      data: {
        isInBacklog: true,   // ⭐ Đẩy về Backlog
        sprintId: null       // ⭐ Gỡ khỏi Sprint
      }
    }));

    if (updates.length > 0) {
      this.issueService.batchUpdateIssues(updates);
    }
  }
}
```

**Kết quả:**

- Sprint chuyển sang trạng thái **COMPLETED**
- Issues đã hoàn thành (status = 'done') vẫn giữ nguyên
- Issues chưa hoàn thành được đẩy về **Backlog**
- Board trở nên trống (không còn Active Sprint)

---

## 4. Các thành phần kỹ thuật

### 4.1. SprintService

**Vai trò:** Giao tiếp với Firestore để thực hiện CRUD operations

```typescript
@Injectable({ providedIn: 'root' })
export class SprintService {
  private sprintsCollection = collection(this.firestore, 'sprints');

  // Lấy tất cả Sprints của một Project
  getSprints(projectId: string): Observable<Sprint[]> {
    const q = query(this.sprintsCollection, where('projectId', '==', projectId));
    return collectionData(q, { idField: 'id' }) as Observable<Sprint[]>;
  }

  // Tạo Sprint mới
  addSprint(sprint: Partial<Sprint>) {
    return addDoc(this.sprintsCollection, sprint);
  }

  // Cập nhật Sprint
  updateSprint(id: string, data: Partial<Sprint>) {
    const docRef = doc(this.firestore, 'sprints', id);
    return updateDoc(docRef, data);
  }

  // Xóa Sprint
  deleteSprint(id: string) {
    const docRef = doc(this.firestore, 'sprints', id);
    return deleteDoc(docRef);
  }

  // Helper: Bắt đầu Sprint
  startSprint(id: string) {
    return this.updateSprint(id, { status: 'active' });
  }

  // Helper: Kết thúc Sprint
  completeSprint(id: string) {
    return this.updateSprint(id, { status: 'completed' });
  }
}
```

---

### 4.2. SprintStore

**Vai trò:** Quản lý state của Sprints, cung cấp computed signals

```typescript
export const SprintStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState({ sprints: [] }),

  // ⭐ Computed Signals
  withComputed(({ sprints }) => ({
    // Sprint đang active (chỉ có 1)
    activeSprint: computed(() =>
      sprints().find(s => s.status === 'active')
    ),

    // Danh sách Future Sprints
    futureSprints: computed(() =>
      sprints().filter(s => s.status === 'future')
    ),

    // Danh sách Completed Sprints
    completedSprints: computed(() =>
      sprints().filter(s => s.status === 'completed')
    ),
  })),

  withMethods((store, sprintService, errorService) => ({
    // Load Sprints từ Firestore (real-time)
    loadSprints: rxMethod<string | null>(
      pipe(
        tap(() => store.setLoading(true)),
        switchMap((projectId) => {
          if (!projectId) return of([]);
          return sprintService.getSprints(projectId).pipe(
            tap((sprints) => {
              patchState(store, { sprints });
              store.setLoading(false);
            }),
            catchError((error) => {
              errorService.showError(error?.message);
              return of([]);
            })
          );
        })
      )
    ),

    addSprint: async (sprint: Partial<Sprint>) => { ... },
    updateSprint: async (id: string, updates: Partial<Sprint>) => { ... },
    deleteSprint: async (id: string) => { ... },
    startSprint: async (id: string) => { ... },
    completeSprint: async (id: string) => { ... },
  }))
);
```

---

### 4.3. BoardStore (đã cập nhật)

**Thay đổi quan trọng:** Filter Issues dựa trên Active Sprint

```typescript
withComputed(({ issues, filter }) => {
  const sprintStore = inject(SprintStore);

  const filteredIssues = computed(() => {
    const activeSprintId = sprintStore.activeSprint()?.id;

    return issues().filter((issue) => {
      // ... các filter khác (search, assignee, priority...)

      // ⭐ Chỉ hiển thị Issues thuộc Active Sprint
      const matchesSprint = issue.sprintId ? issue.sprintId === activeSprintId : true;

      const isNotBacklog = !issue.isInBacklog;

      return (
        matchesSearch &&
        matchesUser &&
        matchesAssignee &&
        matchesStatus &&
        matchesPriority &&
        isNotBacklog &&
        matchesSprint
      ); // ⭐ Thêm điều kiện mới
    });
  });

  return {
    todoIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo')),
    inProgressIssues: computed(() =>
      sortedFilteredIssues().filter((i) => i.statusColumnId === 'in-progress')
    ),
    doneIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'done')),
  };
});
```

---

### 4.4. Backlog Component

**Vai trò:** Giao diện quản lý Sprints và Backlog

**Computed Signals:**

```typescript
// Issues không thuộc Sprint nào (Backlog thuần túy)
backlogIssues = computed(() => {
  return this.boardStore.issues().filter((i) => !i.sprintId && i.isInBacklog);
});

// Map: Sprint ID → Danh sách Issues
sprintIssuesMap = computed(() => {
  const issues = this.boardStore.issues();
  const map = new Map<string, Issue[]>();

  issues.forEach((i) => {
    if (i.sprintId) {
      if (!map.has(i.sprintId)) map.set(i.sprintId, []);
      map.get(i.sprintId)!.push(i);
    }
  });

  return map;
});
```

**Template Structure:**

```html
<div class="backlog-container" cdkDropListGroup>
  <!-- Header -->
  <div class="header-actions">
    <h2>Backlog</h2>
    <button (click)="createSprint()">Create Sprint</button>
  </div>

  <!-- Sprints List -->
  @for (sprint of sprintStore.sprints(); track sprint.id) {
  <div class="sprint-container">
    <div class="sprint-header">
      <span>{{ sprint.name }}</span>
      <span class="badge">{{ sprint.status }}</span>

      @if (sprint.status === 'future') {
      <button (click)="startSprint(sprint)">Start Sprint</button>
      } @if (sprint.status === 'active') {
      <button (click)="completeSprint(sprint)">Complete Sprint</button>
      }
    </div>

    <!-- Issues trong Sprint (có thể kéo thả) -->
    <div
      cdkDropList
      [cdkDropListData]="getSprintIssues(sprint.id)"
      (cdkDropListDropped)="drop($event, sprint.id)"
    >
      @for (issue of getSprintIssues(sprint.id); track issue.id) {
      <div cdkDrag [cdkDragData]="issue">
        <!-- Issue card -->
      </div>
      }
    </div>
  </div>
  }

  <!-- Backlog Section -->
  <div class="backlog-section">
    <h3>Backlog ({{ backlogIssues().length }} issues)</h3>

    <div cdkDropList [cdkDropListData]="backlogIssues()" (cdkDropListDropped)="drop($event, null)">
      @for (issue of backlogIssues(); track issue.id) {
      <div cdkDrag [cdkDragData]="issue">
        <!-- Issue card -->
      </div>
      }
    </div>
  </div>
</div>
```

---

## 5. Quy trình từng bước

### 5.1. Khởi tạo dữ liệu khi vào Backlog

```typescript
ngOnInit() {
  this.route.parent?.paramMap.subscribe((params) => {
    const projectId = params.get('projectId');
    if (projectId) {
      // 1. Load tất cả Issues của Project
      this.boardStore.loadIssues(projectId);

      // 2. Load tất cả Sprints của Project
      this.sprintStore.loadSprints(projectId);

      // 3. Select Project hiện tại
      this.projectsStore.selectProject(projectId);
    }
  });
}
```

**Firestore Queries được thực hiện:**

```javascript
// Query 1: Lấy Issues
db.collection('issues')
  .where('projectId', '==', projectId)
  .onSnapshot(...)

// Query 2: Lấy Sprints
db.collection('sprints')
  .where('projectId', '==', projectId)
  .onSnapshot(...)
```

**Real-time Updates:**

- Khi có Sprint mới được tạo → UI tự động cập nhật
- Khi Issue được kéo vào Sprint → UI tự động cập nhật
- Khi Sprint status thay đổi → UI tự động cập nhật

---

### 5.2. Tạo Issue mới với Sprint

```typescript
createIssue() {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '600px',
    data: { statusColumnId: 'todo' }
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      const projectId = this.projectsStore.selectedProjectId();
      const projectKey = this.projectsStore.selectedProject()?.key;
      const currentUser = this.authStore.user();

      this.boardStore.addIssue({
        ...result,
        projectId,
        boardId: projectId,
        order: 0,
        key: this.boardStore.getNextIssueKey(projectKey),
        reporterId: currentUser.uid,
        isInBacklog: result.isInBacklog,  // ⭐ Từ dialog
      });
    }
  });
}
```

**Trong IssueDialog:**

```typescript
save() {
  const formValue = this.form.getRawValue();
  const result: any = { ...formValue };

  // ⭐ Tự động xác định isInBacklog dựa trên Sprint
  if (result.sprintId) {
    const sprint = this.sprintStore.sprints().find(s => s.id === result.sprintId);
    if (sprint && sprint.status === 'active') {
      result.isInBacklog = false;  // Hiển thị trên Board
    } else {
      result.isInBacklog = true;   // Ẩn trong Backlog
    }
  } else {
    result.isInBacklog = true;     // Không có Sprint = Backlog
  }

  this.dialogRef.close(result);
}
```

---

### 5.3. Drag & Drop Logic

```typescript
drop(event: CdkDragDrop<Issue[]>, targetSprintId: string | null) {
  // Case 1: Sắp xếp lại trong cùng một list
  if (event.previousContainer === event.container) {
    moveItemInArray(
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    return;  // Không cần update Firestore
  }

  // Case 2: Di chuyển giữa các lists
  transferArrayItem(
    event.previousContainer.data,
    event.container.data,
    event.previousIndex,
    event.currentIndex
  );

  const issue = event.item.data as Issue;
  const updates: Partial<Issue> = {
    sprintId: targetSprintId,
  };

  // ⭐ Logic xác định isInBacklog
  if (targetSprintId) {
    const sprint = this.sprintStore.sprints().find(s => s.id === targetSprintId);

    if (sprint?.status === 'active') {
      // Kéo vào Active Sprint → Hiển thị trên Board
      updates.isInBacklog = false;
    } else {
      // Kéo vào Future Sprint → Vẫn ẩn trong Backlog
      updates.isInBacklog = true;
    }
  } else {
    // Kéo về Backlog → Ẩn và gỡ Sprint
    updates.isInBacklog = true;
    updates.sprintId = null;
  }

  // Update Firestore
  this.boardStore.updateIssue(issue.id, updates);
}
```

**Các trường hợp Drag & Drop:**

| Từ              | Đến             | sprintId    | isInBacklog | Hiển thị trên Board? |
| --------------- | --------------- | ----------- | ----------- | -------------------- |
| Backlog         | Future Sprint   | sprint_id   | true        | ❌ Không             |
| Backlog         | Active Sprint   | sprint_id   | false       | ✅ Có                |
| Future Sprint   | Active Sprint   | sprint_id   | false       | ✅ Có                |
| Active Sprint   | Backlog         | null        | true        | ❌ Không             |
| Future Sprint A | Future Sprint B | sprint_b_id | true        | ❌ Không             |

---

## 6. Tương tác giữa các thành phần

### 6.1. Sơ đồ luồng dữ liệu

```
┌─────────────────────────────────────────────────────────────────┐
│                         FIRESTORE                               │
│  ┌──────────────┐              ┌──────────────┐                │
│  │   sprints    │              │    issues    │                │
│  │ collection   │              │  collection  │                │
│  └──────┬───────┘              └──────┬───────┘                │
└─────────┼──────────────────────────────┼──────────────────────┘
          │                              │
          │ Real-time                    │ Real-time
          │ Snapshot                     │ Snapshot
          ↓                              ↓
┌─────────────────┐            ┌─────────────────┐
│  SprintService  │            │  IssueService   │
└────────┬────────┘            └────────┬────────┘
         │                              │
         │ Observable<Sprint[]>         │ Observable<Issue[]>
         ↓                              ↓
┌─────────────────┐            ┌─────────────────┐
│  SprintStore    │            │   BoardStore    │
│                 │◄───────────┤                 │
│ - sprints       │  inject    │ - issues        │
│ - activeSprint  │            │ - filteredIssues│
└────────┬────────┘            └────────┬────────┘
         │                              │
         │ inject                       │ inject
         ↓                              ↓
┌──────────────────────────────────────────────┐
│         Backlog Component                    │
│                                              │
│ - backlogIssues (computed)                   │
│ - sprintIssuesMap (computed)                 │
│                                              │
│ Methods:                                     │
│ - createSprint()                             │
│ - startSprint()                              │
│ - completeSprint()                           │
│ - drop()                                     │
└──────────────────────────────────────────────┘
```

---

### 6.2. Sequence Diagram: Start Sprint

```
User          Backlog         SprintStore      SprintService     Firestore      BoardStore      IssueService
 │               │                 │                 │               │               │               │
 │ Click "Start" │                 │                 │               │               │               │
 ├──────────────>│                 │                 │               │               │               │
 │               │ startSprint(id) │                 │               │               │               │
 │               ├────────────────>│                 │               │               │               │
 │               │                 │ startSprint(id) │               │               │               │
 │               │                 ├────────────────>│               │               │               │
 │               │                 │                 │ updateDoc()   │               │               │
 │               │                 │                 ├──────────────>│               │               │
 │               │                 │                 │               │ onSnapshot    │               │
 │               │                 │                 │               ├──────────────>│               │
 │               │                 │ Observable      │               │               │               │
 │               │                 │<────────────────┤               │               │               │
 │               │                 │ patchState()    │               │               │               │
 │               │                 │ (status=active) │               │               │               │
 │               │                 │                 │               │               │               │
 │               │ getSprintIssues()                 │               │               │               │
 │               ├─────────────────────────────────────────────────>│               │               │
 │               │ [Issue A, B, C] │                 │               │               │               │
 │               │<─────────────────────────────────────────────────┤               │               │
 │               │                 │                 │               │               │               │
 │               │ batchUpdateIssues([{id, data: {isInBacklog: false}}])            │               │
 │               ├──────────────────────────────────────────────────────────────────────────────────>│
 │               │                 │                 │               │               │ writeBatch()  │
 │               │                 │                 │               │               │──────────────>│
 │               │                 │                 │               │               │               │
 │               │                 │                 │               │ onSnapshot    │               │
 │               │                 │                 │               ├──────────────>│               │
 │               │                 │                 │               │ patchState()  │               │
 │               │                 │                 │               │ (issues)      │               │
 │               │                 │                 │               │               │               │
 │  UI Update    │                 │                 │               │               │               │
 │<──────────────┤                 │                 │               │               │               │
```

---

### 6.3. Firestore Security Rules

```javascript
match /sprints/{sprintId} {
  // Đọc: Phải là member của project
  allow read: if signedIn() && isProjectMember(resource.data.projectId);

  // Tạo: Phải là member của project
  allow create: if signedIn() && isProjectMember(request.resource.data.projectId);

  // Cập nhật: Phải là member của project
  allow update: if signedIn() && isProjectMember(resource.data.projectId);

  // Xóa: Phải là member của project
  allow delete: if signedIn() && isProjectMember(resource.data.projectId);
}
```

**Lưu ý:** Cần deploy rules lên Firebase:

```bash
firebase deploy --only firestore:rules
```

---

## 7. Best Practices & Tips

### 7.1. Quy tắc vàng

1. **Chỉ có 1 Active Sprint**

   - Trước khi Start Sprint mới, phải Complete Sprint cũ
   - Hệ thống không tự động kiểm tra điều này (có thể cải thiện)

2. **Issues trong Future Sprint vẫn nằm trong Backlog view**

   - `isInBacklog = true` cho Future Sprints
   - Chỉ khi Start Sprint thì mới `isInBacklog = false`

3. **Completed Sprint không thể chỉnh sửa**
   - Hiện tại chưa có validation (có thể thêm)
   - Nên thêm logic ngăn chặn edit Completed Sprint

### 7.2. Cải thiện trong tương lai

1. **Sprint Planning Dialog**

   - Thay vì confirm() đơn giản, mở dialog để:
     - Chọn ngày bắt đầu/kết thúc
     - Nhập Sprint Goal
     - Xem tổng số Issues và Story Points

2. **Complete Sprint Dialog**

   - Cho phép chọn:
     - Move incomplete issues về Backlog
     - Move incomplete issues sang Sprint tiếp theo
     - Giữ nguyên trong Sprint (mark as Completed anyway)

3. **Sprint Metrics**

   - Velocity chart
   - Burndown chart
   - Sprint Report

4. **Validation**
   - Không cho phép Start Sprint nếu đã có Active Sprint
   - Không cho phép xóa Sprint đang Active
   - Không cho phép edit Completed Sprint

### 7.3. Troubleshooting

**Vấn đề:** Issues không hiển thị trên Board sau khi Start Sprint

**Giải pháp:**

- Kiểm tra `isInBacklog` của Issues → phải là `false`
- Kiểm tra `sprintId` của Issues → phải match với Active Sprint ID
- Kiểm tra BoardStore filter logic

**Vấn đề:** Drag & Drop không hoạt động

**Giải pháp:**

- Đảm bảo `DragDropModule` đã được import
- Kiểm tra `cdkDropListGroup` ở container cha
- Kiểm tra `cdkDropList` và `cdkDrag` directives

**Vấn đề:** Firestore Permission Denied

**Giải pháp:**

```bash
firebase deploy --only firestore:rules
```

---

## 8. Tóm tắt

### Luồng hoạt động cơ bản:

1. **Tạo Sprint** → Status: FUTURE
2. **Thêm Issues vào Sprint** (Drag & Drop hoặc chọn trong Dialog)
3. **Start Sprint** → Status: ACTIVE, Issues xuất hiện trên Board
4. **Làm việc trên Board** → Di chuyển Issues qua các cột
5. **Complete Sprint** → Status: COMPLETED, Issues chưa xong về Backlog

### Các trường quan trọng:

- `Sprint.status`: Xác định trạng thái Sprint
- `Issue.sprintId`: Xác định Issue thuộc Sprint nào
- `Issue.isInBacklog`: Xác định Issue có hiển thị trên Board không

### Tương tác chính:

- **SprintStore** ↔ **Firestore** (Real-time sync)
- **BoardStore** ↔ **Firestore** (Real-time sync)
- **Backlog Component** → Sử dụng cả SprintStore và BoardStore
- **Board Component** → Chỉ hiển thị Active Sprint Issues

---

**Tài liệu này được tạo để giúp hiểu rõ toàn bộ luồng làm việc với Sprint trong dự án Jira Clone.**
