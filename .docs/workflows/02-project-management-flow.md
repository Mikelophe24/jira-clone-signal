# Luồng Quản Lý Dự Án (Project Management Flow) - Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Kiến Trúc ProjectsStore](#2-kiến-trúc-projectsstore)
3. [Tạo Dự Án Mới](#3-tạo-dự-án-mới)
4. [Mời Thành Viên](#4-mời-thành-viên)
5. [Chấp Nhận/Từ Chối Lời Mời](#5-chấp-nhậntừ-chối-lời-mời)
6. [Quản Lý Roles](#6-quản-lý-roles)
7. [Xóa Thành Viên](#7-xóa-thành-viên)
8. [Cập Nhật Dự Án](#8-cập-nhật-dự-án)
9. [Xóa Dự Án](#9-xóa-dự-án)
10. [Firestore Security Rules](#10-firestore-security-rules)

---

## 1. Tổng Quan

### 1.1 Mục Đích

Project Management flow cho phép:

- ✅ Tạo và quản lý projects
- ✅ Mời members vào project
- ✅ Phân quyền (Owner/Admin/Member/Viewer)
- ✅ Real-time collaboration
- ✅ Secure access control

### 1.2 Project Model

```typescript
interface Project {
  id: string;
  name: string; // "My Awesome Project"
  key: string; // "MAP" - used for issue keys
  ownerId: string; // Creator's UID
  memberIds: string[]; // Array of member UIDs
  invitedMemberIds?: string[]; // Pending invites
  roles?: {
    // Role mapping
    [userId: string]: 'admin' | 'member' | 'viewer';
  };
  createdAt?: string;
  updatedAt?: string;
}
```

### 1.3 Files Liên Quan

```
src/app/features/projects/
├── projects.store.ts          # State management
├── projects.service.ts        # Firestore API
├── project.model.ts           # Type definitions
├── project-list/
│   ├── project-list.ts        # List view
│   └── edit-project-dialog/   # Edit dialog
└── members-dialog/
    └── members-dialog.ts      # Member management
```

---

## 2. Kiến Trúc ProjectsStore

### 2.1 State Structure

```typescript
// File: src/app/features/projects/projects.store.ts
type ProjectsState = {
  projects: Project[]; // User's projects
  projectOwners: AppUser[]; // Owners of all projects
  members: AppUser[]; // Members of selected project
  pendingInvites: Project[]; // Projects user is invited to
  selectedProjectId: string | null;
};

const initialState: ProjectsState = {
  projects: [],
  projectOwners: [],
  members: [],
  pendingInvites: [],
  selectedProjectId: null,
};
```

### 2.2 Computed Values

```typescript
withComputed(({ projects, selectedProjectId }) => ({
  selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId())),
}));
```

### 2.3 Methods Overview

```typescript
export const ProjectsStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(...),
  withMethods((store, projectsService, issueService) => ({
    // Loading
    loadProjects: rxMethod<string | null>(...),
    loadInvites: rxMethod<string | null>(...),
    loadMembers: rxMethod<string[]>(...),

    // CRUD
    selectProject(projectId: string),
    deleteProject(projectId: string),
    updateProject(projectId: string, updates: Partial<Project>),

    // Member Management
    inviteUser(email: string, role: 'admin' | 'member' | 'viewer'),
    acceptInvite(project: Project, userId: string),
    rejectInvite(project: Project, userId: string),
    removeMember(memberId: string),
  }))
);
```

---

## 3. Tạo Dự Án Mới

### 3.1 Sequence Diagram

```
User          ProjectList    ProjectsService    Firestore    ProjectsStore
 │                 │                │              │              │
 │  Enter Name     │                │              │              │
 │  & Key          │                │              │              │
 │────────────────>│                │              │              │
 │                 │                │              │              │
 │  Click Create   │                │              │              │
 │────────────────>│                │              │              │
 │                 │ createProject()│              │              │
 │                 │───────────────>│              │              │
 │                 │                │ addProject() │              │
 │                 │                │─────────────>│              │
 │                 │                │              │              │
 │                 │                │  Validate    │              │
 │                 │                │  Rules       │              │
 │                 │                │              │              │
 │                 │                │  Create Doc  │              │
 │                 │                │              │              │
 │                 │                │  Snapshot    │              │
 │                 │                │  Listener    │              │
 │                 │                │<─────────────│              │
 │                 │                │              │              │
 │                 │                │              │  loadProjects│
 │                 │                │              │  (emit new)  │
 │                 │                │              │─────────────>│
 │                 │                │              │              │
 │                 │                │              │  patchState  │
 │                 │                │              │  (add project)
 │                 │                │              │              │
 │  UI Update      │                │              │              │
 │<────────────────┼────────────────┼──────────────┼──────────────│
```

### 3.2 Step-by-Step Implementation

#### Step 1: UI Form

```typescript
// File: src/app/features/projects/project-list/project-list.ts
@Component({
  template: `
    <mat-card class="create-card">
      <mat-card-header>
        <mat-card-title>Create Project</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        <form
          (submit)="
            createProject(nameInput.value, keyInput.value);
            nameInput.value = '';
            keyInput.value = ''
          "
        >
          <mat-form-field appearance="outline">
            <mat-label>Project Name</mat-label>
            <input matInput #nameInput required placeholder="My Awesome Project" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Key (e.g. PROJ)</mat-label>
            <input
              matInput
              #keyInput
              required
              placeholder="MAP"
              maxlength="10"
              (input)="keyInput.value = keyInput.value.toUpperCase()"
            />
            <mat-hint>Used for issue keys (e.g. MAP-1, MAP-2)</mat-hint>
          </mat-form-field>

          <button
            mat-raised-button
            color="primary"
            type="submit"
            [disabled]="!nameInput.value || !keyInput.value"
          >
            <mat-icon>add</mat-icon>
            Create
          </button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
})
export class ProjectList {
  readonly store = inject(ProjectsStore);
  private projectsService = inject(ProjectsService);
  readonly authStore = inject(AuthStore);

  createProject(name: string, key: string) {
    if (!name || !key) return;

    const currentUser = this.authStore.user();
    const ownerId = currentUser ? currentUser.uid : 'anonymous';

    this.projectsService.addProject({
      name,
      key: key.toUpperCase(),
      ownerId: ownerId,
      memberIds: [ownerId], // Owner is first member
      roles: {
        [ownerId]: 'admin', // Owner has admin role
      },
    });
  }
}
```

**Validation:**

- ✅ Name: Required, min 2 characters
- ✅ Key: Required, max 10 characters, uppercase
- ✅ Key format: Letters only, no spaces

---

#### Step 2: ProjectsService.addProject()

```typescript
// File: src/app/features/projects/projects.service.ts
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private firestore = inject(Firestore);
  private projectsCollection = collection(this.firestore, 'projects');

  async addProject(project: Partial<Project>) {
    const newProject = {
      ...project,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await addDoc(this.projectsCollection, newProject);
  }
}
```

**Firestore Operation:**

```javascript
// Equivalent Firestore command
db.collection('projects').add({
  name: 'My Awesome Project',
  key: 'MAP',
  ownerId: 'user123',
  memberIds: ['user123'],
  roles: {
    user123: 'admin',
  },
  createdAt: '2026-01-20T15:00:00.000Z',
  updatedAt: '2026-01-20T15:00:00.000Z',
});
```

---

#### Step 3: Firestore Security Rules Validation

```javascript
// File: firestore.rules
match /projects/{projectId} {
  // Create: strict schema validation
  allow create: if signedIn() && isValidNewProject();
}

function isValidNewProject() {
  let data = request.resource.data;
  return data.keys().hasAll(['name', 'key', 'ownerId', 'memberIds'])
    && data.name is string && data.name.size() > 0
    && data.key is string && data.key.size() > 0
    && data.ownerId == request.auth.uid
    && data.memberIds is list
    && data.memberIds.hasAll([request.auth.uid]);
}
```

**Validation Checks:**

1. ✅ User is authenticated
2. ✅ Required fields present: name, key, ownerId, memberIds
3. ✅ Name is non-empty string
4. ✅ Key is non-empty string
5. ✅ ownerId matches authenticated user
6. ✅ memberIds includes owner

**If validation fails:**

```typescript
Error: 'Missing or insufficient permissions';
```

---

#### Step 4: Real-time Listener Update

```typescript
// File: src/app/features/projects/projects.store.ts
loadProjects: rxMethod<string | null>(
  pipe(
    tap(() => store.setLoading(true)),
    switchMap((userId) => {
      if (!userId) {
        patchState(store, { projects: [] });
        return of([]);
      }

      // Firestore query with real-time listener
      const projectsRef = collection(firestore, 'projects');
      const q = query(projectsRef, where('memberIds', 'array-contains', userId));

      return collectionData(q, { idField: 'id' }).pipe(
        tap((projects) => {
          patchState(store, { projects });
          store.setLoading(false);

          // Load project owners
          const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
          // ... load owners
        }),
        catchError((error) => {
          errorService.showError('Failed to load projects');
          return of([]);
        }),
      );
    }),
  ),
);
```

**Query Explanation:**

```javascript
// Find all projects where memberIds array contains userId
db.collection('projects')
  .where('memberIds', 'array-contains', 'user123')
  .onSnapshot(...)
```

**Real-time Updates:**

- Khi project mới được tạo → listener emit
- `patchState` update projects array
- UI tự động re-render
- Project card xuất hiện ngay lập tức

---

### 3.3 Complete Flow Example

```typescript
// 1. User fills form
Name: "E-Commerce Platform"
Key: "ECOM"

// 2. Click Create

// 3. ProjectsService creates document
{
  id: "proj_abc123",  // Auto-generated
  name: "E-Commerce Platform",
  key: "ECOM",
  ownerId: "user_xyz789",
  memberIds: ["user_xyz789"],
  roles: {
    user_xyz789: "admin"
  },
  createdAt: "2026-01-20T15:00:00.000Z",
  updatedAt: "2026-01-20T15:00:00.000Z"
}

// 4. Firestore validates rules ✓

// 5. Document created

// 6. Listener emits new project

// 7. State updated
projects: [
  ...existingProjects,
  {
    id: "proj_abc123",
    name: "E-Commerce Platform",
    key: "ECOM",
    ...
  }
]

// 8. UI renders new project card
```

---

## 4. Mời Thành Viên

### 4.1 Sequence Diagram

```
Admin         MembersDialog    ProjectsStore    ProjectsService    Firestore
 │                 │                │                  │              │
 │  Click Members  │                │                  │              │
 │────────────────>│                │                  │              │
 │                 │                │                  │              │
 │  Enter Email    │                │                  │              │
 │  Select Role    │                │                  │              │
 │────────────────>│                │                  │              │
 │                 │                │                  │              │
 │  Click Invite   │                │                  │              │
 │────────────────>│                │                  │              │
 │                 │ inviteUser()   │                  │              │
 │                 │───────────────>│                  │              │
 │                 │                │ getUserByEmail() │              │
 │                 │                │─────────────────>│              │
 │                 │                │                  │ Query users  │
 │                 │                │                  │ collection   │
 │                 │                │                  │─────────────>│
 │                 │                │                  │              │
 │                 │                │                  │ User found   │
 │                 │                │                  │<─────────────│
 │                 │                │                  │              │
 │                 │                │  User object     │              │
 │                 │                │<─────────────────│              │
 │                 │                │                  │              │
 │                 │                │ updateProject()  │              │
 │                 │                │─────────────────>│              │
 │                 │                │                  │ Update doc:  │
 │                 │                │                  │ - invitedIds │
 │                 │                │                  │ - roles      │
 │                 │                │                  │─────────────>│
 │                 │                │                  │              │
 │                 │                │                  │ Updated      │
 │                 │                │                  │<─────────────│
 │                 │                │                  │              │
 │  Success Toast  │                │                  │              │
 │<────────────────┼────────────────┼──────────────────┼──────────────│
```

### 4.2 Implementation

#### Step 1: Members Dialog UI

```typescript
// File: src/app/features/projects/members-dialog/members-dialog.ts
@Component({
  template: `
    <h2 mat-dialog-title>Project Members</h2>

    <mat-dialog-content>
      <!-- Invite Form -->
      <div class="invite-section">
        <h3>Invite Member</h3>
        <form (submit)="inviteUser(); emailInput.value = ''">
          <mat-form-field>
            <mat-label>Email</mat-label>
            <input matInput #emailInput type="email" required />
          </mat-form-field>

          <mat-form-field>
            <mat-label>Role</mat-label>
            <mat-select [(value)]="selectedRole">
              <mat-option value="viewer">Viewer (Read only)</mat-option>
              <mat-option value="member">Member (Can edit)</mat-option>
              <mat-option value="admin">Admin (Full access)</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-raised-button color="primary" type="submit">
            <mat-icon>person_add</mat-icon>
            Invite
          </button>
        </form>
      </div>

      <!-- Current Members List -->
      <div class="members-list">
        <h3>Current Members ({{ projectsStore.members().length }})</h3>

        @for (member of projectsStore.members(); track member.uid) {
          <div class="member-item">
            <img [src]="member.photoURL || defaultAvatar" class="avatar" />

            <div class="member-info">
              <div class="name">{{ member.displayName }}</div>
              <div class="email">{{ member.email }}</div>
            </div>

            <mat-chip class="role-chip">
              {{ getRole(member.uid) }}
            </mat-chip>

            @if (canRemoveMember(member.uid)) {
              <button mat-icon-button color="warn" (click)="removeMember(member.uid)">
                <mat-icon>person_remove</mat-icon>
              </button>
            }
          </div>
        }
      </div>
    </mat-dialog-content>
  `,
})
export class MembersDialog {
  projectsStore = inject(ProjectsStore);
  authStore = inject(AuthStore);

  selectedRole: 'admin' | 'member' | 'viewer' = 'member';

  inviteUser() {
    const email = this.emailInput.value;
    if (email) {
      this.projectsStore.inviteUser(email, this.selectedRole);
    }
  }

  canRemoveMember(memberId: string): boolean {
    const project = this.projectsStore.selectedProject();
    const currentUser = this.authStore.user();

    // Can't remove owner
    if (project?.ownerId === memberId) return false;

    // Can't remove yourself
    if (currentUser?.uid === memberId) return false;

    // Only owner/admin can remove
    return project?.ownerId === currentUser?.uid || project?.roles?.[currentUser?.uid!] === 'admin';
  }

  removeMember(memberId: string) {
    if (confirm('Remove this member from the project?')) {
      this.projectsStore.removeMember(memberId);
    }
  }

  getRole(userId: string): string {
    const project = this.projectsStore.selectedProject();
    if (project?.ownerId === userId) return 'Owner';
    return project?.roles?.[userId] || 'Member';
  }
}
```

---

#### Step 2: ProjectsStore.inviteUser()

```typescript
// File: src/app/features/projects/projects.store.ts
inviteUser: async (email: string, role: 'admin' | 'member' | 'viewer' = 'member') => {
  const projectId = store.selectedProjectId();
  if (!projectId) {
    errorService.showError('No project selected');
    return;
  }

  try {
    // 1. Find user by email
    const user = await projectsService.getUserByEmail(email);

    if (!user) {
      errorService.showError('User not found with email: ' + email);
      return;
    }

    // 2. Check if already member
    const project = store.selectedProject();
    if (project?.memberIds.includes(user.uid)) {
      errorService.showError('User is already a member');
      return;
    }

    // 3. Check if already invited
    if (project?.invitedMemberIds?.includes(user.uid)) {
      errorService.showError('User already invited');
      return;
    }

    // 4. Update project with invite
    await projectsService.updateProject(projectId, {
      invitedMemberIds: arrayUnion(user.uid),
      roles: {
        ...project?.roles,
        [user.uid]: role,
      },
    });

    errorService.showSuccess(`Invitation sent to ${user.displayName}`);
  } catch (error: any) {
    errorService.showError(error?.message || 'Failed to invite user');
  }
};
```

---

#### Step 3: ProjectsService.getUserByEmail()

```typescript
// File: src/app/features/projects/projects.service.ts
async getUserByEmail(email: string): Promise<AppUser | null> {
  const usersRef = collection(this.firestore, 'users');
  const q = query(usersRef, where('email', '==', email), limit(1));

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    uid: doc.id,
    ...doc.data()
  } as AppUser;
}
```

---

#### Step 4: Firestore Update

```typescript
// Before
{
  id: "proj_abc123",
  name: "E-Commerce Platform",
  memberIds: ["user_xyz789"],
  roles: {
    user_xyz789: "admin"
  }
}

// After inviting user_123 as "member"
{
  id: "proj_abc123",
  name: "E-Commerce Platform",
  memberIds: ["user_xyz789"],
  invitedMemberIds: ["user_123"],  // Added
  roles: {
    user_xyz789: "admin",
    user_123: "member"              // Added
  }
}
```

**Firestore Operation:**

```typescript
await updateDoc(doc(firestore, 'projects', projectId), {
  invitedMemberIds: arrayUnion('user_123'),
  'roles.user_123': 'member',
});
```

---

## 5. Chấp Nhận/Từ Chối Lời Mời

### 5.1 Notification Badge

```typescript
// File: src/app/app.ts (Main toolbar)
<button mat-icon-button
        [matMenuTriggerFor]="notificationMenu"
        [matBadge]="projectsStore.pendingInvites().length"
        matBadgeColor="warn"
        [matBadgeHidden]="projectsStore.pendingInvites().length === 0">
  <mat-icon>notifications</mat-icon>
</button>

<mat-menu #notificationMenu="matMenu">
  @for (invite of projectsStore.pendingInvites(); track invite.id) {
    <div class="invite-item" (click)="$event.stopPropagation()">
      <span class="invite-text">
        Invitation to <strong>{{ invite.name }}</strong> by
        <strong>{{ getOwnerName(invite.ownerId) }}</strong>
      </span>
      <div class="invite-actions">
        <button mat-icon-button color="primary"
                (click)="accept(invite)">
          <mat-icon>check</mat-icon>
        </button>
        <button mat-icon-button color="warn"
                (click)="reject(invite)">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>
  } @empty {
    <div class="no-invites">No notifications</div>
  }
</mat-menu>
```

### 5.2 Load Pending Invites

```typescript
// File: src/app/features/projects/projects.store.ts
loadInvites: rxMethod<string | null>(
  pipe(
    switchMap((userId) => {
      if (!userId) {
        patchState(store, { pendingInvites: [] });
        return of([]);
      }

      // Query projects where user is invited
      const projectsRef = collection(firestore, 'projects');
      const q = query(projectsRef, where('invitedMemberIds', 'array-contains', userId));

      return collectionData(q, { idField: 'id' }).pipe(
        tap((invites) => {
          patchState(store, { pendingInvites: invites });

          // Load owners for display
          const ownerIds = invites.map((p) => p.ownerId);
          // ... load owners
        }),
      );
    }),
  ),
);
```

### 5.3 Accept Invite

```typescript
// File: src/app/features/projects/projects.store.ts
acceptInvite: async (project: Project, userId: string) => {
  try {
    // Move user from invitedMemberIds to memberIds
    await projectsService.updateProject(project.id, {
      memberIds: arrayUnion(userId),
      invitedMemberIds: arrayRemove(userId),
    });

    errorService.showSuccess(`You joined ${project.name}`);
  } catch (error: any) {
    errorService.showError('Failed to accept invitation');
  }
};
```

**Firestore Update:**

```typescript
// Before
{
  memberIds: ["owner_123"],
  invitedMemberIds: ["user_456"],
  roles: {
    owner_123: "admin",
    user_456: "member"
  }
}

// After accept
{
  memberIds: ["owner_123", "user_456"],  // Added
  invitedMemberIds: [],                   // Removed
  roles: {
    owner_123: "admin",
    user_456: "member"                    // Kept
  }
}
```

### 5.4 Reject Invite

```typescript
rejectInvite: async (project: Project, userId: string) => {
  try {
    // Remove from invitedMemberIds and roles
    await projectsService.updateProject(project.id, {
      invitedMemberIds: arrayRemove(userId),
      [`roles.${userId}`]: deleteField(),
    });

    errorService.showInfo('Invitation declined');
  } catch (error: any) {
    errorService.showError('Failed to reject invitation');
  }
};
```

---

## 6. Quản Lý Roles

### 6.1 Role Hierarchy

```
Owner (ownerId)
  ├─ Full control
  ├─ Cannot be removed
  └─ Cannot be changed

Admin (roles[uid] = 'admin')
  ├─ Manage members
  ├─ Create/edit/delete sprints
  ├─ Full issue access
  └─ Cannot delete project

Member (roles[uid] = 'member')
  ├─ Create/edit own issues
  ├─ Update issue status
  ├─ Comment on issues
  └─ Cannot manage members

Viewer (roles[uid] = 'viewer')
  ├─ Read-only access
  ├─ View issues
  └─ Cannot edit anything
```

### 6.2 Permission Checks

```typescript
// Helper functions
function isOwner(project: Project, userId: string): boolean {
  return project.ownerId === userId;
}

function isAdmin(project: Project, userId: string): boolean {
  return isOwner(project, userId) || project.roles?.[userId] === 'admin';
}

function isMember(project: Project, userId: string): boolean {
  return project.memberIds.includes(userId);
}

function isViewer(project: Project, userId: string): boolean {
  return project.roles?.[userId] === 'viewer';
}

function canManageMembers(project: Project, userId: string): boolean {
  return isAdmin(project, userId);
}

function canEditProject(project: Project, userId: string): boolean {
  return isAdmin(project, userId);
}

function canDeleteProject(project: Project, userId: string): boolean {
  return isOwner(project, userId);
}
```

### 6.3 Change Member Role

```typescript
// File: src/app/features/projects/members-dialog/members-dialog.ts
changeRole(memberId: string, newRole: 'admin' | 'member' | 'viewer') {
  const project = this.projectsStore.selectedProject();
  if (!project) return;

  // Can't change owner role
  if (project.ownerId === memberId) {
    this.errorService.showError('Cannot change owner role');
    return;
  }

  // Update role
  this.projectsStore.updateProject(project.id, {
    roles: {
      ...project.roles,
      [memberId]: newRole
    }
  });
}
```

---

## 7. Xóa Thành Viên

### 7.1 Implementation

```typescript
// File: src/app/features/projects/projects.store.ts
removeMember: async (memberId: string) => {
  const projectId = store.selectedProjectId();
  const project = store.selectedProject();

  if (!projectId || !project) {
    errorService.showError('No project selected');
    return;
  }

  // Prevent removing owner
  if (project.ownerId === memberId) {
    errorService.showError('Cannot remove project owner');
    return;
  }

  try {
    // 1. Remove from project
    await projectsService.updateProject(projectId, {
      memberIds: arrayRemove(memberId),
      [`roles.${memberId}`]: deleteField(),
    });

    // 2. Unassign all issues
    const issues = await issueService.getIssuesByAssignee(projectId, memberId);

    if (issues.length > 0) {
      const updates = issues.map((issue) => ({
        id: issue.id,
        data: { assigneeId: null },
      }));

      await issueService.batchUpdateIssues(updates);
    }

    errorService.showSuccess('Member removed from project');
  } catch (error: any) {
    errorService.showError('Failed to remove member');
  }
};
```

**Important:** Khi xóa member, tất cả issues assigned cho họ sẽ được unassign (assigneeId = null).

---

## 8. Cập Nhật Dự Án

### 8.1 Edit Project Dialog

```typescript
// File: src/app/features/projects/project-list/edit-project-dialog/edit-project-dialog.ts
@Component({
  template: `
    <h2 mat-dialog-title>Edit Project</h2>

    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field>
          <mat-label>Project Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Key</mat-label>
          <input matInput formControlName="key" [readonly]="true" />
          <mat-hint>Key cannot be changed</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!form.valid">
        Save
      </button>
    </mat-dialog-actions>
  `,
})
export class EditProjectDialog {
  dialogRef = inject(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);

  form = new FormGroup({
    name: new FormControl(this.data.project.name, [Validators.required]),
    key: new FormControl(this.data.project.key),
  });

  save() {
    if (this.form.valid) {
      this.dialogRef.close({
        name: this.form.value.name,
      });
    }
  }
}
```

### 8.2 Update Project

```typescript
// File: src/app/features/projects/projects.store.ts
updateProject: async (projectId: string, updates: Partial<Project>) => {
  try {
    await projectsService.updateProject(projectId, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    errorService.showSuccess('Project updated');
  } catch (error: any) {
    errorService.showError('Failed to update project');
  }
};
```

---

## 9. Xóa Dự Án

### 9.1 Cascade Delete

Khi xóa project, phải xóa tất cả related data:

```typescript
// File: src/app/features/projects/projects.store.ts
deleteProject: async (projectId: string) => {
  try {
    store.setLoading(true);

    // 1. Delete all issues
    const issues = await issueService.getIssuesByProject(projectId);
    for (const issue of issues) {
      await issueService.deleteIssue(issue.id);
    }

    // 2. Delete all sprints
    const sprints = await sprintService.getSprintsByProject(projectId);
    for (const sprint of sprints) {
      await sprintService.deleteSprint(sprint.id);
    }

    // 3. Delete project
    await projectsService.deleteProject(projectId);

    errorService.showSuccess('Project deleted');
    store.setLoading(false);
  } catch (error: any) {
    errorService.showError('Failed to delete project');
    store.setLoading(false);
  }
};
```

**Warning:** Đây là destructive operation. Nên có confirmation dialog:

```typescript
deleteProject(projectId: string) {
  const confirmed = confirm(
    'Are you sure you want to delete this project? ' +
    'All issues and sprints will be permanently deleted. ' +
    'This action cannot be undone.'
  );

  if (confirmed) {
    this.store.deleteProject(projectId);
  }
}
```

---

## 10. Firestore Security Rules

### 10.1 Complete Rules

```javascript
// File: firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function signedIn() {
      return request.auth != null;
    }

    function getProject(projectId) {
      return get(/databases/$(database)/documents/projects/$(projectId));
    }

    function isProjectMember(projectId) {
      let project = getProject(projectId);
      return project != null && (
        project.data.ownerId == request.auth.uid ||
        project.data.memberIds.hasAny([request.auth.uid]) ||
        project.data.roles.keys().hasAny([request.auth.uid])
      );
    }

    function isProjectAdmin(projectId) {
      let project = getProject(projectId);
      return project != null && (
        project.data.ownerId == request.auth.uid ||
        (
          project.data.roles.keys().hasAny([request.auth.uid]) &&
          project.data.roles[request.auth.uid] == 'admin'
        )
      );
    }

    function isProjectViewer(projectId) {
      let project = getProject(projectId);
      return project != null &&
        project.data.ownerId != request.auth.uid &&
        project.data.roles.keys().hasAny([request.auth.uid]) &&
        project.data.roles[request.auth.uid] == 'viewer';
    }

    function isInvited(project) {
      return project.data.keys().hasAny(['invitedMemberIds']) &&
             project.data.invitedMemberIds != null &&
             project.data.invitedMemberIds.hasAny([request.auth.uid]);
    }

    function isValidNewProject() {
      let data = request.resource.data;
      return data.keys().hasAll(['name', 'key', 'ownerId', 'memberIds'])
        && data.name is string && data.name.size() > 0
        && data.key is string && data.key.size() > 0
        && data.ownerId == request.auth.uid
        && data.memberIds is list
        && data.memberIds.hasAll([request.auth.uid]);
    }

    // Project rules
    match /projects/{projectId} {

      // Read: member OR invited OR has role
      allow read: if signedIn() && (
        resource.data.ownerId == request.auth.uid ||
        resource.data.memberIds.hasAny([request.auth.uid]) ||
        resource.data.roles.keys().hasAny([request.auth.uid]) ||
        isInvited(resource)
      );

      // Create: strict schema validation
      allow create: if signedIn() && isValidNewProject();

      // Update:
      // - Owner: full update (except ownerId)
      // - Member/Invited: can only update to accept invite
      allow update: if signedIn() && (
        (
          resource.data.ownerId == request.auth.uid &&
          !request.resource.data.diff(resource.data).affectedKeys().hasAny(['ownerId'])
        ) ||
        (
          (
            resource.data.memberIds.hasAny([request.auth.uid]) ||
            isInvited(resource)
          ) &&
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['name', 'key', 'ownerId'])
        )
      );

      // Delete: owner only
      allow delete: if signedIn() &&
                       resource.data.ownerId == request.auth.uid;
    }
  }
}
```

### 10.2 Rule Testing

```typescript
// Test cases
describe('Project Security Rules', () => {
  test('Owner can create project', async () => {
    const project = {
      name: 'Test Project',
      key: 'TEST',
      ownerId: 'user123',
      memberIds: ['user123'],
    };

    await assertSucceeds(setDoc(doc(firestore, 'projects', 'test'), project));
  });

  test('Non-owner cannot create project with different ownerId', async () => {
    const project = {
      name: 'Test Project',
      key: 'TEST',
      ownerId: 'otherUser', // Different from auth.uid
      memberIds: ['otherUser'],
    };

    await assertFails(setDoc(doc(firestore, 'projects', 'test'), project));
  });

  test('Member can read project', async () => {
    await assertSucceeds(getDoc(doc(firestore, 'projects', 'test')));
  });

  test('Non-member cannot read project', async () => {
    await assertFails(getDoc(doc(firestore, 'projects', 'test')));
  });

  test('Owner can update project name', async () => {
    await assertSucceeds(
      updateDoc(doc(firestore, 'projects', 'test'), {
        name: 'Updated Name',
      }),
    );
  });

  test('Member cannot update project name', async () => {
    await assertFails(
      updateDoc(doc(firestore, 'projects', 'test'), {
        name: 'Updated Name',
      }),
    );
  });

  test('Owner can delete project', async () => {
    await assertSucceeds(deleteDoc(doc(firestore, 'projects', 'test')));
  });

  test('Member cannot delete project', async () => {
    await assertFails(deleteDoc(doc(firestore, 'projects', 'test')));
  });
});
```

---

## 📝 Summary

Project Management Flow:

✅ **Create**: Owner tạo project với auto-generated ID
✅ **Invite**: Admin mời members qua email
✅ **Accept/Reject**: User chấp nhận hoặc từ chối invite
✅ **Roles**: Owner > Admin > Member > Viewer
✅ **Update**: Owner/Admin có thể update project
✅ **Remove**: Admin có thể xóa members (trừ owner)
✅ **Delete**: Chỉ owner có thể xóa project
✅ **Real-time**: Firestore listeners cho instant updates
✅ **Secure**: Firestore rules enforce permissions

**Key Takeaways:**

1. Real-time collaboration với Firestore listeners
2. Role-based access control
3. Invite system với pending state
4. Cascade delete khi xóa project
5. Security rules validate all operations
