# Project Members Management - Deep Dive

> **Mục đích tài liệu**: Giải thích chi tiết luồng quản lý thành viên trong dự án, bao gồm: Mời thành viên, Chấp nhận/Từ chối lời mời, Kick thành viên, và Tự rời khỏi dự án.

---

## 📋 MỤC LỤC

1. [Tổng quan](#-tổng-quan)
2. [Data Model](#-data-model)
3. [Luồng 1: Mời thành viên vào Project](#-luồng-1-mời-thành-viên-vào-proj ect)
4. [Luồng 2: Chấp nhận lời mời](#-luồng-2-chấp-nhận-lời-mời)
5. [Luồng 3: Từ chối lời mời](#-luồng-3-từ-chối-lời-mời)
6. [Luồng 4: Kick thành viên (Owner)](#-luồng-4-kick-thành-viên-owner)
7. [Luồng 5: Tự rời khỏi Project](#-luồng-5-tự-rời-khỏi-project)
8. [Security & Real-time Updates](#-security--real-time-updates)
9. [Key Takeaways](#-key-takeaways)

---

## 🎯 TỔNG QUAN

### Vai trò trong Project

Hệ thống phân biệt 2 vai trò chính:

1. **Owner (Chủ dự án)**:

   - Người tạo ra project
   - Có quyền mời/kick thành viên
   - Không thể tự rời khỏi project (phải delete project)

2. **Member (Thành viên)**:
   - Được mời vào project
   - Có thể tự rời khỏi project bất cứ lúc nào
   - Không có quyền quản lý thành viên khác

### Trạng thái thành viên

```
┌──────────────┐
│ Not Related  │ (Người dùng chưa liên quan đến project)
└──────┬───────┘
       │ Owner gửi lời mời
       ↓
┌──────────────┐
│   Invited    │ (Có trong invitedMemberIds[])
└──────┬───────┘
       │ Accept / Reject
       ↓
┌──────────────┐       ┌──────────────┐
│    Member    │       │ Not Related  │
│ (memberIds[])│       │  (Rejected)  │
└──────┬───────┘       └──────────────┘
       │ Leave / Kicked
       ↓
┌──────────────┐
│ Not Related  │
└──────────────┘
```

---

## 📊 DATA MODEL

### Project Interface

```typescript
export interface Project {
  id: string;
  name: string;
  key: string;
  ownerId: string; // ID của người tạo project
  memberIds: string[]; // Danh sách ID thành viên hiện tại
  invitedMemberIds?: string[]; // Danh sách ID người được mời nhưng chưa accept
}
```

**Ví dụ dữ liệu**:

```json
{
  "id": "proj-123",
  "name": "Jira Clone",
  "key": "JC",
  "ownerId": "user-A",
  "memberIds": ["user-A", "user-B", "user-C"],
  "invitedMemberIds": ["user-D", "user-E"]
}
```

**Giải thích**:

- `user-A`: Owner (luôn có trong memberIds)
- `user-B`, `user-C`: Đã accept invite, là members
- `user-D`, `user-E`: Đã được mời nhưng chưa quyết định

---


## 🔵 LUỒNG 1: MỜI THÀNH VIÊN VÀO PROJECT

### UI Flow

```
Owner mở Members Dialog
       ↓
Nhập email của người muốn mời
       ↓
Click "Add" button
       ↓
System tìm user theo email
       ↓
Kiểm tra điều kiện
       ↓
Gửi lời mời (cập nhật invitedMemberIds)
       ↓
Thông báo thành công
```

### Code Flow

#### 1. UI Component (MembersDialog)

```typescript
// members-dialog.ts
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
```

**Template**:

```html
<mat-form-field>
  <input matInput [(ngModel)]="emailToAdd" placeholder="friend@example.com" />
</mat-form-field>
<button mat-raised-button (click)="addMember()"><mat-icon>person_add</mat-icon> Add</button>
```

---

#### 2. Store Method (ProjectsStore)

```typescript
// projects.store.ts
inviteUser: async (email: string) => {
  store.setLoading(true);
  try {
    // 1. Tìm user theo email
    const users = await firstValueFrom(projectsService.findUserByEmail(email));
    if (users.length === 0) throw new Error('User not found');

    const userToInvite = users[0];
    const project = store.selectedProject();

    if (project) {
      // 2. Kiểm tra: Đã là member chưa?
      if (project.memberIds.includes(userToInvite.uid)) {
        throw new Error('User is already a member');
      }

      // 3. Kiểm tra: Đã được mời chưa?
      if (project.invitedMemberIds?.includes(userToInvite.uid)) {
        throw new Error('User is already invited');
      }

      // 4. Gửi lời mời
      await projectsService.inviteUserToProject(
        project.id,
        userToInvite.uid,
        project.invitedMemberIds
      );

      errorService.showSuccess(`Invitation sent to ${email}`);
    }
    store.setLoading(false);
  } catch (err: any) {
    errorService.showError(err.message);
    throw err;
  }
};
```

**Logic kiểm tra**:

1. **User tồn tại?** Tìm trong Firestore collection `users`
2. **Đã là member?** Check `memberIds.includes(uid)`
3. **Đã được mời?** Check `invitedMemberIds.includes(uid)`

---

#### 3. Service Method (ProjectsService)

```typescript
// projects.service.ts
findUserByEmail(email: string): Observable<any[]> {
  const usersCollection = collection(this.firestore, 'users');
  const q = query(usersCollection, where('email', '==', email));
  return runInInjectionContext(this.injector, () => collectionData(q));
}

inviteUserToProject(projectId: string, userId: string, currentInvitedIds: string[] = []) {
  const docRef = doc(this.firestore, 'projects', projectId);

  // Tránh duplicate
  if (currentInvitedIds.includes(userId)) return Promise.resolve();

  const newInvitedIds = [...currentInvitedIds, userId];
  return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
}
```

**Firestore Update**:

```javascript
// Trước
{
  invitedMemberIds: ['user-D'];
}

// Sau khi mời user-E
{
  invitedMemberIds: ['user-D', 'user-E'];
}
```

---

### Luồng dữ liệu hoàn chỉnh

```
1. User nhập email "john@example.com"
   ↓
2. MembersDialog.addMember() gọi store.inviteUser()
   ↓
3. Store gọi projectsService.findUserByEmail()
   ↓
4. Firestore query: where('email', '==', 'john@example.com')
   ↓
5. Tìm thấy user { uid: 'user-123', email: 'john@...' }
   ↓
6. Kiểm tra điều kiện (chưa là member, chưa được mời)
   ↓
7. Gọi projectsService.inviteUserToProject()
   ↓
8. Firestore updateDoc: invitedMemberIds.push('user-123')
   ↓
9. Real-time listener phát hiện thay đổi
   ↓
10. UI tự động cập nhật (nếu user-123 đang oninle)
```

---

## 🟢 LUỒNG 2: CHẤP NHẬN LỜI MỜI

### UI Flow

User được mời sẽ thấy notification hoặc pending invites list. Khi click "Accept":

```
User click "Accept Invite"
       ↓
Store.acceptInvite() được gọi
       ↓
Service di chuyển user từ invitedMemberIds → memberIds
       ↓
Firestore cập nhật
       ↓
Real-time sync: Project xuất hiện trong danh sách của user
```

### Code Flow

#### 1. Store Method

```typescript
// projects.store.ts
acceptInvite: async (project: Project, userId: string) => {
  try {
    await projectsService.acceptInvite(project, userId);

    // Optimistic update: Cập nhật local state ngay lập tức
    patchState(store, {
      // Xóa khỏi pending invites
      pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),

      // Thêm vào danh sách projects
      projects: [...store.projects(), { ...project, memberIds: [...project.memberIds, userId] }],
    });

    errorService.showSuccess(`Joined project "${project.name}"`);
  } catch (err: any) {
    errorService.showError(err.message);
  }
};
```

---

#### 2. Service Method

```typescript
// projects.service.ts
async acceptInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);

  // 1. Xóa khỏi danh sách invited
  const newInvitedIds = (project.invitedMemberIds || []).filter((id) => id !== userId);

  // 2. Thêm vào danh sách members
  const newMemberIds = [...project.memberIds, userId];

  // 3. Cập nhật cả 2 field cùng lúc (atomic)
  return updateDoc(docRef, {
    invitedMemberIds: newInvitedIds,
    memberIds: newMemberIds,
  });
}
```

**Firestore Update**:

```javascript
// Trước
{
  memberIds: ["user-A", "user-B"],
  invitedMemberIds: ["user-C", "user-D"]
}

// Sau khi user-C accept
{
  memberIds: ["user-A", "user-B", "user-C"],
  invitedMemberIds: ["user-D"]
}
```

---

### Real-time Sync

Khi Firestore cập nhật, tất cả users liên quan sẽ nhận được update:

```
User C accept invite
       ↓
Firestore updateDoc()
       ↓
Real-time listener (collectionData) emit event
       ↓
┌─────────────────────────────────────────────────────┐
│ User A (Owner)                                      │
│ - projects() signal cập nhật                        │
│ - Thấy user-C xuất hiện trong members list         │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ User B (Member)                                     │
│ - projects() signal cập nhật                        │
│ - Thấy user-C xuất hiện trong members list         │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ User C (Vừa accept)                                 │
│ - pendingInvites() signal: Xóa project này          │
│ - projects() signal: Thêm project này               │
│ - Có thể truy cập project board ngay lập tức       │
└─────────────────────────────────────────────────────┘
```

---

## 🔴 LUỒNG 3: TỪ CHỐI LỜI MỜI

### Code Flow

```typescript
// projects.store.ts
rejectInvite: async (project: Project, userId: string) => {
  try {
    await projectsService.rejectInvite(project, userId);

    // Xóa khỏi pending invites
    patchState(store, {
      pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
    });

    errorService.showInfo('Invitation declined');
  } catch (err: any) {
    errorService.showError(err.message);
  }
};
```

```typescript
// projects.service.ts
rejectInvite(project: Project, userId: string) {
  const docRef = doc(this.firestore, 'projects', project.id);
  const newInvitedIds = (project.invitedMemberIds || []).filter((id) => id !== userId);
  return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
}
```

**Firestore Update**:

```javascript
// Trước
{
  invitedMemberIds: ['user-C', 'user-D'];
}

// Sau khi user-C reject
{
  invitedMemberIds: ['user-D'];
}
```

**Kết quả**: User C không còn thấy lời mời này nữa, nhưng Owner vẫn có thể mời lại sau.

---

## ⚠️ LUỒNG 4: KICK THÀNH VIÊN (OWNER)

### UI Flow

```
Owner mở Members Dialog
       ↓
Click icon "Remove" bên cạnh tên member
       ↓
Confirm dialog: "Are you sure?"
       ↓
Store.removeMember() được gọi
       ↓
1. Unassign tất cả issues của member đó trong project
2. Xóa member khỏi memberIds
       ↓
Member bị kick sẽ mất quyền truy cập ngay lập tức
```

### Code Flow

#### 1. UI Component

```typescript
// members-dialog.ts
async removeMember(memberId: string) {
  if (!confirm('Are you sure you want to remove this member?')) return;

  try {
    await this.store.removeMember(memberId);
  } catch (err: any) {
    this.error = err.message || 'Failed to remove member';
  }
}
```

**Template**:

```html
<!-- Chỉ hiển thị nếu là Owner và không phải chính mình -->
@if (isOwner && member.uid !== currentUser?.uid) {
<button mat-icon-button (click)="removeMember(member.uid)" color="warn">
  <mat-icon>remove_circle_outline</mat-icon>
</button>
}
```

---

#### 2. Store Method

```typescript
// projects.store.ts
removeMember: async (memberId: string) => {
  store.setLoading(true);
  try {
    const project = store.selectedProject();
    if (project) {
      // BƯỚC 1: Unassign issues
      await issueService.unassignUserFromProjectIssues(project.id, memberId);

      // BƯỚC 2: Remove from project
      await projectsService.removeMemberFromProject(project.id, memberId, project.memberIds);

      // BƯỚC 3: Update local state
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
    errorService.showError(err.message);
    throw err;
  }
};
```

**Tại sao phải unassign issues trước?**

- Nếu member bị kick mà vẫn còn issues assign cho họ → Data inconsistency
- Các issues đó sẽ tự động chuyển về "Unassigned"

---

#### 3. Service Methods

```typescript
// projects.service.ts
removeMemberFromProject(projectId: string, memberIdToRemove: string, currentMemberIds: string[]) {
  const docRef = doc(this.firestore, 'projects', projectId);
  const newMemberIds = currentMemberIds.filter((id) => id !== memberIdToRemove);
  return updateDoc(docRef, { memberIds: newMemberIds });
}
```

```typescript
// issue.service.ts
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
    data: { assigneeId: null },
  }));

  return this.batchUpdateIssues(updates);
}
```

---

### Real-time Effect khi bị Kick

```
Owner kick user-B
       ↓
Firestore updateDoc: memberIds = ["user-A", "user-C"]
       ↓
Real-time listener phát hiện thay đổi
       ↓
┌─────────────────────────────────────────────────────┐
│ User B (Bị kick)                                    │
│ 1. projects() signal cập nhật                       │
│ 2. Project này biến mất khỏi danh sách              │
│ 3. Effect trong ProjectsStore phát hiện:            │
│    - selectedProjectId vẫn còn                      │
│    - Nhưng project không còn trong projects()       │
│ 4. Trigger security check:                          │
│    - Alert: "Project does not exist anymore"        │
│    - Navigate về /projects                          │
└─────────────────────────────────────────────────────┘
```

**Code Security Check**:

```typescript
// projects.store.ts - withHooks
effect(() => {
  const projects = store.projects();
  const selectedId = store.selectedProjectId();
  const isLoading = store.loading();

  if (!isLoading && selectedId) {
    const stillHasAccess = projects.some((p) => p.id === selectedId);

    if (!stillHasAccess) {
      setTimeout(() => {
        alert('Project does not exist anymore');
        patchState(store, { selectedProjectId: null });
        router.navigate(['/projects']);
      }, 200);
    }
  }
});
```

---

## 🚪 LUỒNG 5: TỰ RỜI KHỎI PROJECT

### UI Flow

```
Member (không phải Owner) mở Members Dialog
       ↓
Thấy nút "Leave" bên cạnh tên mình
       ↓
Click "Leave"
       ↓
Confirm: "Are you sure you want to leave?"
       ↓
Store.removeMember(currentUserId) được gọi
       ↓
Dialog đóng lại
       ↓
Navigate về /projects
```

### Code Flow

```typescript
// members-dialog.ts
async leaveProject(memberId: string) {
  if (!confirm('Are you sure you want to leave this project?')) return;

  try {
    await this.store.removeMember(memberId);
    this.dialogRef.close();
    this.router.navigate(['/projects']);
  } catch (err: any) {
    this.error = err.message || 'Failed to leave project';
  }
}
```

**Template**:

```html
<!-- Chỉ hiển thị nếu KHÔNG phải Owner và là chính mình -->
@if (!isOwner && member.uid === currentUser?.uid) {
<button mat-button color="warn" (click)="leaveProject(member.uid)">Leave</button>
}
```

**Logic**:

- Sử dụng lại method `removeMember()` (giống kick)
- Sau khi leave thành công, tự động navigate về `/projects`
- Real-time sync sẽ xóa project khỏi danh sách của user

---

## 🔒 SECURITY & REAL-TIME UPDATES

### 1. Firestore Security Rules (Ví dụ)

```javascript
// firestore.rules
match /projects/{projectId} {
  // Chỉ members mới đọc được
  allow read: if request.auth.uid in resource.data.memberIds;

  // Chỉ owner mới update được
  allow update: if request.auth.uid == resource.data.ownerId;

  // Chỉ owner mới delete được
  allow delete: if request.auth.uid == resource.data.ownerId;
}
```

---

### 2. Real-time Listener Pattern

```typescript
// projects.service.ts
getProjects(userId: string): Observable<Project[]> {
  const q = query(
    this.projectsCollection,
    where('memberIds', 'array-contains', userId)
  );

  return collectionData(q, { idField: 'id' }) as Observable<Project[]>;
}
```

**Cách hoạt động**:

- `where('memberIds', 'array-contains', userId)`: Chỉ query projects mà user là member
- `collectionData()`: Tạo Observable liên tục lắng nghe Firestore
- Khi memberIds thay đổi (kick/leave) → Query result tự động cập nhật

---

### 3. Auto-redirect khi mất quyền truy cập

```typescript
// projects.store.ts
effect(() => {
  const projects = store.projects();
  const selectedId = store.selectedProjectId();

  if (selectedId) {
    const stillHasAccess = projects.some((p) => p.id === selectedId);

    if (!stillHasAccess) {
      // User đang xem project nhưng bị kick/leave
      alert('Project does not exist anymore');
      router.navigate(['/projects']);
    }
  }
});
```

**Kịch bản**:

1. User B đang xem Board của Project X
2. Owner kick User B
3. Real-time listener cập nhật → Project X biến mất khỏi `projects()`
4. Effect phát hiện `selectedProjectId` không còn trong `projects()`
5. Tự động alert và redirect về `/projects`

---

## 🎯 KEY TAKEAWAYS

### 1. **Invitation System (2-step process)**

```
Invite → Pending (invitedMemberIds) → Accept → Member (memberIds)
```

**Lợi ích**:

- User có quyền từ chối
- Tránh spam (không tự động thêm vào project)

---

### 2. **Atomic Updates**

```typescript
// ✅ ĐÚNG: Cập nhật cả 2 fields cùng lúc
updateDoc(docRef, {
  invitedMemberIds: newInvitedIds,
  memberIds: newMemberIds,
});

// ❌ SAI: Cập nhật từng field riêng lẻ
updateDoc(docRef, { invitedMemberIds: newInvitedIds });
updateDoc(docRef, { memberIds: newMemberIds }); // Có thể fail giữa chừng
```

---

### 3. **Cleanup khi Remove Member**

```typescript
// Thứ tự quan trọng:
1. Unassign issues
2. Remove from memberIds
3. Update local state
```

**Tại sao?**

- Đảm bảo data consistency
- Tránh orphaned issues (issues không có assignee hợp lệ)

---

### 4. **Real-time Security**

```typescript
// Effect tự động kiểm tra quyền truy cập
effect(() => {
  const stillHasAccess = projects.some((p) => p.id === selectedId);
  if (!stillHasAccess) {
    // Redirect ngay lập tức
  }
});
```

**Pattern này bảo vệ**:

- User bị kick không thể tiếp tục xem project
- Tự động redirect về trang an toàn

---

### 5. **Optimistic Updates**

```typescript
// Cập nhật UI ngay lập tức, không đợi Firestore
patchState(store, {
  pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
  projects: [...store.projects(), newProject],
});
```

**Lợi ích**:

- UI phản hồi nhanh
- UX tốt hơn
- Nếu có lỗi, error handler sẽ rollback

---

### 6. **Permission-based UI**

```html
<!-- Owner: Có nút Remove -->
@if (isOwner && member.uid !== currentUser?.uid) {
<button (click)="removeMember()">Remove</button>
}

<!-- Member: Có nút Leave -->
@if (!isOwner && member.uid === currentUser?.uid) {
<button (click)="leaveProject()">Leave</button>
}
```

**Nguyên tắc**:

- UI chỉ hiển thị actions mà user có quyền thực hiện
- Tránh confusion và improve UX

---

## 📝 TÓM TẮT

**Project Members Management** là một hệ thống hoàn chỉnh với:

1. **Invitation System**: 2-step process (Invite → Accept/Reject)
2. **Role-based Permissions**: Owner vs Member
3. **Real-time Sync**: Firestore listeners + Signals
4. **Security**: Auto-redirect khi mất quyền truy cập
5. **Data Consistency**: Cleanup issues khi remove member
6. **Optimistic Updates**: UI phản hồi nhanh

**Pattern này có thể tái sử dụng cho**:

- Team management
- Workspace collaboration
- Access control systems

---

**Tài liệu này giúp bạn hiểu sâu về cách quản lý thành viên trong project. Hãy áp dụng các pattern này vào các tính năng tương tự!** 🎉
