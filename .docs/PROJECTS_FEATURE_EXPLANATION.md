# 📚 Giải Thích Chi Tiết: Projects Feature

> **Mục đích**: Tài liệu này giải thích chi tiết về folder `src/app/features/projects`, cấu trúc, vai trò từng file và luồng hoạt động hoàn chỉnh của hệ thống quản lý dự án.

---

## 📂 Cấu Trúc Thư Mục

```
features/projects/
├── members-dialog/
│   └── members-dialog.ts          # Dialog quản lý thành viên
├── project-layout/
│   └── project-layout.ts          # Layout chính cho chi tiết dự án
├── project-list/
│   └── project-list.ts            # Trang danh sách & tạo dự án
├── project.model.ts               # Interface định nghĩa cấu trúc Project
├── projects.service.ts            # Service giao tiếp với Firebase
└── projects.store.ts              # Store quản lý state (NgRx Signals)
```

---

## 🎯 Vai Trò Từng File

### 1. `project.model.ts` - "Bản Thiết Kế"

**Vai trò**: Định nghĩa cấu trúc dữ liệu của một Project.

```typescript
export interface Project {
  id: string; // ID tự động từ Firestore
  name: string; // Tên dự án (VD: "Website Bán Hàng")
  key: string; // Mã ngắn gọn (VD: "WEB", "SHOP")
  ownerId: string; // UID của người tạo dự án
  memberIds: string[]; // Danh sách UID thành viên
  invitedMemberIds?: string[]; // Danh sách UID người được mời (chưa chấp nhận)
}
```

**Ý nghĩa các trường**:

- `id`: Khóa chính, dùng để phân biệt các dự án
- `key`: Dùng để tạo mã task (VD: WEB-123, SHOP-45)
- `ownerId`: Chỉ owner mới có quyền xóa dự án, mời thành viên
- `memberIds`: Danh sách người có quyền truy cập dự án
- `invitedMemberIds`: Hệ thống lời mời 2 bước (mời → chấp nhận)

---

### 2. `projects.service.ts` - "Người Vận Chuyển"

**Vai trò**: Tầng giao tiếp với Firebase Firestore. Đây là nơi DUY NHẤT được phép chạm vào database.

#### 🔑 Các Phương Thức Chính

##### A. Quản Lý Dự Án

```typescript
getProjects(userId: string): Observable<Project[]>
```

- **Mục đích**: Lấy tất cả dự án mà user là thành viên
- **Query Firestore**: `where('memberIds', 'array-contains', userId)`
- **Đặc biệt**: Trả về `Observable` → Real-time updates tự động
- **Khi nào chạy**: Khi user đăng nhập, hoặc khi có thay đổi trên Firestore

```typescript
addProject(project: Partial<Project>)
```

- **Mục đích**: Tạo dự án mới
- **Dữ liệu gửi lên**: `{ name, key, ownerId, memberIds: [ownerId] }`
- **Lưu ý**: Người tạo tự động trở thành thành viên đầu tiên

```typescript
deleteProject(projectId: string)
```

- **Mục đích**: Xóa dự án (chỉ owner mới được gọi)
- **Tác động**: Xóa vĩnh viễn khỏi Firestore

##### B. Quản Lý Thành Viên

```typescript
getUsers(userIds: string[]): Observable<any[]>
```

- **Mục đích**: Lấy thông tin chi tiết của nhiều user (displayName, email, avatar...)
- **Kỹ thuật đặc biệt**:
  - Firestore giới hạn query `in` tối đa 10 giá trị
  - Service tự động chia mảng thành các chunk 10 phần tử
  - Dùng `combineLatest` để gộp kết quả từ nhiều query

```typescript
findUserByEmail(email: string): Observable<any[]>
```

- **Mục đích**: Tìm user theo email để mời vào dự án
- **Query**: `where('email', '==', email)`

##### C. Hệ Thống Lời Mời (Invitation System)

```typescript
inviteUserToProject(projectId, userId, currentInvitedIds);
```

- **Mục đích**: Thêm userId vào danh sách `invitedMemberIds`
- **Kiểm tra**: Không mời trùng lặp

```typescript
getPendingInvites(userId: string): Observable<Project[]>
```

- **Mục đích**: Lấy danh sách dự án mà user được mời
- **Query**: `where('invitedMemberIds', 'array-contains', userId)`
- **Real-time**: Tự động cập nhật khi có lời mời mới

```typescript
acceptInvite(project: Project, userId: string)
```

- **Mục đích**: Chấp nhận lời mời
- **Hành động**:
  1. Xóa userId khỏi `invitedMemberIds`
  2. Thêm userId vào `memberIds`
- **Kết quả**: User chính thức trở thành thành viên

```typescript
rejectInvite(project: Project, userId: string)
```

- **Mục đích**: Từ chối lời mời
- **Hành động**: Chỉ xóa khỏi `invitedMemberIds`

```typescript
removeMemberFromProject(projectId, memberIdToRemove, currentMemberIds);
```

- **Mục đích**: Kick thành viên hoặc tự rời khỏi dự án
- **Lưu ý**: Phải unassign tất cả task của member đó trước (xử lý ở Store)

---

### 3. `projects.store.ts` - "Bộ Não Trung Tâm"

**Vai trò**: Quản lý state toàn cục của Projects, điều phối giữa UI và Service.

#### 📊 State Structure

```typescript
type ProjectsState = {
  projects: Project[]; // Danh sách dự án user tham gia
  projectOwners: AppUser[]; // Cache thông tin owner (tránh query lặp)
  members: AppUser[]; // Thành viên của dự án đang chọn
  pendingInvites: Project[]; // Dự án user được mời
  selectedProjectId: string | null; // ID dự án đang xem
  filter: string; // (Dự phòng cho tính năng tìm kiếm)
};
```

#### 🔄 Computed Signals

```typescript
selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId()));
```

- **Mục đích**: Tự động tính toán dự án đang được chọn
- **Cập nhật**: Mỗi khi `projects` hoặc `selectedProjectId` thay đổi

#### 🎬 Methods (Các Hành Động)

##### A. Load Data (Real-time)

```typescript
loadProjects: rxMethod<string | null>;
```

**Luồng hoạt động**:

1. Nhận `userId` từ AuthStore
2. Gọi `projectsService.getProjects(userId)`
3. Nhận Observable → tự động lắng nghe Firestore
4. Khi có dữ liệu:
   - Cập nhật `projects`
   - Lấy danh sách `ownerIds` duy nhất
   - Gọi `getUsers(ownerIds)` để lấy thông tin owner
   - Cache vào `projectOwners`

**Tại sao Real-time?**

- `collectionData()` trong Service tạo kết nối WebSocket với Firestore
- Mỗi khi có project mới/sửa/xóa → Firestore push update → Store tự động nhận

```typescript
loadInvites: rxMethod<string | null>;
```

**Tương tự `loadProjects`**, nhưng load danh sách lời mời chờ xử lý.

```typescript
loadMembers: rxMethod<string[]>;
```

- **Khi nào chạy**: Khi `selectedProject` thay đổi (xem Effect bên dưới)
- **Mục đích**: Load thông tin chi tiết các thành viên để hiển thị trong Dialog

##### B. CRUD Operations

```typescript
deleteProject(projectId: string)
```

**Luồng**:

1. Gọi `projectsService.deleteProject(projectId)`
2. **Optimistic Update**: Xóa ngay khỏi state (không chờ Firestore)
3. Hiển thị thông báo thành công
4. Nếu lỗi → Hiển thị lỗi (nhưng state đã bị xóa → cần reload)

```typescript
inviteUser(email: string)
```

**Luồng**:

1. Tìm user bằng email
2. Kiểm tra:
   - User có tồn tại?
   - Đã là thành viên chưa?
   - Đã được mời chưa?
3. Gọi `inviteUserToProject`
4. Hiển thị thông báo

```typescript
acceptInvite(project: Project, userId: string)
```

**Optimistic Update**:

1. Gọi Service cập nhật Firestore
2. Đồng thời cập nhật local state:
   - Xóa khỏi `pendingInvites`
   - Thêm vào `projects` với `memberIds` đã update

```typescript
removeMember(memberId: string)
```

**Đặc biệt**:

1. Gọi `issueService.unassignUserFromProjectIssues()` trước
   - Tránh task bị "mồ côi" (assignee không còn trong dự án)
2. Sau đó mới xóa khỏi `memberIds`
3. Cập nhật local state

#### 🪝 Hooks (Lifecycle)

```typescript
onInit(store) {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Effect 1: Auto-load khi user đăng nhập
  effect(() => {
    const user = authStore.user();
    store.loadProjects(user ? user.uid : null);
    store.loadInvites(user ? user.uid : null);
  });

  // Effect 2: Auto-load members khi chọn project
  effect(() => {
    const project = store.selectedProject();
    if (project && project.memberIds.length > 0) {
      store.loadMembers(project.memberIds);
    } else {
      patchState(store, { members: [] });
    }
  });

  // Effect 3: Security Check - Phát hiện mất quyền truy cập
  effect(() => {
    const projects = store.projects();
    const selectedId = store.selectedProjectId();
    const isLoading = store.loading();

    if (!isLoading && selectedId) {
      const stillHasAccess = projects.some(p => p.id === selectedId);

      if (!stillHasAccess) {
        // User bị kick hoặc project bị xóa
        setTimeout(() => {
          alert('Project does not exist anymore');
          patchState(store, { selectedProjectId: null });
          router.navigate(['/projects']);
        }, 200);
      }
    }
  });
}
```

**Giải thích Effect 3** (Bảo mật Real-time):

- **Tình huống**: User đang xem Project A, owner kick user ra
- **Cơ chế**:
  1. Firestore phát hiện `memberIds` không còn userId → Ngừng stream Project A
  2. `projects` signal cập nhật (không còn Project A)
  3. Effect 3 phát hiện `selectedId` không còn trong `projects`
  4. Tự động redirect về trang danh sách + thông báo

---

### 4. `project-list.ts` - "Trang Quản Lý"

**Vai trò**: Giao diện chính để xem danh sách và tạo dự án mới.

#### 🎨 Template Structure

```
┌─────────────────────────────────────────────┐
│  Header: "Your Projects" + Loading Spinner  │
├─────────────────────────────────────────────┤
│  Grid Layout (2 cột)                        │
│  ┌──────────────────┬──────────────────┐    │
│  │  Danh Sách       │  Form Tạo Mới    │    │
│  │  Projects        │  Project         │    │
│  │  (2fr)           │  (1fr)           │    │
│  └──────────────────┴──────────────────┘    │
└─────────────────────────────────────────────┘
```

#### 🔄 Luồng Hoạt Động

##### Khởi Tạo & Auto-load

```typescript
constructor() {
  effect(() => {
    const user = this.authStore.user();
    if (user) {
      this.store.loadProjects(user.uid);
    }
  });
}
```

**Lưu ý**: Effect này có vẻ trùng với Effect trong Store, nhưng:

- Effect trong Store chạy khi Store init (app-wide)
- Effect này đảm bảo component luôn có dữ liệu mới nhất khi render

##### Hiển Thị Danh Sách

```html
@for (project of store.projects(); track project.id) {
<a mat-list-item [routerLink]="['/project', project.id]">
  <h3>{{ project.name }}</h3>
  <p>{{ project.key }}</p>
  <p>Created by: {{ getOwnerName(project.ownerId) }}</p>

  @if (authStore.user()?.uid === project.ownerId) {
  <button (click)="deleteProject(project.id)">
    <mat-icon>delete</mat-icon>
  </button>
  }
</a>
}
```

**Chi tiết**:

- `track project.id`: Tối ưu rendering (Angular chỉ re-render item thay đổi)
- `getOwnerName()`: Chuyển đổi UID → "Me" hoặc tên người khác
- Nút xóa chỉ hiện với owner

##### Tạo Dự Án Mới

```typescript
createProject(name: string, key: string) {
  const currentUser = this.authStore.user();
  const ownerId = currentUser ? currentUser.uid : 'anonymous';

  this.projectsService.addProject({
    name,
    key,
    ownerId: ownerId,
    memberIds: [ownerId], // Tự động thêm mình vào
  });
}
```

**Điểm đặc biệt**:

- Gọi trực tiếp `Service`, KHÔNG qua Store
- Không cần update UI thủ công → Real-time tự động cập nhật

##### Xóa Dự Án

```typescript
deleteProject(projectId: string) {
  if (confirm('Are you sure?')) {
    this.store.deleteProject(projectId);
  }
}
```

---

### 5. `project-layout.ts` - "Khung Bố Cục"

**Vai trò**: Layout wrapper cho các trang con của một dự án (Board, Backlog).

#### 🎨 Cấu Trúc UI

```
┌────────────────────────────────────────────────┐
│  Sidenav (240px)      │  Main Content          │
│  ┌──────────────────┐ │  ┌──────────────────┐  │
│  │ Project Name     │ │  │                  │  │
│  │ Project Key      │ │  │  <router-outlet> │  │
│  ├──────────────────┤ │  │  (Board/Backlog) │  │
│  │ ☰ Backlog        │ │  │                  │  │
│  │ ☷ Board          │ │  │                  │  │
│  └──────────────────┘ │  └──────────────────┘  │
└────────────────────────────────────────────────┘
```

#### 🔗 Routing Integration

```typescript
template: `
  <mat-sidenav mode="side" opened>
    @if(store.selectedProject(); as project) {
      <h3>{{ project.name }}</h3>
      <p>{{ project.key }} software project</p>
    }
    
    <mat-nav-list>
      <a routerLink="./backlog" routerLinkActive="active-link">
        Backlog
      </a>
      <a routerLink="./board" routerLinkActive="active-link">
        Board
      </a>
    </mat-nav-list>
  </mat-sidenav>
  
  <mat-sidenav-content>
    <router-outlet></router-outlet>
  </mat-sidenav-content>
`;
```

**Cơ chế**:

- `store.selectedProject()`: Lấy thông tin dự án đang xem
- `routerLink="./backlog"`: Relative routing (VD: `/project/abc123/backlog`)
- `routerLinkActive`: Tự động highlight link đang active

---

### 6. `members-dialog.ts` - "Quản Lý Thành Viên"

**Vai trò**: Dialog (popup) để quản lý thành viên dự án.

#### 🎨 UI Sections

```
┌─────────────────────────────────────┐
│  Manage Members                     │
├─────────────────────────────────────┤
│  Current Members:                   │
│  ┌───────────────────────────────┐  │
│  │ 👤 John Doe (john@ex.com)     │  │
│  │    [Remove] (nếu là owner)    │  │
│  │ 👤 Jane Smith (jane@ex.com)   │  │
│  │    [Leave] (nếu là chính mình)│  │
│  └───────────────────────────────┘  │
│  ─────────────────────────────────  │
│  Add Member: (chỉ owner)            │
│  [Email Input] [Add Button]         │
└─────────────────────────────────────┘
```

#### 🔐 Phân Quyền

```typescript
get isOwner() {
  const project = this.store.selectedProject();
  return project?.ownerId === this.currentUser?.uid;
}
```

**Logic hiển thị**:

- **Owner**:
  - Thấy nút "Remove" cho các thành viên khác
  - Thấy form "Add Member"
- **Member thường**:
  - Chỉ thấy nút "Leave" cho chính mình
  - Không thấy form thêm thành viên

#### 🎬 Actions

##### Mời Thành Viên

```typescript
async addMember() {
  try {
    await this.store.inviteUser(this.emailToAdd);
    this.emailToAdd = '';
    alert('Invitation sent!');
  } catch (err: any) {
    this.error = err.message;
  }
}
```

##### Xóa Thành Viên

```typescript
async removeMember(memberId: string) {
  if (!confirm('Are you sure?')) return;
  await this.store.removeMember(memberId);
}
```

##### Rời Dự Án

```typescript
async leaveProject(memberId: string) {
  if (!confirm('Are you sure?')) return;
  await this.store.removeMember(memberId);
  this.dialogRef.close();
  this.router.navigate(['/projects']); // Redirect về danh sách
}
```

---

## 🔄 Luồng Hoạt Động Tổng Thể

### Luồng 1: Khởi Động Ứng Dụng

```
1. User đăng nhập
   ↓
2. AuthStore.user() thay đổi từ null → User object
   ↓
3. ProjectsStore Effect phát hiện thay đổi
   ↓
4. Gọi loadProjects(user.uid) & loadInvites(user.uid)
   ↓
5. Service query Firestore:
   - where('memberIds', 'array-contains', userId)
   - where('invitedMemberIds', 'array-contains', userId)
   ↓
6. Firestore trả về Observable (WebSocket connection)
   ↓
7. Store nhận dữ liệu → Update signals:
   - projects
   - pendingInvites
   ↓
8. UI tự động render (vì dùng signals)
```

### Luồng 2: Tạo Dự Án Mới

```
1. User điền form trong project-list.ts
   ↓
2. Bấm "Create" → createProject(name, key)
   ↓
3. Component gọi projectsService.addProject({...})
   ↓
4. Service gọi addDoc(firestore, 'projects', data)
   ↓
5. Firestore tạo document mới
   ↓
6. Firestore phát hiện thay đổi → Push qua WebSocket
   ↓
7. Observable trong loadProjects nhận event
   ↓
8. Store update signal projects
   ↓
9. UI tự động hiển thị project mới (không cần F5)
```

### Luồng 3: Mời & Chấp Nhận Thành Viên

#### A. Phía Owner (Người Mời)

```
1. Owner mở MembersDialog
   ↓
2. Nhập email → Bấm "Add"
   ↓
3. Dialog gọi store.inviteUser(email)
   ↓
4. Store:
   a. Gọi findUserByEmail(email)
   b. Kiểm tra user tồn tại
   c. Kiểm tra đã là member/invited chưa
   d. Gọi inviteUserToProject(projectId, userId, ...)
   ↓
5. Service update Firestore:
   invitedMemberIds: [...old, newUserId]
   ↓
6. Firestore push update
```

#### B. Phía Invitee (Người Được Mời)

```
1. Firestore push update đến máy Invitee
   ↓
2. Observable trong loadInvites nhận event
   ↓
3. Store update pendingInvites signal
   ↓
4. UI hiển thị thông báo lời mời (VD: badge trên header)
   ↓
5. Invitee bấm "Accept"
   ↓
6. Gọi store.acceptInvite(project, userId)
   ↓
7. Service update Firestore:
   invitedMemberIds: remove userId
   memberIds: add userId
   ↓
8. Firestore push update đến CẢ 2 máy:
   - Owner: projects[x].memberIds cập nhật
   - Invitee:
     * pendingInvites xóa project này
     * projects thêm project này
   ↓
9. UI cả 2 bên tự động cập nhật
```

### Luồng 4: Real-time Security Check

```
Tình huống: User đang xem Project A, Owner kick user ra

1. Owner gọi store.removeMember(userId)
   ↓
2. Service update Firestore:
   memberIds: remove userId
   ↓
3. Firestore phát hiện user không còn trong memberIds
   → Ngừng stream Project A đến máy user đó
   ↓
4. Observable trong loadProjects của user nhận event:
   projects = projects.filter(p => p.id !== 'A')
   ↓
5. Store update signal projects (không còn Project A)
   ↓
6. Effect 3 trong Store hooks chạy:
   selectedId = 'A'
   projects không chứa 'A'
   → stillHasAccess = false
   ↓
7. setTimeout 200ms → Alert + Redirect /projects
```

---

## 🎯 Các Khái Niệm Quan Trọng

### 1. Real-time Updates (Cập Nhật Thời Gian Thực)

**Cơ chế**:

- Firestore `collectionData()` tạo WebSocket connection
- Mỗi khi database thay đổi → Server push event đến client
- Observable emit giá trị mới → Signal update → UI re-render

**Lợi ích**:

- Không cần polling (gọi API liên tục)
- Tiết kiệm bandwidth
- UX mượt mà (nhiều user cùng làm việc thấy thay đổi ngay lập tức)

### 2. Optimistic Updates (Cập Nhật Lạc Quan)

**Ví dụ**: `deleteProject`

```typescript
await projectsService.deleteProject(projectId);
patchState(store, {
  projects: store.projects().filter((p) => p.id !== projectId),
});
```

**Giải thích**:

- Xóa ngay khỏi UI (không chờ Firestore confirm)
- Giả định request sẽ thành công → UX nhanh hơn
- Nếu lỗi → Hiển thị thông báo (nhưng state đã sai → cần reload)

### 3. Signals (Tín Hiệu)

**So sánh với RxJS**:

- **RxJS**: Stream-based, cần subscribe/unsubscribe
- **Signals**: Value-based, tự động track dependencies

**Ví dụ**:

```typescript
// Computed signal tự động update khi dependencies thay đổi
selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId()));

// Effect tự động chạy lại khi signals bên trong thay đổi
effect(() => {
  const user = authStore.user();
  if (user) loadProjects(user.uid);
});
```

### 4. Dependency Injection (Tiêm Phụ Thuộc)

**Cú pháp mới**:

```typescript
store = inject(ProjectsStore);
authStore = inject(AuthStore);
```

**Thay vì**:

```typescript
constructor(
  private store: ProjectsStore,
  private authStore: AuthStore
) {}
```

**Lợi ích**:

- Code ngắn gọn hơn
- Dễ test (mock dependencies)
- Hỗ trợ standalone components

---

## 🔒 Bảo Mật & Firestore Rules

### Firestore Security Rules (Khuyến nghị)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      // Đọc: Chỉ members và invited users
      allow read: if request.auth != null &&
        (request.auth.uid in resource.data.memberIds ||
         request.auth.uid in resource.data.get('invitedMemberIds', []));

      // Tạo: Ai cũng được (tự động là owner)
      allow create: if request.auth != null &&
        request.resource.data.ownerId == request.auth.uid &&
        request.resource.data.memberIds[0] == request.auth.uid;

      // Cập nhật: Chỉ owner
      allow update: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;

      // Xóa: Chỉ owner
      allow delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }
  }
}
```

### Client-side Security

**Effect 3 trong Store**:

- Phát hiện user mất quyền truy cập
- Tự động redirect
- Ngăn user xem dữ liệu không được phép

---

## 📊 Sơ Đồ Quan Hệ

```
┌─────────────┐
│   UI Layer  │
│ (Components)│
└──────┬──────┘
       │ inject()
       ↓
┌─────────────┐      ┌──────────────┐
│ProjectsStore│◄─────┤  AuthStore   │
│  (State)    │      │ (User Info)  │
└──────┬──────┘      └──────────────┘
       │ inject()
       ↓
┌─────────────┐      ┌──────────────┐
│  Projects   │◄────►│  Firestore   │
│  Service    │      │  (Database)  │
└─────────────┘      └──────────────┘
       ↑                     │
       │                     │ Real-time
       │                     ↓
       └─────────────────Observable
```

---

## 🚀 Best Practices Được Áp Dụng

### 1. Single Responsibility Principle

- **Model**: Chỉ định nghĩa cấu trúc
- **Service**: Chỉ giao tiếp database
- **Store**: Chỉ quản lý state
- **Component**: Chỉ hiển thị UI

### 2. Separation of Concerns

- Business logic nằm trong Store
- Database logic nằm trong Service
- UI logic nằm trong Component

### 3. Reactive Programming

- Dùng Observable cho async operations
- Dùng Signals cho state management
- Dùng Effects cho side effects

### 4. Error Handling

- Centralized error service
- User-friendly error messages
- Console logging cho debugging

### 5. Performance Optimization

- Chunking cho queries lớn (getUsers)
- Optimistic updates
- Computed signals (chỉ tính khi cần)
- Track by trong loops

---

## 🐛 Common Issues & Solutions

### Issue 1: Projects không hiển thị sau khi tạo

**Nguyên nhân**: Firestore rules chặn read
**Giải pháp**: Kiểm tra rules, đảm bảo `memberIds` chứa userId

### Issue 2: Invitation không real-time

**Nguyên nhân**: `loadInvites` không được gọi
**Giải pháp**: Kiểm tra Effect trong Store hooks

### Issue 3: Memory leak

**Nguyên nhân**: Observable không unsubscribe
**Giải pháp**: Dùng `rxMethod` (tự động cleanup) hoặc `takeUntilDestroyed()`

### Issue 4: ExpressionChangedAfterItHasBeenCheckedError

**Nguyên nhân**: Effect thay đổi state trong cùng change detection cycle
**Giải pháp**: Dùng `setTimeout` (như trong Effect 3)

---

## 📝 Tóm Tắt

**Projects Feature** là một hệ thống hoàn chỉnh với:

✅ **Real-time collaboration**: Nhiều user cùng làm việc, thấy thay đổi ngay lập tức  
✅ **Invitation system**: Quy trình mời 2 bước (invite → accept)  
✅ **Security**: Client-side + Server-side validation  
✅ **Optimistic updates**: UX mượt mà  
✅ **Reactive architecture**: Signals + RxJS  
✅ **Clean code**: Separation of concerns, DI, Single responsibility

**Luồng chính**:

1. User đăng nhập → Auto-load projects
2. Tạo project → Real-time update
3. Mời member → Notification real-time
4. Accept invite → Tự động thành member
5. Bị kick → Tự động redirect

**Công nghệ sử dụng**:

- Angular Signals (State management)
- NgRx SignalStore (Advanced state)
- Firebase Firestore (Real-time database)
- RxJS (Async operations)
- Angular Material (UI components)
