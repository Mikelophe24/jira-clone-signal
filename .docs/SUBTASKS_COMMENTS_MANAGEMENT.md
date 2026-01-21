# Quản Lý Subtasks & Comments

## 📋 Tổng Quan

Subtasks và Comments là hai tính năng phụ trong Issue Dialog, cho phép người dùng:

- **Subtasks**: Chia nhỏ công việc thành các nhiệm vụ con có thể đánh dấu hoàn thành
- **Comments**: Thảo luận, ghi chú về issue

---

## 🔧 Cấu Trúc Dữ Liệu

### Subtask Model

```typescript
interface Subtask {
  id: string; // Random ID
  title: string; // Tên subtask
  completed: boolean; // Trạng thái hoàn thành
}
```

### Comment Model

```typescript
interface Comment {
  id: string; // Random ID
  userId: string; // Người comment
  content: string; // Nội dung
  createdAt: string; // ISO timestamp
}
```

Cả hai đều được **lưu trực tiếp trong Issue document** (embedded):

```typescript
interface Issue {
  // ...
  subtasks?: Subtask[];
  comments?: Comment[];
}
```

---

## 🔄 Luồng Hoạt Động

### 1. Thêm Subtask

```
User nhập title → Bấm "Add" hoặc Enter
    ↓
addSubtask() được gọi
    ↓
Tạo object Subtask mới (id random, completed: false)
    ↓
Nếu đang edit issue:
  → issueService.updateIssue(issueId, { subtasks: [...old, new] })
  → Firestore cập nhật
  → Real-time listener → UI tự động refresh
    ↓
Nếu đang tạo mới:
  → Lưu vào biến local this.subtasks
  → Khi Save issue → gửi cùng lúc
```

**Code:**

```typescript
// issue-dialog.ts
addSubtask() {
  const newSubtask: Subtask = {
    id: Math.random().toString(36).substr(2, 9),
    title: this.newSubtaskTitle,
    completed: false,
  };

  const updatedSubtasks = [...this.subtasks, newSubtask];

  if (this.isEditing && this.data.issue?.id) {
    this.issueService.updateIssue(this.data.issue.id, { subtasks: updatedSubtasks });
  }

  this.subtasks = updatedSubtasks;
  this.newSubtaskTitle = '';
}
```

---

### 2. Toggle Subtask (Đánh dấu hoàn thành)

```
User click checkbox
    ↓
toggleSubtask(subtask) được gọi
    ↓
Đảo ngược trạng thái: completed = !completed
    ↓
Cập nhật Firestore (nếu đang edit)
    ↓
Progress bar tự động tính lại % hoàn thành
```

**Code:**

```typescript
toggleSubtask(subtask: Subtask) {
  subtask.completed = !subtask.completed;
  const updatedSubtasks = this.subtasks.map(s =>
    s.id === subtask.id ? subtask : s
  );

  if (this.isEditing && this.data.issue?.id) {
    this.issueService.updateIssue(this.data.issue.id, { subtasks: updatedSubtasks });
  }
}
```

---

### 3. Xóa Subtask

```
User click nút X
    ↓
deleteSubtask(id) được gọi
    ↓
Filter ra subtask có id trùng
    ↓
Cập nhật Firestore
```

---

### 4. Thêm Comment

```
User nhập nội dung → Bấm "Save" hoặc Enter
    ↓
addComment() được gọi
    ↓
Tạo Comment object:
  - id: random
  - userId: authStore.user().uid
  - content: nội dung
  - createdAt: new Date().toISOString()
    ↓
Nếu đang edit:
  → Gửi ngay lên Firestore
  → Real-time update
Nếu đang tạo mới:
  → Lưu local → Gửi khi Save issue
```

**Code:**

```typescript
addComment() {
  const user = this.authStore.user();
  const newComment = {
    id: Math.random().toString(36).substr(2, 9),
    userId: user.uid,
    content: this.newCommentText,
    createdAt: new Date().toISOString(),
  };

  const updatedComments = [...this.comments, newComment];

  if (this.isEditing && this.data.issue?.id) {
    this.issueService.updateIssue(this.data.issue.id, { comments: updatedComments });
  }

  this.comments = updatedComments;
  this.newCommentText = '';
}
```

---

### 5. Xóa Comment

```
User click nút delete (chỉ hiện với comment của mình)
    ↓
Confirm dialog
    ↓
deleteComment(commentId)
    ↓
Filter ra comment có id trùng
    ↓
Cập nhật Firestore
```

**Bảo mật:** Chỉ người tạo comment mới thấy nút xóa:

```html
@if (authStore.user()?.uid === comment.userId) {
<button (click)="deleteComment(comment.id)">
  <mat-icon>delete</mat-icon>
</button>
}
```

---

## 🎨 UI Features

### Progress Bar (Subtasks)

```typescript
calculateProgress(): number {
  if (this.subtasks.length === 0) return 0;
  const completed = this.subtasks.filter(s => s.completed).length;
  return (completed / this.subtasks.length) * 100;
}
```

Hiển thị thanh tiến độ:

```html
<div class="progress-bar">
  <div class="progress-fill" [style.width.%]="calculateProgress()"></div>
</div>
```

### Hiển thị User Info (Comments)

```html
@if (getUser(comment.userId); as user) {
<img [src]="user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName" />
<span>{{ user.displayName }}</span>
<span>{{ comment.createdAt | date: 'short' }}</span>
}
```

---

## ⚡ Đặc Điểm Kỹ Thuật

### 1. Embedded Data (Không phải Collection riêng)

- Subtasks & Comments **KHÔNG** có collection riêng trong Firestore
- Chúng được lưu trực tiếp trong Issue document
- **Ưu điểm**: Đơn giản, nhanh (1 lần đọc)
- **Nhược điểm**: Giới hạn 1MB/document (Firestore limit)

### 2. Optimistic Update

Khi edit issue đang mở, mọi thay đổi (add/delete subtask/comment) được gửi **ngay lập tức** lên Firestore, không cần bấm "Save" issue.

### 3. Local State (Khi tạo mới)

Khi tạo issue mới, subtasks/comments được lưu trong biến local. Chỉ khi bấm "Create" thì mới gửi toàn bộ lên Firestore.

---

## 🔒 Bảo Mật

### Comments

- Chỉ người tạo comment mới có quyền xóa
- UI check: `authStore.user()?.uid === comment.userId`
- Backend: Firestore Rules kiểm tra ownership

### Subtasks

- Mọi thành viên project đều có thể thêm/sửa/xóa
- Không có kiểm tra ownership đặc biệt

---

## 📊 Tóm Tắt

| Tính năng    | Lưu trữ              | Real-time     | Quyền              |
| ------------ | -------------------- | ------------- | ------------------ |
| **Subtasks** | Embedded trong Issue | ✅ (khi edit) | Mọi member         |
| **Comments** | Embedded trong Issue | ✅ (khi edit) | Xóa: chỉ người tạo |
| **Progress** | Tính toán động       | -             | -                  |

**Lưu ý quan trọng:** Vì dữ liệu embedded, nếu có quá nhiều comments/subtasks (>100), nên cân nhắc tách ra collection riêng để tránh vượt giới hạn Firestore.
