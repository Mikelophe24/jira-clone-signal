# Tài liệu Chi tiết: Các Luồng Hoạt Động Chính của Jira Clone

## 📋 Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Luồng Xác Thực (Authentication Flow)](#2-luồng-xác-thực-authentication-flow)
3. [Luồng Quản Lý Dự Án (Project Management Flow)](#3-luồng-quản-lý-dự-án-project-management-flow)
4. [Luồng Quản Lý Sprint (Sprint Management Flow)](#4-luồng-quản-lý-sprint-sprint-management-flow)
5. [Luồng Quản Lý Issue/Task (Issue Management Flow)](#5-luồng-quản-lý-issuetask-issue-management-flow)
6. [Luồng Kanban Board (Board Flow)](#6-luồng-kanban-board-board-flow)
7. [Luồng Backlog Planning](#7-luồng-backlog-planning)
8. [Luồng Dashboard & My Tasks](#8-luồng-dashboard--my-tasks)
9. [Hệ Thống Phân Quyền (Authorization System)](#9-hệ-thống-phân-quyền-authorization-system)

---

## 1. Tổng Quan Kiến Trúc

### 1.1 Tech Stack

- **Frontend Framework**: Angular 21 (Standalone Components)
- **State Management**: NgRx Signals (@ngrx/signals)
- **Backend**: Firebase (Firestore + Authentication)
- **UI Library**: Angular Material
- **Drag & Drop**: Angular CDK
- **Styling**: SCSS với CSS Variables (Theme Support)

### 1.2 Cấu Trúc Thư Mục

```
src/app/
├── core/                    # Core services & utilities
│   ├── auth/               # Authentication (AuthStore, AuthService, AuthGuard)
│   ├── services/           # Shared services (ErrorNotificationService)
│   ├── theme/              # Theme management (ThemeStore)
│   └── models/             # Core models
├── features/               # Feature modules
│   ├── auth/              # Login component
│   ├── projects/          # Project management
│   ├── board/             # Board & Sprint management
│   ├── issue/             # Issue dialog & service
│   ├── home/              # Dashboard
│   └── my-tasks/          # Personal task view
└── shared/                # Shared utilities
    └── store-features/    # Custom store features (withLoadingError)
```

### 1.3 State Management Architecture

Dự án sử dụng **NgRx Signals** với pattern:

- **signalStore**: Tạo store với reactive signals
- **withState**: Định nghĩa state structure
- **withComputed**: Tạo derived state (computed values)
- **withMethods**: Định nghĩa actions/methods
- **withHooks**: Lifecycle hooks (onInit)
- **rxMethod**: Reactive methods với RxJS operators

**Các Store chính:**

- `AuthStore`: Quản lý authentication state
- `ProjectsStore`: Quản lý projects, members, invites
- `BoardStore`: Quản lý issues và filtering
- `SprintStore`: Quản lý sprints
- `MyTasksStore`: Quản lý personal tasks
- `ThemeStore`: Quản lý dark/light theme

---

## 2. Luồng Xác Thực (Authentication Flow)

### 2.1 Cấu Trúc AuthStore

**File**: `src/app/core/auth/auth.store.ts`

**State:**

```typescript
type AuthState = {
  user: User | null; // Firebase User object
};
```

**Methods:**

- `loginGoogle()`: Đăng nhập bằng Google OAuth
- `loginEmail(email, password)`: Đăng nhập bằng Email/Password
- `register(email, password, name)`: Đăng ký tài khoản mới
- `logout()`: Đăng xuất
- `_setUser(user)`: Internal method để update user state

### 2.2 Chi Tiết Luồng Đăng Nhập

#### A. Đăng Nhập Google (loginGoogle)

```
1. User clicks "Login with Google" button
   ↓
2. AuthStore.loginGoogle() được gọi
   ↓
3. Set loading = true, clear errors
   ↓
4. AuthService.loginWithGoogle() mở popup Google OAuth
   ↓
5. User chọn tài khoản Google
   ↓
6. Firebase xác thực và trả về User object
   ↓
7. AuthService.user$ (Observable) emit user mới
   ↓
8. AuthStore.onInit hook subscribe và gọi _setUser(user)
   ↓
9. State được update: { user: User }
   ↓
10. AuthGuard kiểm tra user !== null
   ↓
11. Router navigate to '/home'
   ↓
12. ErrorNotificationService.showSuccess("Welcome!")
```

**Xử lý lỗi:**

- Popup closed by user: Silent fail (không hiện lỗi)
- Network error: Show error notification
- Invalid credentials: Show error message

#### B. Đăng Nhập Email/Password

```
1. User nhập email & password trong LoginComponent
   ↓
2. Form submit → AuthStore.loginEmail(email, pass)
   ↓
3. AuthService.loginWithEmail() gọi Firebase signInWithEmailAndPassword
   ↓
4. Firebase xác thực credentials
   ↓
5. Nếu thành công: User object được emit qua user$ Observable
   ↓
6. AuthStore._setUser() update state
   ↓
7. Navigate to '/home'
```

#### C. Đăng Ký (Register)

```
1. User nhập email, password, displayName
   ↓
2. AuthStore.register(email, pass, name)
   ↓
3. AuthService.registerWithEmail() gọi createUserWithEmailAndPassword
   ↓
4. Firebase tạo user mới
   ↓
5. Update profile với displayName: updateProfile(user, { displayName: name })
   ↓
6. User được tự động đăng nhập
   ↓
7. Navigate to '/home'
```

### 2.3 AuthGuard - Route Protection

**File**: `src/app/core/auth/auth.guard.ts`

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.user()) {
    return true; // Cho phép truy cập
  } else {
    router.navigate(['/login']);
    return false; // Chặn truy cập
  }
};
```

**Protected Routes:**

- `/home`
- `/projects`
- `/project/:projectId`
- `/my-tasks`

### 2.4 Persistent Authentication

Firebase tự động lưu auth state vào localStorage/IndexedDB:

```
1. User đăng nhập lần đầu
   ↓
2. Firebase lưu token vào browser storage
   ↓
3. User refresh page hoặc quay lại sau
   ↓
4. AuthService.onInit() subscribe to onAuthStateChanged
   ↓
5. Firebase tự động restore session
   ↓
6. user$ emit User object
   ↓
7. AuthStore._setUser() update state
   ↓
8. User vẫn đăng nhập (không cần login lại)
```

---

## 3. Luồng Quản Lý Dự Án (Project Management Flow)

### 3.1 Cấu Trúc ProjectsStore

**File**: `src/app/features/projects/projects.store.ts`

**State:**

```typescript
type ProjectsState = {
  projects: Project[]; // Danh sách dự án user tham gia
  projectOwners: AppUser[]; // Danh sách owners của các project
  members: AppUser[]; // Members của project đang chọn
  pendingInvites: Project[]; // Lời mời chưa accept
  selectedProjectId: string | null;
};
```

**Computed:**

```typescript
selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId()));
```

### 3.2 Luồng Tạo Dự Án Mới

```
1. User vào /projects page
   ↓
2. Nhập Project Name & Key (VD: "My Project", "MYPROJ")
   ↓
3. ProjectList.createProject(name, key)
   ↓
4. ProjectsService.addProject({
     name,
     key,
     ownerId: currentUser.uid,
     memberIds: [currentUser.uid],
     roles: { [currentUser.uid]: 'admin' }
   })
   ↓
5. Firestore.collection('projects').add(...)
   ↓
6. Firestore Rules kiểm tra:
   - User đã đăng nhập? ✓
   - ownerId === request.auth.uid? ✓
   - memberIds chứa ownerId? ✓
   ↓
7. Document được tạo với auto-generated ID
   ↓
8. ProjectsStore.loadProjects() (rxMethod) subscribe to Firestore
   ↓
9. Firestore snapshot listener emit new project
   ↓
10. patchState(store, { projects: [...] })
   ↓
11. UI tự động update (reactive)
   ↓
12. User có thể click vào project → navigate to /project/:projectId
```

### 3.3 Luồng Mời Thành Viên (Invite User)

```
1. User (Admin/Owner) mở Members Dialog
   ↓
2. Nhập email của người muốn mời
   ↓
3. Chọn role: 'admin' | 'member' | 'viewer'
   ↓
4. ProjectsStore.inviteUser(email, role)
   ↓
5. ProjectsService.getUserByEmail(email)
   ↓
6. Firestore query: users collection where email == input
   ↓
7. Nếu tìm thấy user:
   ↓
8. ProjectsService.updateProject(projectId, {
     invitedMemberIds: arrayUnion(userId),
     roles: { ...roles, [userId]: role }
   })
   ↓
9. Firestore update document
   ↓
10. Người được mời thấy notification badge trên toolbar
   ↓
11. ProjectsStore.loadInvites() load pending invites
   ↓
12. UI hiển thị invite trong notification menu
```

### 3.4 Luồng Chấp Nhận Lời Mời

```
1. User thấy notification badge (số lượng pending invites)
   ↓
2. Click notification icon → mở menu
   ↓
3. Thấy danh sách invites: "Invitation to [Project] by [Owner]"
   ↓
4. Click Accept (✓) button
   ↓
5. AppComponent.accept(invite)
   ↓
6. ProjectsStore.acceptInvite(invite, userId)
   ↓
7. ProjectsService.updateProject(projectId, {
     memberIds: arrayUnion(userId),
     invitedMemberIds: arrayRemove(userId)
   })
   ↓
8. Firestore update: move user từ invitedMemberIds → memberIds
   ↓
9. ProjectsStore.loadProjects() refresh
   ↓
10. Project xuất hiện trong sidebar
   ↓
11. User có thể truy cập project
```

### 3.5 Luồng Xóa Thành Viên

```
1. Admin/Owner mở Members Dialog
   ↓
2. Click Remove button bên cạnh member
   ↓
3. Confirm dialog: "Are you sure?"
   ↓
4. ProjectsStore.removeMember(memberId)
   ↓
5. Check: Không thể xóa owner
   ↓
6. ProjectsService.updateProject(projectId, {
     memberIds: arrayRemove(memberId),
     roles: { ...roles, [memberId]: FieldValue.delete() }
   })
   ↓
7. Firestore update
   ↓
8. Đồng thời: IssueService.batchUpdateIssues()
   - Tìm tất cả issues có assigneeId === memberId
   - Set assigneeId = null (unassign)
   ↓
9. Member bị remove khỏi project
   ↓
10. Member không còn thấy project trong sidebar
```

---

## 4. Luồng Quản Lý Sprint (Sprint Management Flow)

### 4.1 Cấu Trúc SprintStore

**File**: `src/app/features/board/sprint.store.ts`

**State:**

```typescript
type SprintState = {
  sprints: Sprint[];
};
```

**Sprint Model:**

```typescript
interface Sprint {
  id: string;
  projectId: string;
  name: string;
  status: 'future' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  goal?: string;
}
```

**Computed:**

```typescript
activeSprint: computed(() => sprints().find((s) => s.status === 'active'));
activeSprints: computed(() => sprints().filter((s) => s.status === 'active'));
futureSprints: computed(() => sprints().filter((s) => s.status === 'future'));
completedSprints: computed(() => sprints().filter((s) => s.status === 'completed'));
```

### 4.2 Luồng Tạo Sprint

```
1. User vào /project/:id/backlog
   ↓
2. Click "Create Sprint" button
   ↓
3. Backlog.createSprint()
   ↓
4. Tự động tạo sprint với:
   - name: "Sprint {count + 1}"
   - status: 'future'
   - startDate: today
   - endDate: today + 14 days
   ↓
5. SprintStore.addSprint(sprintData)
   ↓
6. SprintService.addSprint() → Firestore.collection('sprints').add()
   ↓
7. Firestore Rules check: isProjectAdmin(projectId)? ✓
   ↓
8. Sprint document được tạo
   ↓
9. SprintStore.loadSprints() listener emit new sprint
   ↓
10. UI hiển thị sprint mới trong Backlog view
```

### 4.3 Luồng Bắt Đầu Sprint (Start Sprint)

```
1. User thấy Future Sprint trong Backlog
   ↓
2. Kéo issues vào sprint (drag & drop)
   ↓
3. Click "Start Sprint" button
   ↓
4. Backlog.startSprint(sprint)
   ↓
5. Check: Sprint có issues không?
   - Nếu rỗng → alert("Please add issues...")
   ↓
6. Mở StartSprintDialog:
   - Hiển thị: Sprint name, dates, goal
   - User có thể edit dates & goal
   ↓
7. User click "Start" trong dialog
   ↓
8. Dialog close với updates: {
     status: 'active',
     startDate: selectedDate,
     endDate: selectedDate,
     goal: goalText
   }
   ↓
9. SprintStore.updateSprint(sprintId, updates)
   ↓
10. SprintService.updateSprint() → Firestore update
   ↓
11. **Quan trọng**: Batch update tất cả issues trong sprint:
    IssueService.batchUpdateIssues([
      { id: issue1.id, data: { isInBacklog: false } },
      { id: issue2.id, data: { isInBacklog: false } },
      ...
    ])
   ↓
12. Issues chuyển từ Backlog → Board
   ↓
13. Router.navigate(['../board'])
   ↓
14. User thấy sprint đang chạy trên Kanban Board
```

**Ý nghĩa của `isInBacklog` flag:**

- `isInBacklog: true` → Issue nằm trong Backlog view (planning phase)
- `isInBacklog: false` → Issue nằm trên Board view (execution phase)

### 4.4 Luồng Kết Thúc Sprint (Complete Sprint)

```
1. User vào Board view, thấy Active Sprint
   ↓
2. Click "Complete Sprint" button
   ↓
3. Backlog.completeSprint(sprint)
   ↓
4. Mở CompleteSprintDialog:
   - Hiển thị thống kê:
     * Total issues: X
     * Completed (Done): Y
     * Incomplete (Todo/In Progress): Z
   - Dropdown: "Move incomplete issues to:"
     * Options: Backlog, Future Sprint 1, Future Sprint 2...
   ↓
5. User chọn destination và click "Complete"
   ↓
6. Dialog close với result: { destinationId: 'sprint-id' | null }
   ↓
7. SprintStore.completeSprint(sprintId)
   ↓
8. SprintService.updateSprint(sprintId, { status: 'completed' })
   ↓
9. **Xử lý Issues:**

   A. Incomplete Issues (statusColumnId !== 'done'):
      IssueService.batchUpdateIssues([
        {
          id: incompleteIssue.id,
          data: {
            sprintId: destinationId,  // null (backlog) hoặc future sprint ID
            isInBacklog: true         // Trả về planning phase
          }
        },
        ...
      ])

   B. Completed Issues (statusColumnId === 'done'):
      IssueService.batchUpdateIssues([
        {
          id: completedIssue.id,
          data: {
            isArchived: true,  // Soft delete - giữ lại lịch sử
            // sprintId giữ nguyên để biết issue thuộc sprint nào
          }
        },
        ...
      ])
   ↓
10. Sprint status = 'completed'
   ↓
11. Incomplete issues xuất hiện ở destination
   ↓
12. Completed issues bị ẩn khỏi tất cả views (archived)
   ↓
13. Sprint biến mất khỏi Backlog view (filter: status !== 'completed')
```

**Lưu ý về Archive:**

- Archived issues KHÔNG bị xóa khỏi database
- Chúng được giữ lại để báo cáo/thống kê
- BoardStore filter: `!issue.isArchived`
- Có thể tạo view riêng để xem archived issues

---

## 5. Luồng Quản Lý Issue/Task (Issue Management Flow)

### 5.1 Cấu Trúc BoardStore

**File**: `src/app/features/board/board.store.ts`

**State:**

```typescript
type BoardState = {
  issues: Issue[];
  filter: BoardFilter;
};

type BoardFilter = {
  searchQuery: string;
  onlyMyIssues: boolean;
  userId: string | null;
  assignee: string[];
  status: string[];
  priority: string[];
};
```

**Issue Model:**

```typescript
interface Issue {
  id: string;
  key: string; // VD: "PROJ-123"
  title: string;
  description: string;
  type: 'story' | 'bug' | 'task';
  priority: 'low' | 'medium' | 'high';
  statusColumnId: 'todo' | 'in-progress' | 'done';
  projectId: string;
  boardId: string;
  sprintId: string | null;
  assigneeId: string | null;
  reporterId: string;
  order: number; // Thứ tự hiển thị
  isInBacklog: boolean; // true = Backlog, false = Board
  isArchived?: boolean; // true = đã archive
  dueDate?: string;
  comments: Comment[];
  subtasks: Subtask[];
}
```

### 5.2 Luồng Tạo Issue Mới

```
1. User click "Create Issue" (từ Backlog hoặc Board)
   ↓
2. Mở IssueDialog với mode = 'create'
   ↓
3. User điền form:
   - Title (required)
   - Description (rich text editor)
   - Type: Story/Bug/Task
   - Priority: Low/Medium/High
   - Assignee: Dropdown members
   - Sprint: Dropdown sprints (hoặc null = backlog)
   - Due Date (optional)
   - Subtasks (optional)
   ↓
4. User click "Save"
   ↓
5. IssueDialog.save()
   ↓
6. Tạo payload:
   {
     title: formValue.title,
     description: formValue.description,
     type: formValue.type,
     priority: formValue.priority,
     statusColumnId: 'todo',  // Mặc định
     projectId: currentProjectId,
     boardId: currentProjectId,
     key: BoardStore.getNextIssueKey(projectKey),  // Auto-generate
     reporterId: currentUser.uid,
     assigneeId: formValue.assigneeId || null,
     sprintId: formValue.sprintId || null,
     isInBacklog: true,  // Mặc định tạo trong backlog
     order: 0,
     comments: [],
     subtasks: formValue.subtasks || []
   }
   ↓
7. BoardStore.addIssue(payload)
   ↓
8. IssueService.addIssue() → Firestore.collection('issues').add()
   ↓
9. Firestore Rules check:
   - isProjectMember(projectId)? ✓
   - !isProjectViewer(projectId)? ✓
   - isValidIssue()? ✓
   ↓
10. Issue document được tạo
   ↓
11. BoardStore.loadIssues() listener emit new issue
   ↓
12. UI tự động hiển thị issue mới
```

**Auto-generate Issue Key:**

```typescript
getNextIssueKey(projectKey: string): string {
  const projectIssues = this.issues().filter(i =>
    i.key.startsWith(projectKey)
  );
  const maxNumber = Math.max(
    ...projectIssues.map(i =>
      parseInt(i.key.split('-')[1]) || 0
    ),
    0
  );
  return `${projectKey}-${maxNumber + 1}`;
}
// VD: "PROJ-1", "PROJ-2", "PROJ-3"...
```

### 5.3 Luồng Cập Nhật Issue

```
1. User click vào issue card (từ Board hoặc Backlog)
   ↓
2. Mở IssueDialog với mode = 'edit', data = issue
   ↓
3. Form được pre-fill với dữ liệu hiện tại
   ↓
4. User chỉnh sửa:
   - Title, description
   - Type, priority
   - Assignee
   - Sprint
   - Status
   - Due date
   ↓
5. User click "Save"
   ↓
6. IssueDialog.save()
   ↓
7. Tạo updates object (chỉ những field thay đổi):
   {
     title: newTitle,
     priority: newPriority,
     assigneeId: newAssigneeId,
     ...
   }
   ↓
8. BoardStore.updateIssue(issueId, updates)
   ↓
9. IssueService.updateIssue() → Firestore.doc('issues/id').update()
   ↓
10. Firestore Rules check:
    - isProjectMember? ✓
    - !isProjectViewer? ✓
    - notChangingProjectId? ✓
    - Nếu user là assignee/reporter/admin → Allow full update
    - Nếu user là member thường → Chỉ cho phép update status & order
   ↓
11. Document được update
   ↓
12. Firestore listener emit updated issue
   ↓
13. patchState: update issue trong array
   ↓
14. UI tự động reflect changes
```

### 5.4 Luồng Thêm Comment

```
1. User mở IssueDialog (edit mode)
   ↓
2. Scroll xuống Comments section
   ↓
3. Nhập text vào comment input
   ↓
4. Click "Add Comment" hoặc press Enter
   ↓
5. IssueDialog.addComment()
   ↓
6. Tạo comment object:
   {
     id: generateId(),
     userId: currentUser.uid,
     text: commentText,
     createdAt: new Date().toISOString()
   }
   ↓
7. Nếu đang edit existing issue:
   - IssueService.updateIssue(issueId, {
       comments: arrayUnion(newComment)
     })
   - Firestore update ngay lập tức
   ↓
8. Nếu đang tạo issue mới:
   - Lưu comment vào local state (form.value.comments)
   - Sẽ được save cùng issue khi click "Save"
   ↓
9. UI hiển thị comment mới với:
   - Avatar người comment
   - Display name
   - Timestamp (relative: "2 minutes ago")
   - Comment text
```

### 5.5 Luồng Thêm/Toggle Subtask

```
1. User mở IssueDialog
   ↓
2. Scroll xuống Subtasks section
   ↓
3. Nhập subtask title và click "Add"
   ↓
4. IssueDialog.addSubtask()
   ↓
5. Tạo subtask object:
   {
     id: generateId(),
     title: subtaskTitle,
     completed: false
   }
   ↓
6. Nếu edit mode:
   - IssueService.updateIssue(issueId, {
       subtasks: [...existingSubtasks, newSubtask]
     })
   ↓
7. Nếu create mode:
   - Push vào local array
   ↓
8. UI hiển thị subtask với checkbox
   ↓
9. User click checkbox để toggle:
   ↓
10. IssueDialog.toggleSubtask(subtask)
   ↓
11. Update subtask.completed = !subtask.completed
   ↓
12. IssueService.updateIssue(issueId, { subtasks: updatedArray })
   ↓
13. Progress bar tự động update:
    calculateProgress() {
      const total = subtasks.length;
      const completed = subtasks.filter(s => s.completed).length;
      return (completed / total) * 100;
    }
```

### 5.6 Luồng Xóa Issue

```
1. User click Delete button trên issue card
   ↓
2. Confirm dialog: "Are you sure you want to delete PROJ-123?"
   ↓
3. User confirm
   ↓
4. BoardStore.deleteIssue(issueId)
   ↓
5. IssueService.deleteIssue() → Firestore.doc('issues/id').delete()
   ↓
6. Firestore Rules check:
   - reporterId === currentUser.uid? ✓ (người tạo)
   - OR isProjectAdmin(projectId)? ✓
   ↓
7. Document bị xóa vĩnh viễn
   ↓
8. Firestore listener emit deletion event
   ↓
9. patchState: remove issue khỏi array
   ↓
10. UI tự động xóa issue card
```

---

## 6. Luồng Kanban Board (Board Flow)

### 6.1 Cấu Trúc Board Component

**File**: `src/app/features/board/board/board.ts`

**Columns:**

- **TODO**: Issues chưa bắt đầu
- **IN PROGRESS**: Issues đang làm
- **DONE**: Issues đã hoàn thành

**Computed Issues:**

```typescript
todoIssues = computed(() => filteredIssues().filter((i) => i.statusColumnId === 'todo'));
inProgressIssues = computed(() =>
  filteredIssues().filter((i) => i.statusColumnId === 'in-progress'),
);
doneIssues = computed(() => filteredIssues().filter((i) => i.statusColumnId === 'done'));
```

### 6.2 Luồng Drag & Drop Issue

````
1. User kéo issue card từ TODO column
   ↓
2. CDK Drag & Drop bắt đầu drag operation
   ↓
3. User thả vào IN PROGRESS column
   ↓
4. Event: CdkDragDrop<Issue[]> được emit
   ↓
5. Board.drop(event, 'in-progress')
   ↓
6. BoardStore.moveIssue(event, 'in-progress')
   ↓
7. Check: Cùng column hay khác column?

   A. Cùng column (reorder):
      - moveItemInArray(array, oldIndex, newIndex)
      - Tính toán order mới dựa trên vị trí
      - Update chỉ 1 issue

   B. Khác column (transfer):
      - transferArrayItem(sourceArray, targetArray, oldIndex, newIndex)
      - Update statusColumnId = newStatus
      - Tính toán order mới trong target column
      - Update issue
   ↓
8. Tính toán order mới:
   ```typescript
   const targetIssues = getIssuesByStatus(newStatus);
   let newOrder: number;

   if (targetIndex === 0) {
     // Đầu danh sách
     newOrder = targetIssues[0].order - 1;
   } else if (targetIndex >= targetIssues.length) {
     // Cuối danh sách
     newOrder = targetIssues[targetIssues.length - 1].order + 1;
   } else {
     // Giữa 2 issues
     const prevOrder = targetIssues[targetIndex - 1].order;
     const nextOrder = targetIssues[targetIndex].order;
     newOrder = (prevOrder + nextOrder) / 2;
   }
````

↓ 9. IssueService.updateIssue(issueId, {
statusColumnId: newStatus,
order: newOrder
})
↓ 10. Firestore update
↓ 11. UI tự động reflect new position

```

**Fractional Ordering:**
- Sử dụng số thực (float) thay vì số nguyên
- Cho phép insert giữa 2 items mà không cần reorder toàn bộ
- VD: order = 1, 2, 3 → insert giữa 1 và 2 → order = 1.5

### 6.3 Luồng Filter Issues

```

1. User nhập text vào search box
   ↓
2. Board.onSearch(event)
   ↓
3. BoardStore.updateFilter({ searchQuery: text })
   ↓
4. patchState: update filter.searchQuery
   ↓
5. Computed filteredIssues tự động re-compute:
   ```typescript
   filteredIssues = computed(() => {
     let issues = store.issues();

     // Filter by search query
     if (filter.searchQuery) {
       issues = issues.filter(
         (i) => i.title.toLowerCase().includes(query) || i.key.toLowerCase().includes(query),
       );
     }

     // Filter by assignee
     if (filter.assignee.length > 0) {
       issues = issues.filter((i) => filter.assignee.includes(i.assigneeId));
     }

     // Filter by status
     if (filter.status.length > 0) {
       issues = issues.filter((i) => filter.status.includes(i.statusColumnId));
     }

     // Filter by priority
     if (filter.priority.length > 0) {
       issues = issues.filter((i) => filter.priority.includes(i.priority));
     }

     // Filter "Only My Issues"
     if (filter.onlyMyIssues && filter.userId) {
       issues = issues.filter((i) => i.assigneeId === filter.userId);
     }

     // Filter out backlog & archived
     issues = issues.filter((i) => !i.isInBacklog && !i.isArchived);

     // Filter by active sprint
     const activeSprint = sprintStore.activeSprint();
     if (activeSprint) {
       issues = issues.filter((i) => i.sprintId === activeSprint.id);
     }

     return issues;
   });
   ```
   ↓
6. todoIssues, inProgressIssues, doneIssues tự động update
   ↓
7. UI re-render với filtered results

```

### 6.4 Luồng "Only My Issues" Toggle

```

1. User click toggle "Only My Issues"
   ↓
2. Board.toggleMyIssues()
   ↓
3. BoardStore.updateFilter({
   onlyMyIssues: !currentValue,
   userId: currentUser.uid
   })
   ↓
4. filteredIssues re-compute
   ↓
5. Chỉ hiển thị issues có assigneeId === currentUser.uid

````

---

## 7. Luồng Backlog Planning

### 7.1 Cấu Trúc Backlog Component
**File**: `src/app/features/board/backlog/backlog.ts`

**Sections:**
1. **Active Sprint** (nếu có)
2. **Future Sprints**
3. **Backlog** (issues chưa assign vào sprint)

**Computed:**
```typescript
backlogIssues = computed(() =>
  boardStore.issues().filter(i => !i.sprintId && i.isInBacklog)
)

sprintIssuesMap = computed(() => {
  const map = new Map<string, Issue[]>();
  boardStore.issues().forEach(i => {
    if (i.sprintId) {
      if (!map.has(i.sprintId)) map.set(i.sprintId, []);
      map.get(i.sprintId)!.push(i);
    }
  });
  return map;
})

visibleSprints = computed(() =>
  sprintStore.sprints().filter(s => s.status !== 'completed')
)
````

### 7.2 Luồng Drag & Drop trong Backlog

````
1. User kéo issue từ Backlog
   ↓
2. Thả vào Future Sprint
   ↓
3. Event: CdkDragDrop<Issue[]>
   ↓
4. Backlog.drop(event, targetSprintId)
   ↓
5. Check: Cùng container hay khác container?

   A. Cùng container (reorder):
      - moveItemInArray()
      - Không update Firestore (chỉ visual)

   B. Khác container (transfer):
      - transferArrayItem()
      - Xác định targetSprintId
      ↓
6. Tạo updates:
   ```typescript
   const updates: Partial<Issue> = {
     sprintId: targetSprintId
   };

   if (targetSprintId) {
     const sprint = sprintStore.sprints().find(s => s.id === targetSprintId);

     if (sprint.status === 'active') {
       // Di chuyển vào active sprint → lên board
       updates.isInBacklog = false;
     } else {
       // Di chuyển vào future sprint → vẫn ở backlog
       updates.isInBacklog = true;
     }
   } else {
     // Di chuyển về backlog chung
     updates.isInBacklog = true;
     updates.sprintId = null;
   }
````

↓ 7. BoardStore.updateIssue(issueId, updates)
↓ 8. Firestore update
↓ 9. UI tự động reflect changes

```

**Ý nghĩa:**
- **Backlog → Future Sprint**: Issue được plan cho sprint tương lai
- **Backlog → Active Sprint**: Issue lên board ngay (isInBacklog = false)
- **Sprint → Backlog**: Issue quay về planning phase
- **Future Sprint → Active Sprint**: Khi start sprint

### 7.3 Luồng Sprint Planning Session

```

Scenario: Team planning Sprint 3

1. Scrum Master tạo "Sprint 3"
   ↓
2. Team review Backlog (100 issues)
   ↓
3. Ưu tiên issues theo:
   - Priority (High → Low)
   - Business value
   - Dependencies
     ↓
4. Kéo top 20 issues vào Sprint 3
   ↓
5. Estimate capacity:
   - Team size: 5 người
   - Sprint duration: 2 tuần
   - Velocity: ~40 story points
     ↓
6. Adjust: Thêm/bớt issues cho phù hợp
   ↓
7. Set Sprint Goal: "Complete user authentication flow"
   ↓
8. Click "Start Sprint"
   ↓
9. Dialog: Confirm dates & goal
   ↓
10. Sprint 3 status = 'active'
    ↓
11. 20 issues chuyển lên Board
    ↓
12. Team bắt đầu làm việc

````

---

## 8. Luồng Dashboard & My Tasks

### 8.1 Home Dashboard
**File**: `src/app/features/home/home.ts`

**Sections:**
1. **Projects Overview**: Danh sách projects với stats
2. **Assigned Tasks**: Tasks được assign cho user
3. **Recent Activity**: (Future feature)

**Computed:**
```typescript
assignedTasks = computed(() => {
  const userId = authStore.user()?.uid;
  return myTasksStore.tasks().filter(t =>
    t.assigneeId === userId &&
    !t.isArchived
  ).slice(0, 5);  // Top 5 tasks
})

projectStats = computed(() => {
  return projectsStore.projects().map(project => {
    const projectIssues = myTasksStore.tasks().filter(t =>
      t.projectId === project.id
    );

    return {
      project,
      totalIssues: projectIssues.length,
      completedIssues: projectIssues.filter(i =>
        i.statusColumnId === 'done'
      ).length,
      overdueIssues: projectIssues.filter(i =>
        isOverdue(i.dueDate, i.statusColumnId)
      ).length
    };
  });
})
````

**Luồng Load Dashboard:**

````
1. User đăng nhập → navigate to /home
   ↓
2. Home component ngOnInit
   ↓
3. Effect triggers:
   ```typescript
   effect(() => {
     const userId = authStore.user()?.uid;
     if (userId) {
       projectsStore.loadProjects(userId);
       myTasksStore.loadTasks(userId);
     }
   })
````

↓ 4. ProjectsStore.loadProjects() load all projects
↓ 5. MyTasksStore.loadTasks() load all assigned tasks
↓ 6. Computed values tự động calculate
↓ 7. UI render:

- Project cards với progress bars
- Assigned tasks list với priority icons
- Overdue badges

````

### 8.2 My Tasks View
**File**: `src/app/features/my-tasks/my-tasks.ts`

**Features:**
- Table view với columns: Project, Title, Priority, Status, Due Date
- Search & Filter
- Sort by columns
- Click row → navigate to project

**Computed:**
```typescript
filteredTasks = computed(() => {
  let tasks = store.tasks();

  // Search
  const query = searchQuery().toLowerCase();
  if (query) {
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.key.toLowerCase().includes(query)
    );
  }

  // Filter by status
  if (statusFilter()) {
    tasks = tasks.filter(t =>
      t.statusColumnId === statusFilter()
    );
  }

  // Filter by priority
  if (priorityFilter()) {
    tasks = tasks.filter(t =>
      t.priority === priorityFilter()
    );
  }

  // Sort
  tasks.sort((a, b) => {
    if (sortBy() === 'dueDate') {
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (sortBy() === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return 0;
  });

  return tasks;
})
````

---

## 9. Hệ Thống Phân Quyền (Authorization System)

### 9.1 Firestore Security Rules

**File**: `firestore.rules`

**Roles:**

- **Owner**: Người tạo project (ownerId)
- **Admin**: Quyền quản trị (roles[userId] === 'admin')
- **Member**: Thành viên thông thường (memberIds contains userId)
- **Viewer**: Chỉ xem (roles[userId] === 'viewer')

### 9.2 Permission Matrix

| Action              | Owner    | Admin    | Member          | Viewer |
| ------------------- | -------- | -------- | --------------- | ------ |
| **Projects**        |
| Read project        | ✓        | ✓        | ✓               | ✓      |
| Create project      | ✓        | -        | -               | -      |
| Update project      | ✓ (full) | ✓ (full) | ✓ (limited)     | ✗      |
| Delete project      | ✓        | ✗        | ✗               | ✗      |
| Invite members      | ✓        | ✓        | ✗               | ✗      |
| Remove members      | ✓        | ✓        | ✗               | ✗      |
| **Sprints**         |
| Read sprints        | ✓        | ✓        | ✓               | ✓      |
| Create sprint       | ✓        | ✓        | ✗               | ✗      |
| Update sprint       | ✓ (full) | ✓ (full) | ✓ (status only) | ✗      |
| Delete sprint       | ✓        | ✓        | ✗               | ✗      |
| Start sprint        | ✓        | ✓        | ✓               | ✗      |
| Complete sprint     | ✓        | ✓        | ✓               | ✗      |
| **Issues**          |
| Read issues         | ✓        | ✓        | ✓               | ✓      |
| Create issue        | ✓        | ✓        | ✓               | ✗      |
| Update own issue    | ✓        | ✓        | ✓               | ✗      |
| Update any issue    | ✓        | ✓        | ✗               | ✗      |
| Update status/order | ✓        | ✓        | ✓               | ✗      |
| Delete own issue    | ✓        | ✓        | ✓               | ✗      |
| Delete any issue    | ✓        | ✓        | ✗               | ✗      |

### 9.3 Chi Tiết Rules

#### A. Project Rules

```javascript
// Read: Member OR Invited OR has role
allow read: if signedIn() && (
  resource.data.ownerId == request.auth.uid ||
  resource.data.memberIds.hasAny([request.auth.uid]) ||
  resource.data.roles.keys().hasAny([request.auth.uid]) ||
  resource.data.invitedMemberIds.hasAny([request.auth.uid])
);

// Create: Strict schema validation
allow create: if signedIn() && isValidNewProject();

// Update:
// - Owner: full update (except ownerId)
// - Member/Invited: cannot change name/key/ownerId
allow update: if signedIn() && (
  (
    resource.data.ownerId == request.auth.uid &&
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['ownerId'])
  ) ||
  (
    (
      resource.data.memberIds.hasAny([request.auth.uid]) ||
      resource.data.invitedMemberIds.hasAny([request.auth.uid])
    ) &&
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['name', 'key', 'ownerId'])
  )
);

// Delete: Owner only
allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;
```

#### B. Issue Rules

```javascript
// Read: Assignee OR Project Member
allow read: if signedIn() && (
  resource.data.assigneeId == request.auth.uid ||
  isProjectMember(resource.data.projectId)
);

// Create: Member (not viewer) + Valid schema
allow create: if signedIn()
  && isProjectMember(request.resource.data.projectId)
  && !isProjectViewer(request.resource.data.projectId)
  && isValidIssue();

// Update:
// - Assignee/Reporter/Admin: Full update
// - Member: Only status & order
allow update: if signedIn()
  && isProjectMember(resource.data.projectId)
  && !isProjectViewer(resource.data.projectId)
  && notChangingProjectId()
  && (
    (
      resource.data.assigneeId == request.auth.uid ||
      resource.data.reporterId == request.auth.uid ||
      isProjectAdmin(resource.data.projectId)
    ) ||
    (
      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'order'])
    )
  );

// Delete: Reporter OR Admin
allow delete: if signedIn() && (
  resource.data.reporterId == request.auth.uid ||
  isProjectAdmin(resource.data.projectId)
);
```

#### C. Sprint Rules

```javascript
// Read: Project Member
allow read: if signedIn() && isProjectMember(resource.data.projectId);

// Create: Admin only
allow create: if signedIn()
  && isProjectAdmin(request.resource.data.projectId)
  && !isProjectViewer(request.resource.data.projectId);

// Update:
// - Admin: Full update
// - Member: Only status (Start/Complete)
allow update: if signedIn()
  && isProjectMember(resource.data.projectId)
  && !isProjectViewer(resource.data.projectId)
  && (
    isProjectAdmin(resource.data.projectId) ||
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
  );

// Delete: Admin only
allow delete: if signedIn() && isProjectAdmin(resource.data.projectId);
```

### 9.4 Helper Functions

```javascript
function signedIn() {
  return request.auth != null;
}

function getProject(projectId) {
  return get(/databases/$(database)/documents/projects/$(projectId));
}

function isProjectMember(projectId) {
  let project = getProject(projectId);
  return project != null && (
    project.data.ownerId == request.auth.uid ||
    project.data.memberIds.hasAny([request.auth.uid]) ||
    project.data.roles.keys().hasAny([request.auth.uid])
  );
}

function isProjectAdmin(projectId) {
  let project = getProject(projectId);
  return project != null && (
    project.data.ownerId == request.auth.uid ||
    (
      project.data.roles.keys().hasAny([request.auth.uid]) &&
      project.data.roles[request.auth.uid] == 'admin'
    )
  );
}

function isProjectViewer(projectId) {
  let project = getProject(projectId);
  return project != null &&
    project.data.ownerId != request.auth.uid &&
    project.data.roles.keys().hasAny([request.auth.uid]) &&
    project.data.roles[request.auth.uid] == 'viewer';
}

function isValidNewProject() {
  let data = request.resource.data;
  return data.keys().hasAll(['name', 'key', 'ownerId', 'memberIds'])
    && data.name is string && data.name.size() > 0
    && data.key is string && data.key.size() > 0
    && data.ownerId == request.auth.uid
    && data.memberIds is list
    && data.memberIds.hasAll([request.auth.uid]);
}

function isValidIssue() {
  let data = request.resource.data;
  return data.title is string && data.title.size() > 0
    && (!data.keys().hasAny(['type']) || data.type in ['story', 'bug', 'task']);
}

function notChangingProjectId() {
  return request.resource.data.projectId == resource.data.projectId;
}
```

---

## 10. Tổng Kết

### 10.1 Key Concepts

1. **Reactive State Management**:
   - NgRx Signals cho reactive state
   - Computed values tự động update
   - RxJS cho async operations

2. **Real-time Sync**:
   - Firestore snapshot listeners
   - Tự động sync giữa clients
   - Optimistic updates

3. **Separation of Concerns**:
   - Store: State management
   - Service: API calls
   - Component: UI logic
   - Rules: Security

4. **Type Safety**:
   - TypeScript interfaces
   - Strict typing
   - Compile-time checks

### 10.2 Best Practices

1. **State Updates**:
   - Luôn dùng patchState, không mutate trực tiếp
   - Computed cho derived state
   - Effect cho side effects

2. **Firestore Queries**:
   - Index cho performance
   - Limit results
   - Pagination cho large datasets

3. **Security**:
   - Validate ở cả client và server (rules)
   - Principle of least privilege
   - Audit logs (future)

4. **UX**:
   - Loading states
   - Error handling
   - Optimistic updates
   - Confirmation dialogs

### 10.3 Future Enhancements

1. **Features**:
   - Activity timeline
   - Email notifications
   - File attachments
   - Custom fields
   - Reports & analytics
   - Burndown charts

2. **Performance**:
   - Virtual scrolling
   - Lazy loading
   - Service worker
   - Offline support

3. **Collaboration**:
   - Real-time cursors
   - Live editing
   - Chat integration
   - @mentions

---

**Tài liệu này cung cấp cái nhìn toàn diện về cách dự án Jira Clone hoạt động. Mỗi luồng được mô tả chi tiết từ UI interaction → Component logic → Store management → Service calls → Firestore operations → Security rules → UI update.**
