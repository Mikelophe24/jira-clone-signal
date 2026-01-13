# BACKLOG COMPONENT - GIẢI THÍCH CHI TIẾT

## 📋 Tổng quan

Component `Backlog` quản lý trang **Backlog** - nơi chứa các công việc (issues) chưa sẵn sàng để đưa vào bảng Kanban chính. Đây là khu vực "staging" để lưu trữ ý tưởng, task tương lai, hoặc các issue đang chờ được phân loại.

**File:** `src/app/features/board/backlog/backlog.ts`

---

## 🏗️ Kiến trúc Component

### 1. Dependencies & Imports

```typescript
import { Component, inject, computed } from '@angular/core';
import { ProjectsStore } from '../../projects/projects.store';
import { BoardStore } from '../board.store';
import { IssueService } from '../../issue/issue.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
```

**Vai trò của từng dependency:**

| Dependency       | Mục đích                                          |
| ---------------- | ------------------------------------------------- |
| `ProjectsStore`  | Lấy thông tin project hiện tại, danh sách members |
| `BoardStore`     | Quản lý danh sách issues, thêm/sửa/xóa issue      |
| `IssueService`   | Gọi API để di chuyển issue từ Backlog → Board     |
| `AuthStore`      | Lấy thông tin user hiện tại (để set reporterId)   |
| `MatDialog`      | Mở popup tạo/sửa issue                            |
| `ActivatedRoute` | Lấy `projectId` từ URL                            |

---

## 🎯 Computed Signal - `backlogIssues`

```typescript
backlogIssues = computed(() => {
  return this.boardStore.issues().filter((i) => i.isInBacklog);
});
```

### Cách hoạt động:

1. Lắng nghe Signal `boardStore.issues()` (danh sách tất cả issues của project).
2. **Tự động lọc** chỉ những issue có `isInBacklog = true`.
3. Khi `boardStore.issues()` thay đổi (thêm/xóa/sửa) → `backlogIssues` tự động cập nhật.
4. UI tự động re-render danh sách.

**Ví dụ:**

```typescript
// Tất cả issues trong Store
issues = [
  { id: '1', title: 'Task A', isInBacklog: true },   // ✅ Hiện trong Backlog
  { id: '2', title: 'Task B', isInBacklog: false },  // ❌ Đã ở Board
  { id: '3', title: 'Task C', isInBacklog: true },   // ✅ Hiện trong Backlog
]

// backlogIssues() sẽ trả về:
[
  { id: '1', title: 'Task A', isInBacklog: true },
  { id: '3', title: 'Task C', isInBacklog: true },
]
```

---

## 🔄 Lifecycle Hook - `ngOnInit`

```typescript
ngOnInit() {
  this.route.parent?.paramMap.subscribe((params) => {
    const projectId = params.get('projectId');
    if (projectId) {
      this.boardStore.loadIssues(projectId);      // Tải issues từ Firestore
      this.projectsStore.selectProject(projectId); // Đánh dấu project đang chọn
    }
  });
}
```

### Luồng hoạt động:

1. Component được khởi tạo.
2. Lắng nghe thay đổi URL (khi user chuyển project).
3. Lấy `projectId` từ URL params.
4. Gọi `loadIssues(projectId)` → Tải dữ liệu từ Firebase.
5. Gọi `selectProject(projectId)` → Cập nhật project đang chọn trong Store.

**Ví dụ URL:**

```
/projects/abc123/backlog
         ^^^^^^^
         projectId
```

---

## 🛠️ Các Methods Chính

### 1. `moveToBoard(issueId)` - Di chuyển Issue lên Board

```typescript
moveToBoard(issueId: string) {
  this.issueService.moveToBoard(issueId);
}
```

**Luồng hoạt động:**

```
1. User bấm "Move to Board"
   ↓
2. Gọi issueService.moveToBoard(issueId)
   ↓
3. Service cập nhật Firestore: { isInBacklog: false }
   ↓
4. Firebase real-time listener bắn data về
   ↓
5. boardStore.issues() tự động cập nhật
   ↓
6. backlogIssues() tự động loại bỏ issue này (vì isInBacklog = false)
   ↓
7. UI tự động xóa issue khỏi danh sách Backlog
```

**Không cần reload trang!** Mọi thứ diễn ra tự động nhờ cơ chế Reactive.

---

### 2. `createIssue()` - Tạo Issue mới trong Backlog

```typescript
createIssue() {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '600px',
    data: { statusColumnId: 'todo' },
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      const projectId = this.projectsStore.selectedProjectId();
      const projectKey = this.projectsStore.selectedProject()?.key;
      const currentUser = this.authStore.user();

      if (projectId && projectKey && currentUser) {
        this.boardStore.addIssue({
          ...result,                                    // Dữ liệu từ form
          projectId,
          boardId: projectId,
          order: 0,
          key: this.boardStore.getNextIssueKey(projectKey), // ⭐ Tự động tăng
          reporterId: currentUser.uid,                  // ⭐ Người tạo
          isInBacklog: true,                            // ⭐ Đánh dấu là Backlog
        });
      }
    }
  });
}
```

### Phân tích chi tiết:

#### Bước 1: Mở Dialog

```typescript
const dialogRef = this.dialog.open(IssueDialog, {
  width: '600px',
  data: { statusColumnId: 'todo' },
});
```

- Hiện popup để user nhập thông tin (Title, Description, Priority...).

#### Bước 2: Xử lý kết quả

```typescript
dialogRef.afterClosed().subscribe((result) => { ... });
```

- Chờ user bấm "Create" hoặc "Cancel".
- Nếu Cancel → `result = null` → Không làm gì.
- Nếu Create → `result` chứa dữ liệu form.

#### Bước 3: Tạo Issue Key tự động

```typescript
key: this.boardStore.getNextIssueKey(projectKey);
```

**Tại sao quan trọng?**

- Đảm bảo key **không trùng lặp** (PROJ-1, PROJ-2, PROJ-3...).
- Trước đây dùng `Math.random()` → Có thể trùng → **Đã sửa**.

#### Bước 4: Set Reporter ID

```typescript
reporterId: currentUser.uid;
```

**Tại sao cần?**

- Firebase Security Rules chỉ cho phép **Reporter** hoặc **Project Owner** xóa issue.
- Nếu không set → Không thể xóa issue → **Bug nghiêm trọng**.

#### Bước 5: Đánh dấu là Backlog

```typescript
isInBacklog: true;
```

- Issue này sẽ **KHÔNG** hiện trên Board chính.
- Chỉ hiện trong trang Backlog.

---

### 3. `editIssue(issue)` - Chỉnh sửa Issue

```typescript
editIssue(issue: any) {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '600px',
    data: { issue },  // ⭐ Truyền dữ liệu issue hiện tại
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      this.boardStore.updateIssue(issue.id, result);
    }
  });
}
```

**Khác biệt với `createIssue`:**

- Truyền `data: { issue }` → Dialog hiện dữ liệu cũ để chỉnh sửa.
- Gọi `updateIssue()` thay vì `addIssue()`.

---

### 4. `deleteIssue(issueId, issueKey)` - Xóa Issue

```typescript
deleteIssue(issueId: string, issueKey: string) {
  if (confirm(`Are you sure you want to delete issue ${issueKey}?`)) {
    this.boardStore.deleteIssue(issueId);
  }
}
```

**Luồng hoạt động:**

```
1. User bấm nút Delete (icon đỏ)
   ↓
2. Hiện popup xác nhận: "Are you sure you want to delete issue PROJ-123?"
   ↓
3. Nếu OK:
   → Gọi boardStore.deleteIssue(issueId)
   → Store gọi issueService.deleteIssue(issueId)
   → Service xóa document trên Firestore
   → Firebase real-time listener phát hiện thay đổi
   → boardStore.issues() tự động cập nhật
   → backlogIssues() tự động loại bỏ issue
   → UI tự động xóa khỏi danh sách
   ↓
4. Nếu Cancel: Không làm gì
```

**Lưu ý về Firebase Rules:**

```javascript
allow delete: if signedIn() && (
  resource.data.reporterId == request.auth.uid ||  // Người tạo
  isProjectOwner(resource.data.projectId)          // Hoặc Owner
);
```

→ Chỉ Reporter hoặc Owner mới xóa được.

---

## 🎨 Helper Methods

### 1. `getPriorityIcon(priority)` - Lấy Icon theo độ ưu tiên

```typescript
getPriorityIcon(priority: string) {
  switch (priority) {
    case 'high':   return 'arrow_upward';    // ↑
    case 'medium': return 'remove';          // —
    case 'low':    return 'arrow_downward';  // ↓
    default:       return 'remove';
  }
}
```

### 2. `getPriorityColor(priority)` - Lấy màu theo độ ưu tiên

```typescript
getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':   return '#de350b';  // Đỏ
    case 'medium': return '#ff9900';  // Cam
    case 'low':    return '#0065ff';  // Xanh
    default:       return '#172b4d';  // Xám
  }
}
```

### 3. `getAssigneeName(userId)` - Lấy tên người được giao

```typescript
getAssigneeName(userId?: string) {
  if (!userId) return 'Unassigned';
  const user = this.projectsStore.members().find((m) => m.uid === userId);
  return user ? user.displayName : 'Unknown';
}
```

**Luồng:**

1. Nếu không có `userId` → Trả về "Unassigned".
2. Tìm user trong danh sách `members()` của project.
3. Nếu tìm thấy → Trả về tên.
4. Nếu không tìm thấy → Trả về "Unknown" (trường hợp user đã rời project).

---

## 🖼️ Template Structure

```html
<div class="backlog-container">
  <!-- Header với nút Create -->
  <div class="backlog-header">
    <h2>Backlog</h2>
    <button (click)="createIssue()">Create Issue</button>
  </div>

  <!-- Danh sách Issues -->
  <div class="issues-list">
    @for (issue of backlogIssues(); track issue.id) {
    <div class="backlog-item">
      <!-- Bên trái: Icon, Key, Title -->
      <div class="item-left">
        <mat-icon [style.color]="getPriorityColor(issue.priority)">
          {{ getPriorityIcon(issue.priority) }}
        </mat-icon>
        <div class="issue-key">{{ issue.key }}</div>
        <div class="issue-title">{{ issue.title }}</div>
      </div>

      <!-- Bên phải: Assignee, Buttons -->
      <div class="item-right">
        <div class="assignee">{{ getAssigneeName(issue.assigneeId) }}</div>
        <button (click)="moveToBoard(issue.id)">Move to Board</button>
        <button (click)="editIssue(issue)"><mat-icon>edit</mat-icon></button>
        <button (click)="deleteIssue(issue.id, issue.key)"><mat-icon>delete</mat-icon></button>
      </div>
    </div>
    } @empty {
    <div class="empty-state">No issues in the backlog.</div>
    }
  </div>
</div>
```

### Giải thích cú pháp Angular mới:

**`@for` (Angular 17+):**

```typescript
@for (issue of backlogIssues(); track issue.id) {
  <!-- Lặp qua từng issue -->
}
```

- Thay thế cho `*ngFor`.
- `track issue.id` → Tối ưu hiệu suất (Angular biết item nào thay đổi).

**`@empty`:**

```typescript
@empty {
  <div>No issues in the backlog.</div>
}
```

- Hiện khi danh sách rỗng.
- Thay thế cho `*ngIf="backlogIssues().length === 0"`.

---

## 🎨 Styling Highlights

### 1. Hover Effect

```scss
.backlog-item {
  transition: background 0.1s;

  &:hover {
    background: #f4f5f7; // Màu xám nhạt khi hover
  }
}
```

### 2. Layout Flexbox

```scss
.backlog-item {
  display: flex;
  justify-content: space-between; // Đẩy 2 bên xa nhau
  align-items: center; // Căn giữa theo chiều dọc
}
```

### 3. Empty State

```scss
.empty-state {
  padding: 32px;
  text-align: center;
  color: #6b778c;
  background: #f4f5f7;
  border-radius: 4px;
}
```

---

## 🔄 Luồng dữ liệu tổng thể

### Khi tạo Issue mới:

```
User bấm "Create Issue"
  ↓
Mở IssueDialog
  ↓
User nhập thông tin → Bấm "Create"
  ↓
Component gọi boardStore.addIssue({ isInBacklog: true, ... })
  ↓
Store gọi issueService.addIssue()
  ↓
Service gọi Firestore addDoc()
  ↓
Firebase tạo document mới
  ↓
Real-time listener phát hiện thay đổi
  ↓
boardStore.issues() tự động cập nhật
  ↓
backlogIssues() tự động thêm issue mới
  ↓
UI tự động hiển thị issue mới
```

### Khi di chuyển Issue lên Board:

```
User bấm "Move to Board"
  ↓
Component gọi issueService.moveToBoard(issueId)
  ↓
Service cập nhật Firestore: { isInBacklog: false }
  ↓
Real-time listener phát hiện thay đổi
  ↓
boardStore.issues() cập nhật issue đó
  ↓
backlogIssues() tự động loại bỏ issue (vì isInBacklog = false)
  ↓
UI tự động xóa khỏi Backlog
  ↓
Đồng thời, Board Component tự động hiển thị issue này
```

---

## ⚠️ Những điểm quan trọng cần nhớ

### 1. ✅ Luôn set `reporterId` khi tạo issue

```typescript
reporterId: currentUser.uid; // ⭐ BẮT BUỘC
```

**Lý do:** Firebase Rules yêu cầu để cho phép xóa.

### 2. ✅ Dùng `getNextIssueKey()` thay vì `Math.random()`

```typescript
key: this.boardStore.getNextIssueKey(projectKey); // ✅ Đúng
key: `${projectKey}-${Math.random()}`; // ❌ Sai (có thể trùng)
```

### 3. ✅ Luôn set `isInBacklog = true`

```typescript
isInBacklog: true; // ⭐ Đảm bảo issue chỉ hiện trong Backlog
```

### 4. ✅ Xác nhận trước khi xóa

```typescript
if (confirm('Are you sure...')) {
  // ⭐ Tránh xóa nhầm
  this.boardStore.deleteIssue(issueId);
}
```

---

## 🔗 Tương tác với các Component khác

| Component/Service | Tương tác                      |
| ----------------- | ------------------------------ |
| `BoardStore`      | Đọc/ghi danh sách issues       |
| `ProjectsStore`   | Lấy thông tin project, members |
| `AuthStore`       | Lấy user hiện tại              |
| `IssueService`    | Gọi API di chuyển issue        |
| `IssueDialog`     | Mở popup tạo/sửa issue         |

---

## 📊 So sánh Backlog vs Board

| Tính năng       | Backlog                         | Board                                 |
| --------------- | ------------------------------- | ------------------------------------- |
| **Hiển thị**    | Danh sách đơn giản              | Kanban với 3 cột                      |
| **Kéo thả**     | ❌ Không                        | ✅ Có                                 |
| **Filter**      | ❌ Không                        | ✅ Có (Search, Assignee, Priority...) |
| **Mục đích**    | Lưu trữ ý tưởng, task tương lai | Quản lý công việc đang làm            |
| **isInBacklog** | `true`                          | `false`                               |

---

## 🚀 Cải tiến có thể làm trong tương lai

1. **Thêm Drag & Drop** để sắp xếp thứ tự issue trong Backlog.
2. **Thêm Filter** (tìm kiếm, lọc theo priority).
3. **Bulk Actions** (chọn nhiều issue để di chuyển cùng lúc).
4. **Sprint Planning** (chọn issue từ Backlog để tạo Sprint).
5. **Estimate Points** (thêm story points cho mỗi issue).

---

## 📝 Tóm tắt

Component `Backlog` là một **danh sách quản lý đơn giản** cho các issue chưa sẵn sàng. Nó tận dụng:

- **Angular Signals** để tự động cập nhật UI.
- **Firebase Real-time** để đồng bộ dữ liệu.
- **NgRx Signal Store** để quản lý state tập trung.

Mọi thao tác (tạo, sửa, xóa, di chuyển) đều **không cần reload trang** nhờ kiến trúc Reactive hiện đại.
