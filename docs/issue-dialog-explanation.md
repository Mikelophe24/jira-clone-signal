# Giải Thích Chi Tiết: IssueDialog Component

## 📋 Tổng Quan

`IssueDialog` là một **Angular Material Dialog** component phức tạp và đa chức năng, đóng vai trò là **trung tâm quản lý issues** trong ứng dụng Jira Clone. Component này hoạt động ở **2 chế độ**:

1. **Create Mode** (Tạo mới): Tạo issue mới
2. **Edit Mode** (Chỉnh sửa): Xem và chỉnh sửa issue đã tồn tại

---

## 🏗️ Cấu Trúc Component

### 1. **Interface: IssueDialogData**

```typescript
export interface IssueDialogData {
  statusColumnId: string; // Cột mặc định (todo, in-progress, done)
  issue?: Issue; // Issue cần edit (undefined = Create mode)
}
```

**Mục đích:** Định nghĩa dữ liệu được truyền vào dialog khi mở.

---

## 🎨 Template Structure

Dialog được chia thành **4 phần chính**:

```
┌─────────────────────────────────────┐
│  📝 Issue Form (Luôn hiển thị)     │
│  - Title, Description               │
│  - Type, Priority                   │
│  - Assignee, Due Date               │
├─────────────────────────────────────┤
│  ✅ Subtasks Section (Luôn)        │
│  - Progress bar                     │
│  - Subtask list                     │
│  - Add subtask input                │
├─────────────────────────────────────┤
│  💬 Comments Section (Edit only)   │
│  - Comment list                     │
│  - Add comment input                │
├─────────────────────────────────────┤
│  🔘 Actions (Luôn)                 │
│  - Cancel / Save (hoặc Create)     │
└─────────────────────────────────────┘
```

---

## 🔧 Component Class - State Management

### 1. **Injected Services**

```typescript
projectsStore = inject(ProjectsStore);  // Lấy danh sách members
authStore = inject(AuthStore);          // Lấy current user
private fb = inject(FormBuilder);       // Tạo Reactive Form
issueService = inject(IssueService);    // CRUD operations
```

### 2. **State Variables**

```typescript
form!: FormGroup;              // Reactive Form chứa dữ liệu issue
comments: any[] = [];          // Danh sách comments
subtasks: Subtask[] = [];      // Danh sách subtasks
reporterId: string | null;     // ID người tạo issue
isEditing = false;             // Chế độ Edit hay Create
newCommentText = '';           // Input tạm cho comment mới
newSubtaskTitle = '';          // Input tạm cho subtask mới
```

---

## 🚀 Lifecycle & Initialization

### Constructor Flow:

```typescript
constructor(
  public dialogRef: MatDialogRef<IssueDialog>,
  @Inject(MAT_DIALOG_DATA) public data: IssueDialogData
) {
  this.initForm();  // 1. Khởi tạo form

  if (data.issue) {
    // 2a. EDIT MODE
    this.isEditing = true;
    this.form.patchValue({...});      // Load dữ liệu vào form
    this.reporterId = data.issue.reporterId;
    this.comments = data.issue.comments || [];
    this.subtasks = data.issue.subtasks || [];
  } else {
    // 2b. CREATE MODE
    this.form.patchValue({
      statusColumnId: data.statusColumnId || 'todo'
    });
  }
}
```

### `initForm()` - Khởi Tạo Reactive Form

```typescript
private initForm() {
  this.form = this.fb.group({
    title: ['', [Validators.required]],           // Bắt buộc
    description: [''],                             // Không bắt buộc
    type: ['task', [Validators.required]],        // Default: task
    priority: ['medium', [Validators.required]],  // Default: medium
    assigneeId: [null],                           // Default: unassigned
    statusColumnId: ['todo'],                     // Default: todo
    dueDate: [null],                              // Default: no due date
  });
}
```

**Lưu ý quan trọng:**

- `comments` và `subtasks` **KHÔNG** nằm trong form
- Chúng được quản lý riêng biệt và merge vào khi save

---

## 📝 Form Fields - Chi Tiết

### 1. **Title Field** (Required)

```html
<mat-form-field appearance="outline">
  <mat-label>Title</mat-label>
  <input matInput formControlName="title" required cdkFocusInitial />
  @if(form.get('title')?.invalid && form.get('title')?.touched) {
  <mat-error>Title is required</mat-error>
  }
</mat-form-field>
```

**Đặc điểm:**

- `cdkFocusInitial`: Auto-focus khi dialog mở
- Validation: Required
- Error message hiện khi touched và invalid

### 2. **Type & Priority** (Row Layout)

```html
<div class="row">
  <mat-form-field appearance="outline">
    <mat-label>Type</mat-label>
    <mat-select formControlName="type">
      <mat-option value="task">Task</mat-option>
      <mat-option value="bug">Bug</mat-option>
      <mat-option value="story">Story</mat-option>
    </mat-select>
  </mat-form-field>

  <mat-form-field appearance="outline">
    <mat-label>Priority</mat-label>
    <mat-select formControlName="priority">
      <mat-option value="low">Low</mat-option>
      <mat-option value="medium">Medium</mat-option>
      <mat-option value="high">High</mat-option>
    </mat-select>
  </mat-form-field>
</div>
```

**CSS `.row`:** Hiển thị 2 fields cạnh nhau (flex layout)

### 3. **Assignee Field** (Dynamic Options)

```html
<mat-select formControlName="assigneeId">
  <mat-option [value]="null">Unassigned</mat-option>
  @for (member of projectsStore.members(); track member.uid) {
  <mat-option [value]="member.uid"> {{ member.display Name }} </mat-option>
  }
</mat-select>
```

**Cách hoạt động:**

- Lấy danh sách members từ `ProjectsStore`
- Option đầu tiên: "Unassigned" (value = null)
- Loop qua members để tạo options

### 4. **Due Date Field** (Material Datepicker)

```html
<mat-form-field appearance="outline">
  <mat-label>Due Date</mat-label>
  <input matInput [matDatepicker]="picker" formControlName="dueDate" />
  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
  <mat-datepicker #picker></mat-datepicker>
</mat-form-field>
```

**Đặc điểm:**

- Material Datepicker với calendar popup
- Icon toggle để mở calendar
- Value: **Date object** (convert sang **ISO string** khi save)

**Tại sao cần convert?**

- **Datepicker** cần `Date Object` để hiển thị trên UI.
- **Firestore/API** cần `ISO String` (`"2026-01-15T00:00:00.000Z"`) để lưu trữ.
- Code xử lý: `dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : null`

---

## ✅ Subtasks Section

### 1. **Progress Bar**

```typescript
calculateProgress(): number {
  if (this.subtasks.length === 0) return 0;
  const completed = this.subtasks.filter((s) => s.completed).length;
  return (completed / this.subtasks.length) * 100;
}
```

```html
@if (subtasks.length > 0) {
<div class="progress-bar">
  <div class="progress-fill" [style.width.%]="calculateProgress()"></div>
</div>
}
```

**Hiển thị:** Thanh progress xanh dương, width = %  
 subtasks completed

### 2. **Subtask List**

```html
@for (s of subtasks; track s.id) {
<div class="subtask-item">
  <mat-checkbox [checked]="s.completed" (change)="toggleSubtask(s)">
    <span [class.completed-text]="s.completed">{{ s.title }}</span>
  </mat-checkbox>
  <button mat-icon-button (click)="deleteSubtask(s.id)">
    <mat-icon>close</mat-icon>
  </button>
</div>
}
```

**Features:**

- Checkbox để toggle completed/uncompleted
- Text có line-through khi completed
- Delete button (hiện khi hover)

### 3. **Add Subtask**

```typescript
addSubtask() {
  if (!this.newSubtaskTitle.trim()) return;

  const newSubtask: Subtask = {
    id: Math.random().toString(36).substr(2, 9),  // Random ID
    title: this.newSubtaskTitle,
    completed: false,
  };

  const updatedSubtasks = [...this.subtasks, newSubtask];

  if (this.isEditing && this.data.issue?.id) {
    // Edit mode: Update ngay lên Firestore
    this.issueService.updateIssue(this.data.issue.id, { subtasks: updatedSubtasks })
      .then(() => {
        this.subtasks = updatedSubtasks;
        this.newSubtaskTitle = '';
      });
  } else {
    // Create mode: Chỉ update local state
    this.subtasks = updatedSubtasks;
    this.newSubtaskTitle = '';
  }
}
```

**Điểm quan trọng:**

- **Edit mode**: Update ngay lên Firestore (real-time)
- **Create mode**: Chỉ lưu local, sẽ merge vào khi save issue

### 4. **Toggle Subtask**

```typescript
toggleSubtask(subtask: Subtask) {
  subtask.completed = !subtask.completed;
  const updatedSubtasks = this.subtasks.map((s) =>
    s.id === subtask.id ? subtask : s
  );

  if (this.isEditing && this.data.issue?.id) {
    this.issueService.updateIssue(this.data.issue.id, { subtasks: updatedSubtasks });
  } else {
    this.subtasks = updatedSubtasks;
  }
}
```

**Flow:**

1. Toggle `completed` flag
2. Tạo array mới (immutability)
3. Edit mode → Update Firestore ngay
4. Create mode → Update local state

---

## 💬 Comments Section (Edit Mode Only)

### 1. **Hiển Thị Điều Kiện**

```html
@if (isEditing) {
<div class="comments-section">
  <!-- Comments UI -->
</div>
}
```

**Lý do:** Comments chỉ có ý nghĩa với issues đã tồn tại

### 2. **Comment List**

```html
@for (comment of comments; track comment.id) {
<div class="comment-item">
  @if (getUser(comment.userId); as user) {
  <img [src]="user.photoURL || '...'" class="comment-avatar" />
  <div class="comment-content">
    <div class="comment-header">
      <span class="comment-author">{{ user.displayName }}</span>
      <span class="comment-date">{{ comment.createdAt | date : 'short' }}</span>

      <!-- Delete button (chỉ hiện nếu là comment của mình) -->
      @if (authStore.user()?.uid === comment.userId) {
      <button mat-icon-button (click)="deleteComment(comment.id)">
        <mat-icon>delete</mat-icon>
      </button>
      }
    </div>
    <div class="comment-text">{{ comment.content }}</div>
  </div>
  }
</div>
}
```

**Features:**

- Avatar + tên người comment
- Timestamp (format: 'short' - vd: 1/13/26, 3:00 PM)
- Delete button chỉ hiện với comment của mình
- `getUser()` helper để lấy thông tin user từ `projectsStore.members()`

### 3. **Add Comment**

```typescript
addComment() {
  if (!this.newCommentText.trim()) return;

  const user = this.authStore.user();
  if (!user) return;

  const newComment = {
    id: Math.random().toString(36).substr(2, 9),
    userId: user.uid,
    content: this.newCommentText,
    createdAt: new Date().toISOString(),
  };

  const updatedComments = [...this.comments, newComment];

  if (this.isEditing && this.data.issue?.id) {
    // Update ngay lên Firestore
    this.issueService.updateIssue(this.data.issue.id, { comments: updatedComments })
      .then(() => {
        this.comments = updatedComments;
        this.newCommentText = '';
      })
      .catch((error) => {
        console.error('Error saving comment:', error);
      });
  } else {
    // Fallback (không nên xảy ra vì comments chỉ có trong Edit mode)
    this.comments = updatedComments;
    this.newCommentText = '';
  }
}
```

**Flow:**

1. Validate input không rỗng
2. Lấy current user
3. Tạo comment object với random ID
4. Update lên Firestore ngay lập tức
5. Clear input sau khi thành công

### 4. **Delete Comment**

```typescript
deleteComment(commentId: string) {
  if (!confirm('Are you sure you want to delete this comment?')) return;

  const updatedComments = this.comments.filter((c) => c.id !== commentId);

  if (this.isEditing && this.data.issue?.id) {
    this.issueService.updateIssue(this.data.issue.id, { comments: updatedComments })
      .then(() => {
        this.comments = updatedComments;
      });
  }
}
```

**Security:** Chỉ hiện delete button cho comments của mình (check trong template)

---

## 💾 Save Method - Trung Tâm Logic

```typescript
save() {
  if (this.form.invalid) return;  // Validate form

  const formValue = this.form.getRawValue();  // Lấy tất cả values (kể cả disabled)

  const result: any = {
    ...formValue,
    dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : null,
  };

  if (!this.isEditing) {
    // CREATE MODE: Merge comments & subtasks vào result
    result.comments = this.comments;
    result.subtasks = this.subtasks;

    // Set reporterId = current user
    const currentUser = this.authStore.user();
    if (currentUser) {
      result.reporterId = currentUser.uid;
    }
  }

  this.dialogRef.close(result);  // Đóng dialog và trả về result
}
```

### Phân Tích Chi Tiết:

#### 1. **Validation**

```typescript
if (this.form.invalid) return;
```

- Kiểm tra form có valid không (title required)
- Nếu invalid → return ngay, không save

#### 2. **Get Form Values**

```typescript
const formValue = this.form.getRawValue();
```

- `getRawValue()` vs `value`:
  - `value`: Chỉ lấy enabled fields
  - `getRawValue()`: Lấy tất cả fields (kể cả disabled)

#### 3. **Transform Due Date**

```typescript
dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : null;
```

- Form lưu `Date` object
- Firestore cần `string` (ISO format)
- Ví dụ: `2026-01-15T00:00:00.000Z`

#### 4. **Create Mode - Merge Extra Data**

```typescript
if (!this.isEditing) {
  result.comments = this.comments;
  result.subtasks = this.subtasks;
  result.reporterId = currentUser.uid;
}
```

**Tại sao chỉ merge khi Create?**

- **Edit mode**: Comments & Subtasks đã được update real-time lên Firestore
- **Create mode**: Chưa có issue ID → chưa thể update → phải merge tất cả vào lúc tạo

#### 5. **Close Dialog**

```typescript
this.dialogRef.close(result);
```

- Đóng dialog
- Trả về `result` cho component gọi dialog
- Component gọi sẽ nhận `result` trong `afterClosed().subscribe()`

---

## 🔄 Data Flow - Create vs Edit Mode

### CREATE MODE Flow:

```
1. User mở dialog (không có issue)
   ↓
2. Form khởi tạo với default values
   ↓
3. User nhập thông tin, thêm subtasks/comments (local)
   ↓
4. User click "Create"
   ↓
5. save() merge tất cả data vào result
   ↓
6. Dialog close, trả về result
   ↓
7. Component gọi nhận result
   ↓
8. Gọi boardStore.addIssue(result)
   ↓
9. IssueService.addIssue() tạo issue mới trong Firestore
   ↓
10. Real-time listener tự động update UI
```

### EDIT MODE Flow:

```
1. User mở dialog (có issue)
   ↓
2. Form load dữ liệu từ issue
   ↓
3. User chỉnh sửa form
   ↓
4. User thêm/xóa/toggle subtasks
   → Update NGAY lên Firestore (real-time)
   ↓
5. User thêm/xóa comments
   → Update NGAY lên Firestore (real-time)
   ↓
6. User click "Save"
   ↓
7. save() chỉ trả về form values (không merge subtasks/comments)
   ↓
8. Dialog close, trả về result
   ↓
9. Component gọi nhận result
   ↓
10. Gọi boardStore.updateIssue(issueId, result)
   ↓
11. IssueService.updateIssue() cập nhật Firestore
```

**Điểm khác biệt quan trọng:**

- **Create**: Tất cả data merge vào 1 lần khi save
- **Edit**: Subtasks/Comments update real-time, form fields update khi save

---

## 🎨 UI/UX Features

### 1. **Reporter Display (Edit Mode Only)**

```html
@if (isEditing && reporterId; as rid) { @if (getUser(rid); as reporter) {
<div class="reporter-info">
  <span class="label">Reporter:</span>
  <div class="reporter-chip">
    <img [src]="reporter.photoURL || '...'" class="reporter-avatar" />
    {{ reporter.displayName }}
  </div>
</div>
} }
```

**Hiển thị:** Chip với avatar + tên người tạo issue (chỉ trong Edit mode)

### 2. **Hover Effects**

```css
.delete-subtask-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.subtask-item:hover .delete-subtask-btn {
  opacity: 1;
}
```

**UX:** Delete buttons ẩn mặc định, chỉ hiện khi hover

### 3. **Responsive Layout**

```css
.dialog-content {
  max-height: 80vh;
  overflow-y: auto;
}
```

**Adaptive:** Dialog scroll nếu nội dung quá dài (nhiều comments/subtasks)

### 4. **Focus Management**

```html
<input matInput formControlName="title" cdkFocusInitial />
```

**UX:** Auto-focus vào Title field khi dialog mở

---

## 🔑 Helper Methods

### 1. **getUser(userId: string)**

```typescript
getUser(userId: string) {
  return this.projectsStore.members().find((m) => m.uid === userId);
}
```

**Mục đích:** Lấy thông tin user (displayName, photoURL) từ userId

**Sử dụng:**

- Hiển thị reporter
- Hiển thị comment author
- Hiển thị assignee (trong select options)

---

## ⚡ Performance Optimizations

### 1. **Immutability**

```typescript
const updatedSubtasks = [...this.subtasks, newSubtask]; // Tạo array mới
```

**Lợi ích:** Giúp Angular change detection hoạt động hiệu quả

### 2. **Track By**

```html
@for (s of subtasks; track s.id) @for (comment of comments; track comment.id)
```

**Lợi ích:** Angular chỉ re-render items thay đổi, không re-render toàn bộ list

### 3. **Conditional Rendering**

```html
@if (isEditing) {
<div class="comments-section">...</div>
}
```

**Lợi ích:** Không render Comments section trong Create mode → giảm DOM nodes

---

## 🎯 Best Practices Được Áp Dụng

### 1. **Reactive Forms**

- ✅ Type-safe với FormBuilder
- ✅ Built-in validation
- ✅ Easy to test

### 2. **Separation of Concerns**

- ✅ Template: UI logic
- ✅ Component: Business logic
- ✅ Service: Data access

### 3. **Real-time Updates (Edit Mode)**

- ✅ Subtasks/Comments update ngay lên Firestore
- ✅ Không cần đợi user click "Save"
- ✅ Tránh mất data nếu user đóng dialog đột ngột

### 4. **User Experience**

- ✅ Auto-focus vào Title
- ✅ Validation errors rõ ràng
- ✅ Confirm trước khi delete
- ✅ Disable buttons khi invalid

### 5. **Security**

- ✅ Chỉ hiện delete comment button cho owner
- ✅ Validate input trước khi save
- ✅ Set reporterId = current user (không cho user fake)

---

## 🚀 Tóm Tắt

`IssueDialog` là một **complex, feature-rich component** với:

✅ **Dual-mode operation** (Create/Edit)  
✅ **Reactive Forms** với validation  
✅ **Real-time updates** cho Subtasks & Comments (Edit mode)  
✅ **Rich UI** với Material Design  
✅ **Optimized performance** với track by & immutability  
✅ **Excellent UX** với auto-focus, hover effects, progress bar

Component này là **trung tâm** của issue management trong ứng dụng Jira Clone! 🎉
