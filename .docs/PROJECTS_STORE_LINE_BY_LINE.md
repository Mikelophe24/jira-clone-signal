# 🔬 Giải Thích Từng Dòng Code: projects.store.ts

> **Mục đích**: Tài liệu này giải thích **TỪNG DÒNG CODE** trong file `projects.store.ts`, bao gồm cả những dòng nhỏ nhất, với ví dụ cụ thể và lý do tại sao cần mỗi dòng.

---

## 📦 PHẦN 1: IMPORTS (Dòng 1-19)

### Dòng 1-8: Import NgRx Signals Store

```typescript
1: import {
2:   signalStore,
3:   withState,
4:   withMethods,
5:   patchState,
6:   withComputed,
7:   withHooks,
8: } from '@ngrx/signals';
```

**Giải thích từng import**:

- **Dòng 2 - `signalStore`**:

  - Factory function để tạo store
  - Nhận vào các "features" (withState, withMethods, etc.)
  - Trả về một class có thể inject vào components

- **Dòng 3 - `withState`**:
  - Feature thêm state (dữ liệu) vào store
  - Biến state thành signals (reactive)
- **Dòng 4 - `withMethods`**:

  - Feature thêm methods (actions) vào store
  - Cho phép components gọi `store.methodName()`

- **Dòng 5 - `patchState`**:

  - Function để update state (immutable)
  - Chỉ update những fields được chỉ định
  - Ví dụ: `patchState(store, { loading: true })` chỉ update `loading`

- **Dòng 6 - `withComputed`**:

  - Feature thêm computed signals
  - Tự động tính toán lại khi dependencies thay đổi

- **Dòng 7 - `withHooks`**:
  - Feature thêm lifecycle hooks
  - Ví dụ: `onInit`, `onDestroy`

---

### Dòng 9: Import Angular Core

```typescript
9: import { inject, computed, effect } from '@angular/core';
```

- **`inject`**: Dependency injection (thay thế constructor injection)
- **`computed`**: Tạo computed signal (tự động update)
- **`effect`**: Tạo side effect (chạy khi signal thay đổi)

---

### Dòng 10-19: Import Services và Models

```typescript
10: import { ProjectsService } from './projects.service';
```

- Service xử lý Firestore operations cho projects

```typescript
11: import { IssueService } from '../issue/issue.service';
```

- Service xử lý issues (cần để unassign tasks khi remove member)

```typescript
12: import { Project } from './project.model';
```

- Type definition cho Project

```typescript
13: import { rxMethod } from '@ngrx/signals/rxjs-interop';
```

- Chuyển Observable thành method của store
- Cho phép dùng RxJS operators trong store methods

```typescript
14: import { Router } from '@angular/router';
```

- Để redirect user (ví dụ: khi bị kick khỏi project)

```typescript
15: import { pipe, tap, switchMap, catchError, of, firstValueFrom } from 'rxjs';
```

- **`pipe`**: Kết hợp operators
- **`tap`**: Side effect (không thay đổi data)
- **`switchMap`**: Chuyển đổi stream (cancel stream cũ)
- **`catchError`**: Xử lý lỗi
- **`of`**: Tạo Observable từ giá trị tĩnh
- **`firstValueFrom`**: Chuyển Observable → Promise (lấy giá trị đầu tiên)

```typescript
16: import { AppUser } from '../../core/models/app-user.model';
```

- Type definition cho User

```typescript
17: import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
```

- Custom feature thêm `loading` và `error` signals

```typescript
18: import { ErrorNotificationService } from '../../core/services/error-notification.service';
```

- Service hiển thị snackbar notifications

```typescript
19: import { AuthStore } from '../../core/auth/auth.store';
```

- Store quản lý authentication state

---

## 📊 PHẦN 2: STATE DEFINITION (Dòng 21-37)

### Dòng 21-28: Type Definition

```typescript
21: type ProjectsState = {
```

- Định nghĩa structure của state

```typescript
22:   projects: Project[];
```

- Mảng chứa tất cả projects mà user là thành viên
- Real-time update từ Firestore

```typescript
23:   projectOwners: AppUser[]; // Cache for owners of displayed projects
```

- Cache thông tin owners để tránh query lặp lại
- Ví dụ: 10 projects cùng 1 owner → Chỉ query owner 1 lần

```typescript
24:   members: AppUser[];
```

- Thành viên của project đang được chọn
- Load khi user mở Members Dialog

```typescript
25:   pendingInvites: Project[]; // Projects where user is invited
```

- Danh sách projects mà user được mời (chưa accept/reject)
- Hiển thị badge notification

```typescript
26:   selectedProjectId: string | null;
```

- ID của project đang được xem
- `null` khi ở trang danh sách projects

```typescript
27:   filter: string;
```

- Dự phòng cho tính năng search/filter (chưa implement)

```typescript
28: };
```

- Đóng type definition

---

### Dòng 30-37: Initial State

```typescript
30: const initialState: ProjectsState = {
```

- Giá trị khởi tạo khi store được tạo

```typescript
31:   projects: [],
```

- Bắt đầu với mảng rỗng (chưa load data)

```typescript
32:   projectOwners: [],
```

- Cache rỗng

```typescript
33:   members: [],
```

- Chưa chọn project nào

```typescript
34:   pendingInvites: [],
```

- Chưa có lời mời

```typescript
35:   selectedProjectId: null, // Could be loaded from local storage
```

- Chưa chọn project
- Comment gợi ý: Có thể load từ localStorage để persist selection

```typescript
36:   filter: '',
```

- Filter rỗng

```typescript
37: };
```

- Đóng initialState

---

## 🏗️ PHẦN 3: STORE CREATION (Dòng 39-45)

### Dòng 39-40: SignalStore Declaration

```typescript
39: export const ProjectsStore = signalStore(
```

- `export const`: Xuất store để components có thể inject
- `signalStore(`: Bắt đầu tạo store

```typescript
40:   { providedIn: 'root' },
```

- Store là singleton (1 instance duy nhất trong toàn app)
- `'root'`: Đăng ký ở root level
- Tự động tree-shakeable (Angular loại bỏ nếu không dùng)

---

### Dòng 41: Custom Feature

```typescript
41:   withLoadingError(),
```

- Thêm custom feature `withLoadingError`
- Tự động thêm vào store:
  - `loading: Signal<boolean>`
  - `error: Signal<string | null>`
  - `setLoading(value: boolean): void`
  - `setError(message: string): void`

---

### Dòng 42: Add State

```typescript
42:   withState(initialState),
```

- Thêm state vào store với giá trị khởi tạo
- Tất cả fields trong `initialState` trở thành signals
- Ví dụ: `store.projects()` trả về mảng projects

---

### Dòng 43-45: Computed Signal

```typescript
43:   withComputed(({ projects, selectedProjectId }) => ({
```

- `withComputed`: Feature thêm computed signals
- `({ projects, selectedProjectId })`: Destructure signals cần dùng
- `=>`: Arrow function trả về object chứa computed signals

```typescript
44:     selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId())),
```

**Giải thích chi tiết**:

- `selectedProject:`: Tên của computed signal
- `computed(`: Tạo computed signal
- `() =>`: Arrow function (không có tham số)
- `projects()`: Gọi signal để lấy giá trị (mảng projects)
- `.find(`: Tìm project trong mảng
- `(p) =>`: Mỗi project trong mảng
- `p.id === selectedProjectId()`: So sánh ID
- `)`: Đóng find
- `)`: Đóng computed
- `,`: Có thể thêm computed signals khác

**Cơ chế**:

```typescript
// Khi selectedProjectId thay đổi
selectedProjectId = 'proj1';
// → computed tự động chạy lại
// → selectedProject = projects.find(p => p.id === "proj1")
```

```typescript
45:   })),
```

- Đóng withComputed

---

## 🎬 PHẦN 4: METHODS (Dòng 46-226)

### Dòng 46-52: Methods Setup

```typescript
46:   withMethods(
```

- Feature thêm methods vào store

```typescript
47:     (
48:       store,
```

- Tham số 1: `store` - Reference đến store instance
- Dùng để gọi `patchState(store, {...})` hoặc `store.projects()`

```typescript
49:       projectsService = inject(ProjectsService),
```

- Inject ProjectsService
- `= inject(...)`: Cú pháp mới của Angular (thay constructor)

```typescript
50:       issueService = inject(IssueService),
```

- Inject IssueService (dùng trong removeMember)

```typescript
51:       errorService = inject(ErrorNotificationService)
```

- Inject ErrorNotificationService (hiển thị snackbar)

```typescript
52:     ) => ({
```

- Arrow function trả về object chứa các methods

---

### METHOD 1: loadProjects (Dòng 53-83)

```typescript
53:       loadProjects: rxMethod<string | null>(
```

- `loadProjects:`: Tên method
- `rxMethod<string | null>`: Chuyển Observable thành method
- `<string | null>`: Type của tham số (userId hoặc null)

```typescript
54:         pipe(
```

- Bắt đầu RxJS pipe (kết hợp operators)

```typescript
55:           tap(() => store.setLoading(true)),
```

- **`tap`**: Side effect (không thay đổi data trong stream)
- **`() =>`**: Arrow function không tham số
- **`store.setLoading(true)`**: Set loading = true
- **Mục đích**: Hiển thị spinner trên UI

```typescript
56:           switchMap((userId) => {
```

- **`switchMap`**: Chuyển đổi stream
- **`(userId)`**: Nhận userId từ stream trước
- **Cancel stream cũ**: Nếu userId thay đổi nhanh, cancel request cũ

```typescript
57:             if (!userId) {
```

- Kiểm tra userId có giá trị không
- `!userId`: `null`, `undefined`, hoặc `""` → true

```typescript
58:               patchState(store, { projects: [], projectOwners: [], selectedProjectId: null });
```

- **`patchState`**: Update state (immutable)
- **`store`**: Store instance
- **`{ projects: [], ... }`**: Object chứa fields cần update
- **Mục đích**: Clear tất cả data khi user logout

```typescript
59:               store.setLoading(false);
```

- Tắt loading spinner

```typescript
60:               return of([]);
```

- **`of([])` **: Tạo Observable emit mảng rỗng
- **`return`**: Kết thúc switchMap
- **Mục đích**: Trả về Observable để stream không bị break

```typescript
61:             }
```

- Đóng if

```typescript
62:             return projectsService.getProjects(userId).pipe(
```

- **`projectsService.getProjects(userId)`**: Gọi service
- **Trả về**: `Observable<Project[]>` (real-time)
- **`.pipe(`**: Tiếp tục xử lý stream

```typescript
63:               tap((projects) => patchState(store, { projects })),
```

- **`tap((projects) =>`**: Nhận projects từ stream
- **`patchState(store, { projects })`**: Update state
- **Shorthand**: `{ projects }` = `{ projects: projects }`
- **Mục đích**: Update UI ngay khi có data

```typescript
64:               // Extract owner IDs and load them
```

- Comment giải thích bước tiếp theo

```typescript
65:               switchMap((projects) => {
```

- **Chuyển stream**: Từ `Observable<Project[]>` → `Observable<AppUser[]>`
- **`(projects)`**: Nhận projects từ tap trước

```typescript
66:                 const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
```

**Giải thích từng phần**:

- **`projects.map((p) => p.ownerId)`**: Lấy tất cả ownerIds
  - Kết quả: `["user1", "user2", "user1", "user3"]`
- **`new Set(...)`**: Loại bỏ duplicate
  - Kết quả: `Set {"user1", "user2", "user3"}`
- **`[...new Set(...)]`**: Chuyển Set → Array
  - Kết quả: `["user1", "user2", "user3"]`
- **`const ownerIds =`**: Lưu vào biến

```typescript
67:                 if (ownerIds.length === 0) return of([]);
```

- Nếu không có owners → Trả về mảng rỗng
- **Edge case**: Khi projects = []

```typescript
68:                 return projectsService.getUsers(ownerIds);
```

- Gọi service lấy thông tin users
- **Chunking**: Service tự động chia nhỏ nếu > 10 IDs
- Trả về: `Observable<AppUser[]>`

```typescript
69:               }),
```

- Đóng switchMap

```typescript
70:               tap((owners) => {
```

- **`tap((owners) =>`**: Nhận owners từ stream

```typescript
71:                 patchState(store, { projectOwners: owners });
```

- Cache owners vào state

```typescript
72:                 store.setLoading(false);
```

- Tắt loading (đã load xong)

```typescript
73:               }),
```

- Đóng tap

```typescript
74:               catchError((err) => {
```

- **`catchError`**: Bắt lỗi trong stream
- **`(err)`**: Error object

```typescript
75:                 const errorMessage = err?.message || 'Failed to load projects';
```

- **`err?.message`**: Optional chaining (tránh crash nếu err = null)
- **`|| 'Failed...'`**: Fallback message

```typescript
76:                 console.error('Error loading projects:', err);
```

- Log lỗi ra console (để debug)

```typescript
77:                 errorService.showError(errorMessage);
```

- Hiển thị snackbar notification

```typescript
78:                 return of([]);
```

- Trả về mảng rỗng để stream không bị break

```typescript
79:               })
80:             );
81:           })
82:         )
83:       ),
```

- Đóng các scopes

---

### METHOD 2: loadInvites (Dòng 84-109)

```typescript
84:       loadInvites: rxMethod<string | null>(
```

- Tương tự `loadProjects` nhưng load pending invites

```typescript
85:         pipe(
86:           switchMap((userId) => {
87:             if (!userId) {
88:               patchState(store, { pendingInvites: [] });
89:               return of([]);
90:             }
```

- Tương tự loadProjects: Clear data nếu logout

```typescript
91:             return projectsService.getPendingInvites(userId).pipe(
```

- **Query khác**: `where('invitedMemberIds', 'array-contains', userId)`

```typescript
92:               tap((pendingInvites) => patchState(store, { pendingInvites })),
```

- Update pendingInvites signal

```typescript
93:               switchMap((invites) => {
94:                 const ownerIds = [...new Set(invites.map((p) => p.ownerId))];
95:                 if (ownerIds.length === 0) return of([]);
96:                 return projectsService.getUsers(ownerIds);
97:               }),
```

- Tương tự loadProjects: Extract và load owner info

```typescript
98:               tap((newOwners) => {
```

- **`newOwners`**: Owners của pending invites

```typescript
99:                 const existingOwners = store.projectOwners();
```

- Lấy owners đã có trong cache

```typescript
100:                 // Simple merge distinct by UID
```

- Comment giải thích merge logic

```typescript
101:                 const merged = [...existingOwners, ...newOwners].filter(
102:                   (v, i, a) => a.findIndex((t) => t.uid === v.uid) === i
103:                 );
```

**Giải thích chi tiết**:

- **`[...existingOwners, ...newOwners]`**: Gộp 2 mảng
- **`.filter((v, i, a) =>`**: Lọc mảng
  - `v`: Giá trị hiện tại (owner object)
  - `i`: Index hiện tại
  - `a`: Toàn bộ mảng
- **`a.findIndex((t) => t.uid === v.uid)`**: Tìm index đầu tiên có cùng UID
- **`=== i`**: Chỉ giữ lại nếu đây là lần xuất hiện đầu tiên
- **Kết quả**: Loại bỏ duplicates

**Ví dụ**:

```typescript
existingOwners = [{ uid: 'u1' }, { uid: 'u2' }];
newOwners = [{ uid: 'u2' }, { uid: 'u3' }];
merged = [{ uid: 'u1' }, { uid: 'u2' }, { uid: 'u3' }];
```

```typescript
104:                 patchState(store, { projectOwners: merged });
```

- Update cache với owners đã merge

```typescript
105:               })
106:             );
107:           })
108:         )
109:       ),
```

- Đóng các scopes

---

### METHOD 3: selectProject (Dòng 110-112)

```typescript
110:       selectProject: (projectId: string) => {
```

- **Simple method** (không phải rxMethod)
- **`(projectId: string)`**: Tham số

```typescript
111:         patchState(store, { selectedProjectId: projectId });
```

- Chỉ update `selectedProjectId`
- **Computed signal** `selectedProject` tự động update
- **Effect 2** tự động load members

```typescript
112:       },
```

- Đóng method

---

### METHOD 4: loadMembers (Dòng 113-118)

```typescript
113:       loadMembers: rxMethod<string[]>(
```

- **`rxMethod<string[]>`**: Nhận mảng user IDs

```typescript
114:         pipe(
115:           switchMap((ids) => projectsService.getUsers(ids)),
```

- **`(ids)`**: Mảng user IDs
- **`getUsers(ids)`**: Load thông tin users
- **Chunking**: Tự động chia nhỏ nếu > 10 IDs

```typescript
116:           tap((members) => patchState(store, { members }))
```

- Update members signal

```typescript
117:         )
118:       ),
```

- Đóng method

---

### METHOD 5: deleteProject (Dòng 119-132)

```typescript
119:       deleteProject: async (projectId: string) => {
```

- **`async`**: Hàm bất đồng bộ (có thể dùng await)
- **`(projectId: string)`**: ID của project cần xóa

```typescript
120:         try {
```

- Bắt đầu try block

```typescript
121:           await projectsService.deleteProject(projectId);
```

- **`await`**: Đợi Firestore xóa xong
- **Gọi service**: Xóa document trên Firestore

```typescript
122:           // Optimistic update: Remove from list locally
```

- Comment giải thích optimistic update

```typescript
123:           patchState(store, {
124:             projects: store.projects().filter((p) => p.id !== projectId),
125:           });
```

- **`store.projects()`**: Lấy mảng projects hiện tại
- **`.filter((p) => p.id !== projectId)`**: Loại bỏ project vừa xóa
- **`patchState`**: Update state
- **Optimistic**: Xóa khỏi UI ngay (không chờ real-time sync)

```typescript
126:           errorService.showSuccess('Project deleted successfully');
```

- Hiển thị snackbar thành công

```typescript
127:         } catch (err: any) {
```

- Bắt lỗi nếu có

```typescript
128:           const errorMessage = err?.message || 'Failed to delete project';
129:           console.error('Failed to delete project', err);
130:           errorService.showError(errorMessage);
```

- Xử lý lỗi: Log và hiển thị notification

```typescript
131:         }
132:       },
```

- Đóng try-catch và method

---

### METHOD 6: acceptInvite (Dòng 133-151)

```typescript
133:       acceptInvite: async (project: Project, userId: string) => {
```

- **2 tham số**: Project object và userId

```typescript
134:         try {
135:           await projectsService.acceptInvite(project, userId);
```

- Gọi service update Firestore:
  - Xóa userId khỏi `invitedMemberIds`
  - Thêm userId vào `memberIds`

```typescript
136:           // Optimistic / Reload
137:           // Remove from invites, add to projects
```

- Comment giải thích optimistic update

```typescript
138:           patchState(store, {
```

- Bắt đầu update state

```typescript
139:             pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
```

- **Xóa khỏi pending invites**: Filter ra project vừa accept

```typescript
140:             projects: [
141:               ...store.projects(),
142:               { ...project, memberIds: [...project.memberIds, userId] },
143:             ],
```

- **Thêm vào projects**:
  - **`...store.projects()`**: Spread existing projects
  - **`{ ...project, ... }`**: Clone project object
  - **`memberIds: [...project.memberIds, userId]`**: Thêm userId vào memberIds
- **Optimistic**: UI update ngay (không chờ real-time)

```typescript
144:           });
145:           errorService.showSuccess(`Joined project "${project.name}"`);
```

- Hiển thị thông báo thành công với tên project

```typescript
146:         } catch (err: any) {
147:           const errorMessage = err?.message || 'Failed to accept invite';
148:           console.error('Failed to accept invite', err);
149:           errorService.showError(errorMessage);
150:         }
151:       },
```

- Error handling

---

### METHOD 7: rejectInvite (Dòng 152-164)

```typescript
152:       rejectInvite: async (project: Project, userId: string) => {
153:         try {
154:           await projectsService.rejectInvite(project, userId);
```

- Gọi service xóa userId khỏi `invitedMemberIds`

```typescript
155:           patchState(store, {
156:             pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
157:           });
```

- **Chỉ xóa khỏi pending invites**
- **Không thêm vào projects** (vì reject)

```typescript
158:           errorService.showInfo('Invitation declined');
```

- **`showInfo`**: Notification màu xanh (không phải success hay error)

```typescript
159:         } catch (err: any) {
160:           const errorMessage = err?.message || 'Failed to reject invite';
161:           console.error('Failed to reject invite', err);
162:           errorService.showError(errorMessage);
163:         }
164:       },
```

- Error handling

---

### METHOD 8: inviteUser (Dòng 165-197)

```typescript
165:       inviteUser: async (email: string) => {
```

- **Tham số**: Email của user cần mời

```typescript
166:         store.setLoading(true);
```

- Hiển thị loading spinner

```typescript
167:         try {
168:           const users = await firstValueFrom(projectsService.findUserByEmail(email));
```

- **`firstValueFrom`**: Chuyển Observable → Promise
- **`await`**: Đợi query Firestore xong
- **`users`**: Mảng users (thường 1 phần tử vì email unique)

```typescript
169:           if (users.length === 0) throw new Error('User not found');
```

- **Validation 1**: User có tồn tại không?
- **`throw new Error`**: Ném lỗi → Nhảy vào catch block

```typescript
170:           const userToInvite = users[0];
```

- Lấy user đầu tiên (và duy nhất)

```typescript
171:           const project = store.selectedProject();
```

- Lấy project đang được chọn từ computed signal

```typescript
172:
173:           if (project) {
```

- Kiểm tra project có tồn tại không

```typescript
174:             // Check if already member
175:             if (project.memberIds.includes(userToInvite.uid)) {
176:               throw new Error('User is already a member');
177:             }
```

- **Validation 2**: User đã là member chưa?
- **`.includes(uid)`**: Kiểm tra UID có trong mảng không

```typescript
178:             // Check if already invited
179:             if (project.invitedMemberIds?.includes(userToInvite.uid)) {
180:               throw new Error('User is already invited');
181:             }
```

- **Validation 3**: User đã được mời chưa?
- **`?.includes`**: Optional chaining (tránh crash nếu invitedMemberIds = undefined)

```typescript
182:
183:             await projectsService.inviteUserToProject(
184:               project.id,
185:               userToInvite.uid,
186:               project.invitedMemberIds
187:             );
```

- **Gọi service**: Update Firestore
- **3 tham số**:
  1. Project ID
  2. User ID cần mời
  3. Danh sách invited hiện tại

```typescript
188:             errorService.showSuccess(`Invitation sent to ${email}`);
```

- **Template literal**: Hiển thị email trong message
- **`${email}`**: Inject biến vào string

```typescript
189:           }
190:           store.setLoading(false);
```

- Tắt loading spinner

```typescript
191:         } catch (err: any) {
192:           const errorMessage = err?.message || 'Failed to invite user';
193:           console.error(err);
194:           errorService.showError(errorMessage);
195:           throw err;
```

- **Error handling**
- **`throw err`**: Re-throw để caller biết có lỗi

```typescript
196:         }
197:       },
```

- Đóng method

---

### METHOD 9: removeMember (Dòng 198-225)

```typescript
198:       removeMember: async (memberId: string) => {
```

- **Tham số**: ID của member cần xóa

```typescript
199:         store.setLoading(true);
200:         try {
201:           const project = store.selectedProject();
202:           if (project) {
```

- Lấy project đang được chọn

```typescript
203:             // Unassign issues from this member in this project
204:             await issueService.unassignUserFromProjectIssues(project.id, memberId);
```

- **QUAN TRỌNG**: Phải unassign tasks TRƯỚC
- **Tránh task "mồ côi"**: Task có assignee không còn trong project
- **`await`**: Đợi unassign xong mới tiếp tục

```typescript
205:
206:             await projectsService.removeMemberFromProject(project.id, memberId, project.memberIds);
```

- **Sau đó** mới xóa khỏi memberIds
- **3 tham số**:
  1. Project ID
  2. Member ID cần xóa
  3. Danh sách members hiện tại

```typescript
207:
208:             // Update local state
209:             const newMemberIds = project.memberIds.filter((id) => id !== memberId);
```

- **Tính toán memberIds mới**: Loại bỏ memberId
- **Immutable**: Không mutate `project.memberIds`

```typescript
210:             patchState(store, {
```

- Bắt đầu update state

```typescript
211:               members: store.members().filter((m) => m.uid !== memberId),
```

- **Update members signal**: Xóa member khỏi danh sách hiển thị

```typescript
212:               projects: store
213:                 .projects()
214:                 .map((p) => (p.id === project.id ? { ...p, memberIds: newMemberIds } : p)),
```

**Giải thích chi tiết**:

- **`store.projects()`**: Lấy mảng projects
- **`.map((p) =>`**: Map qua từng project
- **`p.id === project.id`**: Kiểm tra có phải project đang xóa member không
- **`? { ...p, memberIds: newMemberIds }`**: Nếu đúng → Clone project và update memberIds
- **`: p`**: Nếu không → Giữ nguyên project
- **Kết quả**: Chỉ update 1 project, giữ nguyên các projects khác

```typescript
215:             });
216:             errorService.showSuccess('Member removed successfully');
217:           }
218:           store.setLoading(false);
```

- Hiển thị thông báo và tắt loading

```typescript
219:         } catch (err: any) {
220:           const errorMessage = err?.message || 'Failed to remove member';
221:           console.error('Failed to remove member', err);
222:           errorService.showError(errorMessage);
223:           throw err;
```

- Error handling và re-throw

```typescript
224:         }
225:       },
```

- Đóng method

```typescript
226:     })
```

- Đóng object chứa tất cả methods

```typescript
227:   ),
```

- Đóng withMethods

---

## 🪝 PHẦN 5: HOOKS (Dòng 228-277)

### Dòng 228-231: Hooks Setup

```typescript
228:   withHooks({
```

- Feature thêm lifecycle hooks

```typescript
229:     onInit(store) {
```

- **`onInit`**: Chạy khi store được khởi tạo
- **`(store)`**: Nhận store instance

```typescript
230:       const authStore = inject(AuthStore);
```

- Inject AuthStore để lấy user info

```typescript
231:       const router = inject(Router);
```

- Inject Router để redirect

---

### EFFECT 1: Auto-load Projects & Invites (Dòng 233-237)

```typescript
232:
233:       effect(() => {
```

- **`effect`**: Tạo side effect
- **`() =>`**: Arrow function (chạy khi dependencies thay đổi)

```typescript
234:         const user = authStore.user();
```

- **Đọc signal**: `authStore.user()`
- **Dependency**: Effect tự động chạy lại khi `user` thay đổi

```typescript
235:         store.loadProjects(user ? user.uid : null);
```

- **Ternary operator**: `user ? user.uid : null`
- **Nếu user đăng nhập**: Gọi `loadProjects(uid)`
- **Nếu user logout**: Gọi `loadProjects(null)` → Clear data

```typescript
236:         store.loadInvites(user ? user.uid : null);
```

- Tương tự cho invites

```typescript
237:       });
```

- Đóng effect

**Khi nào chạy?**:

```typescript
// 1. User đăng nhập
user: null → { uid: "user123" }
→ Effect chạy
→ loadProjects("user123")
→ loadInvites("user123")

// 2. User đăng xuất
user: { uid: "user123" } → null
→ Effect chạy
→ loadProjects(null) → Clear projects
→ loadInvites(null) → Clear invites
```

---

### EFFECT 2: Auto-load Members (Dòng 238-246)

```typescript
238:
239:       effect(() => {
```

- Effect thứ 2

```typescript
240:         const project = store.selectedProject();
```

- **Đọc computed signal**: `selectedProject()`
- **Dependency**: Effect chạy khi `selectedProject` thay đổi

```typescript
241:         if (project && project.memberIds.length > 0) {
```

- **Kiểm tra**:
  - `project`: Có project được chọn không?
  - `project.memberIds.length > 0`: Có members không?

```typescript
242:           store.loadMembers(project.memberIds);
```

- **Gọi loadMembers**: Load thông tin chi tiết các members

```typescript
243:         } else {
```

- **Nếu không có project hoặc không có members**

```typescript
244:           patchState(store, { members: [] });
```

- **Clear members**: Set về mảng rỗng

```typescript
245:         }
246:       });
```

- Đóng if-else và effect

**Khi nào chạy?**:

```typescript
// 1. User chọn project
selectedProject: null → { id: "proj1", memberIds: ["u1", "u2"] }
→ Effect chạy
→ loadMembers(["u1", "u2"])

// 2. User quay về danh sách
selectedProject: { ... } → null
→ Effect chạy
→ patchState({ members: [] })

// 3. Project members thay đổi (real-time)
selectedProject.memberIds: ["u1", "u2"] → ["u1", "u2", "u3"]
→ Effect chạy
→ loadMembers(["u1", "u2", "u3"])
```

---

### EFFECT 3: Security Check (Dòng 248-275)

```typescript
247:
248:       // Security/Real-time check:
249:       // If the user has a selectedProject (is viewing one), but that project disappears from their list
250:       // (kicked or deleted), alert them and redirect to project list.
```

- **Comment dài**: Giải thích mục đích của effect

```typescript
251:       effect(() => {
```

- Effect thứ 3

```typescript
252:         const projects = store.projects();
```

- **Đọc signal**: Danh sách projects user có quyền truy cập

```typescript
253:         const selectedId = store.selectedProjectId();
```

- **Đọc signal**: ID của project đang xem

```typescript
254:         const isLoading = store.loading();
```

- **Đọc signal**: Trạng thái loading

```typescript
255:
256:         if (!isLoading && selectedId) {
```

- **Kiểm tra**:
  - `!isLoading`: Không đang load (tránh false positive)
  - `selectedId`: Có project được chọn

```typescript
257:           // Check if project exists in user's access list
258:           const stillHasAccess = projects.some((p) => p.id === selectedId);
```

- **`projects.some(...)`**: Kiểm tra có project nào có ID = selectedId không
- **`stillHasAccess`**: `true` nếu vẫn có quyền, `false` nếu mất quyền

```typescript
259:
260:           if (!stillHasAccess) {
```

- **Nếu mất quyền truy cập**

```typescript
261:             // Access lost (kicked or project deleted)
262:             // Use setTimeout to avoid 'ExpressionChangedAfterItHasBeenCheckedError'
263:             // and allow UI to stabilize if this is a transient state
```

- **Comment giải thích** tại sao dùng setTimeout

```typescript
264:             setTimeout(() => {
```

- **`setTimeout`**: Delay 200ms
- **Tránh lỗi**: Angular change detection error
- **Cho UI ổn định**: Tránh false positive

```typescript
265:               const currentProjects = store.projects();
```

- **Double-check**: Đọc lại projects sau 200ms

```typescript
266:               // Re-verify condition
267:               if (!currentProjects.some((p) => p.id === selectedId)) {
```

- **Verify lại**: Vẫn không có access?

```typescript
268:                 alert('Project does not exist anymore ');
```

- **Alert**: Thông báo cho user
- **Note**: Có space thừa ở cuối string (có thể fix)

```typescript
269:                 patchState(store, { selectedProjectId: null });
```

- **Clear selection**: Set selectedProjectId = null

```typescript
270:                 router.navigate(['/projects']);
```

- **Redirect**: Quay về trang danh sách projects

```typescript
271:               }
272:             }, 200);
```

- **200ms delay**
- Đóng if và setTimeout

```typescript
273:           }
274:         }
275:       });
```

- Đóng các if và effect

**Timeline thực tế**:

```
T=0s   User đang xem Project A
T=1s   Owner kick user ra khỏi Project A
T=1.1s Firestore phát hiện user không còn trong memberIds
T=1.2s Ngừng stream Project A đến máy user
T=1.3s Observable emit: projects không còn Project A
T=1.4s Effect 3 chạy
T=1.5s stillHasAccess = false
T=1.7s setTimeout 200ms
T=1.9s Double-check: Vẫn không có access
T=2.0s Alert: "Project does not exist anymore"
T=2.1s Redirect về /projects
```

---

### Dòng 276-279: Closing

```typescript
276:     },
```

- Đóng `onInit` function

```typescript
277:   })
```

- Đóng `withHooks` object

```typescript
278: );
```

- Đóng `signalStore()` function call

```typescript
279:
```

- Dòng trống cuối file

---

## 📊 TÓM TẮT CẤU TRÚC

```typescript
export const ProjectsStore = signalStore(
  // 1. Config
  { providedIn: 'root' },

  // 2. Custom Features
  withLoadingError(),

  // 3. State
  withState(initialState),

  // 4. Computed Signals
  withComputed(({ projects, selectedProjectId }) => ({
    selectedProject: computed(...)
  })),

  // 5. Methods
  withMethods((store, services...) => ({
    loadProjects: rxMethod(...),
    loadInvites: rxMethod(...),
    selectProject: (...) => {...},
    loadMembers: rxMethod(...),
    deleteProject: async (...) => {...},
    acceptInvite: async (...) => {...},
    rejectInvite: async (...) => {...},
    inviteUser: async (...) => {...},
    removeMember: async (...) => {...}
  })),

  // 6. Lifecycle Hooks
  withHooks({
    onInit(store) {
      // Effect 1: Auto-load projects & invites
      effect(() => {...});

      // Effect 2: Auto-load members
      effect(() => {...});

      // Effect 3: Security check
      effect(() => {...});
    }
  })
);
```

---

## 🎯 ĐIỂM QUAN TRỌNG

### 1. Signals vs Regular Variables

```typescript
// ❌ Sai - Không reactive
const projects = store.projects;

// ✅ Đúng - Gọi signal để lấy giá trị
const projects = store.projects();
```

### 2. Immutability

```typescript
// ❌ Sai - Mutate array
store.projects().push(newProject);

// ✅ Đúng - Immutable update
patchState(store, {
  projects: [...store.projects(), newProject],
});
```

### 3. Effect Dependencies

```typescript
effect(() => {
  const user = authStore.user(); // ← Dependency
  store.loadProjects(user?.uid); // ← Side effect
});
// Effect tự động chạy lại khi user thay đổi
```

### 4. Optimistic Updates

```typescript
// Update UI trước
patchState(store, { projects: updatedProjects });

// Sau đó mới gọi API
await service.updateProject(...);
```

### 5. Error Handling Pattern

```typescript
try {
  await asyncOperation();
  errorService.showSuccess('Success!');
} catch (err: any) {
  const errorMessage = err?.message || 'Failed';
  console.error(err);
  errorService.showError(errorMessage);
  throw err; // Re-throw nếu cần
}
```

---

Đây là bản giải thích **TỪNG DÒNG CODE** chi tiết nhất có thể! 🎓
