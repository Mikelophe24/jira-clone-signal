# Tài Liệu Chi Tiết Về Kiến Trúc & Luồng Hoạt Động (Jira Clone)

Tài liệu này giải thích chi tiết về cấu trúc mã nguồn, công nghệ sử dụng và luồng hoạt động của từng tính năng trong dự án Jira Clone này.

## 1. Tổng Quan Công Nghệ (Tech Stack)

Dự án được xây dựng dựa trên các công nghệ hiện đại nhất của Angular (phiên bản 17+):

- **Angular Signals**: Quản lý trạng thái (State Management) phản ứng (reactive) thay vì dùng RxJS BehaviorSubject truyền thống cho View state.
- **NgRx Signals Store**: Thư viện quản lý state nhẹ, mạnh mẽ, thay thế cho NgRx Global Store cồng kềnh (Reducers/Selectors/Effects).
- **Standalone Components**: Không sử dụng NgModules (`app.module.ts`), giúp tree-shaking tốt hơn và cấu trúc gọn nhẹ.
- **Angular Material**: UI Component Library (Dialog, Form, DragDrop).
- **Firebase / Firestore**: Backend-as-a-Service dùng để lưu trữ dữ liệu (NoSQL) và xác thực người dùng.

---

## 2. Cấu Trúc Thư Mục (Folder Structure)

Chúng ta tuân theo cấu trúc **Feature-First**:

```
src/app/
├── core/                   # Các thành phần cốt lõi dùng chung toàn app
│   ├── auth/               # Logic xác thực (AuthService, AuthStore, AuthGuard)
│   ├── models/             # Interfaces dữ liệu chung (AppUser, v.v.)
│   └── services/           # Services tầng thấp (nếu có)
│
├── features/               # Các tính năng chính (nghiệp vụ)
│   ├── auth/               # UI Login/Register
│   ├── board/              # Logic Bảng Kanban (Board Component, BoardStore, Filter)
│   ├── issue/              # Logic thẻ Task (Model, Dialog tạo/sửa Issue)
│   ├── projects/           # Logic quản lý Dự án (List, Create, ProjectsStore)
│
├── app.routes.ts           # Định tuyến toàn bộ ứng dụng
└── app.ts                  # Component gốc (Root)
```

---

## 3. Luồng Hoạt Động Của Các Tính Năng (Detailed Flows)

### 3.1. Hệ Thống Xác Thực (Authentication)

**Luồng đi:**

1.  **Login**: Người dùng bấm đăng nhập (Google) tại `Login` component.
2.  **Service**: `AuthService` gọi Firebase `signInWithPopup`.
3.  **State**: `AuthStore` lắng nghe thay đổi từ Firebase (`onAuthStateChanged`).
    - Khi có user: Store cập nhật signal `user`.
    - Khi logout: Store set `user` về `null`.
4.  **Guard**: `authGuard` (trong `app.routes.ts`) kiểm tra signal `user` trong `AuthStore`.
    - Nếu chưa login: Chuyển hướng về `/login`.
    - Nếu đã login: Cho phép truy cập `/projects`.

### 3.2. Quản Lý Dự Án (Projects)

**Luồng hiển thị dự án:**

1.  **Init**: Khi vào trang `/projects`, `ProjectList` component được khởi tạo.
2.  **Load Data**: Component gọi `projectsStore.loadProjects(userId)`.
3.  **API Call**: `ProjectsService` query Firestore lấy danh sách project mà user là thành viên.
4.  **Display**: Danh sách project được lưu vào signal `projects` trong store và render ra màn hình.

### 3.3. Bảng Kanban (Kanban Board)

Đây là tính năng phức tạp nhất.

**a. Khởi tạo & Load Dữ Liệu:**

1.  **Routing**: URL có dạng `/project/:projectId/board`.
2.  **Resolution**: `Board` component đọc `projectId` từ URL params.
3.  **Fetching**:
    - Gọi `boardStore.loadIssues(projectId)` để lấy toàn bộ Task.
    - Gọi `projectsStore.selectProject(projectId)` để lấy thông tin dự án hiện tại (để hiển thị tên, members).
    - **Cơ chế Avatar**: Nếu F5, danh sách Project rỗng. `Board` có thêm `effect` để tự động gọi `loadProjects` nếu thấy user đã login mà chưa có dữ liệu project -> Đảm bảo Avatar assignee luôn hiển thị.

**b. Filtering (Bộ lọc Assignee, Status, Priority):**

1.  **Component**: `BoardFilter` chứa logic UI checkbox.
2.  **Action**: Khi user tick vào một filter (ví dụ: "High Priority"):
    - Gọi `boardStore.updateFilter({ priority: ['high'] })`.
3.  **Computed Signal**: Trong `BoardStore`, có một signal tên là `filteredIssues`.
    - Signal này **tự động tính toán lại** mỗi khi `filter` hoặc `issues` gốc thay đổi.
    - Logic: `issues gốc` -> `filter assignee?` -> `filter priority?` -> `filter search text?` -> `Kết quả`.
4.  **View**: UI bảng Board chỉ bind vào `store.todoIssues()`, `store.doneIssues()`. Các computed này lấy nguồn từ `filteredIssues` đã lọc, nên UI update tức thì.

**c. Kéo Thả (Drag & Drop):**

1.  **Event**: Người dùng kéo thẻ từ cột TO DO sang DONE.
2.  **Optimistic UI Update**:
    - `BoardStore` ngay lập tức cập nhật state local (thẻ di chuyển ngay lập tức trên màn hình) để tạo cảm giác mượt mà.
3.  **Backend Sync**:
    - Sau khi update UI, Store gọi `Firestore` để lưu trạng thái mới (`status: 'done'`).
    - Nếu lỗi backend, Store sẽ revert lại state cũ (có thể implement thêm notify).

**d. Hiển Thị Priority:**

1.  Trong `issue.model.ts`, Priority được định nghĩa là `'high' | 'medium' | 'low'`.
2.  `Board` component có helper `getPriorityIcon` và `getPriorityColor` để render icon tương ứng.

### 3.4. Quản Lý Issue (Tạo/Sửa/Xóa)

1.  **Dialog**: Sử dụng `MatDialog` để mở popup (`IssueDialog`).
2.  **Form**: Form nhập liệu dùng `ReactiveFormsModule`.
3.  **Result**:
    - Khi đóng dialog (Save), trả về object task mới.
    - `Board` component nhận result và gọi `store.addIssue` hoặc `store.updateIssue`.

---

## 4. Các Store Quan Trọng (State Management)

Chúng ta dùng **NgRx Signals** thay vì Service thường để quản lý state.

### `projects.store.ts`

- **State**: Danh sách `projects`, `selectedProjectId`, `members` (thành viên dự án).
- **Nhiệm vụ**: Load dự án, load thông tin thành viên (để lấy avatar/tên cho Board).

### `board.store.ts`

- **State**: Danh sách toàn bộ `issues`, trạng thái `filter` (assigneeIs, onlyMyIssues, priority...).
- **Computed**:
  - `filteredIssues`: List issues sau khi qua bộ lọc.
  - `groupedIssues`: Chia `filteredIssues` thành 3 nhóm (todo, in-progress, done) để render ra 3 cột.
- **Methods**: `loadIssues`, `addIssue`, `updateIssue`, `deleteIssue`, `moveIssue`.

### `auth.store.ts`

- **State**: `user` (firebase user object), `loading`.
- **Nhiệm vụ**: Giữ trạng thái đăng nhập toàn cục.

---

## 5. Mẹo & Lưu Ý Khi Phát Triển

- **Thêm trường mới vào Task**: Cần sửa `issue.model.ts`, sau đó sửa `IssueDialog`, và cuối cùng là hiển thị trên `TaskCard` trong `board.ts`.
- **Debug**: Sử dụng `console.log` trong `withMethods` của store hoặc dùng Redux DevTools (nếu cài adapter). Do dùng Signals nên việc track data rất dễ dàng bằng cách log giá trị signal `store.issues()`.
- **Styles**: SCSS được dùng. Các class tiện ích (utils) nên để trong `styles.scss` gốc.
