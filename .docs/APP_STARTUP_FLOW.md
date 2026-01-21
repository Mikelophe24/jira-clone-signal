# Luồng Khởi Động Ứng Dụng (App Startup Flow)

## 1. Truy cập URL (`http://localhost:4200`)

### 🟢 Bước 1: App Initialization

```
main.ts
  ↓
Review AppComponent
  ↓
Khởi tạo các Services & Stores gốc (AuthStore, Router...)
```

### 🔐 Bước 2: Auth Check (Xác thực)

```
AuthStore.onInit (Chạy ngay lập tức)
  ↓
Subscribe vào Firebase Auth State
  ↓
Firebase: Kiểm tra LocalStorage/IndexedDB
  ↓
  ├─ Trường hợp A: Đã Login → Trả về User object
  └─ Trường hợp B: Chưa Login → Trả về null
```

---

## 2. Routing Decision (Điều hướng)

### 🔀 Angular Router

Router kiểm tra URL `/`:

```typescript
// app.routes.ts
{
  path: '',
  component: MainLayoutComponent,
  canActivate: [authGuard], // 🛡️ Chốt chặn bảo vệ
  children: [
    { path: '', redirectTo: 'home', pathMatch: 'full' },
    // ...
  ]
}
```

### 🛡️ Auth Guard Check

Guard chạy logic kiểm tra (như đã giải thích ở `auth.guard.ts`):

- **Nếu chưa Login:**
  - Guard trả về `false`
  - Redirect thẳng về `/login`
  - **DỪNG LUỒNG TẠI ĐÂY.**

- **Nếu đã Login:**
  - Guard trả về `true`
  - Router tiếp tục load `MainLayoutComponent`
  - Redirect từ `''` -> `home`

---

## 3. Data Loading (Tải dữ liệu ban đầu)

Khi `MainLayoutComponent` (và ứng dụng) khởi động xong:

### 📦 ProjectsStore (Tải danh sách dự án)

```
ProjectsStore.onInit
  ↓
Effect: Theo dõi AuthStore.user()
  ↓
Có user → Gọi loadProjects(uid)
  ↓
ProjectsService: Lắng nghe Firestore (Real-time)
  ↓
Cập nhật danh sách Projects vào Store
```

---

## 4. User Chọn Vào Project (`/project/123`)

User click vào một project hoặc truy cập trực tiếp URL:

### 🎯 Project Layout Activation

```
User điều hướng đến: /project/123
  ↓
Router kích hoạt: ProjectLayoutComponent
```

### 🔄 Project Selection (Chọn dự án)

```
ProjectLayout.ts
  ↓
Constructor/ngOnInit: Đọc ID từ URL param ('id')
  ↓
Gọi: projectsStore.selectProject('123')
  ↓
ProjectsStore: Cập nhật state selectedProject
```

### 📋 Board Data Loading (Tải Issue)

```
BoardStore.onInit
  ↓
Effect: Theo dõi projectsStore.selectedProject()
  ↓
Thấy 'selectedProject' thay đổi (có ID '123')
  ↓
Gọi: loadIssues('123')
  ↓
IssueService: Lắng nghe Firestore issues của dự án này
  ↓
BoardStore: Nhận danh sách Issue → Lọc & Sắp xếp → Hiển thị lên Board
```

---

## 🏁 Kết Thúc

Lúc này, User đang ở trong trang Board/Backlog của dự án '123', với đầy đủ dữ liệu Projects và Issues đã được load sẵn sàng.
