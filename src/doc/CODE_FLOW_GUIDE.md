# Hướng Dẫn Chi Tiết: Luồng Code và Cách Hoạt Động Của Jira Clone

> **Mục đích**: Giải thích cách toàn bộ ứng dụng hoạt động từ lúc khởi động đến khi thực hiện các chức năng, bao gồm cách các file liên kết với nhau.

---

## 📖 Mục Lục

1. [Khởi động ứng dụng](#1-khởi-động-ứng-dụng-bootstrap)
2. [Luồng đăng nhập & xác thực](#2-luồng-đăng-nhập--xác-thực-authentication-flow)
3. [Luồng quản lý dự án](#3-luồng-quản-lý-dự-án-project-management)
4. [Luồng Kanban Board](#4-luồng-kanban-board-drag--drop)
5. [Luồng My Tasks](#5-luồng-my-tasks)
6. [Cơ chế Real-time Updates](#6-cơ-chế-real-time-updates-firestore)
7. [Sơ đồ liên kết các file](#7-sơ-đồ-liên-kết-các-file)

---

## 1. Khởi động ứng dụng (Bootstrap)

### 🎯 Điểm khởi đầu: `main.ts`

```typescript
// File: src/main.ts
bootstrapApplication(AppComponent, appConfig);
```

**Điều gì xảy ra?**

- Angular khởi tạo `AppComponent` - component gốc của toàn bộ ứng dụng
- Load cấu hình từ `appConfig` (Firebase, Router, Material UI...)

---

### 🏗️ AppComponent (`app.ts`) - Bộ khung chính

```typescript
export class AppComponent {
  readonly authStore = inject(AuthStore); // ← Store quản lý người dùng
  readonly projectsStore = inject(ProjectsStore); // ← Store quản lý dự án
}
```

**Nhiệm vụ của AppComponent:**

#### 1. Hiển thị Header (Top Toolbar)

```html
<mat-toolbar color="primary">
  <span>Jira Clone</span>
  <!-- Hiển thị notifications (lời mời dự án) -->
  <button [matBadge]="projectsStore.pendingInvites().length">
    <mat-icon>notifications</mat-icon>
  </button>
  <!-- Hiển thị tên user & nút logout -->
  <span>{{ authStore.user()?.displayName }}</span>
  <button (click)="authStore.logout()">Logout</button>
</mat-toolbar>
```

**Lưu ý quan trọng:**

- `authStore.user()` là một **Signal** - tự động cập nhật UI khi user đăng nhập/đăng xuất
- `projectsStore.pendingInvites()` cũng là **Signal** - số lượng lời mời tự động cập nhật

#### 2. Hiển thị Sidebar (Menu bên trái)

```html
<mat-sidenav>
  <a routerLink="/home">Home</a>
  <a routerLink="/my-tasks">My Tasks</a>

  <!-- Danh sách dự án (tự động lặp) -->
  @for (project of projectsStore.projects(); track project.id) {
  <a [routerLink]="['/project', project.id]">{{ project.name }}</a>
  }
</mat-sidenav>
```

**Điểm đặc biệt:**

- `@for` là cú pháp mới của Angular 17+ (thay thế `*ngFor`)
- Danh sách dự án **tự động cập nhật** khi thêm/xóa project trong Firestore

#### 3. Hiển thị nội dung chính

```html
<mat-sidenav-content>
  <app-breadcrumbs></app-breadcrumbs>
  <!-- Đường dẫn điều hướng -->
  <router-outlet></router-outlet>
  <!-- Nơi render các trang con -->
</mat-sidenav-content>
```

**Cách hoạt động:**

1. User click vào menu "Home" → Router load `HomeComponent`
2. `HomeComponent` được render vào vị trí `<router-outlet>`
3. Breadcrumbs tự động cập nhật thành "Home"

---

## 2. Luồng đăng nhập & xác thực (Authentication Flow)

### 🔐 Các file liên quan:

```
src/app/
├── core/auth/
│   ├── auth.store.ts      ← Quản lý state người dùng (user, loading, error)
│   ├── auth.service.ts    ← Gọi Firebase Authentication API
│   └── auth.guard.ts      ← Bảo vệ các route cần đăng nhập
└── features/auth/login/
    └── login.ts           ← UI trang đăng nhập
```

---

### 📝 Bước 1: User bấm "Login with Google"

**File:** `features/auth/login/login.ts`

```typescript
async loginWithGoogle() {
  await this.authStore.login(); // ← Gọi method từ AuthStore
  this.router.navigate(['/home']); // Chuyển về trang Home
}
```

---

### 📝 Bước 2: AuthStore xử lý logic đăng nhập

**File:** `core/auth/auth.store.ts`

```typescript
export const AuthStore = signalStore(
  withState({
    user: null, // ← Thông tin user hiện tại
    loading: false, // ← Trạng thái đang load
    error: null, // ← Lỗi (nếu có)
  }),
  withMethods((store, authService = inject(AuthService)) => ({
    login: async () => {
      patchState(store, { loading: true }); // Bật loading

      try {
        await authService.loginWithGoogle(); // Gọi Firebase
      } catch (error) {
        patchState(store, { error: error.message }); // Lưu lỗi
      } finally {
        patchState(store, { loading: false }); // Tắt loading
      }
    },
  }))
);
```

**Giải thích:**

- `patchState()` = Cập nhật state (giống `setState` trong React)
- `authService.loginWithGoogle()` = Gọi API Firebase

---

### 📝 Bước 3: AuthService gọi Firebase

**File:** `core/auth/auth.service.ts`

```typescript
async loginWithGoogle() {
  // 1. Mở popup đăng nhập Google OAuth
  const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());

  // 2. Lưu thông tin user vào Firestore
  await this.syncUserToFirestore(credential.user);

  return credential;
}

private async syncUserToFirestore(user: User) {
  const userDoc = doc(this.firestore, 'users', user.uid);
  await setDoc(userDoc, {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  }, { merge: true }); // merge = không ghi đè, chỉ cập nhật
}
```

**Tại sao phải lưu vào Firestore?**

- Firebase Auth chỉ lưu thông tin đăng nhập, không lưu metadata
- Chúng ta cần lưu user vào Firestore để:
  - Tìm kiếm user theo email (mời vào dự án)
  - Hiển thị danh sách thành viên, ảnh đại diện...

---

### 📝 Bước 4: Auth State Listener (Tự động đăng nhập)

**File:** `core/auth/auth.store.ts`

```typescript
withHooks({
  onInit(store, authService = inject(AuthService)) {
    // Lắng nghe thay đổi trạng thái đăng nhập từ Firebase
    authService.user$.subscribe((user) => {
      patchState(store, { user }); // Cập nhật state
    });
  },
});
```

**Cách hoạt động:**

1. User đăng nhập thành công → Firebase lưu session vào localStorage
2. Lần sau mở app → Firebase tự động restore session
3. `authService.user$` emit user → Store tự động cập nhật
4. UI tự động hiển thị tên user (không cần reload)

---

### 📝 Bước 5: Hiệu ứng domino - Load dữ liệu tự động

**File:** `features/projects/projects.store.ts`

```typescript
withHooks({
  onInit(store) {
    const authStore = inject(AuthStore);

    effect(() => {
      const user = authStore.user(); // ← Lắng nghe thay đổi

      if (user) {
        // Khi có user → Tự động load projects
        store.loadProjects(user.uid);
        store.loadInvites(user.uid);
      } else {
        // Khi logout → Xóa dữ liệu cũ
        patchState(store, { projects: [], pendingInvites: [] });
      }
    });
  },
});
```

**Luồng hoàn chỉnh:**

```
User đăng nhập
    ↓
AuthStore.user() = { uid: "abc123", name: "John" }
    ↓ (Effect tự động chạy)
ProjectsStore.loadProjects("abc123")
    ↓
ProjectsService.getProjects("abc123") → Query Firestore
    ↓
Firestore trả về: [Project1, Project2]
    ↓
ProjectsStore.projects() = [Project1, Project2]
    ↓ (UI tự động re-render)
Sidebar hiển thị danh sách dự án
```

---

### 🔒 Auth Guard - Bảo vệ route

**File:** `core/auth/auth.guard.ts`

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.user()) {
    return true; // Cho phép truy cập
  } else {
    router.navigate(['/login']); // Redirect về login
    return false; // Chặn
  }
};
```

**File:** `app.routes.ts`

```typescript
export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: 'home',
    component: Home,
    canActivate: [authGuard], // ← Bảo vệ route này
  },
  // ...
];
```

**Kịch bản:**

1. User chưa đăng nhập, vào URL `/home`
2. Guard kiểm tra `authStore.user()` → `null`
3. Guard redirect về `/login`
4. User không thấy trang Home

---

## 3. Luồng quản lý dự án (Project Management)

### 📂 Các file liên quan:

```
src/app/features/projects/
├── projects.store.ts       ← State management (projects, invites, members)
├── projects.service.ts     ← API calls đến Firestore
├── project.model.ts        ← TypeScript interface
├── project-list/           ← Trang danh sách dự án
└── project-create/         ← Dialog tạo dự án mới
```

---

### 🔄 Luồng tải danh sách dự án

#### Bước 1: HomeComponent khởi tạo

**File:** `features/home/home.ts`

```typescript
export class Home {
  projectsStore = inject(ProjectsStore); // ← Inject store

  // Template tự động hiển thị
  @for (project of projectsStore.projects(); track project.id) {
    <mat-card>{{ project.name }}</mat-card>
  }
}
```

#### Bước 2: ProjectsStore load dữ liệu

**File:** `features/projects/projects.store.ts`

```typescript
loadProjects: rxMethod<string>(
  pipe(
    tap(() => store.setLoading(true)), // Bật loading

    // Gọi service để query Firestore
    switchMap((userId) => projectsService.getProjects(userId)),

    // Lưu vào store
    tap((projects) => patchState(store, { projects })),

    // Load thêm thông tin owner (người tạo dự án)
    switchMap((projects) => {
      const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
      return projectsService.getUsers(ownerIds);
    }),

    tap((owners) => {
      patchState(store, { projectOwners: owners, loading: false });
    })
  )
);
```

**Giải thích `rxMethod` và RxJS:**

- `rxMethod` = Wrapper của NgRx để xử lý stream dữ liệu
- `pipe()` = Chuỗi các operator xử lý dữ liệu tuần tự
- `tap()` = Side effect (cập nhật state, log...)
- `switchMap()` = Chuyển đổi từ stream này sang stream khác (gọi API mới)

**Tại sao dùng `switchMap` thay vì `map`?**

```typescript
// map: Chỉ transform dữ liệu
['user1', 'user2'].map((id) => id.toUpperCase()); // ['USER1', 'USER2']

// switchMap: Gọi Observable mới (API call)
of(['user1', 'user2']).pipe(
  switchMap((ids) => getUsers(ids)) // ← Gọi API, trả về Observable mới
);
```

#### Bước 3: ProjectsService query Firestore

**File:** `features/projects/projects.service.ts`

```typescript
getProjects(userId: string): Observable<Project[]> {
  const q = query(
    this.projectsCollection,
    where('memberIds', 'array-contains', userId) // Chỉ lấy project có user này
  );

  return collectionData(q, { idField: 'id' }); // Real-time listener
}
```

**Giải thích query:**

```javascript
// Cấu trúc document trong Firestore:
{
  id: "proj-1",
  name: "Website Redesign",
  ownerId: "user-123",
  memberIds: ["user-123", "user-456"] // ← Array chứa members
}

// Query tìm các project có userId trong mảng memberIds
where('memberIds', 'array-contains', 'user-456')

// Kết quả: Trả về "proj-1" vì "user-456" có trong memberIds
```

---

### 👥 Luồng mời thành viên vào dự án

#### UI Flow

```
1. Owner mở Project Settings
2. Nhập email: "john@example.com"
3. Bấm "Invite"ell 
4. John nhận thông báo (Bell icon trên Header)
5. John bấm "Accept" hoặc "Reject"
```

#### Code Flow

**Bước 1:** Owner mời user

```typescript
// File: features/projects/projects.store.ts
inviteUser: async (email: string) => {
  // 1. Tìm user theo email
  const users = await projectsService.findUserByEmail(email);
  if (users.length === 0) throw new Error('User not found');

  const userToInvite = users[0];
  const project = store.selectedProject();

  // 2. Kiểm tra đã là member chưa
  if (project.memberIds.includes(userToInvite.uid)) {
    throw new Error('User is already a member');
  }

  // 3. Thêm vào danh sách "chờ mời"
  await projectsService.inviteUserToProject(project.id, userToInvite.uid, project.invitedMemberIds);
};
```

**Bước 2:** Service cập nhật Firestore

```typescript
// File: features/projects/projects.service.ts
inviteUserToProject(projectId: string, userId: string, currentInvitedIds: string[]) {
  const docRef = doc(this.firestore, 'projects', projectId);
  const newInvitedIds = [...currentInvitedIds, userId]; // Thêm user mới

  return updateDoc(docRef, {
    invitedMemberIds: newInvitedIds
  });
}
```

**Cấu trúc Firestore thay đổi:**

```javascript
// BEFORE
{
  id: "proj-1",
  name: "Website",
  memberIds: ["user-123"],
  invitedMemberIds: [] // ← Rỗng
}

// AFTER (mời user-456)
{
  id: "proj-1",
  name: "Website",
  memberIds: ["user-123"],
  invitedMemberIds: ["user-456"] // ← Đã thêm
}
```

**Bước 3:** John (user-456) nhận thông báo

Vì `ProjectsStore` đang lắng nghe real-time:

```typescript
loadInvites: rxMethod<string>(
  pipe(
    switchMap((userId) => projectsService.getPendingInvites(userId)),
    tap((pendingInvites) => patchState(store, { pendingInvites }))
  )
);
```

Query trong `getPendingInvites`:

```typescript
where('invitedMemberIds', 'array-contains', userId);
```

→ Khi Firestore cập nhật, Observable tự động emit giá trị mới
→ UI tự động hiển thị badge thông báo

**Bước 4:** John bấm "Accept"

```typescript
acceptInvite: async (project: Project, userId: string) => {
  await projectsService.acceptInvite(project, userId);

  // Optimistic Update: Cập nhật UI ngay lập tức
  patchState(store, {
    pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
    projects: [
      ...store.projects(),
      {
        ...project,
        memberIds: [...project.memberIds, userId], // Thêm vào members
      },
    ],
  });
};
```

Service xử lý Firestore:

```typescript
async acceptInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);

  return updateDoc(docRef, {
    invitedMemberIds: project.invitedMemberIds.filter(id => id !== userId), // Xóa khỏi danh sách chờ
    memberIds: [...project.memberIds, userId] // Thêm vào members chính thức
  });
}
```

---

## 4. Luồng Kanban Board (Drag & Drop)

### 📋 Các file liên quan:

```
src/app/features/
├── board/
│   ├── board.store.ts        ← State: issues, filter
│   ├── board.ts              ← UI: 3 cột (Todo, In Progress, Done)
│   └── board-filter/         ← Component lọc (search, assignee...)
└── issue/
    ├── issue.service.ts      ← CRUD operations
    ├── issue.model.ts        ← TypeScript interface
    └── issue-dialog/         ← Dialog thêm/sửa issue
```

---

### 🎨 Cách Kanban Board render

**File:** `features/board/board.ts`

```html
<div class="board-columns">
  <!-- Cột TODO -->
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

  <!-- Cột IN PROGRESS (tương tự) -->
  <!-- Cột DONE (tương tự) -->
</div>
```

**Cách hoạt động của Angular CDK Drag & Drop:**

1. `cdkDropList` = Định nghĩa vùng có thể thả (drop zone)
2. `cdkDrag` = Phần tử có thể kéo
3. `cdkDropListConnectedTo` = Danh sách các cột có thể kéo qua lại
4. `cdkDropListDropped` = Event khi thả phần tử

---

### 🔢 Computed Signals - Tự động lọc và sắp xếp

**File:** `features/board/board.store.ts`

```typescript
withComputed(({ issues, filter }) => {
  // 1. Lọc theo điều kiện (search, assignee, priority...)
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

  // 2. Sắp xếp theo order
  const sortedFilteredIssues = computed(() => {
    return [...filteredIssues()].sort((a, b) => a.order - b.order);
  });

  // 3. Tách ra từng cột
  return {
    todoIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo')),
    inProgressIssues: computed(() =>
      sortedFilteredIssues().filter((i) => i.statusColumnId === 'in-progress')
    ),
    doneIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'done')),
  };
});
```

**Tại sao dùng Computed Signal?**

- **Auto-recompute**: Khi `issues` hoặc `filter` thay đổi → Tự động tính lại
- **Memoization**: Chỉ tính lại khi dependency thay đổi (tránh tính lại không cần thiết)
- **Fine-grained reactivity**: Angular chỉ re-render các phần UI phụ thuộc vào signal này

**Ví dụ thực tế:**

```typescript
// User nhập "bug" vào ô search
store.updateFilter({ searchQuery: 'bug' });

// Flow tự động:
filter() thay đổi
    ↓
filteredIssues() tự động tính lại (chỉ giữ issues có "bug")
    ↓
sortedFilteredIssues() tự động tính lại
    ↓
todoIssues() tự động tính lại
    ↓
UI tự động re-render cột TODO
```

---

### 🎯 Drag & Drop Logic - Chi tiết từng trường hợp

#### Trường hợp 1: Kéo trong cùng cột (Reorder)

```typescript
moveIssue: (event: CdkDragDrop<Issue[]>, newStatus: string) => {
  const movedIssue = event.item.data as Issue;

  if (event.previousContainer === event.container) {
    // 1. Sắp xếp lại mảng trên UI
    const columnIssues = [...event.container.data];
    moveItemInArray(columnIssues, event.previousIndex, event.currentIndex);

    // 2. Tính toán lại thứ tự (order)
    const updates: { id: string; data: Partial<Issue> }[] = [];

    columnIssues.forEach((issue, index) => {
      const newOrder = index * 1000; // 0, 1000, 2000, 3000...
      if (issue.order !== newOrder) {
        updates.push({ id: issue.id, data: { order: newOrder } });
      }
    });

    // 3. Optimistic Update: Cập nhật UI ngay lập tức
    if (updates.length > 0) {
      patchState(store, (state) =>
        produce(state, (draft) => {
          updates.forEach((update) => {
            const issue = draft.issues.find((i) => i.id === update.id);
            if (issue) issue.order = update.data.order!;
          });
        })
      );

      // 4. Batch Update: Cập nhật Firestore (1 lần gọi duy nhất)
      issueService.batchUpdateIssues(updates);
    }
  }
};
```

**Tại sao spacing = 1000?**

```
// Dễ dàng insert vào giữa
[0, 1000, 2000]
    ↓ Insert vào giữa 0 và 1000
[0, 500, 1000, 2000]
```

**Batch Update Service:**

```typescript
async batchUpdateIssues(updates: { id: string; data: Partial<Issue> }[]) {
  const batch = writeBatch(this.firestore);

  updates.forEach(({ id, data }) => {
    const docRef = doc(this.firestore, 'issues', id);
    batch.update(docRef, data);
  });

  return batch.commit(); // 1 network call thay vì N calls
}
```

---

#### Trường hợp 2: Kéo sang cột khác

```typescript
else {
  // 1. Simulate insert để tìm vị trí mới
  const targetColumnIssues = [...event.container.data];
  targetColumnIssues.splice(event.currentIndex, 0, movedIssue);

  // 2. Tính order dựa trên 2 phần tử lân cận
  let newOrder = 0;
  const prevItem = targetColumnIssues[event.currentIndex - 1];
  const nextItem = targetColumnIssues[event.currentIndex + 1];

  if (!prevItem && !nextItem) {
    newOrder = 0; // Cột rỗng
  } else if (!prevItem) {
    newOrder = (nextItem.order || 0) - 1000; // Đầu cột
  } else if (!nextItem) {
    newOrder = (prevItem.order || 0) + 1000; // Cuối cột
  } else {
    newOrder = (prevItem.order + nextItem.order) / 2; // Giữa 2 phần tử
  }

  // 3. Optimistic Update với Immer
  patchState(store, (state) =>
    produce(state, (draft) => {
      const issue = draft.issues.find(i => i.id === movedIssue.id);
      if (issue) {
        issue.statusColumnId = newStatus; // Đổi cột
        issue.order = newOrder;           // Đổi vị trí
      }
    })
  );

  // 4. Update Firestore
  issueService.updateIssue(movedIssue.id, {
    statusColumnId: newStatus,
    order: newOrder
  });
}
```

**Ví dụ tính order:**

```
Cột In Progress: [order: 1000, order: 3000]

Kéo issue vào giữa:
  prevItem.order = 1000
  nextItem.order = 3000
  newOrder = (1000 + 3000) / 2 = 2000

Kết quả: [1000, 2000, 3000]
```

---

### ✨ Optimistic Update Pattern

**Tại sao cần?**

- Không cần đợi Firestore phản hồi (100-500ms)
- App cảm giác "instant" như native app

**Rủi ro:**

- Nếu Firestore lỗi → UI hiển thị sai

**Giải pháp: Rollback khi lỗi**

```typescript
updateIssue: async (issueId: string, updates: Partial<Issue>) => {
  const originalIssues = [...store.issues()]; // Backup

  // Optimistic Update
  patchState(store, (state) =>
    produce(state, (draft) => {
      const issue = draft.issues.find((i) => i.id === issueId);
      if (issue) Object.assign(issue, updates);
    })
  );

  try {
    await issueService.updateIssue(issueId, updates);
  } catch (err) {
    // Rollback nếu lỗi
    patchState(store, { issues: originalIssues });
    errorService.showError('Failed to update issue');
  }
};
```

---

## 5. Luồng My Tasks

### 📂 Files

```
src/app/features/my-tasks/
├── my-tasks.store.ts    ← Store riêng cho "task của tôi"
├── my-tasks.ts          ← UI dạng Table (khác với Kanban)
└── my-tasks.service.ts  ← Không có, dùng chung IssueService
```

---

### 🔍 Query đặc biệt: "Chỉ task được assign cho tôi"

**File:** `features/issue/issue.service.ts`

```typescript
getMyIssues(userId: string): Observable<Issue[]> {
  const q = query(
    this.issuesCollection,
    where('assigneeId', '==', userId), // ← Chỉ lấy task có assigneeId là userId
    orderBy('createdAt', 'desc')
  );

  return collectionData(q, { idField: 'id' });
}
```

**Khác biệt với Board:**

```typescript
// Board: Lấy TẤT CẢ task của 1 dự án
where('projectId', '==', projectId);

// My Tasks: Lấy task được assign cho user (có thể nhiều dự án)
where('assigneeId', '==', userId);
```

---

### 📊 UI: Table thay vì Kanban

**File:** `features/my-tasks/my-tasks.ts`

```html
<table mat-table [dataSource]="store.issues()">
  <!-- Column: Title -->
  <ng-container matColumnDef="title">
    <th mat-header-cell *matHeaderCellDef>Title</th>
    <td mat-cell *matCellDef="let issue">{{ issue.title }}</td>
  </ng-container>

  <!-- Column: Project -->
  <ng-container matColumnDef="project">
    <th mat-header-cell *matHeaderCellDef>Project</th>
    <td mat-cell *matCellDef="let issue">{{ getProjectName(issue.projectId) }}</td>
  </ng-container>

  <!-- Column: Priority -->
  <ng-container matColumnDef="priority">
    <th mat-header-cell *matHeaderCellDef>Priority</th>
    <td mat-cell *matCellDef="let issue">
      <mat-icon [class]="'priority-' + issue.priority">
        {{ getPriorityIcon(issue.priority) }}
      </mat-icon>
    </td>
  </ng-container>

  <!-- Column: Status -->
  <ng-container matColumnDef="status">
    <th mat-header-cell *matHeaderCellDef>Status</th>
    <td mat-cell *matCellDef="let issue">{{ getStatusLabel(issue.statusColumnId) }}</td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
</table>
```

---

## 6. Cơ chế Real-time Updates (Firestore)

### 🔄 Tại sao UI tự động cập nhật?

**Firestore Realtime Listeners:**

```typescript
// Firestore SDK tự động mở WebSocket connection
collectionData(query); // ← Observable, không phải Promise!
```

**Luồng hoạt động:**

```
User A tạo issue mới
    ↓
Issue được thêm vào Firestore
    ↓
Firestore gửi event qua WebSocket
    ↓
Observable emit giá trị mới: [Issue1, Issue2, NewIssue]
    ↓
BoardStore.issues() tự động cập nhật
    ↓
Computed Signals (todoIssues, inProgressIssues...) tự động tính lại
    ↓
UI của User B tự động hiển thị issue mới (không cần F5)
```

**Ví dụ thực tế trên 2 trình duyệt:**

```
Browser 1 (User A):              Browser 2 (User B):
Click "Add Issue"                Đang xem Board
    ↓
Issue lưu vào Firestore -------- Firestore notify
    ↓                                    ↓
UI hiển thị ngay               UI tự động thêm issue mới
(Optimistic Update)            (Real-time Update)
```

---

## 7. Sơ đồ liên kết các file

### 🗺️ Luồng dữ liệu tổng quát

```
┌─────────────────────────────────────────────────────┐
│                   AppComponent                      │
│  - Inject: AuthStore, ProjectsStore                │
│  - Hiển thị: Header, Sidebar, Router Outlet        │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼───────┐
│   AuthStore    │   │ ProjectsStore  │
│ ────────────── │   │ ────────────── │
│ - user         │   │ - projects     │
│ - loading      │   │ - invites      │
│ - error        │   │ - members      │
└───────┬────────┘   └────────┬───────┘
        │                     │
┌───────▼────────┐   ┌────────▼────────┐
│  AuthService   │   │ ProjectsService │
│ ────────────── │   │ ──────────────  │
│ - Firebase     │   │ - Firestore     │
│   Auth API     │   │   Query         │
└────────────────┘   └─────────────────┘
```

---

### 🎯 Luồng Board Component chi tiết

```
BoardComponent
    │
    ├─ inject(BoardStore)
    │       │
    │       ├─ todoIssues() ────┐
    │       ├─ inProgressIssues()├─ Computed Signals
    │       └─ doneIssues() ────┘
    │
    ├─ inject(ProjectsStore)
    │       └─ selectedProject()
    │
    └─ Methods:
        ├─ drop(event) ─────> BoardStore.moveIssue()
        ├─ openIssue() ─────> MatDialog.open(IssueDialog)
        └─ deleteIssue() ───> BoardStore.deleteIssue()

BoardStore
    │
    ├─ State: issues[], filter
    │
    ├─ Computed:
    │   ├─ filteredIssues
    │   ├─ sortedFilteredIssues
    │   └─ todoIssues, inProgressIssues, doneIssues
    │
    └─ Methods:
        ├─ loadIssues() ────> IssueService.getIssues()
        ├─ moveIssue() ─────> IssueService.updateIssue()
        ├─ addIssue() ──────> IssueService.addIssue()
        └─ deleteIssue() ───> IssueService.deleteIssue()

IssueService
    │
    └─ Firestore Operations:
        ├─ getIssues(projectId) ───> query(where('projectId', '==', ...))
        ├─ updateIssue(id, data) ──> updateDoc()
        ├─ addIssue(issue) ────────> addDoc()
        ├─ deleteIssue(id) ────────> deleteDoc()
        └─ batchUpdate(updates) ───> writeBatch().commit()
```

---

### 📋 Dependency Graph

```
                    main.ts
                       │
                   AppComponent
                   ┌───┴───┐
              AuthStore  ProjectsStore
                   │           │
              AuthService  ProjectsService
                   │           │
              Firebase    Firestore
                 Auth      Database


    BoardComponent              HomeComponent
         │                           │
    BoardStore                 MyTasksStore
         │                           │
    IssueService ─────────────────────┘
         │
    Firestore
```

---

### 🔗 Service Layer (API gọi Firestore)

```typescript
AuthService: {
  methods: [
    loginWithGoogle(),
    loginWithEmail(),
    logout(),
    syncUserToFirestore()
  ],
  firebaseAPI: Firebase.Auth
}

ProjectsService: {
  methods: [
    getProjects(userId),
    getPendingInvites(userId),
    findUserByEmail(email),
    inviteUserToProject(),
    acceptInvite(),
    rejectInvite(),
    removeMember(),
    getUsers(userIds)
  ],
  firebaseAPI: Firestore
}

IssueService: {
  methods: [
    getIssues(projectId),
    getMyIssues(userId),
    addIssue(issue),
    updateIssue(id, data),
    deleteIssue(id),
    batchUpdateIssues(updates)
  ],
  firebaseAPI: Firestore
}
```

---

### 🎭 Store Layer (State Management)

```typescript
AuthStore: {
  state: {
    user: AppUser | null,
    loading: boolean,
    error: string | null
  },
  methods: [
    login(),
    logout(),
    _setUser(user) // Private, chỉ dùng trong hook
  ],
  hooks: {
    onInit: "Subscribe to Firebase auth state changes"
  }
}

ProjectsStore: {
  state: {
    projects: Project[],
    pendingInvites: Project[],
    projectOwners: AppUser[],
    members: AppUser[],
    selectedProjectId: string | null,
    loading: boolean,
    error: string | null
  },
  computed: {
    selectedProject: "Tìm project theo selectedProjectId"
  },
  methods: [
    loadProjects(userId),
    loadInvites(userId),
    loadMembers(userIds),
    selectProject(id),
    inviteUser(email),
    acceptInvite(project, userId),
    rejectInvite(project, userId),
    removeMember(memberId),
    deleteProject(projectId)
  ],
  hooks: {
    onInit: "Listen to AuthStore.user() and auto-load data"
  }
}

BoardStore: {
  state: {
    issues: Issue[],
    filter: BoardFilter,
    loading: boolean,
    error: string | null
  },
  computed: {
    filteredIssues,
    sortedFilteredIssues,
    todoIssues,
    inProgressIssues,
    doneIssues
  },
  methods: [
    loadIssues(projectId),
    moveIssue(event, newStatus),
    addIssue(issue),
    updateIssue(id, updates),
    deleteIssue(id),
    updateFilter(filter)
  ]
}

MyTasksStore: {
  state: {
    issues: Issue[],
    loading: boolean
  },
  methods: [
    loadMyIssues(userId)
  ],
  hooks: {
    onInit: "Listen to AuthStore.user() and load my tasks"
  }
}
```

---

## 🎓 Tổng kết: Quy trình từ User Action đến UI Update

### Ví dụ: User kéo task từ "Todo" sang "In Progress"

```
1. User Action
   ↓
   Kéo thả task card trong UI
   ↓
2. Component Event
   drop(event: CdkDragDrop<Issue[]>, 'in-progress')
   ↓
3. Store Method
   BoardStore.moveIssue(event, 'in-progress')
   ↓
4. State Update (Optimistic)
   patchState(store, { issues: [...] })
   ↓
5. Computed Signals Re-calculate
   todoIssues(), inProgressIssues() tự động tính lại
   ↓
6. UI Auto Re-render
   Angular phát hiện Signal thay đổi → Re-render 2 cột
   ↓
7. Service Call (Background)
   IssueService.updateIssue(id, { statusColumnId: 'in-progress' })
   ↓
8. Firestore Update
   updateDoc(docRef, { statusColumnId: 'in-progress', order: 2000 })
   ↓
9. Real-time Broadcast
   Firestore gửi event đến tất cả clients đang lắng nghe
   ↓
10. Other Users' UI Update
    Browser khác nhận event → Store cập nhật → UI tự động thay đổi
```

---

### Kết luận

Dự án này áp dụng **kiến trúc hiện đại** với các pattern:

1. **Signal-based Reactivity** - Fine-grained updates, hiệu năng cao
2. **Unidirectional Data Flow** - Dễ debug, dễ hiểu luồng dữ liệu
3. **Real-time Synchronization** - Firestore WebSocket
4. **Optimistic Updates** - UX mượt mà như native app
5. **Separation of Concerns** - Component/Store/Service rõ ràng
6. **Type Safety** - TypeScript đảm bảo ít lỗi runtime

**Những câu hỏi thường gặp:**

**Q: Tại sao không dùng NgRx Store truyền thống?**
→ NgRx Signals Store gọn hơn, ít boilerplate, tích hợp tốt với Angular Signals.

**Q: Tại sao Store lại inject Service?**
→ Để tách biệt logic gọi API (Service) và quản lý state (Store).

**Q: Computed Signal khác gì RxJS Observable?**
→ Signal là synchronous, auto-memoized. Observable là async stream.

**Q: Khi nào nên dùng Immer?**
→ Khi cập nhật nested state phức tạp (ví dụ: drag & drop logic trong BoardStore).

---

**Tài liệu này là bản đầy đủ nhất về cách project hoạt động. Nếu có thắc mắc gì, hãy tham khảo lại các section tương ứng!**
