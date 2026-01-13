# Giải Thích Chi Tiết: IssueService

## 📋 Tổng Quan

`IssueService` là một Angular service quản lý tất cả các thao tác liên quan đến **Issues** (tasks/công việc) trong ứng dụng Jira Clone. Service này tương tác trực tiếp với **Firebase Firestore** để thực hiện các thao tác CRUD (Create, Read, Update, Delete) và các chức năng đặc biệt khác.

---

## 🏗️ Cấu Trúc & Dependencies

### 1. **Imports & Injections**

```typescript
@Injectable({ providedIn: 'root' })
export class IssueService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private issuesCollection = collection(this.firestore, 'issues');
}
```

#### Giải thích:

- **`@Injectable({ providedIn: 'root' })`**: Service được đăng ký ở root level, có nghĩa là nó là **singleton** - chỉ có 1 instance duy nhất trong toàn bộ ứng dụng.
- **`firestore`**: Instance của Firebase Firestore để tương tác với database.
- **`injector`**: Angular Injector được sử dụng để chạy code trong injection context (cần thiết cho `collectionData`).
- **`issuesCollection`**: Reference đến collection 'issues' trong Firestore.

---

## 📖 Chi Tiết Các Methods

### 1. **getIssues(projectId: string)** - Lấy tất cả issues của một project

```typescript
getIssues(projectId: string): Observable<Issue[]> {
  const q = query(this.issuesCollection, where('projectId', '==', projectId));
  return runInInjectionContext(
    this.injector,
    () => collectionData(q, { idField: 'id' }) as Observable<Issue[]>
  );
}
```

#### 🔍 Cách hoạt động:

1. **Tạo query**: Lọc các issues có `projectId` khớp với tham số đầu vào.
2. **`collectionData()`**: Hàm từ `@angular/fire/firestore` tự động:
   - Subscribe vào Firestore collection
   - Lắng nghe **real-time updates** (khi có thay đổi trong DB, Observable sẽ emit giá trị mới)
   - Tự động map document ID vào field `id` của mỗi issue
3. **`runInInjectionContext()`**: Đảm bảo `collectionData` chạy trong Angular injection context (cần thiết cho dependency injection).

#### � Giải thích chi tiết về "Tự động map document ID vào field `id`":

Trong Firestore, mỗi document có 2 phần:

- **Document ID**: Một unique identifier được Firestore tự động tạo (hoặc bạn tự đặt)
- **Document Data**: Các fields bạn lưu trong document

**Vấn đề:** Document ID **KHÔNG** được lưu trong document data mặc định!

##### 🔴 Cấu trúc trong Firestore:

```
Collection: issues
├── Document ID: "abc123xyz"  ← ID này KHÔNG nằm trong data
│   └── Data: {
│         title: "Fix login bug",
│         projectId: "proj-1",
│         status: "TODO",
│         // Chú ý: KHÔNG có field "id" ở đây!
│       }
│
├── Document ID: "def456uvw"
    └── Data: {
          title: "Add dark mode",
          projectId: "proj-1",
          status: "IN_PROGRESS"
        }
```

##### ✅ Khi sử dụng `collectionData(q, { idField: 'id' })`:

Hàm này tự động **merge** Document ID vào data object:

```typescript
// Firestore trả về:
{
  documentId: "abc123xyz",  // Metadata
  data: {
    title: "Fix login bug",
    projectId: "proj-1",
    status: "TODO"
  }
}

// collectionData() tự động transform thành:
{
  id: "abc123xyz",  // ← Document ID được thêm vào đây!
  title: "Fix login bug",
  projectId: "proj-1",
  status: "TODO"
}
```

##### 🎯 Tại sao cần `{ idField: 'id' }`?

- **Không có option này**: Bạn sẽ chỉ nhận được data, KHÔNG có ID → không thể update/delete issue!
- **Có option này**: Document ID được tự động thêm vào field `id` → dễ dàng sử dụng trong UI và các operations.

##### 💻 So sánh code:

**❌ KHÔNG dùng `idField`:**

```typescript
collectionData(q)[ // Không có { idField: 'id' }
  // Kết quả:
  ({ title: 'Fix login bug', projectId: 'proj-1', status: 'TODO' },
  { title: 'Add dark mode', projectId: 'proj-1', status: 'IN_PROGRESS' })
];
// ⚠️ Không có ID → Không thể update/delete!
```

**✅ CÓ dùng `idField`:**

```typescript
collectionData(q, { idField: 'id' })[
  // Kết quả:
  ({ id: 'abc123xyz', title: 'Fix login bug', projectId: 'proj-1', status: 'TODO' },
  { id: 'def456uvw', title: 'Add dark mode', projectId: 'proj-1', status: 'IN_PROGRESS' })
];
// ✅ Có ID → Có thể update/delete dễ dàng!
```

##### 🚀 Ứng dụng thực tế:

```typescript
// Trong component/store, bạn có thể dùng ID ngay:
issues.forEach((issue) => {
  console.log(issue.id); // "abc123xyz"

  // Update issue:
  this.issueService.updateIssue(issue.id, { status: 'DONE' });

  // Delete issue:
  this.issueService.deleteIssue(issue.id);

  // Hiển thị trong template:
  // <div *ngFor="let issue of issues" [attr.data-id]="issue.id">
});
```

**Tóm lại:** `{ idField: 'id' }` giúp bạn không cần phải manually extract document ID, mọi thứ đã được tự động hóa!

#### �💡 Ứng dụng:

- Sử dụng trong **Board** và **Backlog** để hiển thị danh sách issues của project.
- Tự động cập nhật UI khi có issue mới được tạo/sửa/xóa.

---

### 2. **getMyIssues(userId: string)** - Lấy issues được assign cho user

```typescript
getMyIssues(userId: string): Observable<Issue[]> {
  const q = query(this.issuesCollection, where('assigneeId', '==', userId));
  return runInInjectionContext(
    this.injector,
    () => collectionData(q, { idField: 'id' }) as Observable<Issue[]>
  );
}
```

#### 🔍 Cách hoạt động:

- Tương tự `getIssues()` nhưng lọc theo `assigneeId` thay vì `projectId`.
- Trả về **Observable** real-time của tất cả issues được assign cho user cụ thể.

#### 💡 Ứng dụng:

- Sử dụng trong trang **"My Tasks"** để hiển thị danh sách công việc của user hiện tại.
- Tự động cập nhật khi user được assign/unassign từ issues.

---

### 3. **addIssue(issue: Partial<Issue>)** - Tạo issue mới

```typescript
addIssue(issue: Partial<Issue>) {
  return addDoc(this.issuesCollection, issue);
}
```

#### 🔍 Cách hoạt động:

1. **`Partial<Issue>`**: Cho phép truyền vào một phần của Issue object (không cần đầy đủ tất cả fields).
2. **`addDoc()`**: Hàm Firestore thêm document mới vào collection.
3. **Auto-generate ID**: Firestore tự động tạo unique ID cho issue mới.

#### 💡 Ứng dụng:

- Được gọi khi user tạo issue mới từ **Issue Dialog** hoặc **Quick Add**.
- Trả về Promise với **DocumentReference** (chứa ID của issue mới).

#### 📌 Giải thích chi tiết về "Promise với DocumentReference":

##### 🔍 DocumentReference là gì?

`addDoc()` trả về một **Promise** chứa **DocumentReference** - một object đại diện cho document vừa được tạo trong Firestore.

**DocumentReference** chứa:

- ✅ **`id`**: ID của document mới (auto-generated bởi Firestore)
- ✅ **`path`**: Đường dẫn đầy đủ đến document (vd: `"issues/abc123xyz"`)
- ✅ **`parent`**: Reference đến collection chứa document này
- ✅ Các methods: `get()`, `update()`, `delete()`, v.v.

##### 🎯 Ví dụ thực tế trong ứng dụng:

**Trong IssueDialog khi tạo issue mới:**

```typescript
async saveIssue() {
  if (this.isEditMode) {
    // Update existing issue
    await this.issueService.updateIssue(this.issueId, this.issueData);
  } else {
    // Create new issue
    const docRef = await this.issueService.addIssue(this.issueData);

    // Lấy ID của issue mới tạo
    const newIssueId = docRef.id;

    // Có thể dùng ID này để:
    // 1. Navigate đến issue detail page
    this.router.navigate(['/issue', newIssueId]);

    // 2. Hoặc log activity
    await this.activityService.logActivity({
      action: 'ISSUE_CREATED',
      issueId: newIssueId,
      userId: this.currentUser.id
    });

    // 3. Hoặc gửi notification
    await this.notificationService.notifyAssignee(newIssueId);
  }

  this.dialogRef.close();
}
```

##### ⚡ Tại sao cần DocumentReference?

1. **Lấy ID ngay sau khi tạo**: Không cần query lại DB để biết ID của document mới.
2. **Thực hiện operations tiếp theo**: Update, delete, hoặc tạo sub-collections.
3. **Linking data**: Tạo relationships giữa các documents.

##### 🔄 Flow hoàn chỉnh:

```
User clicks "Create Issue"
         ↓
Component gọi addIssue(issueData)
         ↓
Firestore tạo document mới với auto-generated ID
         ↓
addDoc() trả về Promise<DocumentReference>
         ↓
Component nhận DocumentReference
         ↓
Lấy docRef.id để sử dụng
         ↓
Navigate/Log/Notify với ID mới
```

**Tóm lại:** DocumentReference giúp bạn biết ngay ID của document vừa tạo mà không cần query lại database!

---

### 4. **updateIssue(id: string, data: Partial<Issue>)** - Cập nhật issue

```typescript
updateIssue(id: string, data: Partial<Issue>) {
  const docRef = doc(this.firestore, 'issues', id);
  return updateDoc(docRef, data);
}
```

#### 🔍 Cách hoạt động:

1. **`doc()`**: Tạo reference đến document cụ thể trong collection 'issues'.
2. **`updateDoc()`**: Cập nhật các fields được chỉ định trong `data`.
3. **Partial update**: Chỉ cập nhật các fields có trong `data`, không ảnh hưởng đến fields khác.

#### 💡 Ứng dụng:

- Cập nhật thông tin issue (title, description, status, priority, assignee, v.v.).
- Sử dụng trong **Issue Dialog** khi user edit issue.

---

### 5. **deleteIssue(id: string)** - Xóa issue

```typescript
deleteIssue(id: string) {
  const docRef = doc(this.firestore, 'issues', id);
  return deleteDoc(docRef);
}
```

#### 🔍 Cách hoạt động:

- **`deleteDoc()`**: Xóa hoàn toàn document khỏi Firestore.
- Thao tác này **không thể hoàn tác**.

#### 💡 Ứng dụng:

- Xóa issue từ **Issue Dialog** hoặc context menu.

---

### 6. **batchUpdateIssues()** - Cập nhật nhiều issues cùng lúc

```typescript
async batchUpdateIssues(updates: { id: string; data: Partial<Issue> }[]) {
  const batch = writeBatch(this.firestore);
  updates.forEach(({ id, data }) => {
    const docRef = doc(this.firestore, 'issues', id);
    batch.update(docRef, data);
  });
  return batch.commit();
}
```

#### 🔍 Cách hoạt động:

1. **`writeBatch()`**: Tạo batch operation - cho phép thực hiện nhiều thao tác write trong 1 transaction.
2. **Loop qua updates**: Thêm từng update operation vào batch.
3. **`batch.commit()`**: Thực thi tất cả operations cùng lúc.

#### ⚡ Ưu điểm của Batch:

- **Atomic**: Tất cả operations thành công hoặc tất cả thất bại (không có trạng thái giữa chừng).
- **Performance**: Giảm số lượng network requests (1 request thay vì N requests).
- **Cost-effective**: Firestore tính phí theo số lượng operations, batch giúp tiết kiệm.

#### 💡 Ứng dụng:

- Cập nhật `position` của nhiều issues khi **drag & drop** trong Kanban board.
- Cập nhật status của nhiều issues cùng lúc.

---

### 7. **moveToBacklog(issueId: string)** - Chuyển issue về Backlog

```typescript
moveToBacklog(issueId: string) {
  return this.updateIssue(issueId, { isInBacklog: true });
}
```

#### 🔍 Cách hoạt động:

- Wrapper method gọi `updateIssue()` với `isInBacklog: true`.
- Đơn giản hóa code khi cần chuyển issue về backlog.

#### 💡 Ứng dụng:

- Khi user kéo issue từ **Board** về **Backlog**.

---

### 8. **moveToBoard(issueId: string)** - Chuyển issue lên Board

```typescript
moveToBoard(issueId: string) {
  return this.updateIssue(issueId, { isInBacklog: false });
}
```

#### 🔍 Cách hoạt động:

- Wrapper method gọi `updateIssue()` với `isInBacklog: false`.

#### 💡 Ứng dụng:

- Khi user kéo issue từ **Backlog** lên **Board**.

---

### 9. **deleteIssuesByProjectId(projectId: string)** - Xóa tất cả issues của project

```typescript
async deleteIssuesByProjectId(projectId: string) {
  const q = query(this.issuesCollection, where('projectId', '==', projectId));
  const snapshot = await getDocs(q);
  const batch = writeBatch(this.firestore);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  return batch.commit();
}
```

#### 🔍 Cách hoạt động:

1. **Query**: Lấy tất cả issues của project.
2. **`getDocs()`**: Thực thi query và lấy snapshot (không real-time, chỉ lấy 1 lần).
3. **Batch delete**: Xóa tất cả issues trong 1 batch operation.

#### ⚠️ Lưu ý:

- Method này **async** vì cần đợi `getDocs()` hoàn thành.
- Sử dụng batch để đảm bảo tính atomic và performance.

#### 💡 Ứng dụng:

- Được gọi khi **xóa project** - cần cleanup tất cả issues liên quan.

---

### 10. **unassignUserFromProjectIssues()** - Bỏ assign user khỏi tất cả issues

```typescript
async unassignUserFromProjectIssues(projectId: string, userId: string) {
  const q = query(
    this.issuesCollection,
    where('projectId', '==', projectId),
    where('assigneeId', '==', userId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const updates = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: { assigneeId: null as any },
  }));
  return this.batchUpdateIssues(updates);
}
```

#### 🔍 Cách hoạt động:

1. **Composite query**: Lọc issues theo cả `projectId` VÀ `assigneeId`.
2. **Early return**: Nếu không có issues nào, return ngay (tối ưu performance).
3. **Map to updates**: Tạo array các update objects với `assigneeId: null`.
4. **Batch update**: Sử dụng `batchUpdateIssues()` để cập nhật tất cả cùng lúc.

#### 💡 Ứng dụng:

- Khi **remove user khỏi project** - cần unassign user khỏi tất cả issues của họ trong project đó.
- Đảm bảo data integrity (không có orphaned assignees).

---

## 🔄 Real-time Updates Flow

### Cách hoạt động của Real-time Sync:

```
1. Component subscribe vào getIssues(projectId)
   ↓
2. collectionData() tạo Firestore listener
   ↓
3. Khi có thay đổi trong DB:
   - Issue mới được tạo
   - Issue được update
   - Issue được xóa
   ↓
4. Firestore tự động push update
   ↓
5. Observable emit giá trị mới
   ↓
6. Component nhận data mới và update UI
```

### Ví dụ trong BoardStore:

```typescript
// BoardStore tự động nhận updates
loadIssues = rxMethod<string>(
  pipe(
    switchMap((projectId) =>
      this.issueService.getIssues(projectId).pipe(
        tapResponse(
          (issues) => this.patchState({ issues }),
          (error) => console.error(error)
        )
      )
    )
  )
);
```

---

## 🎯 Best Practices Được Áp Dụng

### 1. **Separation of Concerns**

- Service chỉ lo logic tương tác với Firestore.
- Không chứa business logic phức tạp (để trong Store).
- Không chứa UI logic (để trong Components).

### 2. **Type Safety**

- Sử dụng `Partial<Issue>` cho flexibility.
- Type casting `as Observable<Issue[]>` đảm bảo type safety.

### 3. **Performance Optimization**

- Sử dụng **batch operations** cho multiple updates.
- **Early return** trong `unassignUserFromProjectIssues()`.
- **Real-time listeners** thay vì polling.

### 4. **Error Handling**

- Tất cả methods trả về Promise/Observable.
- Caller (Store) chịu trách nhiệm handle errors.

### 5. **Reusability**

- Wrapper methods (`moveToBacklog`, `moveToBoard`) giúp code dễ đọc.
- Generic methods (`updateIssue`, `batchUpdateIssues`) có thể tái sử dụng.

---

## 📊 Data Flow Diagram

```
┌─────────────────┐
│   Components    │
│  (Board, etc)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   BoardStore    │
│  (State Mgmt)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  IssueService   │ ← You are here
│ (Data Access)   │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    Firestore    │
│   (Database)    │
└─────────────────┘
```

---

## 🚀 Tóm Tắt

`IssueService` là **Data Access Layer** của ứng dụng, cung cấp:

✅ **CRUD operations** đầy đủ cho Issues  
✅ **Real-time synchronization** với Firestore  
✅ **Batch operations** cho performance  
✅ **Specialized methods** cho business logic (move to backlog/board, cleanup, etc.)  
✅ **Type-safe** và **reusable** APIs

Service này là nền tảng cho tất cả các tính năng liên quan đến Issues trong ứng dụng Jira Clone!
