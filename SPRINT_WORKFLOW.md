# Sprint Workflow - Tài liệu Chi tiết

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Kiến trúc & Cấu trúc](#kiến-trúc--cấu-trúc)
3. [Data Model](#data-model)
4. [Luồng hoạt động Sprint](#luồng-hoạt-động-sprint)
5. [Chi tiết từng Component](#chi-tiết-từng-component)
6. [Firestore Rules](#firestore-rules)
7. [State Management](#state-management)
8. [Các trường hợp đặc biệt](#các-trường-hợp-đặc-biệt)

---

## Tổng quan

Hệ thống Sprint của dự án này được thiết kế theo mô hình **Scrum/Kanban lai**, cho phép:

- Tạo và quản lý nhiều Sprint (Future, Active, Completed)
- Kéo thả Issues giữa Backlog và Sprint
- Start Sprint để đưa công việc lên Board
- Complete Sprint để kết thúc chu kỳ làm việc
- Tự động tính toán ngày kết thúc dựa trên Duration

### Các trạng thái Sprint

```typescript
type SprintStatus = 'future' | 'active' | 'completed';
```

- **Future**: Sprint đã được tạo nhưng chưa bắt đầu
- **Active**: Sprint đang chạy (chỉ có 1 active sprint tại một thời điểm)
- **Completed**: Sprint đã hoàn thành

---

## Kiến trúc & Cấu trúc

### Cấu trúc thư mục

```
src/app/features/board/
├── backlog/
│   ├── backlog.ts                          # Component chính quản lý Backlog & Sprint
│   ├── start-sprint-dialog/
│   │   └── start-sprint-dialog.ts          # Dialog để start sprint
│   ├── edit-sprint-dialog/
│   │   └── edit-sprint-dialog.ts           # Dialog để edit sprint
│   └── complete-sprint-dialog/
│       └── complete-sprint-dialog.ts       # Dialog để complete sprint
├── board/
│   └── board.ts                            # Kanban Board hiển thị Active Sprint
├── board.store.ts                          # State management cho Issues
├── sprint.store.ts                         # State management cho Sprints
├── sprint.service.ts                       # Service tương tác Firestore
└── sprint.model.ts                         # Data model Sprint

src/app/features/issue/
├── issue.model.ts                          # Data model Issue
└── issue.service.ts                        # Service tương tác Firestore
```

---

## Data Model

### Sprint Model

```typescript
export interface Sprint {
  id?: string; // Firestore document ID
  projectId: string; // ID của project chứa sprint
  name: string; // Tên sprint (VD: "Sprint 1")
  goal?: string; // Mục tiêu sprint (optional)
  startDate?: string; // Ngày bắt đầu (ISO string)
  endDate?: string; // Ngày kết thúc (ISO string)
  status: 'future' | 'active' | 'completed';
  createdAt?: string; // Timestamp tạo
  completedAt?: string; // Timestamp hoàn thành
}
```

### Issue Model (các field liên quan Sprint)

```typescript
export interface Issue {
  id?: string;
  projectId: string;
  sprintId: string | null; // ID của sprint chứa issue (null = không thuộc sprint nào)
  isInBacklog: boolean; // true = hiện ở Backlog, false = hiện ở Board
  statusColumnId: 'todo' | 'in-progress' | 'done';
  // ... các field khác
}
```

### Quy tắc quan trọng về Issue State

| Trạng thái                           | `sprintId`       | `isInBacklog` | Hiển thị ở đâu?              |
| ------------------------------------ | ---------------- | ------------- | ---------------------------- |
| Issue mới tạo từ Backlog             | `null`           | `true`        | Backlog (dưới cùng)          |
| Issue được kéo vào Future Sprint     | `futureSprintId` | `true`        | Backlog (trong panel Sprint) |
| Issue được kéo vào Active Sprint     | `activeSprintId` | `false`       | Board (Kanban)               |
| Issue trong Active Sprint bị Archive | `null`           | `true`        | Backlog (dưới cùng)          |
| Issue tạo trực tiếp từ Board         | `activeSprintId` | `false`       | Board (Kanban)               |

---

## Luồng hoạt động Sprint

### 1. Tạo Sprint (Create Sprint)

**Trigger**: User click nút "Create Sprint" ở Backlog

**Flow**:

```
User click "Create Sprint"
    ↓
backlog.ts → createSprint()
    ↓
Tự động đặt tên: "Sprint {count + 1}"
    ↓
sprintStore.addSprint({
  projectId: currentProjectId,
  name: "Sprint X",
  status: 'future',
  startDate: today,
  endDate: today + 14 days
})
    ↓
sprint.service.ts → addSprint()
    ↓
Firestore: collection('sprints').add(...)
    ↓
Real-time update → sprintStore.sprints() cập nhật
    ↓
UI: Sprint mới xuất hiện ở Backlog view
```

**Code chi tiết**:

```typescript
// backlog.ts
createSprint() {
  const projectId = this.projectsStore.selectedProjectId();
  if (!projectId) return;

  const count = this.sprintStore.sprints().length;
  const name = `Sprint ${count + 1}`;

  this.sprintStore.addSprint({
    projectId,
    name,
    status: 'future',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });
}
```

---

### 2. Thêm Issues vào Sprint (Drag & Drop)

**Trigger**: User kéo issue từ Backlog vào Sprint panel

**Flow**:

```
User drag issue từ Backlog
    ↓
Drop vào Sprint panel (Future hoặc Active)
    ↓
backlog.ts → drop(event, targetSprintId)
    ↓
Xác định Sprint status:
  - Nếu Future Sprint: isInBacklog = true
  - Nếu Active Sprint: isInBacklog = false
    ↓
boardStore.updateIssue(issueId, {
  sprintId: targetSprintId,
  isInBacklog: sprint.status !== 'active'
})
    ↓
issue.service.ts → updateIssue()
    ↓
Firestore: doc('issues/{id}').update(...)
    ↓
Real-time update → boardStore.issues() cập nhật
    ↓
UI: Issue di chuyển sang vị trí mới
```

**Code chi tiết**:

```typescript
// backlog.ts
drop(event: CdkDragDrop<Issue[]>, targetSprintId: string | null) {
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  } else {
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    const issue = event.item.data as Issue;
    const updates: Partial<Issue> = {
      sprintId: targetSprintId,
    };

    if (targetSprintId) {
      const sprint = this.sprintStore.sprints().find((s) => s.id === targetSprintId);
      // Nếu kéo vào Active Sprint → hiện lên Board ngay
      // Nếu kéo vào Future Sprint → vẫn ở Backlog
      updates.isInBacklog = sprint?.status !== 'active';
    } else {
      // Kéo về Backlog thuần túy
      updates.isInBacklog = true;
      updates.sprintId = null;
    }

    this.boardStore.updateIssue(issue.id, updates);
  }
}
```

---

### 3. Start Sprint

**Trigger**: User click "Start Sprint" trên Future Sprint

**Flow**:

```
User click "Start Sprint"
    ↓
Kiểm tra: Sprint có issues không?
  - Nếu không → Alert "Please add issues..."
  - Nếu có → Tiếp tục
    ↓
Mở StartSprintDialog
  - Hiển thị số lượng issues
  - Form: name, duration, startDate, endDate, goal
  - Duration options: 1w, 2w, 3w, 4w, Custom
  - Nếu chọn preset duration → endDate tự động tính & disabled
    ↓
User điền thông tin & click "Start"
    ↓
Dialog trả về updates: {
  name, startDate, endDate, goal, status: 'active'
}
    ↓
sprintStore.updateSprint(sprintId, updates)
    ↓
Cập nhật tất cả issues trong sprint:
  - isInBacklog: false (để hiện lên Board)
    ↓
issue.service.batchUpdateIssues([...])
    ↓
Firestore: Batch update
    ↓
Navigate to Board view
    ↓
UI: Board hiển thị issues của Active Sprint
```

**Code chi tiết**:

```typescript
// backlog.ts
startSprint(sprint: any) {
  const issues = this.getSprintIssues(sprint.id);

  if (issues.length === 0) {
    alert('Please add issues to the sprint before starting it.');
    return;
  }

  const dialogRef = this.dialog.open(StartSprintDialog, {
    width: '500px',
    data: { sprint, issueCount: issues.length },
  });

  dialogRef.afterClosed().subscribe(async (updates) => {
    if (updates) {
      // 1. Update Sprint status → 'active'
      await this.sprintStore.updateSprint(sprint.id, updates);

      // 2. Move issues to board (isInBacklog = false)
      const updatesIssues = issues.map((i) => ({
        id: i.id,
        data: { isInBacklog: false },
      }));

      if (updatesIssues.length > 0) {
        await this.issueService.batchUpdateIssues(updatesIssues);
      }

      // 3. Navigate to board
      this.router.navigate(['../board'], { relativeTo: this.route });
    }
  });
}
```

**StartSprintDialog Logic**:

```typescript
// start-sprint-dialog.ts
onDurationChange() {
  const duration = this.form.get('duration')?.value;
  const endDateControl = this.form.get('endDate');

  if (duration === 'custom') {
    endDateControl?.enable();  // Cho phép user tự chọn
    return;
  }

  endDateControl?.disable();   // Disable khi chọn preset
  const weeks = parseInt(duration, 10);
  const startDate = this.form.get('startDate')?.value;

  if (startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + weeks * 7);
    this.form.patchValue({ endDate });
  }
}

save() {
  if (this.form.valid) {
    const formValue = this.form.getRawValue(); // Lấy cả disabled fields
    const updates = {
      name: formValue.name,
      startDate: formValue.startDate ? formValue.startDate.toISOString() : null,
      endDate: formValue.endDate ? formValue.endDate.toISOString() : null,
      goal: formValue.goal,
      status: 'active',
    };
    this.dialogRef.close(updates);
  }
}
```

---

### 4. Board View - Hiển thị Active Sprint

**Trigger**: User navigate to `/project/{id}/board`

**Flow**:

```
board.ts → ngOnInit()
    ↓
Load data:
  - boardStore.loadIssues(projectId)
  - sprintStore.loadSprints(projectId)
    ↓
Template kiểm tra: sprintStore.activeSprint()
  - Nếu null → Hiển thị Empty State
  - Nếu có → Hiển thị Kanban Board
    ↓
boardStore.filteredIssues() computed:
  - Filter: isInBacklog === false
  - Filter: sprintId === activeSprintId
  - Filter: search, assignee, priority, etc.
    ↓
Phân loại issues theo statusColumnId:
  - todoIssues: statusColumnId === 'todo'
  - inProgressIssues: statusColumnId === 'in-progress'
  - doneIssues: statusColumnId === 'done'
    ↓
Render 3 columns với drag & drop
```

**Code chi tiết**:

```typescript
// board.store.ts
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

    // *** QUAN TRỌNG: Chỉ hiện issues của Active Sprint ***
    const activeSprintId = sprintStore.activeSprint()?.id;
    const matchesSprint = issue.sprintId ? issue.sprintId === activeSprintId : true;
    const isNotBacklog = !issue.isInBacklog;

    return (
      matchesSearch &&
      matchesUser &&
      matchesAssignee &&
      matchesStatus &&
      matchesPriority &&
      isNotBacklog && // Phải không ở Backlog
      matchesSprint // Phải thuộc Active Sprint
    );
  });
});
```

---

### 5. Tạo Issue từ Board

**Trigger**: User click nút "Create" trên Board column

**Flow**:

```
User click "Create" (TODO/IN PROGRESS/DONE column)
    ↓
board.ts → openIssueDialog(statusColumnId)
    ↓
Mở IssueDialog với statusColumnId preset
    ↓
User điền thông tin & submit
    ↓
Dialog trả về result
    ↓
board.ts → boardStore.addIssue({
  ...result,
  projectId,
  sprintId: activeSprint.id,    // *** GÁN VÀO ACTIVE SPRINT ***
  isInBacklog: false,            // *** HIỆN NGAY TRÊN BOARD ***
  key: auto-generated,
  reporterId: currentUser.uid
})
    ↓
issue.service.ts → addIssue()
    ↓
Firestore: collection('issues').add(...)
    ↓
Real-time update → boardStore.issues() cập nhật
    ↓
UI: Issue mới xuất hiện trên Board ngay lập tức
```

**Code chi tiết**:

```typescript
// board.ts
openIssueDialog(statusColumnId: string, issue?: Issue) {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '500px',
    data: { statusColumnId, issue },
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      if (issue) {
        this.store.updateIssue(issue.id, result);
      } else {
        const projectId = this.projectsStore.selectedProjectId();
        const projectKey = this.projectsStore.selectedProject()?.key;

        if (projectId && projectKey) {
          const activeSprint = this.sprintStore.activeSprint();
          this.store.addIssue({
            ...result,
            projectId,
            boardId: projectId,
            order: 0,
            key: this.store.getNextIssueKey(projectKey),
            reporterId: this.authStore.user()?.uid,
            // *** FIX QUAN TRỌNG: Gán vào Active Sprint ***
            sprintId: activeSprint?.id || null,
            isInBacklog: false,
          });
        }
      }
    }
  });
}
```

---

### 6. Archive Issue (Move to Backlog)

**Trigger**: User click nút "Archive" (icon archive) trên issue card

**Flow**:

```
User click Archive button
    ↓
board.ts → moveToBacklog(issueId)
    ↓
issue.service.ts → moveToBacklog(issueId)
    ↓
Update issue: {
  isInBacklog: true,
  sprintId: null        // *** XÓA KHỎI SPRINT ***
}
    ↓
Firestore: doc('issues/{id}').update(...)
    ↓
Real-time update
    ↓
UI:
  - Issue biến mất khỏi Board
  - Issue xuất hiện ở Backlog (dưới cùng)
```

**Code chi tiết**:

```typescript
// issue.service.ts
moveToBacklog(issueId: string) {
  return this.updateIssue(issueId, {
    isInBacklog: true,
    sprintId: null    // *** Quan trọng: Gỡ khỏi Sprint ***
  });
}
```

---

### 7. Complete Sprint

**Trigger**: User click "Complete Sprint" trên Active Sprint

**Flow**:

```
User click "Complete Sprint"
    ↓
Mở CompleteSprintDialog
  - Hiển thị danh sách issues
  - Phân loại: Done vs Incomplete
  - Tùy chọn: Move incomplete issues to?
    + Backlog
    + Future Sprint (nếu có)
    ↓
User chọn destination & confirm
    ↓
Dialog trả về: { destinationId: string | null }
    ↓
sprintStore.completeSprint(sprintId)
  → Update sprint: { status: 'completed', completedAt: now }
    ↓
Xử lý incomplete issues:
  - Filter: statusColumnId !== 'done'
  - Update: {
      sprintId: destinationId,
      isInBacklog: true
    }
    ↓
issue.service.batchUpdateIssues([...])
    ↓
Firestore: Batch update
    ↓
Real-time update
    ↓
UI:
  - Sprint status → 'completed'
  - Incomplete issues → Backlog hoặc Future Sprint
  - Done issues → Vẫn giữ trong Completed Sprint
  - Board view → Empty State (không còn Active Sprint)
```

**Code chi tiết**:

```typescript
// backlog.ts
completeSprint(sprint: any) {
  const issues = this.getSprintIssues(sprint.id);
  const futureSprints = this.sprintStore.futureSprints();

  const dialogRef = this.dialog.open(CompleteSprintDialog, {
    width: '500px',
    data: { sprint, issues, futureSprints },
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      // 1. Mark sprint as completed
      this.sprintStore.completeSprint(sprint.id);

      const destinationId = result.destinationId;
      const incompleteIssues = issues.filter((i) => i.statusColumnId !== 'done');

      // 2. Move incomplete issues
      if (incompleteIssues.length > 0) {
        const updates = incompleteIssues.map((i) => ({
          id: i.id,
          data: {
            sprintId: destinationId,  // null (backlog) hoặc futureSprintId
            isInBacklog: true,        // Luôn true vì rời khỏi Board
          },
        }));

        this.issueService.batchUpdateIssues(updates);
      }
    }
  });
}
```

---

### 8. Edit Sprint

**Trigger**: User click "Edit sprint" từ menu (...)

**Flow**:

```
User click "Edit sprint"
    ↓
Mở EditSprintDialog
  - Pre-fill: name, startDate, endDate, goal
  - Duration dropdown (mới thêm)
  - Logic tự động tính endDate giống StartSprintDialog
    ↓
User chỉnh sửa & submit
    ↓
Dialog trả về updates: {
  name, startDate, endDate, goal
}
    ↓
sprintStore.updateSprint(sprintId, updates)
    ↓
Firestore: doc('sprints/{id}').update(...)
    ↓
Real-time update
    ↓
UI: Sprint info cập nhật
```

**Code chi tiết**:

```typescript
// edit-sprint-dialog.ts
onDurationChange() {
  const duration = this.form.get('duration')?.value;
  const endDateControl = this.form.get('endDate');

  if (duration === 'custom') {
    endDateControl?.enable();
    return;
  }

  endDateControl?.disable();
  const weeks = parseInt(duration, 10);
  const startDate = this.form.get('startDate')?.value;

  if (startDate) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + weeks * 7);
    this.form.patchValue({ endDate });
  }
}
```

---

### 9. Delete Sprint

**Trigger**: User click "Delete sprint" từ menu (...)

**Flow**:

```
User click "Delete sprint"
    ↓
Confirm dialog: "Are you sure...?"
    ↓
User confirm
    ↓
Move tất cả issues về Backlog:
  - Update: { sprintId: null, isInBacklog: true }
    ↓
issue.service.batchUpdateIssues([...])
    ↓
Delete sprint document
    ↓
sprintStore.deleteSprint(sprintId)
    ↓
Firestore: doc('sprints/{id}').delete()
    ↓
Real-time update
    ↓
UI:
  - Sprint biến mất
  - Issues xuất hiện ở Backlog
```

---

## Chi tiết từng Component

### SprintStore (`sprint.store.ts`)

**Responsibilities**:

- Quản lý state của tất cả Sprints
- Load sprints từ Firestore (real-time)
- CRUD operations: add, update, delete, start, complete

**Key Computed Signals**:

```typescript
activeSprint: computed(() => sprints().find((s) => s.status === 'active'));
futureSprints: computed(() => sprints().filter((s) => s.status === 'future'));
completedSprints: computed(() => sprints().filter((s) => s.status === 'completed'));
```

**Methods**:

- `loadSprints(projectId)`: Load sprints theo projectId (rxMethod)
- `addSprint(sprint)`: Tạo sprint mới
- `updateSprint(id, updates)`: Cập nhật sprint
- `deleteSprint(id)`: Xóa sprint
- `startSprint(id)`: Chuyển status → 'active'
- `completeSprint(id)`: Chuyển status → 'completed'

---

### BoardStore (`board.store.ts`)

**Responsibilities**:

- Quản lý state của tất cả Issues
- Load issues từ Firestore (real-time)
- Filter & sort issues
- CRUD operations cho issues

**Key Computed Signals**:

```typescript
filteredIssues: computed(() => {
  // Filter theo search, user, sprint, backlog status
  // *** Chỉ hiện issues của Active Sprint ***
});

todoIssues: computed(() => filteredIssues().filter((i) => i.statusColumnId === 'todo'));
inProgressIssues: computed(() =>
  filteredIssues().filter((i) => i.statusColumnId === 'in-progress'),
);
doneIssues: computed(() => filteredIssues().filter((i) => i.statusColumnId === 'done'));
```

**Filter Logic**:

```typescript
const activeSprintId = sprintStore.activeSprint()?.id;
const matchesSprint = issue.sprintId ? issue.sprintId === activeSprintId : true;
const isNotBacklog = !issue.isInBacklog;

return (
  // ... other filters
  isNotBacklog && // Không ở Backlog
  matchesSprint // Thuộc Active Sprint
);
```

---

### Backlog Component (`backlog.ts`)

**Responsibilities**:

- Hiển thị Backlog & Sprint panels
- Drag & drop issues giữa Backlog và Sprints
- CRUD operations cho Sprints
- Navigate to Board khi Start Sprint

**Key Computed Signals**:

```typescript
backlogIssues = computed(() => boardStore.issues().filter((i) => !i.sprintId && i.isInBacklog));

sprintIssuesMap = computed(() => {
  const map = new Map<string, Issue[]>();
  boardStore.issues().forEach((i) => {
    if (i.sprintId) {
      if (!map.has(i.sprintId)) map.set(i.sprintId, []);
      map.get(i.sprintId)!.push(i);
    }
  });
  return map;
});
```

**Drag & Drop Logic**:

- Sử dụng Angular CDK Drag & Drop
- `cdkDropListGroup`: Cho phép kéo giữa các list
- `cdkDropList`: Mỗi Sprint panel và Backlog là một drop zone
- `drop(event, targetSprintId)`: Xử lý khi drop

---

### Board Component (`board.ts`)

**Responsibilities**:

- Hiển thị Kanban Board với 3 columns
- Drag & drop issues giữa các columns
- Create/Edit/Delete issues
- Complete Sprint
- Archive issues về Backlog

**Template Structure**:

```html
<div class="board-container">
  <div class="board-header">
    <!-- Search, filters, Complete Sprint button -->
  </div>

  <div class="board-columns" *ngIf="sprintStore.activeSprint(); else emptyState">
    <!-- TODO Column -->
    <div class="column">
      <div cdkDropList [cdkDropListData]="store.todoIssues()">
        @for (issue of store.todoIssues(); track issue.id) {
        <mat-card cdkDrag>...</mat-card>
        }
      </div>
    </div>

    <!-- IN PROGRESS Column -->
    <!-- DONE Column -->
  </div>

  <ng-template #emptyState>
    <div class="empty-state">
      <h3>Get started in the backlog</h3>
      <p>Plan and start a sprint to see work here.</p>
      <button routerLink="../backlog">Go to Backlog</button>
    </div>
  </ng-template>
</div>
```

---

## Firestore Rules

### Sprint Collection Rules

```javascript
match /sprints/{sprintId} {
  allow read: if isProjectMember(resource.data.projectId);
  allow create: if isProjectAdmin(request.resource.data.projectId);
  allow update: if isProjectAdmin(resource.data.projectId);
  allow delete: if isProjectAdmin(resource.data.projectId);
}
```

### Issue Collection Rules

```javascript
match /issues/{issueId} {
  allow read: if isProjectMember(resource.data.projectId);
  allow create: if isProjectMember(request.resource.data.projectId);
  allow update: if isProjectMember(resource.data.projectId);
  allow delete: if isProjectAdmin(resource.data.projectId);
}
```

### Helper Functions

```javascript
function isProjectMember(projectId) {
  let project = get(/databases/$(database)/documents/projects/$(projectId));
  return project != null && (
    project.data.ownerId == request.auth.uid ||
    (project.data.keys().hasAny(['memberIds']) && project.data.memberIds.hasAny([request.auth.uid])) ||
    (project.data.keys().hasAny(['roles']) && project.data.roles.keys().hasAny([request.auth.uid]))
  );
}

function isProjectAdmin(projectId) {
  let project = get(/databases/$(database)/documents/projects/$(projectId));
  return project != null && (
    project.data.ownerId == request.auth.uid ||
    (project.data.keys().hasAny(['roles']) && project.data.roles[request.auth.uid] == 'admin')
  );
}
```

---

## State Management

### Signal-based Architecture

Dự án sử dụng **NgRx Signals** (SignalStore) thay vì Redux pattern truyền thống.

**Ưu điểm**:

- Reactive tự động với Angular Signals
- Code ngắn gọn hơn Redux
- Type-safe
- Performance tốt (fine-grained reactivity)

**Pattern**:

```typescript
export const SprintStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),           // Feature: loading & error state
  withState(initialState),      // State definition
  withComputed(({ sprints }) => ({
    activeSprint: computed(...),
    futureSprints: computed(...),
  })),
  withMethods((store, service) => ({
    loadSprints: rxMethod(...),
    addSprint: async (...) => {...},
  }))
);
```

### Real-time Updates

**Firestore Observable Pattern**:

```typescript
// sprint.service.ts
getSprints(projectId: string): Observable<Sprint[]> {
  const q = query(
    this.sprintsCollection,
    where('projectId', '==', projectId)
  );
  return runInInjectionContext(
    this.injector,
    () => collectionData(q, { idField: 'id' }) as Observable<Sprint[]>
  );
}

// sprint.store.ts
loadSprints: rxMethod<string | null>(
  pipe(
    tap(() => store.setLoading(true)),
    switchMap((projectId) => {
      if (!projectId) {
        patchState(store, { sprints: [] });
        store.setLoading(false);
        return of([]);
      }
      return sprintService.getSprints(projectId).pipe(
        tap((sprints) => {
          patchState(store, { sprints });
          store.setLoading(false);
        }),
        catchError((error) => {
          errorService.showError(error?.message || 'Failed to load sprints');
          store.setLoading(false);
          return of([]);
        })
      );
    })
  )
)
```

**Flow**:

1. Component gọi `sprintStore.loadSprints(projectId)`
2. Store gọi `sprintService.getSprints(projectId)`
3. Service return Observable từ Firestore
4. Mỗi khi Firestore data thay đổi → Observable emit
5. Store update state → Signals cập nhật
6. Components tự động re-render (reactive)

---

## Các trường hợp đặc biệt

### 1. Chỉ có 1 Active Sprint tại một thời điểm

**Vấn đề**: User có thể Start nhiều Sprint cùng lúc?

**Giải pháp hiện tại**:

- UI chỉ cho phép Start Sprint khi status = 'future'
- Khi Start, status chuyển thành 'active'
- Computed `activeSprint()` chỉ trả về 1 sprint đầu tiên có status = 'active'

**Cải thiện đề xuất**:

```typescript
// sprint.service.ts
async startSprint(id: string) {
  // 1. Kiểm tra xem đã có Active Sprint chưa
  const activeSprints = await getDocs(
    query(this.sprintsCollection, where('status', '==', 'active'))
  );

  if (!activeSprints.empty) {
    throw new Error('There is already an active sprint. Please complete it first.');
  }

  // 2. Start sprint
  const docRef = doc(this.firestore, 'sprints', id);
  return updateDoc(docRef, { status: 'active' });
}
```

---

### 2. Issue không thuộc Sprint nào (sprintId = null)

**Trường hợp**:

- Issue mới tạo từ Backlog
- Issue bị Archive từ Board
- Issue bị gỡ khỏi Sprint khi Delete Sprint

**Xử lý**:

- `isInBacklog = true`
- `sprintId = null`
- Hiển thị ở Backlog (dưới cùng, không thuộc Sprint panel nào)

**Filter logic**:

```typescript
backlogIssues = computed(() => boardStore.issues().filter((i) => !i.sprintId && i.isInBacklog));
```

---

### 3. Issue trong Future Sprint

**Trạng thái**:

- `sprintId = futureSprintId`
- `isInBacklog = true`

**Hiển thị**:

- Ở Backlog view: Trong panel của Future Sprint đó
- Không hiện ở Board (vì `isInBacklog = true`)

**Khi Start Sprint**:

- Update `isInBacklog = false`
- Giữ nguyên `sprintId`
- Issue tự động hiện lên Board

---

### 4. Issue trong Completed Sprint

**Trạng thái**:

- `sprintId = completedSprintId`
- `isInBacklog = true` (nếu incomplete) hoặc `false` (nếu done)

**Xử lý**:

- Done issues: Giữ nguyên trong Completed Sprint (để báo cáo)
- Incomplete issues: Di chuyển về Backlog hoặc Future Sprint

**Hiển thị**:

- Không hiện ở Board (vì không có Active Sprint)
- Có thể xem lại trong Sprint Report (tính năng tương lai)

---

### 5. Drag & Drop giữa Board Columns

**Flow**:

```
User drag issue từ TODO → IN PROGRESS
    ↓
board.ts → drop(event, 'in-progress')
    ↓
boardStore.moveIssue(event, 'in-progress')
    ↓
Tính toán order mới:
  - Nếu drop vào vị trí giữa: order = (prevOrder + nextOrder) / 2
  - Nếu drop vào đầu: order = nextOrder - 1000
  - Nếu drop vào cuối: order = prevOrder + 1000
    ↓
Optimistic update: Cập nhật UI ngay
    ↓
issue.service.updateIssue(issueId, {
  statusColumnId: 'in-progress',
  order: newOrder
})
    ↓
Firestore update
    ↓
Nếu lỗi: Rollback UI về state cũ
```

---

### 6. Batch Update Performance

**Vấn đề**: Khi Start/Complete Sprint, cần update nhiều issues cùng lúc

**Giải pháp**: Firestore Batch Write

```typescript
// issue.service.ts
async batchUpdateIssues(updates: { id: string; data: Partial<Issue> }[]) {
  const batch = writeBatch(this.firestore);
  updates.forEach(({ id, data }) => {
    const docRef = doc(this.firestore, 'issues', id);
    batch.update(docRef, data);
  });
  return batch.commit();
}
```

**Ưu điểm**:

- Atomic: Tất cả updates thành công hoặc tất cả fail
- Performance: 1 network request thay vì N requests
- Limit: Tối đa 500 operations/batch

---

### 7. Race Condition khi Real-time Update

**Vấn đề**:

- User A Start Sprint
- User B đang xem Backlog
- Real-time update có thể gây UI flicker

**Giải pháp**:

- Optimistic update cho user thực hiện action
- Real-time update cho các user khác
- Conflict resolution: Last write wins (Firestore default)

**Code pattern**:

```typescript
// Optimistic update
patchState(store, (state) => ({
  issues: state.issues.map((issue) => (issue.id === issueId ? { ...issue, ...updates } : issue)),
}));

try {
  await issueService.updateIssue(issueId, updates);
} catch (err) {
  // Rollback on error
  patchState(store, { issues: originalIssues });
  errorService.showError(err.message);
}
```

---

## Best Practices

### 1. Luôn kiểm tra Active Sprint trước khi thao tác

```typescript
const activeSprint = this.sprintStore.activeSprint();
if (!activeSprint) {
  alert('No active sprint. Please start a sprint first.');
  return;
}
```

### 2. Sử dụng Computed Signals thay vì manual filtering

❌ **Tránh**:

```typescript
getActiveSprintIssues() {
  return this.boardStore.issues().filter(i =>
    i.sprintId === this.activeSprint?.id && !i.isInBacklog
  );
}
```

✅ **Nên**:

```typescript
activeSprintIssues = computed(() => {
  const activeSprintId = this.sprintStore.activeSprint()?.id;
  return this.boardStore.issues().filter((i) => i.sprintId === activeSprintId && !i.isInBacklog);
});
```

### 3. Batch updates khi có thể

❌ **Tránh**:

```typescript
for (const issue of issues) {
  await this.issueService.updateIssue(issue.id, { isInBacklog: false });
}
```

✅ **Nên**:

```typescript
const updates = issues.map((i) => ({ id: i.id, data: { isInBacklog: false } }));
await this.issueService.batchUpdateIssues(updates);
```

### 4. Error handling & User feedback

```typescript
try {
  await this.sprintStore.startSprint(sprint.id);
  this.errorService.showSuccess('Sprint started successfully!');
  this.router.navigate(['../board']);
} catch (err: any) {
  this.errorService.showError(err?.message || 'Failed to start sprint');
}
```

### 5. Loading states

```typescript
@if (sprintStore.loading()) {
  <mat-spinner diameter="30"></mat-spinner>
} @else {
  <!-- Content -->
}
```

---

## Tổng kết

### Luồng hoạt động tổng quan

```
1. CREATE SPRINT
   Backlog → Future Sprint (status: 'future')

2. PLAN SPRINT
   Drag Issues → Future Sprint (sprintId: X, isInBacklog: true)

3. START SPRINT
   Future Sprint → Active Sprint (status: 'active')
   Issues → Board (isInBacklog: false)

4. WORK ON SPRINT
   Board: Drag issues TODO → IN PROGRESS → DONE

5. COMPLETE SPRINT
   Active Sprint → Completed Sprint (status: 'completed')
   Incomplete Issues → Backlog/Future Sprint (isInBacklog: true)

6. REPEAT
```

### Key Concepts

1. **Sprint Status**: `future` → `active` → `completed`
2. **Issue State**: Controlled by `sprintId` + `isInBacklog`
3. **Board View**: Chỉ hiện Active Sprint (`isInBacklog = false`)
4. **Backlog View**: Hiện tất cả (`isInBacklog = true`)
5. **Real-time**: Firestore Observable + Angular Signals
6. **State Management**: NgRx SignalStore
7. **Drag & Drop**: Angular CDK

### Files quan trọng

| File                        | Mục đích                           |
| --------------------------- | ---------------------------------- |
| `sprint.model.ts`           | Data model Sprint                  |
| `sprint.service.ts`         | Firestore operations cho Sprint    |
| `sprint.store.ts`           | State management Sprint            |
| `issue.model.ts`            | Data model Issue                   |
| `issue.service.ts`          | Firestore operations cho Issue     |
| `board.store.ts`            | State management Issue + filtering |
| `backlog.ts`                | UI Backlog & Sprint management     |
| `board.ts`                  | UI Kanban Board                    |
| `start-sprint-dialog.ts`    | Dialog Start Sprint                |
| `edit-sprint-dialog.ts`     | Dialog Edit Sprint                 |
| `complete-sprint-dialog.ts` | Dialog Complete Sprint             |
| `firestore.rules`           | Security rules                     |

---

**Tài liệu này được tạo ngày**: 2026-01-20
**Version**: 1.0
**Author**: AI Assistant (Claude 4.5 Sonnet)
