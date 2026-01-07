# Hướng Dẫn Chi Tiết Đầy Đủ - Jira Clone Application

## 📋 Mục Lục

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
3. [Công Nghệ Sử Dụng](#3-công-nghệ-sử-dụng)
4. [Cấu Trúc Thư Mục](#4-cấu-trúc-thư-mục)
5. [Data Models (Mô Hình Dữ Liệu)](#5-data-models-mô-hình-dữ-liệu)
6. [State Management (Quản Lý Trạng Thái)](#6-state-management-quản-lý-trạng-thái)
7. [Luồng Hoạt Động Chi Tiết](#7-luồng-hoạt-động-chi-tiết)
8. [Các Tính Năng Chính](#8-các-tính-năng-chính)
9. [Firebase Security Rules](#9-firebase-security-rules)
10. [Best Practices & Tips](#10-best-practices--tips)

---

## 1. Tổng Quan Dự Án

### 1.1. Giới Thiệu

Đây là một ứng dụng **Jira Clone** được xây dựng bằng **Angular 17+** với các công nghệ hiện đại nhất. Ứng dụng cho phép:

- ✅ Quản lý nhiều dự án (Multi-project support)
- ✅ Bảng Kanban với drag-and-drop
- ✅ Quản lý Issues/Tasks với đầy đủ thông tin
- ✅ Hệ thống phân quyền thành viên
- ✅ Bộ lọc đa điều kiện (Multi-filter)
- ✅ Real-time updates với Firebase
- ✅ Optimistic UI updates

### 1.2. Đặc Điểm Nổi Bật

**🚀 Modern Angular Architecture:**

- Sử dụng **Standalone Components** (không có NgModules)
- **Angular Signals** cho reactive state management
- **NgRx Signals Store** thay vì Redux pattern truyền thống
- Lazy loading cho tất cả các routes

**🎨 User Experience:**

- Drag & Drop mượt mà với CDK
- Optimistic UI updates (cập nhật UI ngay lập tức, sync backend sau)
- Material Design components
- Responsive design

**🔥 Firebase Integration:**

- Firestore cho database NoSQL
- Firebase Authentication (Google Sign-in + Email/Password)
- Real-time data synchronization
- Security rules để bảo vệ dữ liệu

---

## 2. Kiến Trúc Hệ Thống

### 2.1. Sơ Đồ Tổng Quan

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
│  (Angular Components - Standalone)                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT                          │
│  (NgRx Signals Store - AuthStore, ProjectsStore, BoardStore)│
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVICES LAYER                         │
│  (AuthService, ProjectsService, IssueService)               │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE BACKEND                          │
│  (Firestore Database + Authentication)                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2. Luồng Dữ Liệu (Data Flow)

```
User Action → Component → Store Method → Service → Firebase
                ↑                                      │
                └──────── Signal Update ◄──────────────┘
```

**Giải thích:**

1. User thực hiện action (click, drag, input)
2. Component gọi method trong Store
3. Store gọi Service để tương tác với Firebase
4. Firebase trả về dữ liệu
5. Store cập nhật Signal
6. Component tự động re-render (reactive)

---

## 3. Công Nghệ Sử Dụng

### 3.1. Core Technologies

| Công Nghệ            | Phiên Bản | Mục Đích                  |
| -------------------- | --------- | ------------------------- |
| **Angular**          | 17+       | Framework chính           |
| **TypeScript**       | 5.0+      | Ngôn ngữ lập trình        |
| **Angular Signals**  | Built-in  | Reactive state management |
| **NgRx Signals**     | Latest    | Global state store        |
| **Angular Material** | 17+       | UI Components             |
| **Angular CDK**      | 17+       | Drag & Drop               |
| **Firebase**         | 10+       | Backend as a Service      |
| **RxJS**             | 7+        | Reactive programming      |

### 3.2. Tại Sao Chọn Signals Thay Vì RxJS?

**Signals:**

- ✅ Đơn giản hơn, dễ học
- ✅ Performance tốt hơn (fine-grained reactivity)
- ✅ Ít boilerplate code
- ✅ Tích hợp sẵn trong Angular 17+

**RxJS:**

- ⚠️ Phức tạp với operators
- ⚠️ Memory leaks nếu không unsubscribe
- ⚠️ Khó debug

**Kết hợp cả hai:**

- Dùng **Signals** cho component state và computed values
- Dùng **RxJS** cho async operations (HTTP, Firebase streams)
- Dùng `rxMethod` để bridge giữa RxJS và Signals

---

## 4. Cấu Trúc Thư Mục

```
src/app/
├── core/                           # Các module cốt lõi
│   ├── auth/                       # Authentication logic
│   │   ├── auth.guard.ts          # Route guard
│   │   ├── auth.service.ts        # Firebase auth methods
│   │   └── auth.store.ts          # Auth state management
│   ├── models/                     # Shared models
│   │   └── app-user.model.ts      # User interface
│   ├── firestore.ts               # Firestore helper functions
│   └── issues.ts                  # Issue helper functions
│
├── features/                       # Các tính năng chính
│   ├── auth/                       # Authentication UI
│   │   └── login/
│   │       ├── login.ts           # Login component
│   │       ├── login.html         # Login template
│   │       └── login.scss         # Login styles
│   │
│   ├── projects/                   # Project management
│   │   ├── project-list/          # List all projects
│   │   │   ├── project-list.ts
│   │   │   ├── project-list.html
│   │   │   └── project-list.scss
│   │   ├── members-dialog/        # Add members dialog
│   │   │   ├── members-dialog.ts
│   │   │   └── members-dialog.html
│   │   ├── project.model.ts       # Project interface
│   │   ├── projects.service.ts    # Project CRUD operations
│   │   └── projects.store.ts      # Project state management
│   │
│   ├── board/                      # Kanban board
│   │   ├── board/                 # Main board component
│   │   │   ├── board.ts
│   │   │   ├── board.html
│   │   │   ├── board.scss
│   │   │   └── board-filter.ts    # Filter component
│   │   └── board.store.ts         # Board state management
│   │
│   └── issue/                      # Issue/Task management
│       ├── issue-dialog/          # Create/Edit issue dialog
│       │   ├── issue-dialog.ts
│       │   └── issue-dialog.html
│       ├── issue.model.ts         # Issue interface
│       └── issue.service.ts       # Issue CRUD operations
│
├── app.config.ts                   # App configuration
├── app.routes.ts                   # Route definitions
├── app.ts                          # Root component
└── app.html                        # Root template

firestore.rules                     # Firebase security rules
```

### 4.1. Giải Thích Cấu Trúc

**Core vs Features:**

- **core/**: Chứa logic dùng chung, không phụ thuộc vào business logic cụ thể
- **features/**: Chứa các tính năng nghiệp vụ, mỗi feature là một module độc lập

**Standalone Components:**

- Mỗi component tự import dependencies của nó
- Không cần NgModule
- Tree-shaking tốt hơn (bundle size nhỏ hơn)

---

## 5. Data Models (Mô Hình Dữ Liệu)

### 5.1. User Model

```typescript
// core/models/app-user.model.ts
export interface AppUser {
  uid: string; // Firebase User ID
  email: string; // Email address
  displayName: string; // Display name
  photoURL?: string; // Avatar URL (optional)
}
```

**Firestore Collection:** `users/{uid}`

**Ví dụ document:**

```json
{
  "uid": "abc123",
  "email": "user@example.com",
  "displayName": "John Doe",
  "photoURL": "https://..."
}
```

### 5.2. Project Model

```typescript
// features/projects/project.model.ts
export interface Project {
  id: string; // Document ID
  name: string; // Project name (e.g., "My App")
  key: string; // Project key (e.g., "MYAPP")
  ownerId: string; // User ID của người tạo
  memberIds: string[]; // Array of user IDs
}
```

**Firestore Collection:** `projects/{projectId}`

**Ví dụ document:**

```json
{
  "id": "proj123",
  "name": "E-commerce Platform",
  "key": "ECOM",
  "ownerId": "user123",
  "memberIds": ["user123", "user456", "user789"]
}
```

### 5.3. Issue Model

```typescript
// features/issue/issue.model.ts
export type IssueType = 'task' | 'bug' | 'story';
export type IssuePriority = 'high' | 'medium' | 'low';

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string; // ISO string
}

export interface Issue {
  id: string; // Document ID
  projectId: string; // Reference to project
  boardId: string; // Reference to board
  key: string; // Issue key (e.g., "ECOM-123")
  title: string; // Issue title
  description: string; // Issue description
  type: IssueType; // task, bug, or story
  statusColumnId: string; // 'todo', 'in-progress', 'done'
  priority: IssuePriority; // high, medium, low
  assigneeId?: string; // User ID (optional)
  order: number; // Order in column (for drag & drop)
  comments?: Comment[]; // Array of comments (optional)
}
```

**Firestore Collection:** `issues/{issueId}`

**Ví dụ document:**

```json
{
  "id": "issue123",
  "projectId": "proj123",
  "boardId": "board123",
  "key": "ECOM-1",
  "title": "Implement shopping cart",
  "description": "Add shopping cart functionality...",
  "type": "task",
  "statusColumnId": "in-progress",
  "priority": "high",
  "assigneeId": "user456",
  "order": 1000,
  "comments": []
}
```

### 5.4. Mối Quan Hệ Giữa Các Models

```
User (1) ──────┐
               │
               ├──> (N) Project (memberIds)
               │         │
               │         └──> (N) Issue (projectId)
               │
               └──> (N) Issue (assigneeId)
```

---

## 6. State Management (Quản Lý Trạng Thái)

### 6.1. AuthStore (core/auth/auth.store.ts)

**Mục đích:** Quản lý trạng thái đăng nhập của user

**State:**

```typescript
type AuthState = {
  user: User | null; // Firebase User object
  loading: boolean; // Đang xử lý auth?
  error: string | null; // Error message
};
```

**Methods:**

- `login()`: Đăng nhập bằng Google
- `loginEmail(email, password)`: Đăng nhập bằng email
- `register(email, password, name)`: Đăng ký tài khoản mới
- `logout()`: Đăng xuất
- `_setUser(user)`: Internal method để set user

**Hooks:**

- `onInit()`: Subscribe to Firebase `onAuthStateChanged`

**Cách sử dụng trong component:**

```typescript
export class MyComponent {
  authStore = inject(AuthStore);

  // Đọc state
  user = this.authStore.user; // Signal<User | null>
  isLoading = this.authStore.loading; // Signal<boolean>

  // Gọi methods
  login() {
    this.authStore.login();
  }
}
```

### 6.2. ProjectsStore (features/projects/projects.store.ts)

**Mục đích:** Quản lý danh sách projects và members

**State:**

```typescript
type ProjectsState = {
  projects: Project[]; // Danh sách projects
  members: AppUser[]; // Members của project đang chọn
  selectedProjectId: string | null; // ID của project đang chọn
  loading: boolean; // Đang load data?
  filter: string; // Filter text (chưa dùng)
};
```

**Computed Signals:**

- `selectedProject()`: Trả về project đang được chọn

**Methods:**

- `loadProjects(userId)`: Load tất cả projects mà user là member
- `selectProject(projectId)`: Chọn một project
- `loadMembers(userIds)`: Load thông tin members
- `deleteProject(projectId)`: Xóa project
- `addMember(email)`: Thêm member vào project

**Hooks:**

- `onInit()`: Effect để tự động load members khi selectedProject thay đổi

**Luồng hoạt động:**

```
1. User vào trang /projects
2. Component gọi: projectsStore.loadProjects(userId)
3. Store gọi: projectsService.getProjects(userId)
4. Service query Firestore: where('memberIds', 'array-contains', userId)
5. Firestore trả về array of projects
6. Store update signal: patchState({ projects: [...] })
7. Component tự động re-render vì signal thay đổi
```

### 6.3. BoardStore (features/board/board.store.ts)

**Mục đích:** Quản lý issues và filters trên Kanban board

**State:**

```typescript
type BoardFilter = {
  searchQuery: string; // Text search
  onlyMyIssues: boolean; // Chỉ hiện issues của tôi
  ignoreResolved: boolean; // Ẩn issues đã done
  userId: string | null; // Current user ID
  assignee: string[]; // Filter by assignees
  status: string[]; // Filter by status
  priority: string[]; // Filter by priority
};

type BoardState = {
  issues: Issue[]; // Tất cả issues
  loading: boolean; // Đang load?
  filter: BoardFilter; // Bộ lọc hiện tại
};
```

**Computed Signals (Quan Trọng!):**

```typescript
// 1. Lọc issues theo filter
filteredIssues = computed(() => {
  const allIssues = issues();
  const currentFilter = filter();

  return allIssues.filter(issue => {
    // Apply all filters
    const matchesSearch = issue.title.includes(currentFilter.searchQuery);
    const matchesAssignee = currentFilter.assignee.length === 0
      || currentFilter.assignee.includes(issue.assigneeId);
    // ... more filters

    return matchesSearch && matchesAssignee && ...;
  });
});

// 2. Chia issues thành 3 cột
todoIssues = computed(() =>
  filteredIssues()
    .filter(i => i.statusColumnId === 'todo')
    .sort((a, b) => a.order - b.order)
);

inProgressIssues = computed(() =>
  filteredIssues()
    .filter(i => i.statusColumnId === 'in-progress')
    .sort((a, b) => a.order - b.order)
);

doneIssues = computed(() =>
  filteredIssues()
    .filter(i => i.statusColumnId === 'done')
    .sort((a, b) => a.order - b.order)
);
```

**Methods:**

- `loadIssues(projectId)`: Load tất cả issues của project
- `updateFilter(newFilter)`: Cập nhật bộ lọc
- `moveIssue(event, newStatus)`: Xử lý drag & drop
- `addIssue(issue)`: Thêm issue mới
- `updateIssue(issueId, updates)`: Cập nhật issue
- `deleteIssue(issueId)`: Xóa issue

**Cơ Chế Reactive (Signals Chain):**

```
issues (Source Signal)
  │
  ├──> filteredIssues (Computed)
  │      │
  │      ├──> todoIssues (Computed)
  │      ├──> inProgressIssues (Computed)
  │      └──> doneIssues (Computed)
  │
filter (Source Signal)
  │
  └──> filteredIssues (Computed)
```

Khi `issues` hoặc `filter` thay đổi → `filteredIssues` tự động tính lại → 3 cột tự động update → UI tự động re-render!

---

## 7. Luồng Hoạt Động Chi Tiết

### 7.1. Luồng Khởi Động Ứng Dụng (Bootstrap)

**Bước 1: main.ts**

```typescript
bootstrapApplication(AppComponent, appConfig);
```

**Bước 2: app.config.ts**

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),              // Kích hoạt routing
    provideFirebaseApp(...),            // Kết nối Firebase
    provideFirestore(...),              // Kích hoạt Firestore
    provideAuth(...),                   // Kích hoạt Auth
    // ... other providers
  ]
};
```

**Bước 3: AuthStore.onInit()**

```typescript
withHooks({
  onInit(store, authService = inject(AuthService)) {
    // Lắng nghe thay đổi auth state
    authService.user$.subscribe((user) => {
      store._setUser(user);
    });
  },
});
```

**Bước 4: Router**

```typescript
// app.routes.ts
{
  path: 'projects',
  canActivate: [authGuard],  // Kiểm tra đăng nhập
  loadComponent: () => import('./features/projects/...')
}
```

**Bước 5: authGuard**

```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.user()) {
    return true; // Cho phép truy cập
  } else {
    return router.createUrlTree(['/login']); // Redirect
  }
};
```

### 7.2. Luồng Đăng Nhập (Authentication Flow)

```
┌──────────┐
│  User    │ Click "Sign in with Google"
└────┬─────┘
     │
     ▼
┌─────────────────┐
│ Login Component │ authStore.login()
└────┬────────────┘
     │
     ▼
┌─────────────┐
│  AuthStore  │ patchState({ loading: true })
└────┬────────┘
     │
     ▼
┌──────────────┐
│ AuthService  │ signInWithPopup(GoogleAuthProvider)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│   Firebase   │ Authenticate user
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ AuthService  │ onAuthStateChanged() triggered
└────┬─────────┘
     │
     ▼
┌─────────────┐
│  AuthStore  │ _setUser(user), patchState({ user, loading: false })
└────┬────────┘
     │
     ▼
┌──────────────┐
│  authGuard   │ Detect user signal changed → allow navigation
└────┬─────────┘
     │
     ▼
┌──────────────┐
│   Router     │ Navigate to /projects
└──────────────┘
```

### 7.3. Luồng Load Projects

```
┌────────────────┐
│ ProjectList    │ ngOnInit()
│ Component      │
└────┬───────────┘
     │
     ▼
┌────────────────┐
│ ProjectsStore  │ loadProjects(userId)
└────┬───────────┘
     │
     ▼
┌─────────────────┐
│ ProjectsService │ getProjects(userId)
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│   Firestore     │ collection('projects')
│                 │ .where('memberIds', 'array-contains', userId)
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ ProjectsService │ return Observable<Project[]>
└────┬────────────┘
     │
     ▼
┌────────────────┐
│ ProjectsStore  │ patchState({ projects: [...], loading: false })
└────┬───────────┘
     │
     ▼
┌────────────────┐
│ ProjectList    │ Template: @for (project of store.projects())
│ Component      │ → Auto re-render
└────────────────┘
```

### 7.4. Luồng Load Kanban Board

**Bước 1: Navigation**

```
User clicks project → Router navigates to /project/:projectId/board
```

**Bước 2: Board Component Init**

```typescript
ngOnInit() {
  const projectId = this.route.snapshot.paramMap.get('projectId');

  // Load issues
  this.store.loadIssues(projectId);

  // Select project (để lấy members cho avatar)
  this.projectsStore.selectProject(projectId);
}
```

**Bước 3: Effect để fix "Mất Avatar khi F5"**

```typescript
constructor() {
  effect(() => {
    const user = this.authStore.user();

    // Nếu đã login nhưng chưa có projects
    if (user && this.projectsStore.projects().length === 0) {
      // Load lại projects
      this.projectsStore.loadProjects(user.uid);
    }
  });
}
```

**Giải thích vấn đề:**

- Khi F5, tất cả state bị reset
- `issues` load nhanh hơn `projects`
- Khi render issue card, không tìm thấy member info → không hiển thị avatar
- Effect phát hiện: "Có user mà projects rỗng" → Tự động load projects
- Khi projects load xong → Effect trong ProjectsStore tự động load members
- Members có data → Avatar hiển thị

### 7.5. Luồng Filter Issues

```
┌──────────────┐
│ User         │ Ticks "High Priority" checkbox
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ BoardFilter  │ onPriorityChange(['high'])
│ Component    │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ BoardStore   │ updateFilter({ priority: ['high'] })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ BoardStore   │ patchState({ filter: { ...old, priority: ['high'] } })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Signals      │ filter() changed → filteredIssues() re-compute
│ Chain        │ → todoIssues(), inProgressIssues(), doneIssues() re-compute
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Template     │ @for (issue of store.todoIssues())
│              │ → Auto re-render with filtered data
└──────────────┘
```

**Không cần:**

- ❌ Manually call filter function
- ❌ Subscribe/unsubscribe
- ❌ ChangeDetectorRef.detectChanges()

**Tất cả tự động!** 🎉

### 7.6. Luồng Drag & Drop (Chi Tiết Nhất)

**Scenario 1: Kéo trong cùng cột (Reorder)**

```
┌──────────────┐
│ User         │ Drags issue from index 2 to index 0
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Board        │ drop(event, 'todo')
│ Component    │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ BoardStore   │ moveIssue(event, 'todo')
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Logic        │ event.previousContainer === event.container?
│              │ → YES (same column)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 1       │ Copy column issues: [...event.container.data]
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 2       │ moveItemInArray(columnIssues, oldIndex, newIndex)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 3       │ Recalculate order for ALL items in column
│              │ item[0].order = 0
│              │ item[1].order = 1000
│              │ item[2].order = 2000
│              │ ...
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 4       │ Optimistic Update:
│              │ patchState({ issues: updatedIssues })
│              │ → UI updates IMMEDIATELY
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 5       │ Batch update Firestore:
│              │ batchUpdateIssues([
│              │   { id: 'issue1', data: { order: 0 } },
│              │   { id: 'issue2', data: { order: 1000 } },
│              │   ...
│              │ ])
└──────────────┘
```

**Scenario 2: Kéo sang cột khác (Move)**

```
┌──────────────┐
│ User         │ Drags issue from "TODO" to "IN PROGRESS"
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Board        │ drop(event, 'in-progress')
│ Component    │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ BoardStore   │ moveIssue(event, 'in-progress')
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Logic        │ event.previousContainer !== event.container?
│              │ → YES (different column)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 1       │ Get target column issues
│              │ targetColumnIssues = [...event.container.data]
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 2       │ Insert moved issue at new index
│              │ targetColumnIssues.splice(newIndex, 0, movedIssue)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 3       │ Calculate new order based on neighbors:
│              │
│              │ prevItem = targetColumnIssues[newIndex - 1]
│              │ nextItem = targetColumnIssues[newIndex + 1]
│              │
│              │ if (!prevItem && !nextItem):
│              │   newOrder = 0
│              │ else if (!prevItem):
│              │   newOrder = nextItem.order - 1000
│              │ else if (!nextItem):
│              │   newOrder = prevItem.order + 1000
│              │ else:
│              │   newOrder = (prevItem.order + nextItem.order) / 2
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 4       │ Update moved issue:
│              │ movedIssue.statusColumnId = 'in-progress'
│              │ movedIssue.order = newOrder
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 5       │ Optimistic Update:
│              │ patchState({ issues: updatedIssues })
│              │ → UI updates IMMEDIATELY
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Step 6       │ Update Firestore:
│              │ updateIssue(movedIssue.id, {
│              │   statusColumnId: 'in-progress',
│              │   order: newOrder
│              │ })
└──────────────┘
```

**Tại sao dùng order thay vì index?**

- ✅ Dễ dàng insert giữa 2 items (dùng average)
- ✅ Không cần update tất cả items khi move
- ✅ Hỗ trợ concurrent updates tốt hơn

**Tại sao dùng Optimistic Update?**

- ✅ UI mượt mà, không bị lag
- ✅ User experience tốt hơn
- ⚠️ Cần handle error để revert nếu backend fail

### 7.7. Luồng Tạo/Sửa Issue

**Tạo Issue Mới:**

```
┌──────────────┐
│ User         │ Clicks "+ Create Issue" button
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Board        │ openIssueDialog('todo')
│ Component    │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ MatDialog    │ Opens IssueDialog component
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ IssueDialog  │ User fills form:
│              │ - Title
│              │ - Description
│              │ - Type (task/bug/story)
│              │ - Priority (high/medium/low)
│              │ - Assignee
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ IssueDialog  │ User clicks "Save"
│              │ onSubmit()
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ IssueDialog  │ dialogRef.close(formData)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Board        │ dialog.afterClosed().subscribe(result => {
│ Component    │   if (result) {
│              │     const newIssue = {
│              │       ...result,
│              │       projectId: this.projectId,
│              │       statusColumnId: 'todo',
│              │       order: this.getNextOrder('todo')
│              │     };
│              │     this.store.addIssue(newIssue);
│              │   }
│              │ })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ BoardStore   │ addIssue(issue)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ IssueService │ addIssue(issue)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Firestore    │ addDoc(collection('issues'), {
│              │   ...issue,
│              │   key: generateKey(projectKey, issueNumber)
│              │ })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Firestore    │ Real-time listener detects new document
│              │ → Triggers snapshot update
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ IssueService │ Observable emits new issue list
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ BoardStore   │ patchState({ issues: [...newIssues] })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ Template     │ Auto re-render with new issue
└──────────────┘
```

**Sửa Issue:**

Tương tự như tạo mới, nhưng:

1. Dialog nhận `issue` object làm input
2. Form được pre-fill với data hiện tại
3. Gọi `store.updateIssue(issueId, updates)` thay vì `addIssue`

---

## 8. Các Tính Năng Chính

### 8.1. Authentication (Xác Thực)

**Các phương thức hỗ trợ:**

- ✅ Google Sign-in (OAuth)
- ✅ Email/Password
- ✅ Auto-login (remember session)

**Security:**

- Firebase handles all authentication
- JWT tokens stored in browser
- Automatic token refresh

**Code Example:**

```typescript
// Login with Google
async loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(this.auth, provider);
}

// Login with Email
async loginWithEmail(email: string, password: string) {
  await signInWithEmailAndPassword(this.auth, email, password);
}

// Register
async registerWithEmail(email: string, password: string, name: string) {
  const userCredential = await createUserWithEmailAndPassword(
    this.auth,
    email,
    password
  );

  // Update profile
  await updateProfile(userCredential.user, { displayName: name });

  // Create user document in Firestore
  await setDoc(doc(this.firestore, 'users', userCredential.user.uid), {
    uid: userCredential.user.uid,
    email: email,
    displayName: name
  });
}
```

### 8.2. Multi-Project Management

**Tính năng:**

- ✅ Tạo project mới
- ✅ Xem danh sách projects
- ✅ Thêm/xóa members
- ✅ Xóa project (chỉ owner)
- ✅ Filter projects (search)

**Permissions:**

- **Owner**: Full control (update, delete, add members)
- **Member**: View and create issues

**Code Example - Add Member:**

```typescript
async addMember(email: string) {
  // 1. Find user by email
  const users = await firstValueFrom(
    this.projectsService.findUserByEmail(email)
  );

  if (users.length === 0) {
    throw new Error('User not found');
  }

  const newUser = users[0];
  const project = this.selectedProject();

  if (project) {
    // 2. Update project document
    await this.projectsService.addMemberToProject(
      project.id,
      newUser.uid,
      project.memberIds
    );

    // 3. Update local state
    patchState(this, {
      projects: this.projects().map(p =>
        p.id === project.id
          ? { ...p, memberIds: [...p.memberIds, newUser.uid] }
          : p
      )
    });

    // 4. Reload members
    this.loadMembers([...project.memberIds, newUser.uid]);
  }
}
```

### 8.3. Kanban Board

**Columns:**

- 📋 **TO DO**: Issues chưa bắt đầu
- 🔄 **IN PROGRESS**: Issues đang làm
- ✅ **DONE**: Issues đã hoàn thành

**Features:**

- ✅ Drag & Drop giữa các cột
- ✅ Reorder trong cùng cột
- ✅ Hiển thị avatar assignee
- ✅ Hiển thị priority icon
- ✅ Click vào issue để xem/sửa chi tiết
- ✅ Delete issue
- ✅ Real-time updates

**Template Structure:**

```html
<div class="board">
  <!-- TO DO Column -->
  <div
    class="column"
    cdkDropList
    [cdkDropListData]="store.todoIssues()"
    (cdkDropListDropped)="drop($event, 'todo')"
  >
    <h2>TO DO ({{ store.todoIssues().length }})</h2>

    @for (issue of store.todoIssues(); track issue.id) {
    <div class="issue-card" cdkDrag [cdkDragData]="issue">
      <!-- Issue content -->
    </div>
    }
  </div>

  <!-- IN PROGRESS Column -->
  <!-- ... similar structure ... -->

  <!-- DONE Column -->
  <!-- ... similar structure ... -->
</div>
```

### 8.4. Advanced Filtering

**Filter Options:**

- 🔍 **Search**: Tìm theo title hoặc key
- 👤 **Only My Issues**: Chỉ hiện issues được assign cho mình
- 👥 **Assignee**: Filter theo người được assign (multi-select)
- 📊 **Status**: Filter theo trạng thái (multi-select)
- ⚡ **Priority**: Filter theo độ ưu tiên (multi-select)

**UI Component:**

```typescript
@Component({
  selector: 'app-board-filter',
  template: `
    <div class="filters">
      <!-- Search -->
      <input type="text" placeholder="Search issues..." (input)="onSearchChange($event)" />

      <!-- Only My Issues -->
      <mat-slide-toggle [checked]="store.filter().onlyMyIssues" (change)="onMyIssuesToggle()">
        Only My Issues
      </mat-slide-toggle>

      <!-- Assignee Filter -->
      <mat-select
        multiple
        placeholder="Assignee"
        [value]="store.filter().assignee"
        (selectionChange)="onAssigneeChange($event)"
      >
        @for (member of members(); track member.uid) {
        <mat-option [value]="member.uid">
          {{ member.displayName }}
        </mat-option>
        }
      </mat-select>

      <!-- Priority Filter -->
      <mat-select
        multiple
        placeholder="Priority"
        [value]="store.filter().priority"
        (selectionChange)="onPriorityChange($event)"
      >
        <mat-option value="high">High</mat-option>
        <mat-option value="medium">Medium</mat-option>
        <mat-option value="low">Low</mat-option>
      </mat-select>
    </div>
  `,
})
export class BoardFilter {
  store = inject(BoardStore);

  onSearchChange(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.store.updateFilter({ searchQuery: query });
  }

  onMyIssuesToggle() {
    const current = this.store.filter().onlyMyIssues;
    this.store.updateFilter({ onlyMyIssues: !current });
  }

  onAssigneeChange(event: any) {
    this.store.updateFilter({ assignee: event.value });
  }

  onPriorityChange(event: any) {
    this.store.updateFilter({ priority: event.value });
  }
}
```

### 8.5. Issue Management

**Issue Types:**

- 📝 **Task**: Công việc thông thường
- 🐛 **Bug**: Lỗi cần fix
- 📖 **Story**: User story

**Priority Levels:**

- 🔴 **High**: Ưu tiên cao (icon: arrow_upward, color: red)
- 🟡 **Medium**: Ưu tiên trung bình (icon: drag_handle, color: orange)
- 🟢 **Low**: Ưu tiên thấp (icon: arrow_downward, color: green)

**Fields:**

- Title (required)
- Description (optional)
- Type (required)
- Priority (required)
- Assignee (optional)
- Comments (future feature)

**Helper Methods:**

```typescript
getPriorityIcon(priority: IssuePriority): string {
  switch (priority) {
    case 'high': return 'arrow_upward';
    case 'medium': return 'drag_handle';
    case 'low': return 'arrow_downward';
    default: return 'drag_handle';
  }
}

getPriorityColor(priority: IssuePriority): string {
  switch (priority) {
    case 'high': return '#f44336';   // Red
    case 'medium': return '#ff9800'; // Orange
    case 'low': return '#4caf50';    // Green
    default: return '#9e9e9e';       // Grey
  }
}
```

---

## 9. Firebase Security Rules

### 9.1. Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function
    function signedIn() {
      return request.auth != null;
    }

    // Projects Collection
    match /projects/{projectId} {
      // Read: Chỉ members mới đọc được
      allow read: if signedIn()
        && resource.data.memberIds.hasAny([request.auth.uid]);

      // Create: Bất kỳ user nào cũng tạo được project
      allow create: if signedIn();

      // Update: Chỉ members mới update được
      allow update: if signedIn()
        && resource.data.memberIds.hasAny([request.auth.uid]);

      // Delete: Chỉ owner mới xóa được
      allow delete: if signedIn()
        && resource.data.ownerId == request.auth.uid;
    }

    // Issues Collection
    match /issues/{issueId} {
      // MVP: Cho phép tất cả authenticated users
      // TODO: Refine để chỉ members của project mới access được
      allow read, write: if signedIn();
    }

    // Users Collection
    match /users/{uid} {
      // Read: Tất cả authenticated users (để hiển thị avatar)
      allow read: if signedIn();

      // Create/Update: Chỉ chính user đó
      allow create, update: if signedIn() && request.auth.uid == uid;
    }
  }
}
```

### 9.2. Giải Thích Rules

**Projects:**

- `hasAny([request.auth.uid])`: Kiểm tra xem user ID có trong array `memberIds` không
- `resource.data`: Dữ liệu hiện tại trong database
- `request.auth.uid`: ID của user đang request

**Issues:**

- Hiện tại đơn giản: Chỉ cần đăng nhập
- Nên cải thiện: Kiểm tra user có phải member của project không

**Users:**

- Cho phép đọc để hiển thị avatar/tên
- Chỉ cho phép user tự update profile của mình

### 9.3. Testing Rules

**Test Case 1: User không phải member cố đọc project**

```
Result: DENIED ❌
Reason: memberIds không chứa user ID
```

**Test Case 2: Member cố xóa project**

```
Result: DENIED ❌
Reason: Chỉ owner mới có quyền delete
```

**Test Case 3: Owner xóa project**

```
Result: ALLOWED ✅
Reason: ownerId === request.auth.uid
```

---

## 10. Best Practices & Tips

### 10.1. Signals Best Practices

**✅ DO:**

```typescript
// Use computed for derived state
const filteredItems = computed(() => {
  return items().filter(i => i.active);
});

// Use effect for side effects
effect(() => {
  console.log('Items changed:', items());
});

// Read signals in template
@for (item of items(); track item.id) { ... }
```

**❌ DON'T:**

```typescript
// Don't mutate signal values directly
items().push(newItem); // ❌ WRONG

// Don't use signals in constructor (not ready yet)
constructor() {
  console.log(this.store.items()); // ❌ Might be undefined
}

// Don't create infinite loops
effect(() => {
  this.store.updateFilter({ ... }); // ❌ Might trigger itself
});
```

### 10.2. Performance Tips

**1. Use trackBy in @for loops:**

```typescript
@for (issue of issues(); track issue.id) {
  // Angular won't re-create DOM if ID hasn't changed
}
```

**2. Avoid expensive computations in templates:**

```typescript
// ❌ BAD
@for (issue of getFilteredIssues(); track issue.id) { }

// ✅ GOOD
filteredIssues = computed(() => this.getFilteredIssues());
@for (issue of filteredIssues(); track issue.id) { }
```

**3. Use OnPush change detection (automatic with signals):**

```typescript
// Signals automatically optimize change detection
// No need to manually set ChangeDetectionStrategy.OnPush
```

### 10.3. Debugging Tips

**1. Log signal values:**

```typescript
effect(() => {
  console.log('Current filter:', this.store.filter());
  console.log('Filtered issues:', this.store.filteredIssues());
});
```

**2. Use Angular DevTools:**

- Install Angular DevTools extension
- Inspect component tree
- View signal values in real-time

**3. Firestore debugging:**

```typescript
// Enable Firestore logging
enableIndexedDbPersistence(firestore).catch((err) => {
  console.error('Persistence error:', err);
});
```

### 10.4. Common Pitfalls

**1. Forgetting to call signal as function:**

```typescript
// ❌ WRONG
if (store.user) { ... }

// ✅ CORRECT
if (store.user()) { ... }
```

**2. Not handling loading states:**

```typescript
// ✅ GOOD
@if (store.loading()) {
  <mat-spinner></mat-spinner>
} @else {
  @for (item of store.items(); track item.id) { ... }
}
```

**3. Not handling errors:**

```typescript
// ✅ GOOD
try {
  await this.store.addIssue(issue);
} catch (error) {
  console.error('Failed to add issue:', error);
  // Show error message to user
}
```

### 10.5. Code Organization

**1. Keep components small:**

- Component: UI logic only
- Store: State management
- Service: API calls

**2. Use feature modules:**

```
features/
  ├── auth/
  ├── projects/
  └── board/
```

**3. Shared utilities:**

```typescript
// core/utils/date.utils.ts
export function formatDate(date: Date): string { ... }

// core/utils/string.utils.ts
export function generateKey(prefix: string, num: number): string { ... }
```

### 10.6. Testing Strategies

**Unit Tests:**

```typescript
describe('BoardStore', () => {
  it('should filter issues by priority', () => {
    const store = new BoardStore();
    store.patchState({
      issues: [
        { id: '1', priority: 'high', ... },
        { id: '2', priority: 'low', ... }
      ],
      filter: { priority: ['high'] }
    });

    expect(store.filteredIssues().length).toBe(1);
    expect(store.filteredIssues()[0].id).toBe('1');
  });
});
```

**Integration Tests:**

```typescript
describe('Board Component', () => {
  it('should load issues on init', async () => {
    const fixture = TestBed.createComponent(Board);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.store.issues().length).toBeGreaterThan(0);
  });
});
```

### 10.7. Future Improvements

**Short-term:**

- [ ] Add comments to issues
- [ ] Add issue attachments
- [ ] Add activity log
- [ ] Add notifications
- [ ] Add sprint planning

**Long-term:**

- [ ] Add reporting/analytics
- [ ] Add time tracking
- [ ] Add custom workflows
- [ ] Add integrations (Slack, GitHub)
- [ ] Add mobile app

---

## 📚 Tài Liệu Tham Khảo

### Official Documentation

- [Angular Signals](https://angular.io/guide/signals)
- [NgRx Signals](https://ngrx.io/guide/signals)
- [Angular Material](https://material.angular.io/)
- [Firebase Documentation](https://firebase.google.com/docs)

### Tutorials

- [Angular Signals Deep Dive](https://www.youtube.com/watch?v=...)
- [NgRx Signals Tutorial](https://www.youtube.com/watch?v=...)
- [Firebase + Angular](https://www.youtube.com/watch?v=...)

---

## 🎯 Kết Luận

Dự án này minh họa cách xây dựng một ứng dụng **production-ready** với:

✅ **Modern Architecture**: Signals, Standalone Components
✅ **Clean Code**: Feature-first structure, separation of concerns
✅ **Great UX**: Optimistic updates, smooth animations
✅ **Scalable**: Easy to add new features
✅ **Secure**: Firebase security rules

**Điểm mạnh:**

- Code dễ đọc, dễ maintain
- Performance tốt nhờ Signals
- Real-time updates tự động
- Type-safe với TypeScript

**Điểm cần cải thiện:**

- Thêm unit tests
- Thêm error handling
- Refine Firebase security rules
- Add more features (comments, attachments, etc.)

---

**Tác giả:** [Your Name]
**Ngày tạo:** 2026-01-07
**Phiên bản:** 1.0.0

---

_Tài liệu này được tạo để giúp developers hiểu rõ về kiến trúc và luồng hoạt động của ứng dụng Jira Clone. Nếu có thắc mắc, vui lòng tạo issue trên GitHub._
