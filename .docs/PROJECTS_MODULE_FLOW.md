# Projects Module - Luồng Hoạt Động

## 📁 Cấu trúc Module

```
projects/
├── projects.service.ts      # Data Access Layer (Firestore)
├── projects.store.ts         # State Management (NgRx Signals)
├── project-create/           # Component tạo dự án
├── project-list/             # Component danh sách dự án
└── members-dialog/           # Dialog quản lý thành viên
```

---

## 🔄 Luồng Chính

### 1. Khởi tạo (App Start)

```
User Login → AuthStore.user() thay đổi
    ↓
ProjectsStore.onInit (effect)
    ↓
loadProjects(user.uid) được gọi
    ↓
ProjectsService.getProjects(uid)
    ↓
Firestore Query: where('memberIds', 'array-contains', uid)
    ↓
collectionData() → Real-time Observable
    ↓
Store.projects() cập nhật → UI hiển thị danh sách
```

**File liên quan:**

- `projects.store.ts` (dòng 247-250): Effect lắng nghe AuthStore
- `projects.service.ts` (dòng 14-20): Hàm getProjects

---

### 2. Tạo Dự Án Mới

```
User click "Create Project" → ProjectCreateDialog mở
    ↓
User nhập tên, key → Submit
    ↓
ProjectsStore.addProject()
    ↓
ProjectsService.addProject()
    ↓
Firestore: addDoc(projects, {...})
    ↓
Real-time Listener bắn về → projects() tự động cập nhật
    ↓
UI hiển thị dự án mới
```

**Đặc điểm:**

- Không cần reload trang
- Owner tự động là người tạo
- `memberIds` ban đầu chỉ có owner

---

### 3. Mời Thành Viên

```
Owner mở Members Dialog → Nhập email
    ↓
ProjectsStore.inviteUser(email)
    ↓
Tìm user: ProjectsService.findUserByEmail()
    ↓
Kiểm tra:
  - User tồn tại? ✓
  - Đã là member? ✗
  - Đã được mời? ✗
    ↓
ProjectsService.inviteUserToProject()
    ↓
Firestore: updateDoc({ invitedMemberIds: [...old, newUserId] })
    ↓
┌─────────────────────────────────────────┐
│ REAL-TIME PUSH (WebSocket)              │
├─────────────────────────────────────────┤
│ → Owner: projects() cập nhật            │
│ → Invitee: pendingInvites() cập nhật    │
└─────────────────────────────────────────┘
```

**File liên quan:**

- `projects.store.ts` (dòng 179-211): inviteUser method
- `projects.service.ts` (dòng 61-66): inviteUserToProject

---

### 4. Chấp Nhận Lời Mời

```
Invitee thấy thông báo (pendingInvites signal)
    ↓
Click "Accept"
    ↓
ProjectsStore.acceptInvite()
    ↓
ProjectsService.acceptInvite()
    ↓
Firestore: updateDoc({
  invitedMemberIds: remove(userId),
  memberIds: add(userId)
})
    ↓
┌─────────────────────────────────────────┐
│ REAL-TIME UPDATE (Tất cả users)         │
├─────────────────────────────────────────┤
│ Invitee:                                │
│   - pendingInvites() giảm đi 1          │
│   - projects() tăng lên 1               │
│                                         │
│ Owner & Members:                        │
│   - projects() cập nhật (memberIds++)   │
│   - members() load thêm user mới        │
└─────────────────────────────────────────┘
```

**File liên quan:**

- `projects.store.ts` (dòng 147-165): acceptInvite method
- `projects.service.ts` (dòng 76-88): acceptInvite

---

### 5. Xóa Thành Viên

```
Owner click "Remove" trên member
    ↓
ProjectsStore.removeMember(memberId)
    ↓
Bước 1: IssueService.unassignUserFromProjectIssues()
  → Gỡ user khỏi tất cả issues trong project
    ↓
Bước 2: ProjectsService.removeMemberFromProject()
  → Firestore: updateDoc({ memberIds: filter(id !== memberId) })
    ↓
Optimistic Update: Xóa khỏi UI ngay lập tức
    ↓
Real-time Listener xác nhận → Đồng bộ hoàn tất
```

**File liên quan:**

- `projects.store.ts` (dòng 212-239): removeMember method

---

## 🎯 Điểm Quan Trọng

### Real-time Synchronization

Tất cả thay đổi đều tự động đồng bộ nhờ:

```typescript
// projects.service.ts
collectionData(query, { idField: 'id' });
```

Hàm này tạo WebSocket connection, không phải HTTP polling.

### State Management Flow

```
Service (Data) → Store (State) → Component (UI)
       ↑                              ↓
       └──────── User Action ──────────┘
```

### Security

- Firestore Rules kiểm tra quyền Owner/Member
- Frontend validation để UX tốt hơn
- Backend validation để bảo mật

---

## 📊 Computed Signals

```typescript
// projects.store.ts
selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId()));
```

**Lợi ích:**

- Tự động cập nhật khi `projects` hoặc `selectedProjectId` thay đổi
- Không cần viết logic subscribe/unsubscribe
- Performance tối ưu (chỉ tính lại khi cần)

---

## 🔗 Liên Kết Giữa Các Module

```
AuthStore ──(user.uid)──→ ProjectsStore
                              ↓
                        (selectedProject)
                              ↓
                         BoardStore
                              ↓
                        (load issues)
```

Khi user chọn project → `selectedProjectId` thay đổi → BoardStore load issues của project đó.
