# 🎯 Hướng Dẫn Chi Tiết: Hệ Thống Mời Thành Viên (Invitation System)

> **Mục đích**: Tài liệu này hướng dẫn chi tiết toàn bộ quy trình mời thành viên vào dự án, từ góc nhìn của cả Owner (người mời) và Invitee (người được mời), bao gồm code, luồng dữ liệu và real-time updates.

---

## 📋 Tổng Quan Hệ Thống

### Kiến Trúc 2 Bước (Two-Step Invitation)

Hệ thống sử dụng mô hình **Invitation-Based** thay vì thêm thành viên trực tiếp:

```
┌─────────────────────────────────────────────────────┐
│  BƯỚC 1: INVITATION (Lời Mời)                       │
│  Owner → Gửi lời mời → Invitee nhận thông báo       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  BƯỚC 2: ACCEPTANCE (Chấp Nhận)                     │
│  Invitee → Accept/Reject → Trở thành member         │
└─────────────────────────────────────────────────────┘
```

### Lợi Ích Của Mô Hình Này

✅ **Tôn trọng quyền riêng tư**: User không bị thêm vào project mà không biết  
✅ **Tránh spam**: User có thể từ chối lời mời không mong muốn  
✅ **Audit trail**: Có lịch sử ai mời ai, khi nào  
✅ **UX tốt hơn**: User chủ động quyết định tham gia

---

## 🗂️ Cấu Trúc Dữ Liệu

### Project Model

```typescript
interface Project {
  id: string;
  name: string;
  key: string;
  ownerId: string;

  // Danh sách thành viên chính thức
  memberIds: string[];

  // Danh sách người được mời (chưa chấp nhận)
  invitedMemberIds?: string[];
}
```

### Ví Dụ Dữ Liệu Firestore

```javascript
// Document trong collection 'projects'
{
  id: "proj_abc123",
  name: "Website Redesign",
  key: "WEB",
  ownerId: "user_owner",
  memberIds: ["user_owner", "user_dev1"],
  invitedMemberIds: ["user_designer", "user_tester"]
}
```

**Giải thích**:

- `user_owner` và `user_dev1`: Đã là thành viên chính thức
- `user_designer` và `user_tester`: Đã được mời nhưng chưa chấp nhận

---

## 👤 PHẦN 1: OWNER SIDE (Người Mời)

### 1.1. UI Components

#### A. Members Dialog (`members-dialog.ts`)

```typescript
@Component({
  selector: 'app-members-dialog',
  template: `
    <!-- Danh sách thành viên hiện tại -->
    <mat-list>
      <h3 mat-subheader>Current Members</h3>
      @for (member of store.members(); track member.uid) {
      <mat-list-item>
        <mat-icon matListItemIcon>person</mat-icon>
        <div matListItemTitle>{{ member.displayName || member.email }}</div>
        <div matListItemLine>{{ member.email }}</div>

        <!-- Nút xóa (chỉ owner thấy) -->
        @if (isOwner && member.uid !== currentUser?.uid) {
        <button mat-icon-button (click)="removeMember(member.uid)">
          <mat-icon color="warn">remove_circle_outline</mat-icon>
        </button>
        }
      </mat-list-item>
      }
    </mat-list>

    <!-- Form mời thành viên mới (chỉ owner) -->
    @if (isOwner) {
    <h3>Add Member</h3>
    <div class="add-form">
      <mat-form-field appearance="outline">
        <mat-label>User Email</mat-label>
        <input matInput [(ngModel)]="emailToAdd" placeholder="friend@example.com" />
      </mat-form-field>
      <button
        mat-raised-button
        color="primary"
        (click)="addMember()"
        [disabled]="store.loading() || !emailToAdd"
      >
        <mat-icon>person_add</mat-icon> Add
      </button>
    </div>
    } @if (error) {
    <p class="error">{{ error }}</p>
    }
  `,
})
export class MembersDialog {
  store = inject(ProjectsStore);
  authStore = inject(AuthStore);

  emailToAdd = '';
  error = '';

  get currentUser() {
    return this.authStore.user();
  }

  get isOwner() {
    const project = this.store.selectedProject();
    return project?.ownerId === this.currentUser?.uid;
  }

  async addMember() {
    if (!this.emailToAdd) return;
    this.error = '';

    try {
      await this.store.inviteUser(this.emailToAdd);
      this.emailToAdd = '';
      alert('Invitation sent!');
    } catch (err: any) {
      this.error = err.message || 'Failed to invite member';
    }
  }
}
```

---

### 1.2. Store Logic (`projects.store.ts`)

#### Method: `inviteUser(email: string)`

```typescript
inviteUser: async (email: string) => {
  store.setLoading(true);
  try {
    // BƯỚC 1: Tìm user theo email
    const users = await firstValueFrom(projectsService.findUserByEmail(email));

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const userToInvite = users[0];
    const project = store.selectedProject();

    if (project) {
      // BƯỚC 2: Kiểm tra điều kiện

      // Kiểm tra đã là member chưa
      if (project.memberIds.includes(userToInvite.uid)) {
        throw new Error('User is already a member');
      }

      // Kiểm tra đã được mời chưa
      if (project.invitedMemberIds?.includes(userToInvite.uid)) {
        throw new Error('User is already invited');
      }

      // BƯỚC 3: Gửi lời mời
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

---

### 1.3. Service Layer (`projects.service.ts`)

#### Method: `findUserByEmail(email: string)`

```typescript
findUserByEmail(email: string): Observable<any[]> {
  const usersCollection = collection(this.firestore, 'users');
  const q = query(usersCollection, where('email', '==', email));
  return runInInjectionContext(this.injector, () => collectionData(q));
}
```

**Mục đích**: Tìm user trong hệ thống dựa trên email

**Query**: `where('email', '==', email)` - So sánh chính xác

**Trả về**: Mảng users (thường 1 phần tử vì email unique)

---

#### Method: `inviteUserToProject(...)`

```typescript
inviteUserToProject(
  projectId: string,
  userId: string,
  currentInvitedIds: string[] = []
) {
  const docRef = doc(this.firestore, 'projects', projectId);

  // Kiểm tra duplicate
  if (currentInvitedIds.includes(userId)) {
    return Promise.resolve();
  }

  // Tạo mảng mới (immutable)
  const newInvitedIds = [...currentInvitedIds, userId];

  // Cập nhật Firestore
  return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
}
```

**Logic**:

1. Kiểm tra user đã được mời chưa
2. Thêm userId vào mảng `invitedMemberIds`
3. Update document trên Firestore

---

### 1.4. Luồng Hoạt Động Owner Side

```
┌──────────────────────────────────────────────────────┐
│ 1. OWNER MỞ MEMBERS DIALOG                           │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 2. NHẬP EMAIL VÀ BẤM "ADD"                           │
│    Input: "designer@example.com"                     │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 3. DIALOG GỌI store.inviteUser(email)               │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 4. STORE TÌM USER                                    │
│    → projectsService.findUserByEmail(email)          │
│    → Query Firestore: where('email', '==', email)    │
│    → Kết quả: { uid: "user_designer", ... }         │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 5. STORE KIỂM TRA ĐIỀU KIỆN                          │
│    ✅ User tồn tại?                                  │
│    ✅ Chưa là member?                                │
│    ✅ Chưa được mời?                                 │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 6. STORE GỌI SERVICE                                 │
│    → projectsService.inviteUserToProject(            │
│         projectId,                                   │
│         userId,                                      │
│         currentInvitedIds                            │
│       )                                              │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 7. SERVICE CẬP NHẬT FIRESTORE                        │
│    Before: invitedMemberIds: []                      │
│    After:  invitedMemberIds: ["user_designer"]      │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 8. FIRESTORE PUSH UPDATE (REAL-TIME)                │
│    → WebSocket notification đến máy Inv



itee          │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 9. HIỂN THỊ THÔNG BÁO THÀNH CÔNG                     │
│    "Invitation sent to designer@example.com"         │
└──────────────────────────────────────────────────────┘
```

---

### 1.5. Owner Side - Error Handling

```typescript
// Các lỗi có thể xảy ra:

❌ User not found
→ Email không tồn tại trong hệ thống
→ Giải pháp: Yêu cầu user đăng ký trước

❌ User is already a member
→ User đã là thành viên chính thức
→ Giải pháp: Không cần mời lại

❌ User is already invited
→ User đã được mời trước đó (chưa accept/reject)
→ Giải pháp: Đợi user xử lý lời mời cũ

❌ Permission denied (Firestore Rules)
→ Người gọi không phải owner
→ Giải pháp: Kiểm tra quyền trước khi gọi
```

---

## 👥 PHẦN 2: INVITEE SIDE (Người Được Mời)

### 2.1. Real-time Notification System

#### A. Store Hook - Auto Load Invites

```typescript
// Trong projects.store.ts - withHooks
onInit(store) {
  const authStore = inject(AuthStore);

  // Effect tự động load invites khi user đăng nhập
  effect(() => {
    const user = authStore.user();
    store.loadInvites(user ? user.uid : null);
  });
}
```

#### B. Method: `loadInvites`

```typescript
loadInvites: rxMethod<string | null>(
  pipe(
    switchMap((userId) => {
      if (!userId) {
        patchState(store, { pendingInvites: [] });
        return of([]);
      }

      // Query projects mà user được mời
      return projectsService.getPendingInvites(userId).pipe(
        tap((pendingInvites) => patchState(store, { pendingInvites })),

        // Load thông tin owner của các projects
        switchMap((invites) => {
          const ownerIds = [...new Set(invites.map((p) => p.ownerId))];
          if (ownerIds.length === 0) return of([]);
          return projectsService.getUsers(ownerIds);
        }),

        // Merge owner info vào cache
        tap((newOwners) => {
          const existingOwners = store.projectOwners();
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

---

### 2.2. Service Layer - Get Pending Invites

```typescript
getPendingInvites(userId: string): Observable<Project[]> {
  const q = query(
    this.projectsCollection,
    where('invitedMemberIds', 'array-contains', userId)
  );

  return runInInjectionContext(
    this.injector,
    () => collectionData(q, { idField: 'id' }) as Observable<Project[]>
  );
}
```

**Query**: `where('invitedMemberIds', 'array-contains', userId)`

**Ý nghĩa**: Tìm tất cả projects mà mảng `invitedMemberIds` chứa ID của user hiện tại

---

### 2.3. UI - Hiển Thị Lời Mời

#### A. Header Notification Badge

```typescript
// Trong header.component.ts
@Component({
  template: `
    <mat-toolbar>
      <span>Jira Clone</span>

      <!-- Notification Badge -->
      <button mat-icon-button [matMenuTriggerFor]="inviteMenu">
        <mat-icon [matBadge]="inviteCount()" matBadgeColor="warn"> notifications </mat-icon>
      </button>

      <mat-menu #inviteMenu="matMenu">
        @if (projectsStore.pendingInvites().length === 0) {
        <div class="no-invites">No pending invitations</div>
        } @else { @for (invite of projectsStore.pendingInvites(); track invite.id) {
        <button mat-menu-item (click)="openInviteDialog(invite)">
          <mat-icon>folder</mat-icon>
          <span>{{ invite.name }}</span>
          <small>by {{ getOwnerName(invite.ownerId) }}</small>
        </button>
        } }
      </mat-menu>
    </mat-toolbar>
  `,
})
export class HeaderComponent {
  projectsStore = inject(ProjectsStore);

  inviteCount = computed(() => this.projectsStore.pendingInvites().length);

  getOwnerName(ownerId: string): string {
    const owner = this.projectsStore.projectOwners().find((u) => u.uid === ownerId);
    return owner?.displayName || 'Unknown';
  }
}
```

---

#### B. Invite Dialog (Accept/Reject)

```typescript
@Component({
  selector: 'app-invite-dialog',
  template: `
    <h2 mat-dialog-title>Project Invitation</h2>
    <mat-dialog-content>
      <p>
        <strong>{{ getOwnerName(project.ownerId) }}</strong>
        invited you to join:
      </p>
      <h3>{{ project.name }}</h3>
      <p class="project-key">{{ project.key }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="reject()">Decline</button>
      <button mat-raised-button color="primary" (click)="accept()">Accept</button>
    </mat-dialog-actions>
  `,
})
export class InviteDialogComponent {
  project = inject<Project>(MAT_DIALOG_DATA);
  store = inject(ProjectsStore);
  authStore = inject(AuthStore);
  dialogRef = inject(MatDialogRef);

  getOwnerName(ownerId: string): string {
    const owner = this.store.projectOwners().find((u) => u.uid === ownerId);
    return owner?.displayName || 'Unknown';
  }

  async accept() {
    const userId = this.authStore.user()?.uid;
    if (!userId) return;

    await this.store.acceptInvite(this.project, userId);
    this.dialogRef.close();
  }

  async reject() {
    const userId = this.authStore.user()?.uid;
    if (!userId) return;

    await this.store.rejectInvite(this.project, userId);
    this.dialogRef.close();
  }
}
```

---

### 2.4. Store Methods - Accept/Reject

#### A. Accept Invite

```typescript
acceptInvite: async (project: Project, userId: string) => {
  try {
    // Gọi service để update Firestore
    await projectsService.acceptInvite(project, userId);

    // Optimistic update local state
    patchState(store, {
      // Xóa khỏi pending invites
      pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),

      // Thêm vào projects (với memberIds đã update)
      projects: [
        ...store.projects(),
        {
          ...project,
          memberIds: [...project.memberIds, userId],
        },
      ],
    });

    errorService.showSuccess(`Joined project "${project.name}"`);
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to accept invite';
    console.error('Failed to accept invite', err);
    errorService.showError(errorMessage);
  }
};
```

---

#### B. Reject Invite

```typescript
rejectInvite: async (project: Project, userId: string) => {
  try {
    await projectsService.rejectInvite(project, userId);

    // Xóa khỏi pending invites
    patchState(store, {
      pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
    });

    errorService.showInfo('Invitation declined');
  } catch (err: any) {
    const errorMessage = err?.message || 'Failed to reject invite';
    console.error('Failed to reject invite', err);
    errorService.showError(errorMessage);
  }
};
```

---

### 2.5. Service Methods

#### A. Accept Invite

```typescript
async acceptInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);

  // Xóa khỏi invited
  const newInvitedIds = (project.invitedMemberIds || [])
    .filter((id) => id !== userId);

  // Thêm vào members
  const newMemberIds = [...project.memberIds, userId];

  // Atomic update (cập nhật 2 fields cùng lúc)
  return updateDoc(docRef, {
    invitedMemberIds: newInvitedIds,
    memberIds: newMemberIds,
  });
}
```

---

#### B. Reject Invite

```typescript
rejectInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);

  // Chỉ xóa khỏi invited, không thêm vào members
  const newInvitedIds = (project.invitedMemberIds || [])
    .filter((id) => id !== userId);

  return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
}
```

---

### 2.6. Luồng Hoạt Động Invitee Side

```
┌──────────────────────────────────────────────────────┐
│ 1. FIRESTORE PUSH UPDATE (từ Owner side)            │
│    Project updated: invitedMemberIds += userId       │
└──────────────────────────────────────────────────────┘
   ↓ (WebSocket)
┌──────────────────────────────────────────────────────┐
│ 2. OBSERVABLE TRONG loadInvites NHẬN EVENT          │
│    getPendingInvites Observable emit giá trị mới     │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 3. STORE CẬP NHẬT SIGNAL                             │
│    patchState({ pendingInvites: [..., newProject] })│
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 4. UI TỰ ĐỘNG CẬP NHẬT                               │
│    → Badge hiển thị số lời mời (1)                   │
│    → Menu dropdown hiển thị project mới              │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 5. USER CLICK VÀO NOTIFICATION                       │
│    → Mở InviteDialog với thông tin project          │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 6A. USER BẤM "ACCEPT"                                │
│     → store.acceptInvite(project, userId)            │
│     → Service update Firestore:                      │
│        - invitedMemberIds: remove userId             │
│        - memberIds: add userId                       │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 7A. FIRESTORE PUSH UPDATE ĐẾN CẢ 2 MÁY              │
│     Owner machine:                                   │
│       → getProjects emit (memberIds updated)         │
│       → UI hiển thị member mới trong dialog          │
│     Invitee machine:                                 │
│       → getProjects emit (project mới xuất hiện)     │
│       → getPendingInvites emit (project bị xóa)      │
│       → UI: Badge giảm, project hiện trong list      │
└──────────────────────────────────────────────────────┘

HOẶC

┌──────────────────────────────────────────────────────┐
│ 6B. USER BẤM "DECLINE"                               │
│     → store.rejectInvite(project, userId)            │
│     → Service update Firestore:                      │
│        - invitedMemberIds: remove userId             │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ 7B. FIRESTORE PUSH UPDATE                            │
│     → getPendingInvites emit (project bị xóa)        │
│     → UI: Badge giảm, notification biến mất          │
└──────────────────────────────────────────────────────┘
```

---

## 🔄 PHẦN 3: REAL-TIME SYNCHRONIZATION

### 3.1. Cơ Chế Real-time

```typescript
// Khi Owner mời user
┌─────────────┐
│ Owner's PC  │ → updateDoc({ invitedMemberIds: [..., newId] })
└─────────────┘
       ↓
┌─────────────┐
│  Firestore  │ → Detect change → Push via WebSocket
└─────────────┘
       ↓
┌─────────────┐
│ Invitee PC  │ → getPendingInvites Observable emit
└─────────────┘ → UI auto-update (badge, notification)
```

### 3.2. Timeline Ví Dụ

```
T=0s   Owner nhập email "alice@example.com" và bấm Add
T=0.1s Store tìm user → Kết quả: { uid: "alice_123" }
T=0.2s Store gọi inviteUserToProject()
T=0.3s Service update Firestore
T=0.4s Firestore commit change
T=0.5s Firestore push notification qua WebSocket
T=0.6s Alice's browser nhận WebSocket event
T=0.7s getPendingInvites Observable emit giá trị mới
T=0.8s Store update pendingInvites signal
T=0.9s UI re-render: Badge hiển thị (1)
T=1.0s Alice thấy notification "You have 1 invitation"
```

**Tổng thời gian**: ~1 giây từ lúc Owner bấm Add đến khi Invitee thấy thông báo!

---

### 3.3. Synchronization Khi Accept

```
┌──────────────────────────────────────────────────────┐
│ INVITEE ACCEPTS                                      │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ FIRESTORE UPDATE (Atomic)                            │
│   invitedMemberIds: ["alice"] → []                   │
│   memberIds: ["owner", "dev1"] → ["owner", "dev1", "alice"] │
└──────────────────────────────────────────────────────┘
   ↓ (WebSocket push to BOTH machines)
┌──────────────────────────────────────────────────────┐
│ OWNER'S MACHINE                                      │
│   → getProjects Observable emit                      │
│   → projects[x].memberIds updated                    │
│   → Effect detect change → loadMembers(memberIds)    │
│   → Members dialog hiển thị Alice                    │
└──────────────────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────────────────┐
│ INVITEE'S MACHINE (Alice)                            │
│   → getProjects emit (project mới xuất hiện)         │
│   → getPendingInvites emit (project bị xóa khỏi pending) │
│   → Badge: (1) → (0)                                 │
│   → Project list: Thêm 1 project mới                 │
└──────────────────────────────────────────────────────┘
```

---

## 🔒 PHẦN 4: SECURITY & VALIDATION

### 4.1. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      // ✅ Đọc: Members VÀ invited users
      allow read: if request.auth != null &&
        (request.auth.uid in resource.data.memberIds ||
         request.auth.uid in resource.data.get('invitedMemberIds', []));

      // ✅ Tạo: Ai cũng được (nhưng phải là owner)
      allow create: if request.auth != null &&
        request.resource.data.ownerId == request.auth.uid &&
        request.resource.data.memberIds[0] == request.auth.uid;

      // ✅ Update: Chỉ owner HOẶC invitee accept/reject
      allow update: if request.auth != null && (
        // Owner có thể update bất kỳ field nào
        resource.data.ownerId == request.auth.uid ||

        // Invitee chỉ có thể accept/reject (move từ invited → members)
        (request.auth.uid in resource.data.get('invitedMemberIds', []) &&
         onlyAcceptingOrRejecting())
      );

      // ✅ Xóa: Chỉ owner
      allow delete: if request.auth != null &&
        resource.data.ownerId == request.auth.uid;
    }

    // Helper function
    function onlyAcceptingOrRejecting() {
      let oldInvited = resource.data.get('invitedMemberIds', []);
      let newInvited = request.resource.data.get('invitedMemberIds', []);
      let oldMembers = resource.data.memberIds;
      let newMembers = request.resource.data.memberIds;

      // Accept: Xóa khỏi invited, thêm vào members
      let accepting =
        !newInvited.hasAll([request.auth.uid]) &&
        newMembers.hasAll([request.auth.uid]);

      // Reject: Chỉ xóa khỏi invited
      let rejecting =
        !newInvited.hasAll([request.auth.uid]) &&
        oldMembers == newMembers;

      return accepting || rejecting;
    }
  }
}
```

---

### 4.2. Client-side Validation

```typescript
// Trong store.inviteUser()
async inviteUser(email: string) {
  // ✅ Validate email format
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email format');
  }

  // ✅ Tìm user
  const users = await firstValueFrom(
    projectsService.findUserByEmail(email)
  );

  if (users.length === 0) {
    throw new Error('User not found. Please ask them to register first.');
  }

  const userToInvite = users[0];
  const project = store.selectedProject();

  // ✅ Kiểm tra quyền
  if (project.ownerId !== currentUser.uid) {
    throw new Error('Only project owner can invite members');
  }

  // ✅ Kiểm tra duplicate
  if (project.memberIds.includes(userToInvite.uid)) {
    throw new Error('User is already a member');
  }

  if (project.invitedMemberIds?.includes(userToInvite.uid)) {
    throw new Error('User is already invited');
  }

  // ✅ Kiểm tra self-invite
  if (userToInvite.uid === currentUser.uid) {
    throw new Error('You cannot invite yourself');
  }

  // Proceed with invitation...
}
```

---

## 🎨 PHẦN 5: UX BEST PRACTICES

### 5.1. Loading States

```typescript
// Trong dialog
<button
  mat-raised-button
  (click)="addMember()"
  [disabled]="store.loading() || !emailToAdd"
>
  @if (store.loading()) {
    <mat-spinner diameter="20"></mat-spinner>
  } @else {
    <mat-icon>person_add</mat-icon>
  }
  Add
</button>
```

---

### 5.2. Success/Error Feedback

```typescript
// Success
errorService.showSuccess(`Invitation sent to ${email}`);

// Error
errorService.showError('User not found');

// Info
errorService.showInfo('Invitation declined');
```

---

### 5.3. Optimistic Updates

```typescript
// Khi accept invite, update UI ngay lập tức
acceptInvite: async (project, userId) => {
  // Update UI trước
  patchState(store, {
    pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
    projects: [...store.projects(), { ...project, memberIds: [...project.memberIds, userId] }],
  });

  // Sau đó mới gọi API
  try {
    await projectsService.acceptInvite(project, userId);
  } catch (err) {
    // Rollback nếu lỗi
    // (hoặc để real-time sync tự sửa)
  }
};
```

---

## 📊 PHẦN 6: MONITORING & DEBUGGING

### 6.1. Console Logging

```typescript
// Trong store
inviteUser: async (email: string) => {
  console.log('[ProjectsStore] Inviting user:', email);

  try {
    const users = await firstValueFrom(projectsService.findUserByEmail(email));
    console.log('[ProjectsStore] Found users:', users);

    // ...

    console.log('[ProjectsStore] Invitation sent successfully');
  } catch (err) {
    console.error('[ProjectsStore] Failed to invite user:', err);
    throw err;
  }
};
```

---

### 6.2. Firestore Console

Kiểm tra dữ liệu trực tiếp trên Firebase Console:

```
Collections → projects → [project_id]

Before invite:
{
  memberIds: ["owner_id"],
  invitedMemberIds: []
}

After invite:
{
  memberIds: ["owner_id"],
  invitedMemberIds: ["invitee_id"]
}

After accept:
{
  memberIds: ["owner_id", "invitee_id"],
  invitedMemberIds: []
}
```

---

## 🐛 PHẦN 7: COMMON ISSUES & SOLUTIONS

### Issue 1: Invitation không real-time

**Triệu chứng**: Invitee không thấy notification ngay lập tức

**Nguyên nhân**: `loadInvites` không được gọi

**Giải pháp**:

```typescript
// Kiểm tra Effect trong store hooks
effect(() => {
  const user = authStore.user();
  store.loadInvites(user ? user.uid : null);
});
```

---

### Issue 2: Badge không cập nhật

**Triệu chứng**: Badge vẫn hiển thị số cũ sau khi accept/reject

**Nguyên nhân**: Computed signal không reactive

**Giải pháp**:

```typescript
// Đảm bảo dùng computed
inviteCount = computed(() => this.projectsStore.pendingInvites().length);

// KHÔNG dùng:
inviteCount = this.projectsStore.pendingInvites().length; // ❌ Static
```

---

### Issue 3: "User not found"

**Triệu chứng**: Luôn báo lỗi dù email đúng

**Nguyên nhân**: User chưa đăng ký hoặc email sai

**Giải pháp**:

```typescript
// Thêm validation rõ ràng
if (users.length === 0) {
  throw new Error(
    'User not found. Please ask them to create an account first at [your-app-url]/register'
  );
}
```

---

### Issue 4: Duplicate invitations

**Triệu chứng**: Cùng 1 user được mời nhiều lần

**Nguyên nhân**: Không kiểm tra `invitedMemberIds`

**Giải pháp**:

```typescript
// Trong service
if (currentInvitedIds.includes(userId)) {
  return Promise.resolve(); // Early return
}
```

---

## 📝 PHẦN 8: TESTING

### 8.1. Unit Tests

```typescript
describe('Invitation System', () => {
  describe('Owner Side', () => {
    it('should invite user successfully', async () => {
      const email = 'test@example.com';
      spyOn(projectsService, 'findUserByEmail').and.returnValue(of([{ uid: 'test_uid', email }]));

      await store.inviteUser(email);

      expect(projectsService.inviteUserToProject).toHaveBeenCalledWith(projectId, 'test_uid', []);
    });

    it('should reject duplicate invitation', async () => {
      const project = {
        invitedMemberIds: ['existing_uid'],
      };

      await expectAsync(store.inviteUser('existing@example.com')).toBeRejectedWithError(
        'User is already invited'
      );
    });
  });

  describe('Invitee Side', () => {
    it('should load pending invites', (done) => {
      const userId = 'test_user';
      store.loadInvites(userId);

      setTimeout(() => {
        expect(store.pendingInvites().length).toBeGreaterThan(0);
        done();
      }, 1000);
    });

    it('should accept invite successfully', async () => {
      const project = { id: 'proj1', memberIds: ['owner'] };
      const userId = 'invitee';

      await store.acceptInvite(project, userId);

      expect(store.projects()).toContain(jasmine.objectContaining({ id: 'proj1' }));
    });
  });
});
```

---

## 🎯 PHẦN 9: CHECKLIST

### Owner Checklist

- [ ] Chỉ owner mới thấy form "Add Member"
- [ ] Validate email format trước khi gửi
- [ ] Hiển thị loading state khi đang xử lý
- [ ] Hiển thị error message rõ ràng
- [ ] Hiển thị success message khi gửi thành công
- [ ] Không cho phép mời user đã là member
- [ ] Không cho phép mời user đã được mời
- [ ] Clear input field sau khi gửi thành công

### Invitee Checklist

- [ ] Badge hiển thị số lời mời chính xác
- [ ] Notification real-time (không cần F5)
- [ ] Dialog hiển thị đầy đủ thông tin project
- [ ] Hiển thị tên owner (không phải UID)
- [ ] Button Accept/Decline hoạt động
- [ ] Badge giảm sau khi accept/reject
- [ ] Project xuất hiện trong list sau khi accept
- [ ] Notification biến mất sau khi reject

---

## 🚀 PHẦN 10: PERFORMANCE TIPS

### 10.1. Debounce Email Input

```typescript
// Tránh query mỗi lần user gõ
emailInput$ = new Subject<string>();

ngOnInit() {
  this.emailInput$.pipe(
    debounceTime(500),
    distinctUntilChanged(),
    switchMap(email => this.projectsService.findUserByEmail(email))
  ).subscribe(users => {
    // Show suggestions
  });
}
```

---

### 10.2. Cache User Info

```typescript
// Store đã cache projectOwners
// Tránh query lặp lại cho cùng 1 owner
tap((newOwners) => {
  const existingOwners = store.projectOwners();
  const merged = [...existingOwners, ...newOwners].filter(
    (v, i, a) => a.findIndex((t) => t.uid === v.uid) === i
  );
  patchState(store, { projectOwners: merged });
});
```

---

### 10.3. Lazy Load Invites

```typescript
// Chỉ load invites khi user mở notification menu
<button mat-icon-button [matMenuTriggerFor]="menu" (menuOpened)="loadInvites()">
  <mat-icon [matBadge]="inviteCount()">notifications</mat-icon>
</button>
```

---

## 📚 TÀI LIỆU THAM KHẢO

- [Firestore Array Operations](https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array)
- [Angular Signals](https://angular.dev/guide/signals)
- [RxJS Operators](https://rxjs.dev/api)
- [Material Design - Notifications](https://material.io/components/notifications)

---

## ✅ TÓM TẮT

**Hệ thống Invitation** là một feature hoàn chỉnh với:

✅ **Two-step process**: Invite → Accept/Reject  
✅ **Real-time notifications**: WebSocket-based  
✅ **Optimistic updates**: UX mượt mà  
✅ **Security**: Firestore Rules + Client validation  
✅ **Error handling**: Comprehensive error messages  
✅ **Performance**: Caching, debouncing, lazy loading

**Luồng chính**:

1. Owner nhập email → Tìm user → Gửi lời mời
2. Firestore push notification → Invitee thấy badge
3. Invitee click → Mở dialog → Accept/Reject
4. Firestore update → Cả 2 bên tự động sync

**Công nghệ sử dụng**:

- Firebase Firestore (Real-time database)
- NgRx SignalStore (State management)
- RxJS (Reactive programming)
- Angular Material (UI components)
