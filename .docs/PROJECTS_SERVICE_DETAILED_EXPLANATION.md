# 📘 Giải Thích Chi Tiết: projects.service.ts

> **Mục đích**: Tài liệu này giải thích từng dòng code trong file `projects.service.ts`, vai trò của từng hàm, cơ chế hoạt động và các kỹ thuật đặc biệt được sử dụng.

---

## 📋 Tổng Quan

**File**: `src/app/features/projects/projects.service.ts`  
**Vai trò**: Service trung gian duy nhất để giao tiếp với Firebase Firestore cho tất cả thao tác liên quan đến Projects  
**Nguyên tắc**: Single Responsibility - Chỉ xử lý database operations, không chứa business logic

---

## 🔧 Phần 1: Imports và Dependencies

```typescript
import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collectionData } from '@angular/fire/firestore';
import { collection, doc, addDoc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { Project } from './project.model';
import { Observable, of, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
```

### Giải thích từng import:

#### Angular Core

- **`Injectable`**: Decorator đánh dấu class này là một service có thể được inject vào các component/service khác
- **`inject`**: Hàm mới của Angular để inject dependencies (thay thế constructor injection)
- **`Injector`**: Đối tượng quản lý dependency injection context
- **`runInInjectionContext`**: Hàm chạy code trong một injection context cụ thể

#### Angular Fire (Firebase wrapper cho Angular)

- **`Firestore`**: Type definition cho Firestore instance
- **`collectionData`**: Hàm đặc biệt tạo Observable real-time từ Firestore collection

#### Firebase Firestore (Core Firebase SDK)

- **`collection`**: Tạo reference đến một collection
- **`doc`**: Tạo reference đến một document cụ thể
- **`addDoc`**: Thêm document mới vào collection
- **`updateDoc`**: Cập nhật document hiện có
- **`query`**: Tạo query với điều kiện
- **`where`**: Thêm điều kiện lọc vào query
- **`deleteDoc`**: Xóa document

#### RxJS (Reactive Extensions)

- **`Observable`**: Type cho stream dữ liệu bất đồng bộ
- **`of`**: Tạo Observable từ giá trị tĩnh
- **`combineLatest`**: Gộp nhiều Observable thành một
- **`map`**: Transform dữ liệu trong Observable stream

---

## 🏗️ Phần 2: Class Declaration và Initialization

```typescript
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private projectsCollection = collection(this.firestore, 'projects');
```

### `@Injectable({ providedIn: 'root' })`

- **Ý nghĩa**: Đăng ký service này ở root level (singleton toàn ứng dụng)
- **Lợi ích**:
  - Chỉ có 1 instance duy nhất trong toàn app
  - Tự động tree-shakeable (Angular loại bỏ nếu không dùng)
  - Không cần khai báo trong providers array

### `private firestore = inject(Firestore)`

- **Cú pháp mới**: Thay thế cho constructor injection
- **Firestore instance**: Đại diện cho toàn bộ database Firebase của project
- **private**: Chỉ dùng nội bộ trong service

### `private injector = inject(Injector)`

- **Mục đích**: Lưu trữ injection context
- **Sử dụng**: Để chạy `collectionData` trong đúng context (tránh lỗi với Signals)

### `private projectsCollection = collection(this.firestore, 'projects')`

- **collection()**: Tạo reference đến collection 'projects' trên Firestore
- **Tái sử dụng**: Thay vì viết lại đường dẫn mỗi lần, dùng biến này
- **Tương đương SQL**: `SELECT * FROM projects`

---

## 📖 Phần 3: Read Operations (Lấy dữ liệu)

### 3.1. `getProjects(userId: string)` - Lấy dự án của user

```typescript
getProjects(userId: string): Observable<Project[]> {
  const q = query(this.projectsCollection, where('memberIds', 'array-contains', userId));
  return runInInjectionContext(
    this.injector,
    () => collectionData(q, { idField: 'id' }) as Observable<Project[]>
  );
}
```

#### Dòng 1: Tạo query có điều kiện

```typescript
const q = query(this.projectsCollection, where('memberIds', 'array-contains', userId));
```

- **`query()`**: Tạo câu truy vấn Firestore
- **`where('memberIds', 'array-contains', userId)`**: Điều kiện lọc
  - `memberIds`: Tên field trong document (là một array)
  - `array-contains`: Toán tử Firestore kiểm tra array có chứa giá trị không
  - `userId`: Giá trị cần tìm

**Ví dụ thực tế**:

```javascript
// Document trong Firestore:
{
  id: "proj123",
  name: "Website",
  memberIds: ["user1", "user2", "user3"]
}

// Query: where('memberIds', 'array-contains', 'user2')
// Kết quả: Trả về document này vì "user2" có trong memberIds
```

#### Dòng 2-5: Lấy dữ liệu real-time

```typescript
return runInInjectionContext(
  this.injector,
  () => collectionData(q, { idField: 'id' }) as Observable<Project[]>
);
```

**`runInInjectionContext(this.injector, ...)`**:

- Đảm bảo code bên trong chạy trong Angular injection context
- Cần thiết vì `collectionData` có thể cần truy cập các Angular services

**`collectionData(q, { idField: 'id' })`**:

- **Chức năng chính**: Tạo Observable real-time từ Firestore query
- **Real-time**: Tự động emit giá trị mới khi database thay đổi
- **`{ idField: 'id' }`**: Gắn document ID vào field 'id' trong object

**Cơ chế Real-time**:

```
1. collectionData() mở WebSocket connection đến Firestore
2. Firestore push snapshot đầu tiên (dữ liệu hiện tại)
3. Mỗi khi có thay đổi (add/update/delete):
   → Firestore push snapshot mới
   → Observable emit giá trị mới
   → UI tự động cập nhật (vì dùng Signals/RxJS)
```

**Ví dụ dữ liệu trả về**:

```typescript
// Firestore document:
{
  // ID: "abc123" (nằm ngoài data)
  name: "My Project",
  key: "PROJ",
  ownerId: "user1",
  memberIds: ["user1", "user2"]
}

// Sau khi collectionData xử lý:
{
  id: "abc123",           // ← Được thêm vào nhờ idField
  name: "My Project",
  key: "PROJ",
  ownerId: "user1",
  memberIds: ["user1", "user2"]
}
```

---

### 3.2. `getUsers(userIds: string[])` - Lấy thông tin nhiều users

```typescript
getUsers(userIds: string[]): Observable<any[]> {
  if (!userIds || userIds.length === 0) return of([]);

  // Firestore 'in' query supports max 10 values.
  // We chunk the array into groups of 10 to support any number of members.
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    chunks.push(userIds.slice(i, i + 10));
  }

  const usersCollection = collection(this.firestore, 'users');
  const observables = chunks.map((chunk) => {
    const q = query(usersCollection, where('uid', 'in', chunk));
    return runInInjectionContext(this.injector, () => collectionData(q));
  });

  return combineLatest(observables).pipe(map((results) => results.flat()));
}
```

#### Vấn đề cần giải quyết

**Firestore limitation**: Toán tử `in` chỉ hỗ trợ tối đa 10 giá trị

**Ví dụ vấn đề**:

```typescript
// ❌ Lỗi nếu có > 10 users
where('uid', 'in', ['user1', 'user2', ..., 'user15']) // Error!
```

#### Giải pháp: Chunking (Chia nhỏ)

**Bước 1: Kiểm tra edge case**

```typescript
if (!userIds || userIds.length === 0) return of([]);
```

- Nếu không có ID nào → Trả về Observable rỗng ngay

**Bước 2: Chia mảng thành chunks**

```typescript
const chunks: string[][] = [];
for (let i = 0; i < userIds.length; i += 10) {
  chunks.push(userIds.slice(i, i + 10));
}
```

**Ví dụ**:

```typescript
// Input: 23 user IDs
userIds = ['u1', 'u2', ..., 'u23']

// Output: 3 chunks
chunks = [
  ['u1', 'u2', ..., 'u10'],   // Chunk 1: 10 items
  ['u11', 'u12', ..., 'u20'], // Chunk 2: 10 items
  ['u21', 'u22', 'u23']       // Chunk 3: 3 items
]
```

**Bước 3: Tạo query cho mỗi chunk**

```typescript
const usersCollection = collection(this.firestore, 'users');
const observables = chunks.map((chunk) => {
  const q = query(usersCollection, where('uid', 'in', chunk));
  return runInInjectionContext(this.injector, () => collectionData(q));
});
```

- Mỗi chunk tạo ra 1 query riêng
- Mỗi query trả về 1 Observable
- Kết quả: Mảng các Observable

**Bước 4: Gộp kết quả**

```typescript
return combineLatest(observables).pipe(map((results) => results.flat()));
```

**`combineLatest(observables)`**:

- Đợi TẤT CẢ Observable emit giá trị
- Gộp thành 1 Observable duy nhất
- Emit mảng chứa kết quả của tất cả queries

**`map((results) => results.flat())`**:

- `results`: Mảng 2 chiều `[[users1], [users2], [users3]]`
- `.flat()`: Làm phẳng thành mảng 1 chiều `[user1, user2, ..., user23]`

**Ví dụ hoàn chỉnh**:

```typescript
// Input
userIds = ['u1', 'u2', ..., 'u23']

// Chunks
chunks = [chunk1, chunk2, chunk3]

// Queries (parallel)
query1 → Observable<User[]> → [user1, ..., user10]
query2 → Observable<User[]> → [user11, ..., user20]
query3 → Observable<User[]> → [user21, user22, user23]

// combineLatest
[[user1, ..., user10], [user11, ..., user20], [user21, user22, user23]]

// .flat()
[user1, user2, ..., user23]
```

---

### 3.3. `findUserByEmail(email: string)` - Tìm user theo email

```typescript
findUserByEmail(email: string): Observable<any[]> {
  const usersCollection = collection(this.firestore, 'users');
  const q = query(usersCollection, where('email', '==', email));
  return runInInjectionContext(this.injector, () => collectionData(q));
}
```

**Mục đích**: Tìm user trong hệ thống để mời vào project

**Query**: `where('email', '==', email)`

- Toán tử `==`: So sánh bằng chính xác
- Tìm document có field `email` khớp với giá trị truyền vào

**Trả về**: Mảng users (thường chỉ 1 phần tử vì email unique)

---

## ✍️ Phần 4: Write Operations (Ghi dữ liệu)

### 4.1. `addProject(project: Partial<Project>)` - Tạo project mới

```typescript
addProject(project: Partial<Project>) {
  return addDoc(this.projectsCollection, project);
}
```

**`Partial<Project>`**:

- Type utility của TypeScript
- Cho phép truyền vào object chỉ có một số field của Project
- Ví dụ: `{ name, key, ownerId }` (không cần `id` vì Firestore tự tạo)

**`addDoc(collection, data)`**:

- Thêm document mới vào collection
- Firestore tự động tạo ID ngẫu nhiên
- Trả về Promise chứa DocumentReference

**Luồng hoạt động**:

```
1. Component gọi: projectsService.addProject({ name, key, ownerId, memberIds })
2. Service gọi: addDoc(projectsCollection, {...})
3. Firestore tạo document với ID tự động (VD: "abc123xyz")
4. Real-time listener trong getProjects() nhận event
5. Store cập nhật signal projects
6. UI tự động hiển thị project mới
```

---

### 4.2. `deleteProject(projectId: string)` - Xóa project

```typescript
deleteProject(projectId: string) {
  const docRef = doc(this.firestore, 'projects', projectId);
  return deleteDoc(docRef);
}
```

**`doc(firestore, 'projects', projectId)`**:

- Tạo reference đến document cụ thể
- Path: `projects/{projectId}`

**`deleteDoc(docRef)`**:

- Xóa vĩnh viễn document khỏi Firestore
- Không thể undo

**Lưu ý bảo mật**:

- Client-side code này phải tuân thủ Firestore Security Rules
- Rules phải kiểm tra: `request.auth.uid == resource.data.ownerId`

---

### 4.3. `updateDoc` Operations - Cập nhật documents

#### A. `inviteUserToProject` - Mời user vào project

```typescript
inviteUserToProject(projectId: string, userId: string, currentInvitedIds: string[] = []) {
  const docRef = doc(this.firestore, 'projects', projectId);
  if (currentInvitedIds.includes(userId)) return Promise.resolve();
  const newInvitedIds = [...currentInvitedIds, userId];
  return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
}
```

**Logic**:

1. Kiểm tra user đã được mời chưa → Tránh duplicate
2. Tạo mảng mới: `[...old, newUserId]`
3. Cập nhật field `invitedMemberIds`

**Immutability**: Dùng spread operator `[...]` thay vì `.push()` để tránh mutate array gốc

---

#### B. `getPendingInvites` - Lấy danh sách lời mời

```typescript
getPendingInvites(userId: string): Observable<Project[]> {
  const q = query(this.projectsCollection, where('invitedMemberIds', 'array-contains', userId));
  return runInInjectionContext(
    this.injector,
    () => collectionData(q, { idField: 'id' }) as Observable<Project[]>
  );
}
```

**Tương tự `getProjects`** nhưng query field `invitedMemberIds` thay vì `memberIds`

**Use case**: Hiển thị badge "You have 3 pending invitations"

---

#### C. `acceptInvite` - Chấp nhận lời mời

```typescript
async acceptInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);

  // Remove from invited
  const newInvitedIds = (project.invitedMemberIds || []).filter((id) => id !== userId);
  // Add to members
  const newMemberIds = [...project.memberIds, userId];

  return updateDoc(docRef, {
    invitedMemberIds: newInvitedIds,
    memberIds: newMemberIds,
  });
}
```

**Hành động kép** (Atomic update):

1. **Xóa khỏi invited**: `.filter(id => id !== userId)`
2. **Thêm vào members**: `[...memberIds, userId]`

**Kết quả**:

- User chuyển từ "pending" sang "active member"
- Firestore push update đến cả 2 máy (owner và invitee)

---

#### D. `rejectInvite` - Từ chối lời mời

```typescript
rejectInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);
  const newInvitedIds = (project.invitedMemberIds || []).filter((id) => id !== userId);
  return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
}
```

**Đơn giản hơn `acceptInvite`**: Chỉ xóa khỏi `invitedMemberIds`, không thêm vào `memberIds`

---

#### E. `removeMemberFromProject` - Xóa thành viên

```typescript
removeMemberFromProject(projectId: string, memberIdToRemove: string, currentMemberIds: string[]) {
  const docRef = doc(this.firestore, 'projects', projectId);
  const newMemberIds = currentMemberIds.filter((id) => id !== memberIdToRemove);
  return updateDoc(docRef, { memberIds: newMemberIds });
}
```

**Use cases**:

1. Owner kick member
2. Member tự rời project (leave)

**Lưu ý**: Store phải gọi `issueService.unassignUserFromProjectIssues()` trước để tránh task "mồ côi"

---

## 🔄 Phần 5: Data Flow Diagrams

### Flow 1: Tạo Project Mới

```
┌─────────────┐
│ Component   │
│ (UI Layer)  │
└──────┬──────┘
       │ createProject(name, key)
       ↓
┌─────────────┐
│   Service   │ addDoc(projectsCollection, {
│             │   name, key, ownerId, memberIds: [ownerId]
└──────┬──────┘ })
       │
       ↓
┌─────────────┐
│  Firestore  │ Tạo document với ID tự động
│  (Server)   │ → Trigger real-time listeners
└──────┬──────┘
       │
       ↓ (WebSocket push)
┌─────────────┐
│ getProjects │ Observable emit giá trị mới
│ Observable  │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│    Store    │ Update signal projects
└──────┬──────┘
       │
       ↓
┌─────────────┐
│     UI      │ Tự động render project mới
└─────────────┘
```

### Flow 2: Mời & Chấp Nhận Thành Viên

```
┌──────────────────────────────────────────────────────┐
│                    OWNER SIDE                        │
└──────────────────────────────────────────────────────┘
1. Dialog → inviteUser(email)
2. Store → findUserByEmail(email)
3. Store → inviteUserToProject(projectId, userId, ...)
4. Service → updateDoc({ invitedMemberIds: [...old, new] })
5. Firestore → Update document

┌──────────────────────────────────────────────────────┐
│                   INVITEE SIDE                       │
└──────────────────────────────────────────────────────┘
6. Firestore → Push update via WebSocket
7. getPendingInvites Observable → Emit new value
8. Store → Update pendingInvites signal
9. UI → Show notification badge

┌──────────────────────────────────────────────────────┐
│              INVITEE ACCEPTS                         │
└──────────────────────────────────────────────────────┘
10. UI → Click "Accept"
11. Store → acceptInvite(project, userId)
12. Service → updateDoc({
      invitedMemberIds: remove userId,
      memberIds: add userId
    })
13. Firestore → Update document

┌──────────────────────────────────────────────────────┐
│              BOTH SIDES UPDATE                       │
└──────────────────────────────────────────────────────┘
14. Firestore → Push to BOTH machines
15. Owner's getProjects → Emit (project.memberIds updated)
16. Invitee's getProjects → Emit (new project appears)
17. Invitee's getPendingInvites → Emit (project removed)
18. Both UIs → Auto-update
```

---

## 🎯 Phần 6: Kỹ Thuật Đặc Biệt

### 1. runInInjectionContext Pattern

**Vấn đề**:

```typescript
// ❌ Có thể lỗi với Signals/modern Angular
collectionData(q, { idField: 'id' });
```

**Giải pháp**:

```typescript
// ✅ Đảm bảo có injection context
runInInjectionContext(this.injector, () => collectionData(q, { idField: 'id' }));
```

**Tại sao cần**:

- `collectionData` có thể cần truy cập Angular services
- Signals và modern features yêu cầu injection context
- Tránh lỗi "inject() must be called from an injection context"

---

### 2. Chunking Pattern (Vượt giới hạn Firestore)

**Giới hạn**: `in` operator chỉ hỗ trợ max 10 values

**Pattern**:

```typescript
// 1. Chia nhỏ
const chunks = [];
for (let i = 0; i < array.length; i += 10) {
  chunks.push(array.slice(i, i + 10));
}

// 2. Tạo queries parallel
const observables = chunks.map((chunk) => query(collection, where('field', 'in', chunk)));

// 3. Gộp kết quả
return combineLatest(observables).pipe(map((results) => results.flat()));
```

**Lợi ích**:

- Hỗ trợ unlimited số lượng IDs
- Queries chạy parallel (nhanh hơn sequential)
- Transparent cho caller (không cần biết có chunking)

---

### 3. Immutable Updates

**❌ Sai (Mutate array)**:

```typescript
currentMemberIds.push(newMemberId);
updateDoc(docRef, { memberIds: currentMemberIds });
```

**✅ Đúng (Immutable)**:

```typescript
const newMemberIds = [...currentMemberIds, newMemberId];
updateDoc(docRef, { memberIds: newMemberIds });
```

**Tại sao**:

- Tránh side effects
- Dễ debug (có thể so sánh old vs new)
- Tương thích với Signals (change detection)

---

### 4. Real-time Observable Pattern

**Đặc điểm**:

- Không cần unsubscribe thủ công (rxMethod tự cleanup)
- Tự động reconnect khi mất kết nối
- Emit giá trị mới khi database thay đổi

**So sánh với HTTP**:

```typescript
// HTTP (One-time)
http.get('/api/projects'); // Gọi 1 lần, nhận 1 response

// Firestore (Real-time)
collectionData(query); // Mở connection, nhận vô số updates
```

---

## 🔒 Phần 7: Security Considerations

### Firestore Security Rules (Bắt buộc)

Service này **CHỈ** là client-side code. Bảo mật thực sự nằm ở **Firestore Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      // Chỉ members và invited users được đọc
      allow read: if request.auth != null &&
        (request.auth.uid in resource.data.memberIds ||
         request.auth.uid in resource.data.get('invitedMemberIds', []));

      // Ai cũng tạo được (nhưng phải là owner)
      allow create: if request.auth != null &&
        request.resource.data.ownerId == request.auth.uid &&
        request.resource.data.memberIds[0] == request.auth.uid;

      // Chỉ owner update được
      allow update: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;

      // Chỉ owner xóa được
      allow delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }
  }
}
```

**Quan trọng**: Dù code client có gọi `deleteProject()`, nếu user không phải owner, Firestore sẽ từ chối request.

---

## 📊 Phần 8: Performance Optimizations

### 1. Collection Reference Caching

```typescript
private projectsCollection = collection(this.firestore, 'projects');
```

- Tạo 1 lần, dùng nhiều lần
- Tránh overhead của việc tạo reference liên tục

### 2. Parallel Queries (Chunking)

```typescript
const observables = chunks.map(chunk => query(...));
return combineLatest(observables); // Chạy đồng thời
```

- 3 chunks = 3 queries chạy cùng lúc
- Nhanh hơn nhiều so với chạy tuần tự

### 3. Early Return

```typescript
if (!userIds || userIds.length === 0) return of([]);
```

- Tránh query không cần thiết
- Giảm network calls

### 4. Real-time Efficiency

- Firestore chỉ push **delta** (thay đổi), không phải toàn bộ dataset
- WebSocket connection được tái sử dụng

---

## 🐛 Phần 9: Common Pitfalls & Solutions

### Issue 1: "inject() must be called from an injection context"

**Nguyên nhân**: Gọi `collectionData` ngoài injection context

**Giải pháp**: Dùng `runInInjectionContext`

```typescript
runInInjectionContext(this.injector, () => collectionData(q));
```

---

### Issue 2: Query với > 10 IDs bị lỗi

**Nguyên nhân**: Firestore `in` operator limit

**Giải pháp**: Implement chunking pattern (đã có trong `getUsers`)

---

### Issue 3: Memory leak với Observable

**Nguyên nhân**: Không unsubscribe

**Giải pháp**:

- Dùng `rxMethod` trong Store (auto cleanup)
- Hoặc dùng `takeUntilDestroyed()` trong component

---

### Issue 4: Race condition khi update

**Nguyên nhân**: Nhiều updates cùng lúc

**Giải pháp**:

- Dùng Firestore transactions (nếu cần)
- Hoặc optimistic updates + conflict resolution

---

## 📝 Phần 10: Testing Considerations

### Unit Test Example

```typescript
describe('ProjectsService', () => {
  let service: ProjectsService;
  let firestore: Firestore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectsService, { provide: Firestore, useValue: mockFirestore }],
    });
    service = TestBed.inject(ProjectsService);
  });

  it('should chunk user IDs correctly', () => {
    const userIds = Array.from({ length: 23 }, (_, i) => `user${i}`);
    // Test chunking logic
  });

  it('should handle empty user IDs', (done) => {
    service.getUsers([]).subscribe((users) => {
      expect(users).toEqual([]);
      done();
    });
  });
});
```

---

## 🎓 Phần 11: Key Takeaways

### Nguyên tắc thiết kế

1. **Single Responsibility**: Chỉ xử lý database operations
2. **Immutability**: Không mutate arrays/objects
3. **Real-time First**: Dùng Observable thay vì Promises khi có thể
4. **Error Handling**: Để Store xử lý (Service chỉ throw)

### Best Practices

1. Cache collection references
2. Dùng `runInInjectionContext` cho `collectionData`
3. Implement chunking cho queries lớn
4. Luôn kiểm tra edge cases (empty arrays, null values)

### Security

1. Client code KHÔNG phải là bảo mật
2. Firestore Rules là tầng bảo mật thực sự
3. Luôn validate ở cả client và server

---

## 📚 Tài Liệu Tham Khảo

- [Firestore Queries](https://firebase.google.com/docs/firestore/query-data/queries)
- [Angular Fire Documentation](https://github.com/angular/angularfire)
- [RxJS Operators](https://rxjs.dev/api)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

---

**Tóm tắt**: `projects.service.ts` là một service được thiết kế tốt, áp dụng nhiều best practices:

- ✅ Real-time updates
- ✅ Chunking để vượt giới hạn Firestore
- ✅ Immutable operations
- ✅ Proper injection context handling
- ✅ Clean separation of concerns
