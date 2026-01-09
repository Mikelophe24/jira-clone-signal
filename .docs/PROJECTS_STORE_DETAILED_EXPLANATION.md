# 🧠 Giải Thích Chi Tiết: projects.store.ts

> **Mục đích**: Tài liệu này giải thích từng dòng code trong file `projects.store.ts` - "bộ não trung tâm" quản lý state của Projects, bao gồm cơ chế Signals, Effects, và Real-time synchronization.

---

## 📋 Tổng Quan

**File**: `src/app/features/projects/projects.store.ts`  
**Vai trò**: Global State Management cho Projects feature  
**Công nghệ**: NgRx SignalStore (state management mới nhất của Angular)  
**Đặc điểm**: Reactive, Real-time, Type-safe

---

## 🎯 Kiến Trúc Store

```
┌─────────────────────────────────────────────────────┐
│              ProjectsStore                          │
├─────────────────────────────────────────────────────┤
│  STATE (Dữ liệu)                                    │
│  - projects: Project[]                              │
│  - projectOwners: AppUser[]                         │
│  - members: AppUser[]                               │
│  - pendingInvites: Project[]                        │
│  - selectedProjectId: string | null                 │
│  - loading: boolean                                 │
│  - error: string | null                             │
├─────────────────────────────────────────────────────┤
│  COMPUTED (Tính toán tự động)                       │
│  - selectedProject                                  │
├─────────────────────────────────────────────────────┤
│  METHODS (Hành động)                                │
│  - loadProjects()                                   │
│  - loadInvites()                                    │
│  - loadMembers()                                    │
│  - deleteProject()                                  │
│  - inviteUser()                                     │
│  - acceptInvite()                                   │
│  - rejectInvite()                                   │
│  - removeMember()                                   │
│  - selectProject()                                  │
├─────────────────────────────────────────────────────┤
│  HOOKS (Lifecycle)                                  │
│  - onInit() → 3 Effects                             │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 PHẦN 1: Imports & Dependencies

```typescript
import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withComputed,
  withHooks,
} from '@ngrx/signals';
import { inject, computed, effect } from '@angular/core';
import { ProjectsService } from './projects.service';
import { IssueService } from '../issue/issue.service';
import { Project } from './project.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Router } from '@angular/router';
import { pipe, tap, switchMap, catchError, of, firstValueFrom } from 'rxjs';
import { AppUser } from '../../core/models/app-user.model';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../../core/services/error-notification.service';
import { AuthStore } from '../../core/auth/auth.store';
```

### Giải thích từng nhóm import

#### NgRx Signals Store

- **`signalStore`**: Factory function tạo store
- **`withState`**: Thêm state vào store
- **`withMethods`**: Thêm methods (actions) vào store
- **`patchState`**: Update một phần state (immutable)
- **`withComputed`**: Thêm computed signals (tự động tính toán)
- **`withHooks`**: Thêm lifecycle hooks (onInit, onDestroy)

#### Angular Core

- **`inject`**: Dependency injection
- **`computed`**: Tạo computed signal
- **`effect`**: Tạo side effect (chạy khi signal thay đổi)

#### RxJS

- **`rxMethod`**: Chuyển Observable thành method của store
- **`pipe`**: Kết hợp operators
- **`tap`**: Side effect trong stream
- **`switchMap`**: Chuyển đổi stream (cancel stream cũ)
- **`catchError`**: Xử lý lỗi
- **`of`**: Tạo Observable từ giá trị
- **`firstValueFrom`**: Chuyển Observable → Promise

---

## 📊 PHẦN 2: State Definition

```typescript
type ProjectsState = {
  projects: Project[]; // Danh sách dự án user tham gia
  projectOwners: AppUser[]; // Cache thông tin owner (tránh query lặp)
  members: AppUser[]; // Thành viên của dự án đang chọn
  pendingInvites: Project[]; // Dự án user được mời
  selectedProjectId: string | null; // ID dự án đang xem
  filter: string; // (Dự phòng cho tính năng tìm kiếm)
};

const initialState: ProjectsState = {
  projects: [],
  projectOwners: [],
  members: [],
  pendingInvites: [],
  selectedProjectId: null,
  filter: '',
};
```

### Giải thích từng field

#### `projects: Project[]`

**Mục đích**: Lưu tất cả projects mà user là thành viên

**Ví dụ**:

```typescript
projects = [
  { id: 'proj1', name: 'Website', memberIds: ['user1', 'user2'] },
  { id: 'proj2', name: 'Mobile App', memberIds: ['user1', 'user3'] },
];
```

**Cập nhật**: Tự động qua real-time listener

---

#### `projectOwners: AppUser[]`

**Mục đích**: Cache thông tin owner để hiển thị tên (thay vì UID)

**Tại sao cần cache?**

```typescript
// ❌ Không cache - Query lặp lại
projects.forEach((project) => {
  const owner = await getUser(project.ownerId); // Query 10 lần!
  console.log(owner.displayName);
});

// ✅ Có cache - Query 1 lần
const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
const owners = await getUsers(ownerIds); // Query 1 lần duy nhất
// Sau đó dùng cache
```

**Ví dụ**:

```typescript
projectOwners = [
  { uid: 'user1', displayName: 'John Doe', email: 'john@ex.com' },
  { uid: 'user2', displayName: 'Jane Smith', email: 'jane@ex.com' },
];
```

---

#### `members: AppUser[]`

**Mục đích**: Lưu thông tin chi tiết các thành viên của project đang được chọn

**Khi nào load?**: Khi `selectedProject` thay đổi (xem Effect 2)

**Ví dụ**:

```typescript
// User đang xem project "proj1"
selectedProjectId = 'proj1';
selectedProject = { memberIds: ['user1', 'user2', 'user3'] };

// Store tự động load members
members = [
  { uid: 'user1', displayName: 'Alice' },
  { uid: 'user2', displayName: 'Bob' },
  { uid: 'user3', displayName: 'Charlie' },
];
```

---

#### `pendingInvites: Project[]`

**Mục đích**: Danh sách projects mà user được mời (chưa accept/reject)

**Query**: `where('invitedMemberIds', 'array-contains', userId)`

**Ví dụ**:

```typescript
pendingInvites = [
  {
    id: 'proj3',
    name: 'Design System',
    invitedMemberIds: ['currentUserId'],
  },
];
```

**Hiển thị**: Badge notification trên header

---

#### `selectedProjectId: string | null`

**Mục đích**: Track project nào đang được xem

**Cập nhật**: Khi user navigate đến `/project/:id`

**Ví dụ**:

```typescript
// User vào /project/abc123
selectedProjectId = 'abc123';

// User vào /projects (danh sách)
selectedProjectId = null;
```

---

#### `filter: string`

**Mục đích**: Dự phòng cho tính năng search/filter (chưa implement)

**Ví dụ tương lai**:

```typescript
filter = 'website';
filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));
```

---

## 🏗️ PHẦN 3: Store Creation

```typescript
export const ProjectsStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(({ projects, selectedProjectId }) => ({
    selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId())),
  })),
  withMethods(/* ... */),
  withHooks(/* ... */)
);
```

### `signalStore()`

Factory function tạo store với các features

### `{ providedIn: 'root' }`

- Store là **singleton** (1 instance duy nhất)
- Tự động tree-shakeable
- Không cần khai báo trong providers

### `withLoadingError()`

Custom feature thêm:

- `loading: boolean` signal
- `error: string | null` signal
- `setLoading(boolean)` method
- `setError(string)` method

**Ví dụ sử dụng**:

```typescript
// Trong method
store.setLoading(true);
try {
  await someAsyncOperation();
  store.setLoading(false);
} catch (err) {
  store.setError(err.message);
}
```

### `withState(initialState)`

Thêm state vào store với giá trị khởi tạo

### `withComputed()`

Thêm computed signals (giải thích chi tiết bên dưới)

---

## 🔄 PHẦN 4: Computed Signals

```typescript
withComputed(({ projects, selectedProjectId }) => ({
  selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId())),
}));
```

### Cơ Chế Hoạt Động

**Computed signal** tự động tính toán lại khi dependencies thay đổi:

```typescript
// Khi selectedProjectId hoặc projects thay đổi
// → selectedProject tự động tính lại

// Ví dụ:
selectedProjectId = 'proj1';
projects = [
  { id: 'proj1', name: 'Website' },
  { id: 'proj2', name: 'Mobile' },
];

// Computed tự động chạy:
selectedProject = projects.find((p) => p.id === 'proj1');
// Kết quả: { id: "proj1", name: "Website" }
```

### Tại Sao Dùng Computed?

#### ❌ Không dùng computed (Manual update)

```typescript
// Phải update thủ công mỗi khi selectedProjectId thay đổi
selectProject(id: string) {
  patchState(store, {
    selectedProjectId: id,
    selectedProject: projects.find(p => p.id === id) // ← Dễ quên!
  });
}
```

#### ✅ Dùng computed (Auto update)

```typescript
// Chỉ cần update selectedProjectId
selectProject(id: string) {
  patchState(store, { selectedProjectId: id });
  // selectedProject tự động update!
}
```

### Sử Dụng Trong Component

```typescript
// Trong component
const project = this.store.selectedProject();

// Hoặc trong template
@if (store.selectedProject(); as project) {
  <h1>{{ project.name }}</h1>
}
```

---

## 🎬 PHẦN 5: Methods (Actions)

### 5.1. `loadProjects` - Load Dự Án Real-time

```typescript
loadProjects: rxMethod<string | null>(
  pipe(
    tap(() => store.setLoading(true)),
    switchMap((userId) => {
      if (!userId) {
        patchState(store, { projects: [], projectOwners: [], selectedProjectId: null });
        store.setLoading(false);
        return of([]);
      }
      return projectsService.getProjects(userId).pipe(
        tap((projects) => patchState(store, { projects })),
        // Extract owner IDs and load them
        switchMap((projects) => {
          const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
          if (ownerIds.length === 0) return of([]);
          return projectsService.getUsers(ownerIds);
        }),
        tap((owners) => {
          patchState(store, { projectOwners: owners });
          store.setLoading(false);
        }),
        catchError((err) => {
          const errorMessage = err?.message || 'Failed to load projects';
          console.error('Error loading projects:', err);
          errorService.showError(errorMessage);
          return of([]);
        })
      );
    })
  )
);
```

#### Giải Thích Từng Bước

**Bước 1: Set loading state**

```typescript
tap(() => store.setLoading(true));
```

- Hiển thị spinner trên UI

**Bước 2: Kiểm tra userId**

```typescript
if (!userId) {
  patchState(store, { projects: [], projectOwners: [], selectedProjectId: null });
  store.setLoading(false);
  return of([]);
}
```

- Nếu user logout → Clear tất cả dữ liệu

**Bước 3: Load projects từ Firestore**

```typescript
return projectsService.getProjects(userId).pipe(
  tap((projects) => patchState(store, { projects }))
  // ...
);
```

- Gọi service query Firestore
- Observable real-time → Tự động emit khi có thay đổi
- Update state ngay khi có dữ liệu

**Bước 4: Extract owner IDs**

```typescript
switchMap((projects) => {
  const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
  if (ownerIds.length === 0) return of([]);
  return projectsService.getUsers(ownerIds);
});
```

**Ví dụ**:

```typescript
projects = [
  { ownerId: 'user1' },
  { ownerId: 'user2' },
  { ownerId: 'user1' }, // duplicate
];

// Extract unique IDs
ownerIds = ['user1', 'user2']; // Set tự động loại duplicate
```

**Bước 5: Load owner info và cache**

```typescript
tap((owners) => {
  patchState(store, { projectOwners: owners });
  store.setLoading(false);
});
```

**Bước 6: Error handling**

```typescript
catchError((err) => {
  const errorMessage = err?.message || 'Failed to load projects';
  console.error('Error loading projects:', err);
  errorService.showError(errorMessage);
  return of([]); // Trả về empty array để stream không bị break
});
```

#### Luồng Hoạt Động

```
User đăng nhập
   ↓
Effect gọi loadProjects(userId)
   ↓
Set loading = true
   ↓
Query Firestore: where('memberIds', 'array-contains', userId)
   ↓
Nhận projects → Update state
   ↓
Extract ownerIds: ["user1", "user2"]
   ↓
Query users: where('uid', 'in', ownerIds)
   ↓
Nhận owners → Cache vào projectOwners
   ↓
Set loading = false
   ↓
UI tự động render
```

---

### 5.2. `loadInvites` - Load Lời Mời

```typescript
loadInvites: rxMethod<string | null>(
  pipe(
    switchMap((userId) => {
      if (!userId) {
        patchState(store, { pendingInvites: [] });
        return of([]);
      }
      return projectsService.getPendingInvites(userId).pipe(
        tap((pendingInvites) => patchState(store, { pendingInvites })),
        switchMap((invites) => {
          const ownerIds = [...new Set(invites.map((p) => p.ownerId))];
          if (ownerIds.length === 0) return of([]);
          return projectsService.getUsers(ownerIds);
        }),
        tap((newOwners) => {
          const existingOwners = store.projectOwners();
          // Simple merge distinct by UID
          const merged = [...existingOwners, ...newOwners].filter(
            (v, i, a) => a.findIndex((t) => t.uid === v.uid) === i
          );
          patchState(store, { projectOwners: merged });
        })
      );
    })
  )
);
```

#### Điểm Khác Biệt Với `loadProjects`

1. **Query khác**: `where('invitedMemberIds', 'array-contains', userId)`
2. **Merge owners**: Gộp với owners đã có (không overwrite)

#### Merge Logic

```typescript
const existingOwners = store.projectOwners();
const merged = [...existingOwners, ...newOwners].filter(
  (v, i, a) => a.findIndex((t) => t.uid === v.uid) === i
);
```

**Ví dụ**:

```typescript
existingOwners = [
  { uid: 'user1', displayName: 'Alice' },
  { uid: 'user2', displayName: 'Bob' },
];

newOwners = [
  { uid: 'user2', displayName: 'Bob' }, // duplicate
  { uid: 'user3', displayName: 'Charlie' }, // new
];

// Merge
merged = [
  { uid: 'user1', displayName: 'Alice' },
  { uid: 'user2', displayName: 'Bob' }, // chỉ giữ 1
  { uid: 'user3', displayName: 'Charlie' },
];
```

---

### 5.3. `selectProject` - Chọn Dự Án

```typescript
selectProject: (projectId: string) => {
  patchState(store, { selectedProjectId: projectId });
};
```

**Đơn giản nhưng mạnh mẽ**:

- Chỉ update `selectedProjectId`
- `selectedProject` computed tự động update
- Effect 2 tự động load members

**Sử dụng**:

```typescript
// Trong routing
route.params.subscribe((params) => {
  store.selectProject(params['id']);
});
```

---

### 5.4. `loadMembers` - Load Thành Viên

```typescript
loadMembers: rxMethod<string[]>(
  pipe(
    switchMap((ids) => projectsService.getUsers(ids)),
    tap((members) => patchState(store, { members }))
  )
);
```

**Khi nào gọi?**: Tự động qua Effect 2 khi `selectedProject` thay đổi

**Ví dụ**:

```typescript
// User chọn project có memberIds: ["user1", "user2", "user3"]
loadMembers(["user1", "user2", "user3"])
   ↓
getUsers() → Chunking nếu > 10 IDs
   ↓
members = [
  { uid: "user1", displayName: "Alice" },
  { uid: "user2", displayName: "Bob" },
  { uid: "user3", displayName: "Charlie" }
]
```

---

### 5.5. `deleteProject` - Xóa Dự Án

```typescript
deleteProject: async (projectId: string) => {
  try {
    await projectsService.deleteProject(projectId);
    // Optimistic update: Remove from list locally
    patchState(store, {
      projects: store.projects().filter((p) => p.id !== projectId),
    });
    errorService.showSuccess('Project deleted successfully');
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to delete project';
    console.error('Failed to delete project', err);
    errorService.showError(errorMessage);
  }
};
```

#### Optimistic Update

**Cơ chế**:

```
1. Xóa ngay khỏi UI (không chờ Firestore)
2. Gọi Firestore delete
3. Nếu thành công → UI đã đúng rồi
4. Nếu lỗi → Hiển thị error (nhưng UI đã sai)
```

**Lợi ích**: UX nhanh hơn (user thấy kết quả ngay lập tức)

**Nhược điểm**: Nếu lỗi, state bị sai (cần reload)

---

### 5.6. `inviteUser` - Mời Thành Viên

```typescript
inviteUser: async (email: string) => {
  store.setLoading(true);
  try {
    const users = await firstValueFrom(projectsService.findUserByEmail(email));
    if (users.length === 0) throw new Error('User not found');
    const userToInvite = users[0];
    const project = store.selectedProject();

    if (project) {
      // Check if already member
      if (project.memberIds.includes(userToInvite.uid)) {
        throw new Error('User is already a member');
      }
      // Check if already invited
      if (project.invitedMemberIds?.includes(userToInvite.uid)) {
        throw new Error('User is already invited');
      }

      await projectsService.inviteUserToProject(
        project.id,
        userToInvite.uid,
        project.invitedMemberIds
      );
      errorService.showSuccess(`Invitation sent to ${email}`);
    }
    store.setLoading(false);
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to invite user';
    console.error(err);
    errorService.showError(errorMessage);
    throw err;
  }
};
```

#### Validation Chain

```typescript
// 1. User tồn tại?
if (users.length === 0) throw Error('User not found');

// 2. Đã là member?
if (project.memberIds.includes(userId)) throw Error('Already a member');

// 3. Đã được mời?
if (project.invitedMemberIds?.includes(userId)) throw Error('Already invited');

// 4. OK → Gửi lời mời
await inviteUserToProject(...);
```

---

### 5.7. `acceptInvite` - Chấp Nhận Lời Mời

```typescript
acceptInvite: async (project: Project, userId: string) => {
  try {
    await projectsService.acceptInvite(project, userId);
    // Optimistic / Reload
    // Remove from invites, add to projects
    patchState(store, {
      pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
      projects: [...store.projects(), { ...project, memberIds: [...project.memberIds, userId] }],
    });
    errorService.showSuccess(`Joined project "${project.name}"`);
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to accept invite';
    console.error('Failed to accept invite', err);
    errorService.showError(errorMessage);
  }
};
```

#### Optimistic Update

```typescript
// Trước khi gọi API, update UI ngay:
patchState(store, {
  pendingInvites: pendingInvites.filter(p => p.id !== project.id), // Xóa khỏi invites
  projects: [...projects, updatedProject]                          // Thêm vào projects
});

// Sau đó mới gọi Firestore
await projectsService.acceptInvite(...);
```

**Kết quả**: User thấy project xuất hiện ngay lập tức!

---

### 5.8. `removeMember` - Xóa Thành Viên

```typescript
removeMember: async (memberId: string) => {
  store.setLoading(true);
  try {
    const project = store.selectedProject();
    if (project) {
      // Unassign issues from this member in this project
      await issueService.unassignUserFromProjectIssues(project.id, memberId);

      await projectsService.removeMemberFromProject(project.id, memberId, project.memberIds);

      // Update local state
      const newMemberIds = project.memberIds.filter((id) => id !== memberId);
      patchState(store, {
        members: store.members().filter((m) => m.uid !== memberId),
        projects: store
          .projects()
          .map((p) => (p.id === project.id ? { ...p, memberIds: newMemberIds } : p)),
      });
      errorService.showSuccess('Member removed successfully');
    }
    store.setLoading(false);
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to remove member';
    console.error('Failed to remove member', err);
    errorService.showError(errorMessage);
    throw err;
  }
};
```

#### Thứ Tự Quan Trọng

```typescript
// 1. PHẢI unassign tasks trước
await issueService.unassignUserFromProjectIssues(projectId, memberId);

// 2. Sau đó mới xóa khỏi memberIds
await projectsService.removeMemberFromProject(...);

// 3. Cuối cùng update local state
patchState(store, { ... });
```

**Tại sao?** Tránh task "mồ côi" (assignee không còn trong project)

---

## 🪝 PHẦN 6: Hooks (Lifecycle)

```typescript
withHooks({
  onInit(store) {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    // Effect 1: Auto-load khi user đăng nhập
    effect(() => {
      const user = authStore.user();
      store.loadProjects(user ? user.uid : null);
      store.loadInvites(user ? user.uid : null);
    });

    // Effect 2: Auto-load members khi chọn project
    effect(() => {
      const project = store.selectedProject();
      if (project && project.memberIds.length > 0) {
        store.loadMembers(project.memberIds);
      } else {
        patchState(store, { members: [] });
      }
    });

    // Effect 3: Security Check - Phát hiện mất quyền truy cập
    effect(() => {
      const projects = store.projects();
      const selectedId = store.selectedProjectId();
      const isLoading = store.loading();

      if (!isLoading && selectedId) {
        const stillHasAccess = projects.some((p) => p.id === selectedId);

        if (!stillHasAccess) {
          setTimeout(() => {
            const currentProjects = store.projects();
            if (!currentProjects.some((p) => p.id === selectedId)) {
              alert('Project does not exist anymore');
              patchState(store, { selectedProjectId: null });
              router.navigate(['/projects']);
            }
          }, 200);
        }
      }
    });
  },
});
```

### Effect 1: Auto-load Projects & Invites

```typescript
effect(() => {
  const user = authStore.user();
  store.loadProjects(user ? user.uid : null);
  store.loadInvites(user ? user.uid : null);
});
```

**Khi nào chạy?**: Mỗi khi `authStore.user()` thay đổi

**Scenarios**:

```typescript
// 1. User đăng nhập
user: null → { uid: "user123" }
→ loadProjects("user123")
→ loadInvites("user123")

// 2. User đăng xuất
user: { uid: "user123" } → null
→ loadProjects(null) → Clear projects
→ loadInvites(null) → Clear invites
```

---

### Effect 2: Auto-load Members

```typescript
effect(() => {
  const project = store.selectedProject();
  if (project && project.memberIds.length > 0) {
    store.loadMembers(project.memberIds);
  } else {
    patchState(store, { members: [] });
  }
});
```

**Khi nào chạy?**: Mỗi khi `selectedProject` thay đổi

**Scenarios**:

```typescript
// 1. User chọn project
selectedProject: null → { id: "proj1", memberIds: ["user1", "user2"] }
→ loadMembers(["user1", "user2"])

// 2. User quay về danh sách
selectedProject: { ... } → null
→ patchState({ members: [] })

// 3. Project members thay đổi (real-time)
selectedProject.memberIds: ["user1", "user2"] → ["user1", "user2", "user3"]
→ loadMembers(["user1", "user2", "user3"])
```

---

### Effect 3: Security Check (Real-time)

```typescript
effect(() => {
  const projects = store.projects();
  const selectedId = store.selectedProjectId();
  const isLoading = store.loading();

  if (!isLoading && selectedId) {
    const stillHasAccess = projects.some((p) => p.id === selectedId);

    if (!stillHasAccess) {
      setTimeout(() => {
        // Double-check
        const currentProjects = store.projects();
        if (!currentProjects.some((p) => p.id === selectedId)) {
          alert('Project does not exist anymore');
          patchState(store, { selectedProjectId: null });
          router.navigate(['/projects']);
        }
      }, 200);
    }
  }
});
```

#### Tình Huống Thực Tế

```
T=0s   User đang xem Project A
T=1s   Owner kick user ra khỏi Project A
T=1.1s Firestore phát hiện user không còn trong memberIds
T=1.2s Ngừng stream Project A đến máy user
T=1.3s Observable emit: projects không còn Project A
T=1.4s Effect 3 chạy: selectedId = "A", projects không chứa "A"
T=1.5s stillHasAccess = false
T=1.7s setTimeout 200ms
T=1.9s Double-check: Vẫn không có access
T=2.0s Alert: "Project does not exist anymore"
T=2.1s Redirect về /projects
```

#### Tại Sao Dùng `setTimeout`?

**Vấn đề**: Angular change detection có thể gây lỗi nếu update state trong cùng 1 cycle

**Giải pháp**: Delay 200ms để:

1. Cho UI ổn định
2. Tránh `ExpressionChangedAfterItHasBeenCheckedError`
3. Double-check để chắc chắn (tránh false positive)

---

## 🔄 PHẦN 7: Data Flow Examples

### Example 1: User Đăng Nhập

```
1. User login → AuthStore.user() = { uid: "user123" }
   ↓
2. Effect 1 phát hiện thay đổi
   ↓
3. Gọi loadProjects("user123") & loadInvites("user123")
   ↓
4. Service query Firestore (2 queries parallel)
   ↓
5. Nhận dữ liệu:
   - projects: [proj1, proj2]
   - pendingInvites: [proj3]
   ↓
6. Extract ownerIds: ["owner1", "owner2", "owner3"]
   ↓
7. Load owners → Cache vào projectOwners
   ↓
8. UI tự động render:
   - Danh sách projects
   - Badge notification (1 invite)
```

---

### Example 2: User Chọn Project

```
1. User click vào Project A
   ↓
2. Router navigate /project/abc123
   ↓
3. Component gọi store.selectProject("abc123")
   ↓
4. patchState({ selectedProjectId: "abc123" })
   ↓
5. selectedProject computed tự động update
   ↓
6. Effect 2 phát hiện selectedProject thay đổi
   ↓
7. Gọi loadMembers(project.memberIds)
   ↓
8. Service query users
   ↓
9. patchState({ members: [...] })
   ↓
10. UI hiển thị danh sách members trong dialog
```

---

### Example 3: Owner Mời Member

```
1. Owner nhập email "alice@example.com"
   ↓
2. Dialog gọi store.inviteUser(email)
   ↓
3. Store tìm user → { uid: "alice_uid" }
   ↓
4. Kiểm tra: ✅ Chưa là member, ✅ Chưa được mời
   ↓
5. Service update Firestore:
   invitedMemberIds: [] → ["alice_uid"]
   ↓
6. Firestore push update qua WebSocket
   ↓
7. Alice's machine:
   - getPendingInvites Observable emit
   - patchState({ pendingInvites: [...] })
   - Badge: (0) → (1)
```

---

### Example 4: Invitee Accept

```
1. Alice bấm "Accept"
   ↓
2. Dialog gọi store.acceptInvite(project, "alice_uid")
   ↓
3. Optimistic update:
   - pendingInvites: xóa project
   - projects: thêm project
   - UI update ngay lập tức
   ↓
4. Service update Firestore:
   invitedMemberIds: ["alice_uid"] → []
   memberIds: ["owner"] → ["owner", "alice_uid"]
   ↓
5. Firestore push đến CẢ 2 máy:
   - Owner: getProjects emit (memberIds updated)
   - Alice: getProjects emit (project mới) + getPendingInvites emit (project removed)
   ↓
6. Cả 2 UI tự động sync
```

---

## 🎯 PHẦN 8: Best Practices Được Áp Dụng

### 1. Immutability

```typescript
// ❌ Mutate array
store.projects().push(newProject);

// ✅ Immutable
patchState(store, {
  projects: [...store.projects(), newProject],
});
```

### 2. Optimistic Updates

```typescript
// Update UI trước
patchState(store, { projects: updatedProjects });

// Sau đó mới gọi API
await service.updateProject(...);
```

### 3. Error Handling

```typescript
try {
  await asyncOperation();
  errorService.showSuccess('Success!');
} catch (err: any) {
  const errorMessage = err?.message || 'Failed';
  console.error(err);
  errorService.showError(errorMessage);
  throw err; // Re-throw để caller biết có lỗi
}
```

### 4. Loading States

```typescript
store.setLoading(true);
try {
  await operation();
} finally {
  store.setLoading(false); // Luôn reset loading
}
```

### 5. Computed Signals

```typescript
// Tự động update, không cần manual sync
selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId()));
```

---

## 📝 TÓM TẮT

**ProjectsStore** là một state management solution hoàn chỉnh với:

✅ **Reactive**: Signals + Effects tự động cập nhật  
✅ **Real-time**: WebSocket connection với Firestore  
✅ **Type-safe**: TypeScript đầy đủ  
✅ **Optimistic**: Update UI trước, API sau  
✅ **Error handling**: Comprehensive try/catch  
✅ **Security**: Real-time access check  
✅ **Performance**: Caching, computed signals

**3 Effects chính**:

1. Auto-load projects khi login/logout
2. Auto-load members khi chọn project
3. Security check khi bị kick/project deleted

**Luồng dữ liệu**:

```
User Action → Store Method → Service → Firestore
                ↓                         ↓
            Update State ← Observable ← WebSocket
                ↓
            UI Auto-render
```
