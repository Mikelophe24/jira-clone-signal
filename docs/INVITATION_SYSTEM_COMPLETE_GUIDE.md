# 📧 HƯỚNG DẪN CHI TIẾT: HỆ THỐNG MỜI NGƯỜI VÀO PROJECT

## 📋 MỤC LỤC

1. [Tổng quan hệ thống](#tổng-quan-hệ-thống)
2. [Luồng hoạt động](#luồng-hoạt-động)
3. [Chi tiết từng bước](#chi-tiết-từng-bước)
4. [Code chính xác](#code-chính-xác)
5. [Firestore Rules](#firestore-rules)
6. [Testing](#testing)

---

## TỔNG QUAN HỆ THỐNG

### Mô hình dữ liệu

```typescript
// Project Model
interface Project {
  id: string;
  name: string;
  key: string;
  ownerId: string; // User tạo project
  memberIds: string[]; // Members đã accept
  invitedMemberIds?: string[]; // Members được mời chưa accept
}

// User Model
interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}
```

### Các thành phần chính

1. **Members Dialog** - UI quản lý members
2. **Projects Store** - State management
3. **Projects Service** - Firestore operations
4. **Firestore Rules** - Security

---

## LUỒNG HOẠT ĐỘNG

### Flow 1: Mời người vào project

```
Owner → Click "Manage Members"
  → Nhập email
  → Click "Invite"
  → Email thêm vào invitedMemberIds[]
  → Người được mời thấy project
  → Click "Accept"
  → Chuyển từ invitedMemberIds[] → memberIds[]
```

### Flow 2: Từ chối lời mời

```
Invited User → Thấy project
  → Click "Decline"
  → Xóa khỏi invitedMemberIds[]
  → Project biến mất
```

### Flow 3: Xóa member

```
Owner → Click "Manage Members"
  → Click "Remove"
  → Xóa khỏi memberIds[]
  → Issues assigned → assigneeId = null
```

---

## CHI TIẾT TỪNG BƯỚC

### BƯỚC 1: Mở Members Dialog

**File:** `src/app/features/projects/project-list/project-list.ts`

```typescript
// Component method
openMembersDialog(project: Project) {
  this.dialog.open(MembersDialogComponent, {
    width: '500px',
    data: { project }
  });
}
```

**Template:**

```html
<button
  mat-icon-button
  (click)="openMembersDialog(project); $event.stopPropagation()"
  matTooltip="Manage Members"
>
  <mat-icon>group</mat-icon>
</button>
```

---

### BƯỚC 2: Members Dialog UI

**File:** `src/app/features/projects/members-dialog/members-dialog.ts`

**Template:**

```html
<h2 mat-dialog-title>Project Members</h2>

<mat-dialog-content>
  <!-- Invite Section -->
  <div class="invite-section">
    <mat-form-field>
      <input matInput placeholder="Email to invite" [(ngModel)]="emailToInvite" />
    </mat-form-field>
    <button mat-raised-button color="primary" (click)="inviteMember()">Invite</button>
  </div>

  <!-- Current Members -->
  <div class="members-list">
    <h3>Members ({{ members().length }})</h3>
    @for (member of members(); track member.uid) {
    <div class="member-item">
      <img [src]="member.photoURL || defaultAvatar" />
      <span>{{ member.displayName }}</span>
      <span class="email">{{ member.email }}</span>

      @if (isOwner() && member.uid !== data.project.ownerId) {
      <button mat-icon-button color="warn" (click)="removeMember(member.uid)">
        <mat-icon>close</mat-icon>
      </button>
      }
    </div>
    }
  </div>

  <!-- Invited Members -->
  <div class="invited-list">
    <h3>Invited ({{ invitedMembers().length }})</h3>
    @for (invited of invitedMembers(); track invited.uid) {
    <div class="member-item invited">
      <img [src]="invited.photoURL || defaultAvatar" />
      <span>{{ invited.displayName }}</span>
      <span class="badge">Pending</span>
    </div>
    }
  </div>
</mat-dialog-content>
```

**Component:**

```typescript
import { Component, inject, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ProjectsStore } from '../projects.store';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-members-dialog',
  standalone: true,
  imports: [
    /* Material modules */
  ],
  template: `...`,
  styles: [`...`],
})
export class MembersDialogComponent {
  projectsStore = inject(ProjectsStore);
  authStore = inject(AuthStore);

  emailToInvite = '';

  constructor(@Inject(MAT_DIALOG_DATA) public data: { project: Project }) {}

  members = this.projectsStore.members;
  invitedMembers = this.projectsStore.invitedMembers;

  isOwner() {
    return this.data.project.ownerId === this.authStore.user()?.uid;
  }
}
```

---

### BƯỚC 3: Invite Member

**Component Method:**

```typescript
async inviteMember() {
  // Validate
  if (!this.emailToInvite || !this.emailToInvite.includes('@')) {
    this.projectsStore.showError('Invalid email');
    return;
  }

  // Call store
  await this.projectsStore.inviteMember({
    projectId: this.data.project.id,
    email: this.emailToInvite.trim().toLowerCase()
  });

  // Clear input
  this.emailToInvite = '';
}
```

**Store Method:**

```typescript
// File: projects.store.ts

inviteMember: rxMethod<{ projectId: string; email: string }>(
  pipe(
    switchMap(async ({ projectId, email }) => {
      patchState(store, { loading: true });

      try {
        // 1. Tìm user
        const user = await projectsService.getUserByEmail(email);

        if (!user) {
          notificationService.showError('User not found');
          return;
        }

        // 2. Check đã là member
        const project = store.projects().find(p => p.id === projectId);
        if (project?.memberIds.includes(user.uid)) {
          notificationService.showInfo('Already a member');
          return;
        }

        // 3. Check đã được mời
        if (project?.invitedMemberIds?.includes(user.uid)) {
          notificationService.showInfo('Already invited');
          return;
        }

        // 4. Invite
        await projectsService.inviteMember(projectId, user.uid);

        // 5. Update state
        patchState(store, {
          projects: store.projects().map(p =>
            p.id === projectId
              ? {
                  ...p,
                  invitedMemberIds: [
                    ...(p.invitedMemberIds || []),
                    user.uid
                  ]
                }
              : p
          ),
          loading: false
        });

        notificationService.showSuccess('Invitation sent');
      } catch (error) {
        patchState(store, { loading: false });
        notificationService.showError('Failed to invite');
      }
    })
  )
),
```

**Service Methods:**

```typescript
// File: projects.service.ts

async getUserByEmail(email: string): Promise<User | null> {
  const usersCollection = collection(this.firestore, 'users');
  const q = query(usersCollection, where('email', '==', email));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as User;
}

async inviteMember(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(this.firestore, 'projects', projectId);
  await updateDoc(projectRef, {
    invitedMemberIds: arrayUnion(userId)
  });
}
```

---

### BƯỚC 4: Accept/Decline Invitation

**Project List Template:**

```html
<!-- Invited Projects -->
@for (project of invitedProjects(); track project.id) {
<mat-card class="project-card invited">
  <mat-card-header>
    <mat-card-title>{{ project.name }}</mat-card-title>
    <mat-card-subtitle>
      <mat-icon>mail</mat-icon>
      You're invited
    </mat-card-subtitle>
  </mat-card-header>

  <mat-card-actions>
    <button mat-raised-button color="primary" (click)="acceptInvite(project.id)">Accept</button>
    <button mat-button (click)="declineInvite(project.id)">Decline</button>
  </mat-card-actions>
</mat-card>
}
```

**Component Methods:**

```typescript
acceptInvite(projectId: string) {
  this.projectsStore.acceptInvite(projectId);
}

declineInvite(projectId: string) {
  this.projectsStore.declineInvite(projectId);
}
```

**Store Methods:**

```typescript
acceptInvite: rxMethod<string>(
  pipe(
    switchMap(async (projectId) => {
      patchState(store, { loading: true });
      const userId = authStore.user()?.uid;
      if (!userId) return;

      try {
        // Update Firestore
        await projectsService.acceptInvite(projectId, userId);

        // Update state
        patchState(store, {
          projects: store.projects().map(p =>
            p.id === projectId
              ? {
                  ...p,
                  memberIds: [...p.memberIds, userId],
                  invitedMemberIds: (p.invitedMemberIds || [])
                    .filter(id => id !== userId)
                }
              : p
          ),
          loading: false
        });

        notificationService.showSuccess('Joined project');
      } catch (error) {
        notificationService.showError('Failed to join');
      }
    })
  )
),

declineInvite: rxMethod<string>(
  pipe(
    switchMap(async (projectId) => {
      const userId = authStore.user()?.uid;
      if (!userId) return;

      try {
        await projectsService.declineInvite(projectId, userId);

        patchState(store, {
          projects: store.projects().filter(p => p.id !== projectId)
        });

        notificationService.showSuccess('Invitation declined');
      } catch (error) {
        notificationService.showError('Failed to decline');
      }
    })
  )
),
```

**Service Methods:**

```typescript
async acceptInvite(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(this.firestore, 'projects', projectId);
  await updateDoc(projectRef, {
    memberIds: arrayUnion(userId),
    invitedMemberIds: arrayRemove(userId)
  });
}

async declineInvite(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(this.firestore, 'projects', projectId);
  await updateDoc(projectRef, {
    invitedMemberIds: arrayRemove(userId)
  });
}
```

---

### BƯỚC 5: Remove Member

**Component Method:**

```typescript
async removeMember(userId: string) {
  const confirmed = confirm('Remove this member?');
  if (!confirmed) return;

  await this.projectsStore.removeMember({
    projectId: this.data.project.id,
    userId
  });
}
```

**Store Method:**

```typescript
removeMember: rxMethod<{ projectId: string; userId: string }>(
  pipe(
    switchMap(async ({ projectId, userId }) => {
      try {
        // Remove from project
        await projectsService.removeMember(projectId, userId);

        // Unassign from issues
        await issueService.unassignUserFromProjectIssues(projectId, userId);

        // Update state
        patchState(store, {
          projects: store.projects().map(p =>
            p.id === projectId
              ? {
                  ...p,
                  memberIds: p.memberIds.filter(id => id !== userId)
                }
              : p
          )
        });

        notificationService.showSuccess('Member removed');
      } catch (error) {
        notificationService.showError('Failed to remove');
      }
    })
  )
),
```

**Service Methods:**

```typescript
// projects.service.ts
async removeMember(projectId: string, userId: string): Promise<void> {
  const projectRef = doc(this.firestore, 'projects', projectId);
  await updateDoc(projectRef, {
    memberIds: arrayRemove(userId)
  });
}

// issue.service.ts
async unassignUserFromProjectIssues(
  projectId: string,
  userId: string
): Promise<void> {
  const q = query(
    this.issuesCollection,
    where('projectId', '==', projectId),
    where('assigneeId', '==', userId)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const updates = snapshot.docs.map(doc => ({
    id: doc.id,
    data: { assigneeId: null }
  }));

  return this.batchUpdateIssues(updates);
}
```

---

## CODE CHÍNH XÁC

### Imports cần thiết

```typescript
// Firestore
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

// RxJS
import { pipe, switchMap } from 'rxjs';

// NgRx Signals
import { patchState, rxMethod } from '@ngrx/signals/rxjs-interop';
```

### Models

```typescript
// project.model.ts
export interface Project {
  id: string;
  name: string;
  key: string;
  ownerId: string;
  memberIds: string[];
  invitedMemberIds?: string[];
}

// user.model.ts
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}
```

---

## FIRESTORE RULES

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function isProjectMember(projectId) {
      let project = get(/databases/$(database)/documents/projects/$(projectId));
      return project != null && (
        project.data.memberIds.hasAny([request.auth.uid]) ||
        (project.data.invitedMemberIds != null &&
         project.data.invitedMemberIds.hasAny([request.auth.uid]))
      );
    }

    match /projects/{projectId} {
      allow read: if signedIn() && (
        resource.data.memberIds.hasAny([request.auth.uid]) ||
        (resource.data.invitedMemberIds != null &&
         resource.data.invitedMemberIds.hasAny([request.auth.uid]))
      );

      allow create: if signedIn() &&
        request.resource.data.ownerId == request.auth.uid;

      allow update: if signedIn() &&
        resource.data.ownerId == request.auth.uid;

      allow delete: if signedIn() &&
        resource.data.ownerId == request.auth.uid;
    }

    match /users/{uid} {
      allow read: if signedIn();
      allow write: if signedIn() && request.auth.uid == uid;
    }
  }
}
```

---

## TESTING

### Test 1: Invite Member

**Steps:**

1. Login as Owner
2. Click "Manage Members"
3. Enter email: `test@example.com`
4. Click "Invite"

**Expected:**

- ✅ Success: "Invitation sent"
- ✅ Email in "Invited" section
- ✅ Firestore: `invitedMemberIds` updated

### Test 2: Accept Invitation

**Steps:**

1. Login as invited user
2. See project with "You're invited"
3. Click "Accept"

**Expected:**

- ✅ Success: "Joined project"
- ✅ Can access project
- ✅ Firestore: moved to `memberIds`

### Test 3: Decline Invitation

**Steps:**

1. Login as invited user
2. Click "Decline"

**Expected:**

- ✅ Success: "Invitation declined"
- ✅ Project disappears
- ✅ Firestore: removed from `invitedMemberIds`

### Test 4: Remove Member

**Steps:**

1. Login as Owner
2. Click "Manage Members"
3. Click "Remove"
4. Confirm

**Expected:**

- ✅ Success: "Member removed"
- ✅ Member disappears
- ✅ Issues unassigned
- ✅ Firestore: removed from `memberIds`

---

## TROUBLESHOOTING

### "User not found"

- User chưa đăng ký
- Check `users` collection

### "Permission denied"

- Deploy Firestore rules
- Check user in `memberIds` or `invitedMemberIds`

### "Already a member"

- User đã là member
- Check `memberIds` array

### UI không update

- Refresh page
- Check `patchState` logic

---

## SUMMARY

**Files quan trọng:**

- `members-dialog.ts` - UI
- `projects.store.ts` - State
- `projects.service.ts` - Firestore
- `firestore.rules` - Security

**Luồng:**

```
Invite → invitedMemberIds[]
  → Accept → memberIds[]
  → Remove → Xóa
```

**Key Points:**

- ✅ Dùng `arrayUnion`/`arrayRemove`
- ✅ Validate email
- ✅ Check duplicate
- ✅ Unassign issues
- ✅ Update local state

---

**Version:** 1.0  
**Date:** 16/01/2026
