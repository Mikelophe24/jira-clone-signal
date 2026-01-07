# 📚 KIẾN TRÚC VÀ LUỒNG CODE - JIRA CLONE

## 📋 MỤC LỤC

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Kiến Trúc Tổng Thể](#2-kiến-trúc-tổng-thể)
3. [Luồng Xác Thực (Authentication Flow)](#3-luồng-xác-thực-authentication-flow)
4. [Quản Lý State với NgRx Signals](#4-quản-lý-state-với-ngrx-signals)
5. [Luồng Quản Lý Projects](#5-luồng-quản-lý-projects)
6. [Luồng Quản Lý Issues/Tasks](#6-luồng-quản-lý-issuestasks)
7. [Kanban Board và Drag & Drop](#7-kanban-board-và-drag--drop)
8. [Firebase Security Rules](#8-firebase-security-rules)
9. [Routing và Navigation](#9-routing-và-navigation)
10. [Chi Tiết Từng Component](#10-chi-tiết-từng-component)

---

## 1. TỔNG QUAN DỰ ÁN

### 🎯 Mục Đích

Dự án **Jira Clone** là một ứng dụng quản lý dự án và task tương tự Jira, được xây dựng bằng **Angular 18+** với **Firebase** làm backend.

### 🛠️ Tech Stack

- **Frontend Framework**: Angular 18+ (Standalone Components)
- **State Management**: NgRx Signals (thay vì NgRx Store truyền thống)
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **UI Library**: Angular Material
- **Drag & Drop**: Angular CDK
- **Language**: TypeScript

### 📁 Cấu Trúc Thư Mục

```
src/
├── app/
│   ├── core/                    # Các service và module core
│   │   ├── auth/               # Authentication logic
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.store.ts
│   │   │   └── auth.guard.ts
│   │   ├── components/         # Shared components
│   │   │   └── breadcrumbs/
│   │   ├── models/             # Data models
│   │   └── firestore.ts        # Firestore config
│   │
│   ├── features/               # Feature modules
│   │   ├── auth/              # Login/Register pages
│   │   │   └── login/
│   │   ├── board/             # Kanban board
│   │   │   ├── board/
│   │   │   ├── backlog/
│   │   │   └── board.store.ts
│   │   ├── home/              # Dashboard
│   │   ├── issue/             # Issue management
│   │   │   ├── issue-dialog/
│   │   │   ├── issue.model.ts
│   │   │   └── issue.service.ts
│   │   ├── my-tasks/          # User's tasks
│   │   └── projects/          # Project management
│   │       ├── project-list/
│   │       ├── project-layout/
│   │       ├── members-dialog/
│   │       ├── project.model.ts
│   │       ├── projects.service.ts
│   │       └── projects.store.ts
│   │
│   ├── app.config.ts          # App configuration
│   ├── app.routes.ts          # Routing configuration
│   └── app.ts                 # Root component
│
├── environments/
│   └── environment.ts         # Environment config
└── firestore.rules            # Firestore security rules
```

---

## 2. KIẾN TRÚC TỔNG THỂ

### 🏗️ Kiến Trúc Layered

```
┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                      │
│  (Components - UI Logic - Templates)                │
│  - AppComponent                                      │
│  - Feature Components (Board, Projects, etc)        │
└─────────────────────────────────────────────────────┘
                        ↕️
┌─────────────────────────────────────────────────────┐
│           STATE MANAGEMENT LAYER                     │
│  (NgRx Signal Stores)                               │
│  - AuthStore                                         │
│  - ProjectsStore                                     │
│  - BoardStore                                        │
│  - MyTasksStore                                      │
└─────────────────────────────────────────────────────┘
                        ↕️
┌─────────────────────────────────────────────────────┐
│              SERVICE LAYER                           │
│  (Business Logic - API Calls)                       │
│  - AuthService                                       │
│  - ProjectsService                                   │
│  - IssueService                                      │
└─────────────────────────────────────────────────────┘
                        ↕️
┌─────────────────────────────────────────────────────┐
│              DATA LAYER                              │
│  (Firebase - Firestore, Auth, Storage)             │
│  - Collections: users, projects, issues             │
└─────────────────────────────────────────────────────┘
```

### 🔄 Luồng Dữ Liệu (Data Flow)

```
User Action (Click, Input)
    ↓
Component Method
    ↓
Store Method (dispatch action)
    ↓
Service Method (API call)
    ↓
Firebase (Firestore/Auth)
    ↓
Observable/Promise Response
    ↓
Store Update (patchState)
    ↓
Signal Update (reactive)
    ↓
Component Re-render (automatic)
```

---

## 3. LUỒNG XÁC THỰC (AUTHENTICATION FLOW)

### 📝 Chi Tiết Luồng Login

#### **Bước 1: User Click "Login with Google"**

```typescript
// File: src/app/features/auth/login/login.ts
async loginWithGoogle() {
  await this.authStore.login();  // Gọi method trong AuthStore
  this.router.navigate(['/home']);
}
```

#### **Bước 2: AuthStore xử lý login**

```typescript
// File: src/app/core/auth/auth.store.ts
login: async () => {
  patchState(store, { loading: true, error: null });
  try {
    await authService.loginWithGoogle(); // Gọi AuthService
  } catch (error: any) {
    patchState(store, { error: error.message });
  } finally {
    patchState(store, { loading: false });
  }
};
```

#### **Bước 3: AuthService thực hiện login với Firebase**

```typescript
// File: src/app/core/auth/auth.service.ts
async loginWithGoogle() {
  // 1. Mở popup Google login
  const cred = await signInWithPopup(this.auth, new GoogleAuthProvider());

  // 2. Đồng bộ user info vào Firestore
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

#### **Bước 4: AuthStore lắng nghe thay đổi user state**

```typescript
// File: src/app/core/auth/auth.store.ts
withHooks({
  onInit(store, authService = inject(AuthService)) {
    // Subscribe to Firebase Auth state changes
    authService.user$.subscribe((user) => {
      store._setUser(user); // Cập nhật user vào store
    });
  },
});
```

#### **Bước 5: AppComponent phản ứng với user state**

```typescript
// File: src/app/app.ts
constructor() {
  effect(() => {
    const user = this.authStore.user();
    if (user) {
      // Load projects và invites khi user đăng nhập
      this.projectsStore.loadInvites(user.uid);
      this.projectsStore.loadProjects(user.uid);
    }
  });
}
```

### 🔒 Auth Guard - Bảo Vệ Routes

```typescript
// File: src/app/core/auth/auth.guard.ts
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.user()) {
    return true; // Cho phép truy cập
  } else {
    router.navigate(['/login']); // Redirect về login
    return false;
  }
};
```

**Cách hoạt động:**

1. User cố gắng truy cập route được bảo vệ (vd: `/projects`)
2. Angular Router gọi `authGuard`
3. Guard kiểm tra `authStore.user()`
4. Nếu có user → cho phép
5. Nếu không → redirect về `/login`

---

## 4. QUẢN LÝ STATE VỚI NGRX SIGNALS

### 🎯 Tại Sao Dùng NgRx Signals?

**NgRx Signals** là cách tiếp cận mới, đơn giản hơn NgRx Store truyền thống:

- ✅ Ít boilerplate code hơn
- ✅ Type-safe tự động
- ✅ Reactive với Angular Signals
- ✅ Dễ test hơn

### 📦 Cấu Trúc Một Signal Store

```typescript
export const ExampleStore = signalStore(
  { providedIn: 'root' }, // Singleton service

  // 1. STATE - Định nghĩa state shape
  withState<StateType>(initialState),

  // 2. COMPUTED - Derived state (giống selector)
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

    updateData: async (newData) => {
      patchState(store, { data: newData });
      await service.save(newData);
    },
  })),

  // 4. HOOKS - Lifecycle hooks
  withHooks({
    onInit(store) {
      // Chạy khi store được khởi tạo
    },
  })
);
```

### 🔍 Ví Dụ Cụ Thể: AuthStore

```typescript
// 1. Định nghĩa State Type
type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

// 2. Initial State
const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

// 3. Tạo Store
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  // 4. Methods (Actions)
  withMethods((store, authService = inject(AuthService)) => ({
    login: async () => {
      // Update state: bắt đầu loading
      patchState(store, { loading: true, error: null });

      try {
        // Gọi service
        await authService.loginWithGoogle();
      } catch (error: any) {
        // Update state: có lỗi
        patchState(store, { error: error.message });
      } finally {
        // Update state: kết thúc loading
        patchState(store, { loading: false });
      }
    },

    logout: async () => {
      await authService.logout();
      patchState(store, { user: null });
    },

    _setUser: (user: User | null) => {
      patchState(store, { user, loading: false });
    },
  })),

  // 5. Hooks - Subscribe to auth changes
  withHooks({
    onInit(store, authService = inject(AuthService)) {
      authService.user$.subscribe((user) => {
        store._setUser(user);
      });
    },
  })
);
```

### 🎨 Sử Dụng Store Trong Component

```typescript
@Component({...})
export class LoginComponent {
  readonly authStore = inject(AuthStore);

  // Đọc state (reactive)
  user = this.authStore.user;
  loading = this.authStore.loading;
  error = this.authStore.error;

  // Gọi actions
  async login() {
    await this.authStore.login();
  }
}
```

**Template:**

```html
@if (authStore.loading()) {
<p>Loading...</p>
} @if (authStore.error()) {
<p>Error: {{ authStore.error() }}</p>
} @if (authStore.user()) {
<p>Welcome {{ authStore.user()?.displayName }}</p>
}
```

---

## 5. LUỒNG QUẢN LÝ PROJECTS

### 📊 Data Model: Project

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

#### **Bước 1: Component khởi tạo**

```typescript
// File: src/app/features/projects/project-list/project-list.ts
export class ProjectList implements OnInit {
  readonly authStore = inject(AuthStore);
  readonly projectsStore = inject(ProjectsStore);

  ngOnInit() {
    const user = this.authStore.user();
    if (user) {
      // Trigger load projects
      this.projectsStore.loadProjects(user.uid);
    }
  }
}
```

#### **Bước 2: ProjectsStore xử lý**

```typescript
// File: src/app/features/projects/projects.store.ts
loadProjects: rxMethod<string>(
  pipe(
    // 1. Set loading = true
    tap(() => patchState(store, { loading: true })),

    // 2. Gọi service để lấy projects
    switchMap((userId) => projectsService.getProjects(userId)),

    // 3. Update projects vào state
    tap((projects) => patchState(store, { projects })),

    // 4. Load thông tin owners
    switchMap((projects) => {
      const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
      if (ownerIds.length === 0) return of([]);
      return projectsService.getUsers(ownerIds);
    }),

    // 5. Update owners và set loading = false
    tap((owners) =>
      patchState(store, {
        projectOwners: owners,
        loading: false,
      })
    ),

    // 6. Error handling
    catchError((err) => {
      console.error('Error loading projects:', err);
      patchState(store, { loading: false });
      return of([]);
    })
  )
);
```

#### **Bước 3: ProjectsService query Firestore**

```typescript
// File: src/app/features/projects/projects.service.ts
getProjects(userId: string): Observable<Project[]> {
  const q = query(
    this.projectsCollection,
    where('memberIds', 'array-contains', userId)
  );
  return collectionData(q, { idField: 'id' }) as Observable<Project[]>;
}
```

**Firestore Query:**

- Tìm tất cả projects mà `memberIds` chứa `userId`
- Trả về Observable (real-time updates)

#### **Bước 4: Component hiển thị**

```typescript
// Template
@for (project of projectsStore.projects(); track project.id) {
  <div class="project-card">
    <h3>{{ project.name }}</h3>
    <p>{{ project.key }}</p>
  </div>
}
```

### ➕ Luồng Tạo Project Mới

```typescript
// 1. User nhập form và submit
async createProject(form: ProjectForm) {
  const user = this.authStore.user();
  if (!user) return;

  const newProject: Partial<Project> = {
    name: form.name,
    key: form.key,
    description: form.description,
    ownerId: user.uid,
    memberIds: [user.uid],  // Owner tự động là member
    invitedMemberIds: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // 2. Gọi service
  await this.projectsService.createProject(newProject);

  // 3. Firestore tự động trigger update
  // 4. Observable trong loadProjects sẽ emit project mới
  // 5. Component tự động re-render
}
```

### 👥 Luồng Mời Member

```typescript
// File: src/app/features/projects/projects.store.ts
inviteUser: async (email: string) => {
  patchState(store, { loading: true });

  try {
    // 1. Tìm user theo email
    const users = await firstValueFrom(projectsService.findUserByEmail(email));

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const userToInvite = users[0];
    const project = store.selectedProject();

    if (project) {
      // 2. Kiểm tra đã là member chưa
      if (project.memberIds.includes(userToInvite.uid)) {
        throw new Error('User is already a member');
      }

      // 3. Kiểm tra đã được mời chưa
      if (project.invitedMemberIds?.includes(userToInvite.uid)) {
        throw new Error('User is already invited');
      }

      // 4. Thêm vào invitedMemberIds
      await projectsService.inviteUserToProject(
        project.id,
        userToInvite.uid,
        project.invitedMemberIds
      );
    }
  } catch (err: any) {
    console.error(err);
    throw err;
  } finally {
    patchState(store, { loading: false });
  }
};
```

### ✅ Luồng Accept/Reject Invite

```typescript
// Accept Invite
acceptInvite: async (project: Project, userId: string) => {
  try {
    // 1. Gọi service
    await projectsService.acceptInvite(project, userId);

    // 2. Optimistic update
    patchState(store, {
      // Xóa khỏi pending invites
      pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),

      // Thêm vào projects
      projects: [...store.projects(), { ...project, memberIds: [...project.memberIds, userId] }],
    });
  } catch (err) {
    console.error('Failed to accept invite', err);
  }
};

// Reject Invite
rejectInvite: async (project: Project, userId: string) => {
  try {
    await projectsService.rejectInvite(project, userId);

    // Xóa khỏi pending invites
    patchState(store, {
      pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
    });
  } catch (err) {
    console.error('Failed to reject invite', err);
  }
};
```

**Service Implementation:**

```typescript
async acceptInvite(project: Project, userId: string) {
  const projectRef = doc(this.firestore, 'projects', project.id);

  await updateDoc(projectRef, {
    // Thêm vào memberIds
    memberIds: arrayUnion(userId),
    // Xóa khỏi invitedMemberIds
    invitedMemberIds: arrayRemove(userId)
  });
}
```

---

## 6. LUỒNG QUẢN LÝ ISSUES/TASKS

### 📋 Data Model: Issue

```typescript
export interface Issue {
  id: string;
  projectId: string; // Thuộc project nào
  key: string; // Issue key (vd: "PROJ-123")
  title: string;
  description?: string;
  type: 'story' | 'bug' | 'task';
  priority: 'low' | 'medium' | 'high' | 'highest';
  statusColumnId: 'todo' | 'in-progress' | 'done';
  assigneeId?: string; // User được assign
  reporterId: string; // User tạo issue
  order: number; // Thứ tự trong column
  isInBacklog: boolean; // Có trong backlog không
  createdAt: Date;
  updatedAt: Date;
}
```

### 🔄 Luồng Load Issues

```typescript
// 1. Component load issues cho project
ngOnInit() {
  const projectId = this.route.snapshot.paramMap.get('projectId');
  if (projectId) {
    this.boardStore.loadIssues(projectId);
  }
}

// 2. BoardStore xử lý
loadIssues: rxMethod<string>(
  pipe(
    tap(() => patchState(store, { loading: true })),
    switchMap((projectId) => issueService.getIssues(projectId)),
    tap((issues) => patchState(store, { issues, loading: false }))
  )
)

// 3. IssueService query Firestore
getIssues(projectId: string): Observable<Issue[]> {
  const q = query(
    this.issuesCollection,
    where('projectId', '==', projectId)
  );
  return collectionData(q, { idField: 'id' }) as Observable<Issue[]>;
}
```

### ➕ Luồng Tạo Issue Mới

```typescript
// 1. User mở dialog và submit form
async createIssue(form: IssueForm) {
  const user = this.authStore.user();
  const projectId = this.projectsStore.selectedProjectId();

  if (!user || !projectId) return;

  // 2. Tạo issue object
  const newIssue: Partial<Issue> = {
    projectId: projectId,
    key: await this.generateIssueKey(projectId),
    title: form.title,
    description: form.description,
    type: form.type,
    priority: form.priority,
    statusColumnId: 'todo',
    assigneeId: form.assigneeId,
    reporterId: user.uid,
    order: 0,  // Sẽ được tính lại
    isInBacklog: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // 3. Gọi store
  await this.boardStore.addIssue(newIssue);
}

// BoardStore
addIssue: async (issue: Partial<Issue>) => {
  try {
    await issueService.addIssue(issue);
    // Firestore real-time update sẽ tự động thêm vào list
  } catch (err) {
    console.error('Failed to add issue', err);
  }
}
```

### 📝 Luồng Update Issue

```typescript
// BoardStore - Optimistic Update
updateIssue: async (issueId: string, updates: Partial<Issue>) => {
  // 1. Optimistic Update - Update UI ngay lập tức
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
    // TODO: Revert optimistic update nếu cần
  }
};
```

### 🔍 Luồng Filter Issues

```typescript
// BoardStore - Computed Signals
withComputed(({ issues, filter }) => {
  const filteredIssues = computed(() => {
    const { searchQuery, onlyMyIssues, userId, assignee, status, priority } = filter();
    const query = searchQuery.toLowerCase();

    return issues().filter((issue) => {
      // 1. Search filter
      const matchesSearch =
        issue.title.toLowerCase().includes(query) || issue.key.toLowerCase().includes(query);

      // 2. My issues filter
      const matchesUser = onlyMyIssues ? issue.assigneeId === userId : true;

      // 3. Assignee filter (multi-select)
      const matchesAssignee =
        assignee.length === 0 || (issue.assigneeId && assignee.includes(issue.assigneeId));

      // 4. Status filter (multi-select)
      const matchesStatus = status.length === 0 || status.includes(issue.statusColumnId);

      // 5. Priority filter (multi-select)
      const matchesPriority = priority.length === 0 || priority.includes(issue.priority);

      // 6. Exclude backlog items
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

  // Computed cho từng column
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
});
```

---

## 7. KANBAN BOARD VÀ DRAG & DROP

### 🎯 Cơ Chế Drag & Drop

Dự án sử dụng **Angular CDK Drag & Drop** để implement tính năng kéo thả issues giữa các columns.

### 📊 Cấu Trúc HTML

```html
<!-- Board Container -->
<div class="board-columns">
  <!-- TODO Column -->
  <div class="column">
    <h3>To Do</h3>
    <div
      cdkDropList
      #todoList="cdkDropList"
      [cdkDropListData]="boardStore.todoIssues()"
      [cdkDropListConnectedTo]="[inProgressList, doneList]"
      (cdkDropListDropped)="onDrop($event, 'todo')"
      class="issue-list"
    >
      @for (issue of boardStore.todoIssues(); track issue.id) {
      <div cdkDrag [cdkDragData]="issue" class="issue-card">{{ issue.title }}</div>
      }
    </div>
  </div>

  <!-- IN PROGRESS Column -->
  <div class="column">...</div>

  <!-- DONE Column -->
  <div class="column">...</div>
</div>
```

### 🔄 Luồng Drag & Drop

#### **Trường Hợp 1: Kéo Trong Cùng Column (Reorder)**

```typescript
moveIssue: (event: CdkDragDrop<Issue[]>, newStatus: string) => {
  const movedIssue = event.item.data as Issue;
  const allIssues = [...store.issues()];

  if (event.previousContainer === event.container) {
    // 1. Reorder trong cùng column
    const columnIssues = [...event.container.data];
    moveItemInArray(columnIssues, event.previousIndex, event.currentIndex);

    // 2. Tính lại order cho tất cả issues trong column
    const updates: { id: string; data: Partial<Issue> }[] = [];

    columnIssues.forEach((issue, index) => {
      const newOrder = index * 1000; // Spacing: 0, 1000, 2000, ...

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

**Giải thích:**

- Sử dụng `moveItemInArray` từ CDK để reorder array
- Tính lại `order` cho tất cả issues (spacing 1000 để dễ insert sau này)
- Batch update để giảm số lần gọi Firestore

#### **Trường Hợp 2: Kéo Sang Column Khác**

```typescript
else {
  // 1. Move to different column
  const targetColumnIssues = [...event.container.data];

  // 2. Insert vào vị trí mới để tính order
  targetColumnIssues.splice(event.currentIndex, 0, movedIssue);

  // 3. Tính order dựa trên neighbors
  let newOrder = 0;
  const prevItem = targetColumnIssues[event.currentIndex - 1];
  const nextItem = targetColumnIssues[event.currentIndex + 1];

  if (!prevItem && !nextItem) {
    newOrder = 0;  // Column rỗng
  } else if (!prevItem) {
    newOrder = (nextItem.order || 0) - 1000;  // Đầu column
  } else if (!nextItem) {
    newOrder = (prevItem.order || 0) + 1000;  // Cuối column
  } else {
    newOrder = (prevItem.order + nextItem.order) / 2;  // Giữa 2 items
  }

  // 4. Update local state
  const issueIndex = allIssues.findIndex(i => i.id === movedIssue.id);
  if (issueIndex > -1) {
    const updatedIssue = {
      ...allIssues[issueIndex],
      statusColumnId: newStatus,
      order: newOrder
    };
    allIssues[issueIndex] = updatedIssue;
    patchState(store, { issues: allIssues });
  }

  // 5. Update Firestore
  issueService.updateIssue(movedIssue.id, {
    statusColumnId: newStatus,
    order: newOrder
  });
}
```

**Giải thích:**

- Tính `order` bằng cách lấy trung bình của 2 neighbors
- Nếu không có neighbor → dùng offset 1000
- Update cả `statusColumnId` và `order`

### 🎨 Batch Update Service

```typescript
// IssueService
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

---

## 8. FIREBASE SECURITY RULES

### 🔒 Tổng Quan Security Rules

Firestore Security Rules đảm bảo:

- ✅ Chỉ authenticated users mới truy cập được
- ✅ Users chỉ xem/sửa projects họ là member
- ✅ Users chỉ xem/sửa issues thuộc projects của họ
- ✅ Validate data schema

### 📝 Helper Functions

```javascript
// Kiểm tra user đã đăng nhập
function signedIn() {
  return request.auth != null;
}

// Kiểm tra user là member của project
function isProjectMember(projectId) {
  let project = get(/databases/$(database)/documents/projects/$(projectId));
  return project != null && (
    project.data.memberIds.hasAny([request.auth.uid]) ||
    (project.data.invitedMemberIds != null &&
     project.data.invitedMemberIds.hasAny([request.auth.uid]))
  );
}

// Kiểm tra user là owner của project
function isProjectOwner(projectId) {
  let project = get(/databases/$(database)/documents/projects/$(projectId));
  return project != null && project.data.ownerId == request.auth.uid;
}
```

### 🗂️ Projects Collection Rules

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

  // UPDATE: Owner, member, hoặc invited user
  allow update: if signedIn() && (
    resource.data.ownerId == request.auth.uid ||
    resource.data.memberIds.hasAny([request.auth.uid]) ||
    resource.data.invitedMemberIds.hasAny([request.auth.uid])
  );

  // DELETE: Chỉ owner
  allow delete: if signedIn() && resource.data.ownerId == request.auth.uid;
}

// Validate schema khi tạo project
function isValidNewProject() {
  let data = request.resource.data;
  return data.keys().hasAll(['name', 'key', 'ownerId', 'memberIds'])
    && data.name is string && data.name.size() > 0
    && data.key is string && data.key.size() > 0
    && data.ownerId == request.auth.uid
    && data.memberIds.hasAll([request.auth.uid]);
}
```

### 📋 Issues Collection Rules

```javascript
match /issues/{issueId} {
  // READ: Assignee hoặc project member
  allow read: if signedIn() && (
    resource.data.assigneeId == request.auth.uid ||
    isProjectMember(resource.data.projectId)
  );

  // CREATE: Phải là project member và valid schema
  allow create: if signedIn()
    && isProjectMember(request.resource.data.projectId)
    && isValidIssue();

  // UPDATE: Phải là project member, không đổi projectId, valid schema
  allow update: if signedIn()
    && isProjectMember(resource.data.projectId)
    && notChangingProjectId()
    && isValidIssue();

  // DELETE: Phải là project member
  allow delete: if signedIn() && isProjectMember(resource.data.projectId);
}

// Validate issue schema
function isValidIssue() {
  let data = request.resource.data;
  return data.title is string && data.title.size() > 0
    && (!data.keys().hasAny(['type']) || data.type in ['story', 'bug', 'task']);
}

// Ngăn thay đổi projectId
function notChangingProjectId() {
  return request.resource.data.projectId == resource.data.projectId;
}
```

### 👤 Users Collection Rules

```javascript
match /users/{uid} {
  // READ: Bất kỳ authenticated user nào (để hiển thị tên, avatar)
  allow read: if signedIn();

  // WRITE: Chỉ chính user đó
  allow write: if signedIn() && request.auth.uid == uid;
}
```

---

## 9. ROUTING VÀ NAVIGATION

### 🗺️ Route Configuration

```typescript
// File: src/app/app.routes.ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'projects',
    canActivate: [authGuard], // Protected route
    loadComponent: () =>
      import('./features/projects/project-list/project-list').then((m) => m.ProjectList),
  },
  {
    path: 'project/:projectId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-layout/project-layout').then((m) => m.ProjectLayout),
    children: [
      {
        path: 'board',
        loadComponent: () => import('./features/board/board/board').then((m) => m.Board),
      },
      {
        path: 'backlog',
        loadComponent: () => import('./features/board/backlog/backlog').then((m) => m.Backlog),
      },
      {
        path: '',
        redirectTo: 'board',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'my-tasks',
    canActivate: [authGuard],
    loadComponent: () => import('./features/my-tasks/my-tasks').then((m) => m.MyTasks),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
```

### 🎯 Lazy Loading

**Tất cả components đều được lazy load:**

- ✅ Giảm initial bundle size
- ✅ Tăng tốc độ load trang đầu tiên
- ✅ Load on-demand khi user navigate

### 🔐 Protected Routes

```typescript
{
  path: 'projects',
  canActivate: [authGuard],  // Chỉ authenticated users
  loadComponent: ...
}
```

### 🌳 Nested Routes

```typescript
{
  path: 'project/:projectId',
  component: ProjectLayout,  // Parent component
  children: [
    { path: 'board', component: Board },
    { path: 'backlog', component: Backlog }
  ]
}
```

**URL Examples:**

- `/project/abc123/board`
- `/project/abc123/backlog`

### 🧭 Breadcrumbs Component

```typescript
// File: src/app/core/components/breadcrumbs/breadcrumbs.ts
export class BreadcrumbsComponent {
  readonly router = inject(Router);
  readonly activatedRoute = inject(ActivatedRoute);
  readonly projectsStore = inject(ProjectsStore);

  breadcrumbs = computed(() => {
    const url = this.router.url;
    const parts = url.split('/').filter((p) => p);

    const crumbs: Breadcrumb[] = [{ label: 'Home', url: '/home' }];

    // Parse URL và tạo breadcrumbs
    if (parts[0] === 'project' && parts[1]) {
      const project = this.projectsStore.selectedProject();
      crumbs.push({
        label: project?.name || 'Project',
        url: `/project/${parts[1]}`,
      });

      if (parts[2] === 'board') {
        crumbs.push({ label: 'Board', url: '' });
      } else if (parts[2] === 'backlog') {
        crumbs.push({ label: 'Backlog', url: '' });
      }
    }

    return crumbs;
  });
}
```

---

## 10. CHI TIẾT TỪNG COMPONENT

### 🏠 AppComponent (Root)

**Vai trò:**

- Root component của ứng dụng
- Chứa toolbar, sidebar, và router-outlet
- Hiển thị notifications (project invites)

**Template Structure:**

```
AppComponent
├── Toolbar
│   ├── Logo
│   ├── Notifications (invites)
│   └── User menu
├── Sidenav Container
│   ├── Sidebar (nếu logged in)
│   │   ├── Home link
│   │   ├── My Tasks link
│   │   ├── Projects list
│   │   └── Add Project link
│   └── Main Content
│       ├── Breadcrumbs
│       └── Router Outlet
```

**Key Logic:**

```typescript
constructor() {
  effect(() => {
    const user = this.authStore.user();
    if (user) {
      // Load data khi user login
      this.projectsStore.loadInvites(user.uid);
      this.projectsStore.loadProjects(user.uid);
    }
  });
}

accept(invite: any) {
  const user = this.authStore.user();
  if (user) {
    this.projectsStore.acceptInvite(invite, user.uid);
  }
}

reject(invite: any) {
  const user = this.authStore.user();
  if (user) {
    this.projectsStore.rejectInvite(invite, user.uid);
  }
}
```

### 🔐 Login Component

**Vai trò:**

- Xử lý login/register
- Hỗ trợ Google OAuth và Email/Password

**Template:**

```html
<div class="login-container">
  <!-- Login Form -->
  @if (!showRegister) {
  <form (ngSubmit)="loginWithEmail()">
    <input [(ngModel)]="email" type="email" placeholder="Email" />
    <input [(ngModel)]="password" type="password" placeholder="Password" />
    <button type="submit">Login</button>
  </form>

  <button (click)="loginWithGoogle()">Login with Google</button>

  <a (click)="showRegister = true">Create account</a>
  }

  <!-- Register Form -->
  @else {
  <form (ngSubmit)="register()">
    <input [(ngModel)]="name" placeholder="Name" />
    <input [(ngModel)]="email" type="email" placeholder="Email" />
    <input [(ngModel)]="password" type="password" placeholder="Password" />
    <button type="submit">Register</button>
  </form>
  }
</div>
```

### 📊 Board Component (Kanban)

**Vai trò:**

- Hiển thị Kanban board
- Xử lý drag & drop
- Filters và search

**Template Structure:**

```html
<div class="board-container">
  <!-- Filters -->
  <div class="board-filters">
    <input [(ngModel)]="searchQuery" placeholder="Search..." />
    <button (click)="openFilterMenu()">Filters</button>
    <button (click)="openIssueDialog()">Create Issue</button>
  </div>

  <!-- Columns -->
  <div class="board-columns">
    <!-- TODO Column -->
    <div class="column">
      <h3>To Do ({{ boardStore.todoIssues().length }})</h3>
      <div
        cdkDropList
        [cdkDropListData]="boardStore.todoIssues()"
        (cdkDropListDropped)="onDrop($event, 'todo')"
      >
        @for (issue of boardStore.todoIssues(); track issue.id) {
        <div cdkDrag [cdkDragData]="issue" (click)="openIssue(issue)">
          <app-issue-card [issue]="issue" />
        </div>
        }
      </div>
    </div>

    <!-- IN PROGRESS Column -->
    <div class="column">...</div>

    <!-- DONE Column -->
    <div class="column">...</div>
  </div>
</div>
```

**Key Methods:**

```typescript
ngOnInit() {
  const projectId = this.route.snapshot.paramMap.get('projectId');
  if (projectId) {
    this.boardStore.loadIssues(projectId);
    this.projectsStore.selectProject(projectId);
  }
}

onDrop(event: CdkDragDrop<Issue[]>, newStatus: string) {
  this.boardStore.moveIssue(event, newStatus);
}

openIssueDialog() {
  this.dialog.open(IssueDialogComponent, {
    width: '800px',
    data: { projectId: this.projectsStore.selectedProjectId() }
  });
}
```

### 📝 Issue Dialog Component

**Vai trò:**

- Create/Edit issue
- Form validation
- Assign members

**Form Fields:**

```typescript
issueForm = new FormGroup({
  title: new FormControl('', Validators.required),
  description: new FormControl(''),
  type: new FormControl('story'),
  priority: new FormControl('medium'),
  assigneeId: new FormControl(null),
  statusColumnId: new FormControl('todo')
});

async save() {
  if (this.issueForm.valid) {
    const formValue = this.issueForm.value;

    if (this.data.issue) {
      // Update existing
      await this.boardStore.updateIssue(this.data.issue.id, formValue);
    } else {
      // Create new
      await this.boardStore.addIssue({
        ...formValue,
        projectId: this.data.projectId,
        reporterId: this.authStore.user()!.uid,
        order: 0,
        isInBacklog: false
      });
    }

    this.dialogRef.close();
  }
}
```

### 📂 Project List Component

**Vai trò:**

- Hiển thị danh sách projects
- Create new project
- Delete project

**Template:**

```html
<div class="projects-container">
  <h1>Projects</h1>

  <button (click)="openCreateDialog()">Create Project</button>

  <div class="projects-grid">
    @for (project of projectsStore.projects(); track project.id) {
    <div class="project-card" (click)="navigateToProject(project.id)">
      <h3>{{ project.name }}</h3>
      <p>{{ project.key }}</p>
      <p>{{ project.memberIds.length }} members</p>

      @if (project.ownerId === authStore.user()?.uid) {
      <button (click)="deleteProject(project.id); $event.stopPropagation()">Delete</button>
      }
    </div>
    }
  </div>
</div>
```

### 🏗️ Project Layout Component

**Vai trò:**

- Parent component cho project routes
- Hiển thị project navigation
- Load project members

**Template:**

```html
<div class="project-layout">
  <!-- Project Header -->
  <div class="project-header">
    <h2>{{ projectsStore.selectedProject()?.name }}</h2>

    <nav>
      <a routerLink="board" routerLinkActive="active">Board</a>
      <a routerLink="backlog" routerLinkActive="active">Backlog</a>
    </nav>

    <button (click)="openMembersDialog()">Members</button>
  </div>

  <!-- Child Routes -->
  <router-outlet></router-outlet>
</div>
```

### 👥 Members Dialog Component

**Vai trò:**

- Hiển thị project members
- Invite new members
- Remove members

**Template:**

```html
<h2>Project Members</h2>

<!-- Current Members -->
<div class="members-list">
  @for (member of projectsStore.members(); track member.uid) {
  <div class="member-item">
    <img [src]="member.photoURL" alt="" />
    <span>{{ member.displayName }}</span>

    @if (canRemoveMember(member)) {
    <button (click)="removeMember(member.uid)">Remove</button>
    }
  </div>
  }
</div>

<!-- Invite Form -->
<form (ngSubmit)="inviteUser()">
  <input [(ngModel)]="inviteEmail" type="email" placeholder="Enter email to invite" />
  <button type="submit">Invite</button>
</form>
```

### ✅ My Tasks Component

**Vai trò:**

- Hiển thị tasks được assign cho user
- Filter và sort
- Quick actions

**Template:**

```html
<div class="my-tasks-container">
  <h1>My Tasks</h1>

  <!-- Filters -->
  <div class="filters">
    <select [(ngModel)]="statusFilter">
      <option value="">All Status</option>
      <option value="todo">To Do</option>
      <option value="in-progress">In Progress</option>
      <option value="done">Done</option>
    </select>
  </div>

  <!-- Tasks List -->
  <div class="tasks-list">
    @for (task of myTasksStore.filteredTasks(); track task.id) {
    <div class="task-item" (click)="openTask(task)">
      <span class="task-key">{{ task.key }}</span>
      <h3>{{ task.title }}</h3>
      <span class="task-status">{{ task.statusColumnId }}</span>
      <span class="task-priority">{{ task.priority }}</span>
    </div>
    }
  </div>
</div>
```

### 🏠 Home Component (Dashboard)

**Vai trò:**

- Dashboard overview
- Statistics
- Recent tasks

**Template:**

```html
<div class="home-container">
  <h1>Dashboard</h1>

  <!-- Statistics -->
  <div class="stats-grid">
    <div class="stat-card">
      <h3>Total Tasks</h3>
      <p>{{ stats.totalTasks }}</p>
    </div>

    <div class="stat-card">
      <h3>Completed</h3>
      <p>{{ stats.completedTasks }}</p>
    </div>

    <div class="stat-card">
      <h3>Overdue</h3>
      <p>{{ stats.overdueTasks }}</p>
    </div>
  </div>

  <!-- Assigned Tasks Widget -->
  <div class="assigned-tasks-widget">
    <h2>Assigned Tasks</h2>

    @for (task of recentTasks(); track task.id) {
    <div class="task-item">{{ task.title }}</div>
    }

    <button (click)="toggleShowAll()">{{ showAll ? 'Show Less' : 'Show All' }}</button>
  </div>
</div>
```

---

## 🎓 TÓM TẮT LUỒNG HOẠT ĐỘNG TỔNG THỂ

### 1️⃣ User Login

```
User clicks "Login with Google"
  ↓
LoginComponent.loginWithGoogle()
  ↓
AuthStore.login()
  ↓
AuthService.loginWithGoogle()
  ↓
Firebase Auth (popup)
  ↓
AuthService.syncUserToFirestore()
  ↓
AuthService.user$ emits new user
  ↓
AuthStore._setUser() updates state
  ↓
AppComponent effect triggers
  ↓
ProjectsStore.loadProjects() & loadInvites()
  ↓
UI updates (sidebar shows projects)
```

### 2️⃣ Navigate to Board

```
User clicks project in sidebar
  ↓
Router navigates to /project/:id/board
  ↓
AuthGuard checks authentication
  ↓
ProjectLayout component loads
  ↓
Board component ngOnInit
  ↓
BoardStore.loadIssues(projectId)
  ↓
IssueService.getIssues() queries Firestore
  ↓
Firestore returns Observable<Issue[]>
  ↓
BoardStore updates issues state
  ↓
Computed signals filter issues by column
  ↓
UI renders 3 columns with issues
```

### 3️⃣ Drag & Drop Issue

```
User drags issue from TODO to IN PROGRESS
  ↓
CDK emits cdkDropListDropped event
  ↓
Board.onDrop(event, 'in-progress')
  ↓
BoardStore.moveIssue()
  ↓
Calculate new order value
  ↓
Optimistic update (patchState immediately)
  ↓
UI updates instantly
  ↓
IssueService.updateIssue() to Firestore
  ↓
Firestore triggers real-time update
  ↓
Observable emits updated issue
  ↓
State syncs with server
```

### 4️⃣ Create New Issue

```
User clicks "Create Issue"
  ↓
Dialog opens (IssueDialogComponent)
  ↓
User fills form and submits
  ↓
IssueDialog.save()
  ↓
BoardStore.addIssue()
  ↓
IssueService.addIssue() to Firestore
  ↓
Firestore creates document
  ↓
Real-time listener detects new issue
  ↓
Observable emits updated issues array
  ↓
BoardStore updates state
  ↓
Computed signals recalculate
  ↓
UI shows new issue in correct column
```

### 5️⃣ Invite Member to Project

```
User opens Members dialog
  ↓
Enters email and clicks Invite
  ↓
MembersDialog.inviteUser()
  ↓
ProjectsStore.inviteUser(email)
  ↓
ProjectsService.findUserByEmail()
  ↓
Firestore queries users collection
  ↓
ProjectsService.inviteUserToProject()
  ↓
Firestore updates project.invitedMemberIds
  ↓
Invited user sees notification
  ↓
User clicks Accept
  ↓
ProjectsStore.acceptInvite()
  ↓
Firestore moves user from invitedMemberIds to memberIds
  ↓
Both users' project lists update
```

---

## 🚀 KẾT LUẬN

### ✨ Điểm Mạnh Của Kiến Trúc

1. **Reactive & Real-time**

   - Sử dụng Signals và Observables
   - Firestore real-time updates
   - UI tự động sync với data

2. **Type-Safe**

   - TypeScript strict mode
   - Strong typing cho models
   - Compile-time error checking

3. **Scalable**

   - Feature-based structure
   - Lazy loading
   - Modular design

4. **Maintainable**

   - Clear separation of concerns
   - Single responsibility principle
   - Easy to test

5. **Secure**
   - Firebase Security Rules
   - Auth guards
   - Server-side validation

### 🎯 Best Practices Được Áp Dụng

- ✅ Standalone Components (Angular 18+)
- ✅ Signal-based state management
- ✅ Reactive programming with RxJS
- ✅ Optimistic updates for better UX
- ✅ Lazy loading for performance
- ✅ Security rules for data protection
- ✅ Type safety throughout

### 📚 Tài Liệu Tham Khảo

- [Angular Documentation](https://angular.dev)
- [NgRx Signals](https://ngrx.io/guide/signals)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Angular Material](https://material.angular.io)
- [Angular CDK](https://material.angular.io/cdk)

---

**Tác giả:** Jira Clone Development Team  
**Ngày cập nhật:** 2026-01-07  
**Phiên bản:** 1.0.0
