# 📚 KIẾN TRÚC VÀ LUỒNG HOẠT ĐỘNG - JIRA CLONE

> **Tài liệu chi tiết về kiến trúc, luồng code và cách hoạt động của dự án Jira Clone**
>
> Phiên bản: 1.0 | Cập nhật: 07/01/2026

---

## 📋 MỤC LỤC

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Luồng Xác Thực (Authentication)](#3-luồng-xác-thực-authentication)
4. [Quản Lý State với NgRx Signals](#4-quản-lý-state-với-ngrx-signals)
5. [Hệ Thống Phân Quyền](#5-hệ-thống-phân-quyền)
6. [Luồng Quản Lý Projects](#6-luồng-quản-lý-projects)
7. [Luồng Quản Lý Issues](#7-luồng-quản-lý-issues)
8. [Kanban Board & Drag-Drop](#8-kanban-board--drag-drop)
9. [Chi Tiết Các Component](#9-chi-tiết-các-component)
10. [Firebase Security Rules](#10-firebase-security-rules)

---

## 1. TỔNG QUAN DỰ ÁN

### 🎯 Mục Đích

Xây dựng một ứng dụng quản lý dự án và task tương tự Jira, sử dụng công nghệ hiện đại nhất của Angular và Firebase.

### 🛠️ Tech Stack

| Công nghệ            | Phiên bản | Mục đích                                        |
| -------------------- | --------- | ----------------------------------------------- |
| **Angular**          | 18+       | Framework frontend với Standalone Components    |
| **NgRx Signals**     | Latest    | State management hiện đại, thay thế NgRx Store  |
| **Firebase**         | Latest    | Backend-as-a-Service (Auth, Firestore, Storage) |
| **Angular Material** | Latest    | UI Component Library                            |
| **Angular CDK**      | Latest    | Drag & Drop functionality                       |
| **TypeScript**       | 5+        | Type-safe development                           |

### 📁 Cấu Trúc Thư Mục

```
src/app/
├── core/
│   ├── auth/
│   │   ├── auth.service.ts       # Firebase Auth operations
│   │   ├── auth.store.ts         # Auth state management
│   │   └── auth.guard.ts         # Route protection
│   ├── components/
│   │   └── breadcrumbs/          # Navigation breadcrumbs
│   └── models/
│       └── app-user.model.ts     # User data model
│
├── features/
│   ├── auth/
│   │   └── login/                # Login/Register page
│   ├── board/
│   │   ├── board/                # Kanban board component
│   │   ├── backlog/              # Backlog management
│   │   └── board.store.ts        # Board state & drag-drop logic
│   ├── home/
│   │   └── home.ts               # Dashboard with statistics
│   ├── issue/
│   │   ├── issue-dialog/         # Create/Edit issue dialog
│   │   ├── issue.model.ts        # Issue data model
│   │   └── issue.service.ts      # Issue CRUD operations
│   ├── my-tasks/
│   │   ├── my-tasks.ts           # User's assigned tasks
│   │   └── my-tasks.store.ts     # My tasks state
│   └── projects/
│       ├── project-list/         # Projects overview
│       ├── project-layout/       # Project container
│       ├── members-dialog/       # Member management
│       ├── project.model.ts      # Project data model
│       ├── projects.service.ts   # Project CRUD operations
│       └── projects.store.ts     # Projects state
│
├── app.config.ts                 # App configuration & providers
├── app.routes.ts                 # Routing configuration
└── app.ts                        # Root component

firestore.rules                   # Firebase security rules
```

---

## 2. KIẾN TRÚC HỆ THỐNG

### 🏗️ Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER                       │
│         (Components, Templates, User Input)             │
│  • AppComponent                                         │
│  • Board, Projects, MyTasks, Home                       │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│              STATE MANAGEMENT LAYER                      │
│              (NgRx Signal Stores)                       │
│  • AuthStore      - Authentication state                │
│  • ProjectsStore  - Projects & invites                  │
│  • BoardStore     - Issues & filters                    │
│  • MyTasksStore   - User's tasks                        │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                  SERVICE LAYER                           │
│           (Business Logic, API Calls)                   │
│  • AuthService      - Firebase Auth                     │
│  • ProjectsService  - Project operations                │
│  • IssueService     - Issue CRUD                        │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                    DATA LAYER                            │
│              (Firebase Firestore)                       │
│  Collections:                                           │
│  • users          - User profiles                       │
│  • projects       - Project data                        │
│  • issues         - Task/Issue data                     │
└─────────────────────────────────────────────────────────┘
```

### 🔄 Data Flow Pattern

```
User Action (Click/Input)
    ↓
Component Method
    ↓
Store Method (Signal Store)
    ↓
Service Method (Firebase API)
    ↓
Firestore Database
    ↓
Real-time Observable Update
    ↓
Store State Update (patchState)
    ↓
Computed Signals Recalculate
    ↓
Component Auto Re-render
```

---

## 3. LUỒNG XÁC THỰC (AUTHENTICATION)

### 📝 Login Flow - Chi Tiết Từng Bước

#### **Bước 1: User Clicks "Login with Google"**

```typescript
// File: src/app/features/auth/login/login.ts
async loginWithGoogle() {
  await this.authStore.login();
  this.router.navigate(['/home']);
}
```

#### **Bước 2: AuthStore Handles Login**

```typescript
// File: src/app/core/auth/auth.store.ts
login: async () => {
  patchState(store, { loading: true, error: null });
  try {
    await authService.loginWithGoogle();
  } catch (error: any) {
    patchState(store, { error: error.message });
  } finally {
    patchState(store, { loading: false });
  }
};
```

#### **Bước 3: AuthService Calls Firebase**

```typescript
// File: src/app/core/auth/auth.service.ts
async loginWithGoogle() {
  // 1. Open Google OAuth popup
  const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());

  // 2. Sync user data to Firestore
  await this.syncUserToFirestore(cred.user);

  return cred;
}

private async syncUserToFirestore(user: User) {
  const userDoc = doc(this.firestore, 'users', user.uid);
  await setDoc(userDoc, {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  }, { merge: true });
}
```

#### **Bước 4: Auth State Listener**

```typescript
// File: src/app/core/auth/auth.store.ts
withHooks({
  onInit(store, authService = inject(AuthService)) {
    // Subscribe to Firebase auth state changes
    authService.user$.subscribe((user) => {
      store._setUser(user);
    });
  },
});
```

#### **Bước 5: App Component Reacts**

```typescript
// File: src/app/app.ts
constructor() {
  effect(() => {
    const user = this.authStore.user();
    if (user) {
      // Load user's projects and invites
      this.projectsStore.loadInvites(user.uid);
      this.projectsStore.loadProjects(user.uid);
    }
  });
}
```

### 🚪 Logout Flow

```typescript
// File: src/app/core/auth/auth.store.ts
logout: async () => {
  await authService.logout();
  patchState(store, { user: null });
  router.navigate(['/login']); // ✨ Auto redirect to login
};
```

### 🔒 Auth Guard

```typescript
// File: src/app/core/auth/auth.guard.ts
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.user()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};
```

**Cách hoạt động:**

1. User cố gắng truy cập protected route
2. Angular Router gọi `authGuard`
3. Guard kiểm tra `authStore.user()`
4. Nếu có user → cho phép
5. Nếu không → redirect về `/login`

---

## 4. QUẢN LÝ STATE VỚI NGRX SIGNALS

### 🎯 Tại Sao Dùng NgRx Signals?

**Ưu điểm so với NgRx Store truyền thống:**

- ✅ Ít boilerplate code hơn (không cần actions, reducers riêng)
- ✅ Type-safe tự động
- ✅ Reactive với Angular Signals
- ✅ Performance tốt hơn
- ✅ Dễ test hơn

### 📦 Cấu Trúc Signal Store

```typescript
export const ExampleStore = signalStore(
  { providedIn: 'root' },

  // 1. STATE - Định nghĩa state shape
  withState<StateType>(initialState),

  // 2. COMPUTED - Derived state
  withComputed(({ stateProperty }) => ({
    derivedValue: computed(() => {
      // Logic tính toán từ state
    }),
  })),

  // 3. METHODS - Actions và side effects
  withMethods((store, service = inject(Service)) => ({
    loadData: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((id) => service.getData(id)),
        tap((data) => patchState(store, { data, loading: false }))
      )
    ),
  })),

  // 4. HOOKS - Lifecycle
  withHooks({
    onInit(store) {
      // Chạy khi store được khởi tạo
    },
  })
);
```

### 🔍 Ví Dụ: BoardStore

```typescript
// File: src/app/features/board/board.store.ts

type BoardState = {
  issues: Issue[];
  loading: boolean;
  filter: BoardFilter;
};

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // Computed signals - Auto recalculate when dependencies change
  withComputed(({ issues, filter }) => {
    const filteredIssues = computed(() => {
      const { searchQuery, assignee, status, priority } = filter();

      return issues().filter((issue) => {
        const matchesSearch = issue.title.toLowerCase().includes(searchQuery);
        const matchesAssignee = assignee.length === 0 || assignee.includes(issue.assigneeId);
        const matchesStatus = status.length === 0 || status.includes(issue.statusColumnId);
        const matchesPriority = priority.length === 0 || priority.includes(issue.priority);

        return matchesSearch && matchesAssignee && matchesStatus && matchesPriority;
      });
    });

    return {
      todoIssues: computed(() =>
        filteredIssues()
          .filter((i) => i.statusColumnId === 'todo')
          .sort((a, b) => a.order - b.order)
      ),
      inProgressIssues: computed(() =>
        filteredIssues()
          .filter((i) => i.statusColumnId === 'in-progress')
          .sort((a, b) => a.order - b.order)
      ),
      doneIssues: computed(() =>
        filteredIssues()
          .filter((i) => i.statusColumnId === 'done')
          .sort((a, b) => a.order - b.order)
      ),
    };
  }),

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
```

### 🎨 Sử Dụng Store Trong Component

```typescript
@Component({...})
export class Board {
  readonly store = inject(BoardStore);

  // Signals tự động reactive
  todoIssues = this.store.todoIssues;
  loading = this.store.loading;

  ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    this.store.loadIssues(projectId);
  }
}
```

**Template:**

```html
@if (store.loading()) {
<p>Loading...</p>
} @for (issue of store.todoIssues(); track issue.id) {
<div class="issue-card">{{ issue.title }}</div>
}
```

---

## 5. HỆ THỐNG PHÂN QUYỀN

### 👥 Các Vai Trò Trong Hệ Thống

#### **1. Project Owner (Chủ Dự Án)**

- Người tạo ra project
- Có toàn quyền với project và tất cả issues bên trong
- Có thể:
  - ✅ Sửa tên, key của project
  - ✅ Mời/xóa members
  - ✅ Xóa project
  - ✅ Xóa bất kỳ issue nào
  - ✅ Sửa bất kỳ issue nào

#### **2. Reporter (Người Tạo Issue)**

- Người tạo ra issue
- Có quyền cao nhất đối với issue đó
- Có thể:
  - ✅ Sửa title, description
  - ✅ Thay đổi priority, type
  - ✅ Xóa issue
  - ✅ Chuyển status

#### **3. Assignee (Người Được Giao)**

- Người được giao nhiệm vụ thực hiện issue
- Có thể:
  - ✅ Sửa title, description
  - ✅ Thay đổi priority, type
  - ✅ Chuyển status
  - ❌ Không thể xóa issue

#### **4. Member (Thành Viên)**

- Thành viên bình thường của project
- Có thể:
  - ✅ Xem tất cả issues
  - ✅ Chuyển status (kéo thả)
  - ✅ Thay đổi order (sắp xếp)
  - ❌ Không thể sửa title, description
  - ❌ Không thể xóa issue

### 🔐 Firestore Security Rules

```javascript
// File: firestore.rules

match /issues/{issueId} {
  allow update: if signedIn()
                && isProjectMember(resource.data.projectId)
                && notChangingProjectId()
                && (
                  // Nhóm 1: Assignee, Reporter, Owner - Full access
                  (
                    resource.data.assigneeId == request.auth.uid ||
                    resource.data.reporterId == request.auth.uid ||
                    isProjectOwner(resource.data.projectId)
                  ) ||
                  // Nhóm 2: Member - Chỉ được đổi status và order
                  !request.resource.data.diff(resource.data)
                    .affectedKeys()
                    .hasAny(['title', 'description', 'type', 'priority', 'reporterId', 'key'])
                );

  allow delete: if signedIn() && (
    resource.data.reporterId == request.auth.uid ||
    isProjectOwner(resource.data.projectId)
  );
}
```

**Giải thích:**

- `diff(resource.data).affectedKeys()`: So sánh data mới và cũ, trả về list các field bị thay đổi
- Nếu member cố sửa `title`, `description`, etc. → Request bị từ chối
- Chỉ cho phép member sửa các field không nằm trong danh sách cấm

---

## 6. LUỒNG QUẢN LÝ PROJECTS

### 📊 Data Model

```typescript
export interface Project {
  id: string;
  name: string;
  key: string; // Project key (vd: "PROJ")
  description?: string;
  ownerId: string; // User ID của owner
  memberIds: string[]; // Danh sách member IDs
  invitedMemberIds?: string[]; // Danh sách user được mời
  createdAt: Date;
  updatedAt: Date;
}
```

### 🔄 Luồng Load Projects

```typescript
// 1. Component khởi tạo
ngOnInit() {
  const user = this.authStore.user();
  if (user) {
    this.projectsStore.loadProjects(user.uid);
  }
}

// 2. ProjectsStore
loadProjects: rxMethod<string>(
  pipe(
    tap(() => patchState(store, { loading: true })),
    switchMap((userId) => projectsService.getProjects(userId)),
    tap((projects) => patchState(store, { projects })),
    // Load owner information
    switchMap((projects) => {
      const ownerIds = [...new Set(projects.map(p => p.ownerId))];
      return projectsService.getUsers(ownerIds);
    }),
    tap((owners) => patchState(store, { projectOwners: owners, loading: false }))
  )
)

// 3. ProjectsService
getProjects(userId: string): Observable<Project[]> {
  const q = query(
    this.projectsCollection,
    where('memberIds', 'array-contains', userId)
  );
  return collectionData(q, { idField: 'id' });
}
```

### 👥 Luồng Mời Member

```typescript
// 1. User nhập email và click Invite
inviteUser: async (email: string) => {
  const users = await firstValueFrom(
    projectsService.findUserByEmail(email)
  );

  if (users.length === 0) {
    throw new Error('User not found');
  }

  const userToInvite = users[0];
  const project = store.selectedProject();

  // 2. Kiểm tra đã là member chưa
  if (project.memberIds.includes(userToInvite.uid)) {
    throw new Error('User is already a member');
  }

  // 3. Thêm vào invitedMemberIds
  await projectsService.inviteUserToProject(
    project.id,
    userToInvite.uid,
    project.invitedMemberIds
  );
}

// Service
inviteUserToProject(projectId: string, userId: string, currentInvitedIds: string[]) {
  const docRef = doc(this.firestore, 'projects', projectId);
  const newInvitedIds = [...currentInvitedIds, userId];
  return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
}
```

### ✅ Luồng Accept/Reject Invite

```typescript
// Accept
acceptInvite: async (project: Project, userId: string) => {
  await projectsService.acceptInvite(project, userId);

  // Optimistic update
  patchState(store, {
    pendingInvites: store.pendingInvites().filter(p => p.id !== project.id),
    projects: [...store.projects(), { ...project, memberIds: [...project.memberIds, userId] }]
  });
}

// Service
async acceptInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);

  return updateDoc(docRef, {
    invitedMemberIds: (project.invitedMemberIds || []).filter(id => id !== userId),
    memberIds: [...project.memberIds, userId]
  });
}
```

---

## 7. LUỒNG QUẢN LÝ ISSUES

### 📋 Data Model

```typescript
export interface Issue {
  id: string;
  projectId: string;
  key: string; // Issue key (vd: "PROJ-123")
  title: string;
  description: string;
  type: 'story' | 'bug' | 'task';
  priority: 'high' | 'medium' | 'low';
  statusColumnId: 'todo' | 'in-progress' | 'done';
  assigneeId?: string;
  reporterId: string; // Người tạo issue
  order: number; // Thứ tự trong column
  isInBacklog: boolean;
  dueDate?: string;
  subtasks?: Subtask[];
  comments?: Comment[];
}
```

### ➕ Luồng Tạo Issue

```typescript
// 1. User mở dialog và submit form
async createIssue(form: IssueForm) {
  const user = this.authStore.user();
  const projectId = this.projectsStore.selectedProjectId();

  const newIssue: Partial<Issue> = {
    projectId: projectId,
    key: await this.generateIssueKey(projectId),
    title: form.title,
    description: form.description,
    type: form.type,
    priority: form.priority,
    statusColumnId: 'todo',
    assigneeId: form.assigneeId,
    reporterId: user.uid,  // ✨ Người tạo
    order: 0,
    isInBacklog: false,
    createdAt: new Date()
  };

  await this.boardStore.addIssue(newIssue);
}

// BoardStore
addIssue: async (issue: Partial<Issue>) => {
  await issueService.addIssue(issue);
  // Firestore real-time update sẽ tự động thêm vào list
}
```

### 📝 Luồng Update Issue

```typescript
// Optimistic Update Pattern
updateIssue: async (issueId: string, updates: Partial<Issue>) => {
  // 1. Update UI immediately
  const allIssues = [...store.issues()];
  const issueIndex = allIssues.findIndex((i) => i.id === issueId);

  if (issueIndex > -1) {
    allIssues[issueIndex] = { ...allIssues[issueIndex], ...updates };
    patchState(store, { issues: allIssues });
  }

  // 2. Update Firestore
  try {
    await issueService.updateIssue(issueId, updates);
  } catch (err) {
    console.error('Failed to update issue', err);
    // TODO: Revert optimistic update if needed
  }
};
```

---

## 8. KANBAN BOARD & DRAG-DROP

### 🎯 Cơ Chế Drag & Drop

Sử dụng **Angular CDK Drag & Drop** với logic tính toán `order` thông minh.

### 📊 HTML Structure

```html
<div class="board-columns">
  <!-- TODO Column -->
  <div class="column">
    <div
      cdkDropList
      #todoList="cdkDropList"
      [cdkDropListData]="store.todoIssues()"
      [cdkDropListConnectedTo]="[inProgressList, doneList]"
      (cdkDropListDropped)="drop($event, 'todo')"
    >
      @for (issue of store.todoIssues(); track issue.id) {
      <div cdkDrag [cdkDragData]="issue">{{ issue.title }}</div>
      }
    </div>
  </div>

  <!-- IN PROGRESS Column -->
  <div class="column">...</div>

  <!-- DONE Column -->
  <div class="column">...</div>
</div>
```

### 🔄 Logic Kéo Thả

#### **Trường Hợp 1: Reorder Trong Cùng Column**

```typescript
moveIssue: (event: CdkDragDrop<Issue[]>, newStatus: string) => {
  const movedIssue = event.item.data as Issue;
  const allIssues = [...store.issues()];

  if (event.previousContainer === event.container) {
    // 1. Reorder array
    const columnIssues = [...event.container.data];
    moveItemInArray(columnIssues, event.previousIndex, event.currentIndex);

    // 2. Recalculate order values
    const updates: { id: string; data: Partial<Issue> }[] = [];

    columnIssues.forEach((issue, index) => {
      const newOrder = index * 1000; // Spacing: 0, 1000, 2000...

      if (issue.order !== newOrder) {
        updates.push({ id: issue.id, data: { order: newOrder } });

        // Update local state
        const globalIndex = allIssues.findIndex((i) => i.id === issue.id);
        if (globalIndex > -1) {
          allIssues[globalIndex] = { ...allIssues[globalIndex], order: newOrder };
        }
      }
    });

    // 3. Optimistic update
    patchState(store, { issues: allIssues });

    // 4. Batch update Firestore
    if (updates.length > 0) {
      issueService.batchUpdateIssues(updates);
    }
  }
};
```

**Tại sao spacing 1000?**

- Dễ dàng insert issue mới vào giữa
- Ví dụ: [0, 1000, 2000] → insert vào giữa 0 và 1000 → order = 500

#### **Trường Hợp 2: Move Sang Column Khác**

```typescript
else {
  // 1. Simulate insert to find neighbors
  const targetColumnIssues = [...event.container.data];
  targetColumnIssues.splice(event.currentIndex, 0, movedIssue);

  // 2. Calculate order based on neighbors
  let newOrder = 0;
  const prevItem = targetColumnIssues[event.currentIndex - 1];
  const nextItem = targetColumnIssues[event.currentIndex + 1];

  if (!prevItem && !nextItem) {
    newOrder = 0;  // Empty column
  } else if (!prevItem) {
    newOrder = (nextItem.order || 0) - 1000;  // Top of column
  } else if (!nextItem) {
    newOrder = (prevItem.order || 0) + 1000;  // Bottom of column
  } else {
    newOrder = (prevItem.order + nextItem.order) / 2;  // Between two items
  }

  // 3. Update local state
  const issueIndex = allIssues.findIndex(i => i.id === movedIssue.id);
  if (issueIndex > -1) {
    allIssues[issueIndex] = {
      ...allIssues[issueIndex],
      statusColumnId: newStatus,
      order: newOrder
    };
    patchState(store, { issues: allIssues });
  }

  // 4. Update Firestore
  issueService.updateIssue(movedIssue.id, {
    statusColumnId: newStatus,
    order: newOrder
  });
}
```

**Ví dụ tính order:**

```
Column hiện tại: [order: 1000, order: 3000]
Kéo issue vào giữa → newOrder = (1000 + 3000) / 2 = 2000
Kết quả: [1000, 2000, 3000]
```

### 🎨 Batch Update Service

```typescript
async batchUpdateIssues(updates: { id: string; data: Partial<Issue> }[]) {
  const batch = writeBatch(this.firestore);

  updates.forEach(({ id, data }) => {
    const docRef = doc(this.firestore, 'issues', id);
    batch.update(docRef, data);
  });

  return batch.commit();
}
```

**Lợi ích:**

- Giảm số lần gọi Firestore (1 batch thay vì N calls)
- Atomic operation (tất cả thành công hoặc tất cả fail)
- Tiết kiệm chi phí

---

## 9. CHI TIẾT CÁC COMPONENT

### 🏠 Home Component (Dashboard)

**Chức năng:**

- Hiển thị thống kê: Total Projects, Total Tasks, Completed Tasks, Overdue Tasks
- Widget "Assigned Tasks" với expand/collapse
- Quick access to projects

**Key Features:**

```typescript
// Computed statistics
completedTasksCount = computed(
  () => this.myTasksStore.issues().filter((i) => i.statusColumnId === 'done').length
);

overdueTasksCount = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.myTasksStore
    .issues()
    .filter((i) => i.dueDate && new Date(i.dueDate) < today && i.statusColumnId !== 'done').length;
});

// Expandable task list
displayedTasks = computed(() => {
  const all = this.myTasksStore.issues();
  return this.isExpanded() ? all : all.slice(0, 3);
});
```

### 📋 Board Component (Kanban)

**Chức năng:**

- Hiển thị 3 columns: Todo, In Progress, Done
- Drag & drop giữa các columns
- Filters: Search, Assignee, Status, Priority
- Create/Edit/Delete issues

**Key Methods:**

```typescript
ngOnInit() {
  const projectId = this.route.snapshot.paramMap.get('projectId');
  this.store.loadIssues(projectId);
  this.projectsStore.selectProject(projectId);
}

drop(event: CdkDragDrop<Issue[]>, newStatus: string) {
  this.store.moveIssue(event, newStatus);
}

openIssueDialog(statusColumnId: string, issue?: Issue) {
  this.dialog.open(IssueDialogComponent, {
    width: '800px',
    data: { issue, statusColumnId, projectId: this.projectsStore.selectedProjectId() }
  });
}
```

### ✅ My Tasks Component

**Chức năng:**

- Hiển thị tất cả tasks được assign cho user
- Table view với columns: Title, Project, Priority, Status, Due Date
- **Fix lỗi hiển thị status**: Sử dụng `statusColumnId` thay vì `status`

**Template:**

```html
<table mat-table [dataSource]="store.issues()">
  <ng-container matColumnDef="status">
    <th mat-header-cell *matHeaderCellDef>Status</th>
    <td mat-cell *matCellDef="let issue">
      <span class="status-badge" [ngClass]="issue.statusColumnId">
        {{ formatStatus(issue.statusColumnId) }}
      </span>
    </td>
  </ng-container>
</table>
```

**Status Formatting:**

```typescript
formatStatus(statusId: string): string {
  switch (statusId) {
    case 'todo': return 'TODO';
    case 'in-progress': return 'IN PROGRESS';
    case 'done': return 'DONE';
    default: return statusId.toUpperCase();
  }
}
```

**CSS:**

```scss
.status-badge.todo {
  background: #dfe1e6;
  color: #42526e;
}
.status-badge.in-progress {
  background: #deebff;
  color: #0052cc;
}
.status-badge.done {
  background: #e3fcef;
  color: #006644;
}
```

### 📂 Project List Component

**Chức năng:**

- Grid view của tất cả projects
- Create new project
- Delete project (chỉ owner)
- Navigate to project board

### 🏗️ Project Layout Component

**Chức năng:**

- Container cho project routes
- Navigation tabs: Board, Backlog
- Members management button
- Load project members

---

## 10. FIREBASE SECURITY RULES

### 🔒 Projects Collection

```javascript
match /projects/{projectId} {
  // READ: Member hoặc invited user
  allow read: if signedIn() && (
    resource.data.memberIds.hasAny([request.auth.uid]) ||
    (resource.data.invitedMemberIds != null &&
     resource.data.invitedMemberIds.hasAny([request.auth.uid]))
  );

  // CREATE: Phải set mình làm owner và member
  allow create: if signedIn() && isValidNewProject();

  // UPDATE:
  // - Owner: Full access
  // - Member/Invited: Không được đổi name, key, ownerId
  allow update: if signedIn() && (
    resource.data.ownerId == request.auth.uid ||
    (
      (
        resource.data.memberIds.hasAny([request.auth.uid]) ||
        (resource.data.invitedMemberIds != null &&
         resource.data.invitedMemberIds.hasAny([request.auth.uid]))
      ) &&
      !request.resource.data.diff(resource.data)
        .affectedKeys()
        .hasAny(['name', 'key', 'ownerId'])
    )
  );

  // DELETE: Chỉ owner
  allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;
}
```

### 📋 Issues Collection

```javascript
match /issues/{issueId} {
  // READ: Assignee hoặc project member
  allow read: if signedIn() && (
    resource.data.assigneeId == request.auth.uid ||
    isProjectMember(resource.data.projectId)
  );

  // CREATE: Project member + valid schema
  allow create: if signedIn()
                && isProjectMember(request.resource.data.projectId)
                && isValidIssue();

  // UPDATE: Phân quyền theo vai trò
  allow update: if signedIn()
                && isProjectMember(resource.data.projectId)
                && notChangingProjectId()
                && (
                  // Assignee, Reporter, Owner: Full access
                  (
                    resource.data.assigneeId == request.auth.uid ||
                    resource.data.reporterId == request.auth.uid ||
                    isProjectOwner(resource.data.projectId)
                  ) ||
                  // Member: Chỉ được đổi status và order
                  !request.resource.data.diff(resource.data)
                    .affectedKeys()
                    .hasAny(['title', 'description', 'type', 'priority', 'reporterId', 'key'])
                );

  // DELETE: Reporter hoặc Owner
  allow delete: if signedIn() && (
    resource.data.reporterId == request.auth.uid ||
    isProjectOwner(resource.data.projectId)
  );
}
```

### 👤 Users Collection

```javascript
match /users/{uid} {
  // READ: Bất kỳ authenticated user (để hiển thị tên, avatar)
  allow read: if signedIn();

  // WRITE: Chỉ chính user đó
  allow write: if signedIn() && request.auth.uid == uid;
}
```

---

## 📊 TỔNG KẾT

### ✨ Điểm Mạnh Của Kiến Trúc

1. **Modern & Scalable**

   - Angular 18+ Standalone Components
   - NgRx Signals thay vì NgRx Store cũ
   - Type-safe với TypeScript

2. **Real-time & Reactive**

   - Firestore real-time updates
   - Signals auto-recalculate
   - Optimistic updates cho UX mượt mà

3. **Security First**

   - Multi-layer permissions (Owner, Reporter, Assignee, Member)
   - Firestore rules validate ở backend
   - Auth guard protect routes

4. **Performance**

   - Lazy loading routes
   - Computed signals (chỉ recalculate khi cần)
   - Batch updates giảm Firestore calls

5. **Developer Experience**
   - Clear separation of concerns
   - Easy to test
   - Maintainable code structure

### 🎯 Best Practices Được Áp Dụng

- ✅ Standalone Components (Angular 18+)
- ✅ Signal-based state management
- ✅ Reactive programming với RxJS
- ✅ Optimistic updates
- ✅ Lazy loading
- ✅ Security rules
- ✅ Type safety
- ✅ Clean architecture

---

**Tác giả:** Jira Clone Development Team  
**Ngày cập nhật:** 07/01/2026  
**Phiên bản:** 1.0.0
