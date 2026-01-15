# My Tasks Feature - Deep Dive

> **Mục đích tài liệu**: Giải thích chi tiết cách hoạt động của tính năng "My Tasks" (Công việc của tôi), bao gồm Store, Component, và luồng dữ liệu từ Firestore đến UI.

---

## 📋 MỤC LỤC

1. [Tổng quan](#-tổng-quan)
2. [Kiến trúc](#-kiến-trúc)
3. [MyTasksStore - State Management](#-mytasksstore---state-management)
4. [MyTasks Component - UI Layer](#-mytasks-component---ui-layer)
5. [Luồng dữ liệu hoàn chỉnh](#-luồng-dữ-liệu-hoàn-chỉnh)
6. [So sánh với BoardStore](#-so-sánh-với-boardstore)
7. [Key Takeaways](#-key-takeaways)

---

## 🎯 TỔNG QUAN

### Chức năng

Trang "My Tasks" hiển thị **tất cả các Issues được giao cho người dùng hiện tại** (assigneeId = currentUser.uid) dưới dạng bảng (Table), bất kể chúng thuộc Project nào.

### Đặc điểm nổi bật

- ✅ **Real-time**: Tự động cập nhật khi có thay đổi trên Firestore
- ✅ **Reactive**: Sử dụng NgRx Signal Store
- ✅ **Auto-load**: Tự động tải dữ liệu khi user đăng nhập
- ✅ **Cross-project**: Hiển thị tasks từ nhiều dự án khác nhau

---

## 🏗️ KIẾN TRÚC

```
┌─────────────────────────────────────────────────────────┐
│                    MyTasks Component                     │
│  (UI: MatTable, Status Badges, Priority Icons)          │
└──────────────────────┬──────────────────────────────────┘
                       │ inject(MyTasksStore)
                       ↓
┌─────────────────────────────────────────────────────────┐
│                   MyTasksStore                           │
│  State: { issues: Issue[], loading: boolean }           │
│  Methods: loadMyIssues(userId)                           │
└──────────────────────┬──────────────────────────────────┘
                       │ inject(IssueService)
                       ↓
┌─────────────────────────────────────────────────────────┐
│                   IssueService                           │
│  getMyIssues(userId): Observable<Issue[]>                │
│  → query(where('assigneeId', '==', userId))             │
└──────────────────────┬──────────────────────────────────┘
                       │ collectionData()
                       ↓
┌─────────────────────────────────────────────────────────┐
│                    Firestore                             │
│  Collection: 'issues'                                    │
│  Filter: assigneeId == currentUser.uid                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🗄️ MYTASKSSTORE - STATE MANAGEMENT

### File: `my-tasks.store.ts`

### 1. State Definition

```typescript
type MyTasksState = {
  issues: Issue[]; // Danh sách công việc được giao cho user
  loading: boolean; // Trạng thái đang tải
};

const initialState: MyTasksState = {
  issues: [],
  loading: false,
};
```

**Giải thích**:

- `issues`: Mảng chứa tất cả Issues mà user hiện tại là assignee
- `loading`: Boolean flag để hiển thị spinner/loading state

---

### 2. Store Creation

```typescript
export const MyTasksStore = signalStore(
  { providedIn: 'root' },  // Singleton service
  withState(initialState),
  withMethods(...),
  withHooks(...)
);
```

**Các tính năng được tích hợp**:

- `providedIn: 'root'`: Store là singleton, dùng chung toàn app
- `withState`: Khởi tạo state ban đầu
- `withMethods`: Định nghĩa các phương thức
- `withHooks`: Lifecycle hooks (onInit)

---

### 3. Method: loadMyIssues

```typescript
loadMyIssues: rxMethod<string | null>(
  pipe(
    tap(() => console.log('Loading my issues...')),
    tap(() => patchState(store, { loading: true })),
    switchMap((userId) => {
      if (!userId) {
        patchState(store, { issues: [], loading: false });
        return [];
      }
      console.log('Querying for userId:', userId);
      return issueService.getMyIssues(userId);
    }),
    tap((issues) => {
      console.log('Issues found:', issues);
      patchState(store, { issues, loading: false });
    })
  )
);
```

#### Phân tích từng bước:

**Bước 1: Bật loading state**

```typescript
tap(() => patchState(store, { loading: true }));
```

- Đặt `loading = true` để UI hiển thị spinner

**Bước 2: Kiểm tra userId**

```typescript
switchMap((userId) => {
  if (!userId) {
    patchState(store, { issues: [], loading: false });
    return [];
  }
  // ...
});
```

- Nếu không có userId (user chưa đăng nhập): Xóa danh sách issues, tắt loading
- `switchMap`: Hủy Observable cũ nếu có request mới (tránh race condition)

**Bước 3: Gọi Service**

```typescript
return issueService.getMyIssues(userId);
```

- Gọi `IssueService.getMyIssues()` để query Firestore
- Trả về Observable<Issue[]>

**Bước 4: Cập nhật State**

```typescript
tap((issues) => {
  console.log('Issues found:', issues);
  patchState(store, { issues, loading: false });
});
```

- Nhận danh sách issues từ Firestore
- Cập nhật vào state
- Tắt loading

---

### 4. Auto-load với withHooks

```typescript
withHooks({
  onInit(store) {
    const authStore = inject(AuthStore);
    effect(() => {
      const user = authStore.user();
      store.loadMyIssues(user ? user.uid : null);
    });
  },
});
```

**Cơ chế hoạt động**:

1. **onInit**: Chạy khi Store được khởi tạo lần đầu
2. **effect()**: Tạo một "reactive effect" (tự động chạy lại khi dependencies thay đổi)
3. **authStore.user()**: Đọc Signal từ AuthStore
4. **Kích hoạt tự động**: Mỗi khi `authStore.user()` thay đổi (login/logout), effect sẽ chạy lại

**Kịch bản thực tế**:

```
User đăng nhập → authStore.user() thay đổi từ null → User object
                ↓
        effect() phát hiện thay đổi
                ↓
        Gọi store.loadMyIssues(user.uid)
                ↓
        Query Firestore → Cập nhật UI
```

---

## 🎨 MYTASKS COMPONENT - UI LAYER

### File: `my-tasks.ts`

### 1. Component Setup

```typescript
@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSelectModule,
    // ...
  ],
  template: `...`,
  styles: [`...`],
})
export class MyTasks {
  store = inject(MyTasksStore);
  authStore = inject(AuthStore);
  projectsStore = inject(ProjectsStore);

  displayedColumns: string[] = ['title', 'projectId', 'priority', 'status', 'dueDate'];
}
```

**Dependency Injection**:

- `MyTasksStore`: Lấy danh sách issues
- `AuthStore`: Lấy thông tin user hiện tại (nếu cần)
- `ProjectsStore`: Tra cứu tên Project từ projectId

---

### 2. Template - MatTable

```html
<table mat-table [dataSource]="store.issues()" class="tasks-table">
  <!-- Columns definition -->
  <ng-container matColumnDef="status">
    <th mat-header-cell *matHeaderCellDef>Status</th>
    <td mat-cell *matCellDef="let issue">
      <span class="status-badge" [ngClass]="issue.statusColumnId">
        {{ formatStatus(issue.statusColumnId) }}
      </span>
    </td>
  </ng-container>

  <!-- Priority, Title, Project, Due Date columns... -->

  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>

  <!-- Empty state -->
  <tr class="mat-row" *matNoDataRow>
    <td class="mat-cell" colspan="5" style="text-align:center;">No tasks found assigned to you.</td>
  </tr>
</table>
```

**Cách hoạt động**:

- `[dataSource]="store.issues()"`: Đọc Signal từ Store
- Khi `store.issues()` thay đổi → Angular tự động re-render table
- `*matNoDataRow`: Hiển thị message khi không có dữ liệu

---

### 3. Helper Methods

#### getProjectName()

```typescript
getProjectName(projectId: string): string {
  const project = this.projectsStore.projects().find((p) => p.id === projectId);
  return project ? project.name : 'Unknown Project';
}
```

**Mục đích**: Chuyển đổi `projectId` (string) thành tên Project dễ đọc.

**Cách hoạt động**:

1. Tìm project trong `projectsStore.projects()` (Signal)
2. Trả về `project.name` hoặc 'Unknown Project' nếu không tìm thấy

---

#### getPriorityIcon() & getPriorityColor()

```typescript
getPriorityIcon(priority: string) {
  switch (priority) {
    case 'high':   return 'arrow_upward';
    case 'medium': return 'remove';
    case 'low':    return 'arrow_downward';
    default:       return 'remove';
  }
}

getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':   return '#de350b'; // Red
    case 'medium': return '#ff9900'; // Orange
    case 'low':    return '#0065ff'; // Blue
    default:       return '#172b4d';
  }
}
```

**Mục đích**: Hiển thị icon và màu sắc tương ứng với mức độ ưu tiên.

---

#### formatStatus()

```typescript
formatStatus(statusId: string): string {
  switch (statusId) {
    case 'todo':        return 'TODO';
    case 'in-progress': return 'IN PROGRESS';
    case 'done':        return 'DONE';
    default:            return statusId.toUpperCase();
  }
}
```

**Mục đích**: Chuyển đổi status ID thành text hiển thị.

---

### 4. Styling - Status Badges

```css
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge.todo {
  background: #dfe1e6;
  color: #42526e;
}

.status-badge.in-progress {
  background: #deebff;
  color: #0052cc;
}

.status-badge.done {
  background: #e3fcef;
  color: #006644;
}
```

**Cơ chế**:

- `[ngClass]="issue.statusColumnId"`: Gắn class động (todo/in-progress/done)
- CSS selector `.status-badge.todo` → Áp dụng màu tương ứng

---

## 🔄 LUỒNG DỮ LIỆU HOÀN CHỈNH

### Scenario: User đăng nhập và mở trang My Tasks

```
1. User đăng nhập
   ↓
2. AuthStore.user() thay đổi từ null → User object
   ↓
3. MyTasksStore.onInit() → effect() phát hiện thay đổi
   ↓
4. Gọi store.loadMyIssues(user.uid)
   ↓
5. rxMethod pipeline bắt đầu:
   - Bật loading = true
   - Gọi issueService.getMyIssues(userId)
   ↓
6. IssueService.getMyIssues() thực thi:
   const q = query(issuesCollection, where('assigneeId', '==', userId));
   return collectionData(q, { idField: 'id' });
   ↓
7. Firestore trả về Observable<Issue[]>
   ↓
8. rxMethod nhận dữ liệu:
   - patchState(store, { issues, loading: false })
   ↓
9. MyTasks Component đọc store.issues() (Signal)
   ↓
10. Angular re-render MatTable
    ↓
11. UI hiển thị danh sách tasks
```

---

### Real-time Update Flow

```
User A tạo Issue mới và assign cho User B
         ↓
Firestore nhận document mới (assigneeId = User B)
         ↓
collectionData() Observable emit event mới
         ↓
rxMethod tap() nhận danh sách issues mới
         ↓
patchState() cập nhật store.issues
         ↓
Signal thay đổi → Angular re-render
         ↓
User B thấy task mới xuất hiện ngay lập tức (không cần refresh)
```

---

## 🆚 SO SÁNH VỚI BOARDSTORE

| Aspect               | MyTasksStore                 | BoardStore                               |
| -------------------- | ---------------------------- | ---------------------------------------- |
| **Query Filter**     | `assigneeId == userId`       | `projectId == selectedProjectId`         |
| **Scope**            | Cross-project (tất cả dự án) | Single project                           |
| **UI**               | MatTable (danh sách)         | Kanban Board (cột)                       |
| **Computed Signals** | Không có                     | todoIssues, inProgressIssues, doneIssues |
| **Filtering**        | Không có (hiển thị tất cả)   | Có (search, onlyMyIssues, priority...)   |
| **Auto-load**        | ✅ Khi user đăng nhập        | ✅ Khi chọn project                      |
| **Loading State**    | ✅ Có                        | ✅ Có (withLoadingError feature)         |

---

## 🎯 KEY TAKEAWAYS

### 1. **Reactive Architecture**

```typescript
effect(() => {
  const user = authStore.user();
  store.loadMyIssues(user ? user.uid : null);
});
```

- Sử dụng `effect()` để tự động phản ứng với thay đổi của `authStore.user()`
- Không cần gọi `loadMyIssues()` thủ công

---

### 2. **rxMethod Pattern**

```typescript
loadMyIssues: rxMethod<string | null>(
  pipe(
    tap(() => /* set loading */),
    switchMap((userId) => /* query */),
    tap((issues) => /* update state */)
  )
)
```

**Lợi ích**:

- Tự động hủy request cũ khi có request mới (switchMap)
- Dễ dàng thêm error handling, retry logic
- Code gọn gàng, dễ đọc

---

### 3. **Signal-based State**

```typescript
// Component
<table mat-table [dataSource]="store.issues()">
```

- Đọc state bằng cách gọi Signal như function: `store.issues()`
- Angular tự động track dependencies và re-render khi cần

---

### 4. **Real-time Sync**

```typescript
// IssueService
return collectionData(q, { idField: 'id' }) as Observable<Issue[]>;
```

- `collectionData()` tạo Observable liên tục lắng nghe Firestore
- Mỗi khi Firestore thay đổi → Observable emit → Store update → UI re-render

---

### 5. **Separation of Concerns**

```
┌─────────────────────────────────────────┐
│  Component (my-tasks.ts)                │
│  - UI logic (formatStatus, getIcon)     │
│  - Template rendering                   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  Store (my-tasks.store.ts)              │
│  - State management                     │
│  - Business logic (loadMyIssues)        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│  Service (issue.service.ts)             │
│  - Firestore queries                    │
│  - Data fetching                        │
└─────────────────────────────────────────┘
```

**Nguyên tắc**:

- Component chỉ quan tâm đến UI
- Store quản lý state và orchestrate data flow
- Service chỉ lo việc giao tiếp với backend

---

### 6. **Auto-initialization Pattern**

```typescript
withHooks({
  onInit(store) {
    const authStore = inject(AuthStore);
    effect(() => {
      const user = authStore.user();
      store.loadMyIssues(user ? user.uid : null);
    });
  },
});
```

**Tại sao pattern này tốt?**

- ✅ Component không cần gọi `ngOnInit()` để load data
- ✅ Tự động sync với auth state
- ✅ Tránh quên gọi load method
- ✅ Centralized initialization logic

---

## 🚀 BEST PRACTICES

### 1. **Luôn kiểm tra null/undefined**

```typescript
if (!userId) {
  patchState(store, { issues: [], loading: false });
  return [];
}
```

### 2. **Sử dụng switchMap cho async operations**

```typescript
switchMap((userId) => issueService.getMyIssues(userId));
```

- Tự động hủy request cũ khi có request mới
- Tránh race conditions

### 3. **Logging để debug**

```typescript
tap(() => console.log('Loading my issues...'));
```

- Giúp trace data flow
- Dễ dàng phát hiện lỗi

### 4. **Fallback values**

```typescript
return project ? project.name : 'Unknown Project';
```

- Luôn có giá trị hiển thị
- Tránh UI bị lỗi khi data thiếu

---

## 📝 TÓM TẮT

**My Tasks Feature** là một ví dụ điển hình về **Reactive State Management** trong Angular:

1. **Store** quản lý state và business logic
2. **Service** lo việc query Firestore
3. **Component** chỉ quan tâm đến UI
4. **Real-time sync** nhờ `collectionData()` Observable
5. **Auto-load** nhờ `effect()` và `withHooks()`

Pattern này có thể tái sử dụng cho các tính năng tương tự như:

- My Projects
- My Notifications
- Recent Activities
- ...

---

**Tài liệu này được tạo để giúp bạn hiểu sâu về cách My Tasks hoạt động. Hãy áp dụng các pattern này vào các tính năng khác của ứng dụng!** 🎉
