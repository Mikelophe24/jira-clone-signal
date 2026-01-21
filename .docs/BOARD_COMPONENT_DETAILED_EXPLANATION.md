# 📊 Board Component - Giải Thích Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#tổng-quan)
2. [Imports & Dependencies](#imports--dependencies)
3. [Template Structure](#template-structure)
4. [Drag & Drop System](#drag--drop-system)
5. [Component Class](#component-class)
6. [Styling Deep Dive](#styling-deep-dive)
7. [State Management Flow](#state-management-flow)
8. [User Interactions](#user-interactions)
9. [Best Practices](#best-practices)

---

## 🎯 Tổng Quan

**Board Component** là trái tim của ứng dụng Jira Clone - nơi users quản lý tasks theo Kanban methodology.

### **Chức Năng Chính**

1. 📋 **Kanban Board**: Hiển thị 3 columns (TODO, IN PROGRESS, DONE)
2. 🖱️ **Drag & Drop**: Di chuyển issues giữa các columns
3. 🔍 **Search & Filter**: Tìm kiếm và lọc issues
4. ➕ **CRUD Operations**: Create, Read, Update, Delete issues
5. 👥 **Member Management**: Hiển thị assignees, mở members dialog
6. 🎨 **Visual Indicators**: Priority icons, due dates, subtasks progress

### **File Size: 711 dòng!**

Đây là một trong những components lớn nhất trong app, bao gồm:

- **Template**: 322 dòng (45%)
- **Styles**: 254 dòng (36%)
- **Logic**: 135 dòng (19%)

---

## 📦 Imports & Dependencies

### **Dòng 1-22: Import Statements**

```typescript
import { Component, inject, OnInit, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BoardStore } from '../board.store';
import { ProjectsStore } from '../../projects/projects.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Issue, IssuePriority } from '../../issue/issue.model';
import { MatDialog } from '@angular/material/dialog';
import { BoardFilter } from './board-filter';
import { IssueDialog } from '../../issue/issue-dialog/issue-dialog';
import { MembersDialog } from '../../projects/members-dialog/members-dialog';
```

#### **Core Angular**

- **`OnInit`**: Lifecycle hook để init data
- **`effect`**: Reactive side effects với signals
- **`ActivatedRoute`**: Lấy route params (projectId)

#### **Stores (State Management)**

```typescript
BoardStore; // Quản lý issues, filters, drag & drop
ProjectsStore; // Quản lý project info, members
AuthStore; // Quản lý user authentication
```

#### **Angular CDK Drag & Drop**

```typescript
DragDropModule; // Module cho drag & drop
CdkDragDrop; // Event type khi drop
```

**Tại sao dùng CDK thay vì HTML5 Drag & Drop?**

- ✅ Touch support (mobile)
- ✅ Accessibility (keyboard navigation)
- ✅ Animation built-in
- ✅ Better browser compatibility

#### **Material Dialog**

```typescript
MatDialog; // Service để mở dialogs
IssueDialog; // Dialog tạo/edit issue
MembersDialog; // Dialog quản lý members
```

#### **Custom Components**

```typescript
BoardFilter; // Component filter issues (assignee, status, priority)
```

---

## 🖼️ Template Structure

Template có **322 dòng**, tôi sẽ chia nhỏ để giải thích:

### **A. Board Container (Dòng 46)**

```html
<div class="board-container">
  <!-- All content -->
</div>
```

**CSS:**

```css
.board-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background-color: #f4f5f7; /* Jira light gray */
}
```

**Layout:**

```
┌─────────────────────────────────┐
│  Board Container (flex column)  │
│  ┌───────────────────────────┐  │
│  │  Board Header             │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  Board Columns (flex row) │  │
│  │  ┌─────┬─────┬─────┐      │  │
│  │  │TODO │ IP  │DONE │      │  │
│  │  └─────┴─────┴─────┘      │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

### **B. Board Header (Dòng 47-75)**

```html
<div class="board-header">
  <div class="header-content">
    <h2>{{ projectsStore.selectedProject()?.name }} Board</h2>

    <div class="filters">
      <!-- Search input -->
      <mat-form-field appearance="outline" class="search-input">
        <mat-icon matPrefix>search</mat-icon>
        <input matInput placeholder="Search issues" (input)="onSearch($event)" />
      </mat-form-field>

      <!-- Quick filters -->
      <div class="quick-filters">
        <button
          mat-stroked-button
          [class.active]="store.filter().onlyMyIssues"
          (click)="toggleMyIssues()"
        >
          Only My Issues
        </button>
        <app-board-filter></app-board-filter>
        <button mat-stroked-button (click)="openMembersDialog()">
          <mat-icon>people</mat-icon> Members
        </button>
      </div>
    </div>
  </div>

  @if (store.loading()) {
  <mat-spinner diameter="30"></mat-spinner>
  }
</div>
```

#### **B.1. Project Name Display**

```html
<h2>{{ projectsStore.selectedProject()?.name }} Board</h2>
```

**Luồng:**

```
projectsStore.selectedProject() signal
   ↓
Computed từ selectedProjectId
   ↓
Tìm project trong projects array
   ↓
Hiển thị: "My Project Board"
```

**Optional chaining `?.`:**

```typescript
// Nếu selectedProject() = undefined
projectsStore.selectedProject()?.name; // → undefined (không crash)

// Thay vì:
projectsStore.selectedProject().name; // → Error: Cannot read property 'name' of undefined
```

---

#### **B.2. Search Input (Dòng 51-54)**

```html
<mat-form-field appearance="outline" class="search-input" subscriptSizing="dynamic">
  <mat-icon matPrefix>search</mat-icon>
  <input matInput placeholder="Search issues" (input)="onSearch($event)" />
</mat-form-field>
```

**Attributes:**

- **`appearance="outline"`**: Material outlined style
- **`subscriptSizing="dynamic"`**: Error messages không làm shift layout
- **`matPrefix`**: Icon ở đầu input

**Event Handler:**

```typescript
// board.ts - Dòng 606-609
onSearch(event: Event) {
  const input = event.target as HTMLInputElement;
  this.store.updateFilter({ searchQuery: input.value });
}
```

**Luồng:**

```
User type "bug"
   ↓
(input) event fired
   ↓
onSearch() called
   ↓
store.updateFilter({ searchQuery: "bug" })
   ↓
BoardStore filter signal updated
   ↓
filteredIssues computed signal re-compute
   ↓
todoIssues, inProgressIssues, doneIssues re-compute
   ↓
Template re-render với filtered issues
```

---

#### **B.3. Quick Filters (Dòng 56-68)**

##### **"Only My Issues" Button**

```html
<button mat-stroked-button [class.active]="store.filter().onlyMyIssues" (click)="toggleMyIssues()">
  Only My Issues
</button>
```

**Dynamic Class Binding:**

```typescript
[class.active]="store.filter().onlyMyIssues"

// Nếu store.filter().onlyMyIssues = true
// → <button class="active">

// CSS:
button.active {
  background-color: #deebff;
  color: #0052cc;
  border-color: transparent;
}
```

**Click Handler:**

```typescript
// board.ts - Dòng 611-618
toggleMyIssues() {
  const current = this.store.filter().onlyMyIssues;
  const user = this.authStore.user();
  this.store.updateFilter({
    onlyMyIssues: !current,
    userId: user ? user.uid : null,
  });
}
```

**Luồng:**

```
User click "Only My Issues"
   ↓
toggleMyIssues() called
   ↓
Get current filter state: onlyMyIssues = false
   ↓
Get current user: user.uid = "abc123"
   ↓
updateFilter({ onlyMyIssues: true, userId: "abc123" })
   ↓
BoardStore filter updated
   ↓
filteredIssues re-compute:
  - Filter issues where assigneeId === "abc123"
   ↓
Template re-render với only user's issues
   ↓
Button class.active = true (highlighted)
```

##### **BoardFilter Component**

```html
<app-board-filter></app-board-filter>
```

Đây là một child component riêng để filter theo:

- **Assignee**: Chọn members
- **Status**: TODO, IN PROGRESS, DONE
- **Priority**: High, Medium, Low

##### **Members Dialog Button**

```html
<button mat-stroked-button (click)="openMembersDialog()">
  <mat-icon>people</mat-icon> Members
</button>
```

```typescript
// board.ts - Dòng 665-669
openMembersDialog() {
  this.dialog.open(MembersDialog, {
    width: '500px',
  });
}
```

Mở dialog để:

- Xem danh sách members
- Invite users
- Remove members

---

#### **B.4. Loading Spinner (Dòng 72-74)**

```html
@if (store.loading()) {
<mat-spinner diameter="30"></mat-spinner>
}
```

Hiển thị spinner khi:

- Load issues từ Firestore
- Update issue status (drag & drop)
- Delete issue

---

### **C. Board Columns (Dòng 77-320)**

```html
<div class="board-columns" cdkDropListGroup>
  <!-- TO DO Column -->
  <!-- IN PROGRESS Column -->
  <!-- DONE Column -->
</div>
```

#### **`cdkDropListGroup`**

**Quan trọng!** Directive này cho phép drag & drop **giữa các columns**.

```html
<div cdkDropListGroup>
  <div cdkDropList [cdkDropListData]="todoIssues">...</div>
  <div cdkDropList [cdkDropListData]="inProgressIssues">...</div>
  <div cdkDropList [cdkDropListData]="doneIssues">...</div>
</div>
```

**Không có `cdkDropListGroup`:**

- ❌ Chỉ drag trong cùng 1 column
- ❌ Không thể move issue từ TODO → IN PROGRESS

**Có `cdkDropListGroup`:**

- ✅ Drag giữa các columns
- ✅ Move issue tự do

---

### **C.1. Column Structure (Dòng 79-157 - TODO Column)**

Tôi sẽ phân tích TODO column, các columns khác tương tự:

```html
<div class="column">
  <!-- Column Header -->
  <div class="column-header">
    <h3>TO DO</h3>
    <div class="header-end">
      <span class="issue-count">{{ store.todoIssues().length }}</span>
      <button mat-icon-button (click)="openIssueDialog('todo')">
        <mat-icon>add</mat-icon>
      </button>
    </div>
  </div>

  <!-- Issue List (Drop Zone) -->
  <div
    cdkDropList
    [cdkDropListData]="store.todoIssues()"
    class="issue-list"
    (cdkDropListDropped)="drop($event, 'todo')"
  >
    <!-- Issue Cards -->
    @for (issue of store.todoIssues(); track issue.id) {
    <mat-card
      class="issue-card"
      cdkDrag
      [cdkDragData]="issue"
      (click)="openIssueDialog('todo', issue)"
    >
      <!-- Card content -->
    </mat-card>
    }
  </div>
</div>
```

#### **Column Header**

```html
<div class="column-header">
  <h3>TO DO</h3>
  <div class="header-end">
    <span class="issue-count">{{ store.todoIssues().length }}</span>
    <button mat-icon-button (click)="openIssueDialog('todo')">
      <mat-icon>add</mat-icon>
    </button>
  </div>
</div>
```

**Visual:**

```
┌─────────────────────────┐
│ TO DO              3  + │ ← h3, count, add button
└─────────────────────────┘
```

**Issue Count:**

```typescript
{
  {
    store.todoIssues().length;
  }
}

// BoardStore computed signal:
todoIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo'));
```

**Add Button:**

```typescript
click = "openIssueDialog('todo')";

// Opens dialog to create new issue with status = 'todo'
```

---

#### **Drop List (Drop Zone)**

```html
<div
  cdkDropList
  [cdkDropListData]="store.todoIssues()"
  class="issue-list"
  (cdkDropListDropped)="drop($event, 'todo')"
></div>
```

**Attributes:**

##### **`cdkDropList`**

Directive đánh dấu đây là drop zone.

##### **`[cdkDropListData]="store.todoIssues()"`**

Data binding cho drop list. CDK dùng để:

- Track items trong list
- Calculate drop position
- Update array order

##### **`(cdkDropListDropped)="drop($event, 'todo')"`**

Event fired khi user drop issue vào column này.

**Event object:**

```typescript
interface CdkDragDrop<T> {
  previousIndex: number; // Vị trí cũ trong arrayy
  item: CdkDrag<T>; // Item được drag
  currentIndex: number; // Vị trí mới trong arra
  container: CdkDropList<T>; // Drop list hiện tại
  previousContainer: CdkDropList<T>; // Drop list trước đó
  isPointerOverContainer: boolean;
  distance: { x: number; y: number };
}
```

**Handler:**

```typescript
// board.ts - Dòng 620-622
drop(event: CdkDragDrop<Issue[]>, newStatus: string) {
  this.store.moveIssue(event, newStatus);
}
```

---

#### **Issue Cards (Dòng 95-154)**

```html
@for (issue of store.todoIssues(); track issue.id) {
<mat-card class="issue-card" cdkDrag [cdkDragData]="issue" (click)="openIssueDialog('todo', issue)">
  <!-- Delete Button -->
  <button
    mat-icon-button
    class="delete-btn"
    color="warn"
    (click)="$event.stopPropagation(); deleteIssue(issue.id)"
  >
    <mat-icon>delete</mat-icon>
  </button>

  <mat-card-content>
    <!-- Issue Title -->
    <div class="issue-title">{{ issue.title }}</div>

    <!-- Issue Meta -->
    <div class="issue-meta">
      <div class="meta-left">
        <!-- Priority Icon -->
        <mat-icon
          [style.color]="getPriorityColor(issue.priority)"
          class="priority-icon"
          [matTooltip]="issue.priority"
        >
          {{ getPriorityIcon(issue.priority) }}
        </mat-icon>

        <!-- Issue Key -->
        <span class="key">{{ issue.key }}</span>

        <!-- Due Date -->
        @if (issue.dueDate) {
        <span class="due-date" [class.overdue]="isOverdue(issue.dueDate)">
          <mat-icon>calendar_today</mat-icon>
          {{ issue.dueDate | date : 'd MMM' }}
        </span>
        }

        <!-- Subtasks Progress -->
        @if (getSubtaskStats(issue); as stats) {
        <span class="subtasks-count" title="Subtasks">
          <mat-icon>check_box</mat-icon>
          {{ stats.completed }}/{{ stats.total }}
        </span>
        }
      </div>

      <!-- Assignee Avatar -->
      @if (getAssignee(issue.assigneeId); as assignee) {
      <img
        [src]="assignee.photoURL || 
                      'https://ui-avatars.com/api/?name=' + 
                      assignee.displayName + '&background=random'"
        class="assignee-avatar"
        [title]="assignee.displayName"
      />
      }
    </div>
  </mat-card-content>
</mat-card>
}
```

**Phân tích từng phần:**

##### **Card Attributes**

```html
<mat-card
  class="issue-card"
  cdkDrag
  [cdkDragData]="issue"
  (click)="openIssueDialog('todo', issue)"
></mat-card>
```

- **`cdkDrag`**: Directive đánh dấu item có thể drag
- **`[cdkDragData]="issue"`**: Data của item (để access trong drop event)
- **`(click)="openIssueDialog('todo', issue)"`**: Click card để edit

---

##### **Delete Button (Dòng 102-109)**

```html
<button
  mat-icon-button
  class="delete-btn"
  color="warn"
  (click)="$event.stopPropagation(); deleteIssue(issue.id)"
>
  <mat-icon>delete</mat-icon>
</button>
```

**`$event.stopPropagation()`** - Quan trọng!

```typescript
// Không có stopPropagation:
User click delete button
   ↓
Delete button click event fired
   ↓
Event bubbles up to parent <mat-card>
   ↓
Card click event fired
   ↓
openIssueDialog() called (KHÔNG MONG MUỐN!)

// Có stopPropagation:
User click delete button
   ↓
Delete button click event fired
   ↓
$event.stopPropagation() prevents bubbling
   ↓
Card click event KHÔNG fired
   ↓
Chỉ deleteIssue() được gọi ✅
```

**CSS - Hidden by default:**

```css
.issue-card .delete-btn {
  opacity: 0; /* Hidden */
  transition: opacity 0.2s ease-in-out;
}

.issue-card:hover .delete-btn {
  opacity: 1; /* Show on hover */
}
```

**Visual:**

```
Normal:                    Hover:
┌─────────────────┐       ┌─────────────────┐
│ Fix login bug   │       │ Fix login bug 🗑│ ← Delete button appears
│ PROJ-123        │       │ PROJ-123        │
└─────────────────┘       └─────────────────┘
```

---

##### **Priority Icon (Dòng 114-120)**

```html
<mat-icon
  [style.color]="getPriorityColor(issue.priority)"
  class="priority-icon"
  [matTooltip]="issue.priority"
>
  {{ getPriorityIcon(issue.priority) }}
</mat-icon>
```

**Helper Methods:**

```typescript
// board.ts - Dòng 671-682
getPriorityIcon(priority: IssuePriority): string {
  switch (priority) {
    case 'high':   return 'arrow_upward';
    case 'medium': return 'remove';
    case 'low':    return 'arrow_downward';
    default:       return 'remove';
  }
}

// board.ts - Dòng 684-695
getPriorityColor(priority: IssuePriority): string {
  switch (priority) {
    case 'high':   return '#de350b';  // Red
    case 'medium': return '#ff9900';  // Orange
    case 'low':    return '#0065ff';  // Blue
    default:       return '#172b4d';
  }
}
```

**Visual:**

```
High:    ⬆ (red)
Medium:  ─ (orange)
Low:     ⬇ (blue)
```

---

##### **Issue Key (Dòng 121)**

```html
<span class="key">{{ issue.key }}</span>
```

**Ví dụ:** `PROJ-123`, `MAP-456`

**Key generation:**

```typescript
// board.ts - Dòng 644-646
key: `${this.projectsStore.selectedProject()?.key}-${Math.floor(Math.random() * 1000)}`;

// Result: "PROJ-742"
```

**⚠️ Lưu ý:** Đây là random, không phải auto-increment. Trong production nên dùng:

```typescript
key: `${projectKey}-${issueCount + 1}`;
```

---

##### **Due Date (Dòng 122-129)**

```html
@if (issue.dueDate) {
<span class="due-date" [class.overdue]="isOverdue(issue.dueDate)">
  <mat-icon>calendar_today</mat-icon>
  {{ issue.dueDate | date : 'd MMM' }}
</span>
}
```

**Conditional Rendering:**

```typescript
@if (issue.dueDate) {
  // Chỉ hiển thị nếu issue có dueDate
}
```

**Dynamic Class:**

```typescript
[class.overdue]="isOverdue(issue.dueDate)"

// Helper method - Dòng 697-703
isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}
```

**CSS:**

```css
.due-date {
  color: #5e6c84;
  background: rgba(9, 30, 66, 0.04);
}

.due-date.overdue {
  color: #de350b; /* Red */
  background: #ffebe6; /* Light red */
  font-weight: 600;
}
```

**Date Pipe:**

```typescript
{{ issue.dueDate | date : 'd MMM' }}

// Input:  "2026-01-15"
// Output: "15 Jan"
```

**Visual:**

```
Normal:   📅 15 Jan  (gray background)

Overdue:  📅 10 Jan  (red background, bold)
```

---

##### **Subtasks Progress (Dòng 130-138)**

```html
@if (getSubtaskStats(issue); as stats) {
<span class="subtasks-count" title="Subtasks">
  <mat-icon>check_box</mat-icon>
  {{ stats.completed }}/{{ stats.total }}
</span>
}
```

**`@if` with alias:**

```typescript
@if (getSubtaskStats(issue); as stats) {
  // stats = return value của getSubtaskStats()
  // Chỉ render nếu stats !== null
}
```

**Helper Method:**

```typescript
// board.ts - Dòng 705-709
getSubtaskStats(issue: Issue) {
  if (!issue.subtasks || issue.subtasks.length === 0) return null;
  const completed = issue.subtasks.filter((s) => s.completed).length;
  return { completed, total: issue.subtasks.length };
}
```

**Luồng:**

```
issue.subtasks = [
  { title: "Task 1", completed: true },
  { title: "Task 2", completed: false },
  { title: "Task 3", completed: true }
]
   ↓
getSubtaskStats() returns { completed: 2, total: 3 }
   ↓
Template renders: ☑ 2/3
```

**Visual:**

```
☑ 2/3  (2 completed out of 3 total)
```

---

##### **Assignee Avatar (Dòng 140-151)**

```html
@if (getAssignee(issue.assigneeId); as assignee) {
<img
  [src]="assignee.photoURL || 
              'https://ui-avatars.com/api/?name=' + 
              assignee.displayName + '&background=random'"
  class="assignee-avatar"
  [title]="assignee.displayName"
/>
}
```

**Helper Method:**

```typescript
// board.ts - Dòng 660-663
getAssignee(assigneeId: string | undefined) {
  if (!assigneeId) return null;
  return this.projectsStore.members().find((m) => m.uid === assigneeId);
}
```

**Luồng:**

```
issue.assigneeId = "abc123"
   ↓
getAssignee("abc123")
   ↓
projectsStore.members() = [
  { uid: "abc123", displayName: "John Doe", photoURL: "..." },
  { uid: "xyz789", displayName: "Jane Smith", photoURL: null }
]
   ↓
Find member với uid = "abc123"
   ↓
Return { uid: "abc123", displayName: "John Doe", photoURL: "..." }
   ↓
Template render avatar
```

**Fallback Avatar:**

```typescript
assignee.photoURL ||
  'https://ui-avatars.com/api/?name=' + assignee.displayName + '&background=random';

// Nếu không có photoURL:
// → Generate avatar từ UI Avatars API
// → URL: https://ui-avatars.com/api/?name=John+Doe&background=random
```

**Visual:**

```
With photoURL:     Without photoURL:
   ┌─────┐            ┌─────┐
   │ 👤  │            │ JD  │ (initials)
   └─────┘            └─────┘
```

---

## 🖱️ Drag & Drop System

### **Cơ Chế Hoạt Động**

#### **1. Setup**

```html
<div class="board-columns" cdkDropListGroup>
  <div
    cdkDropList
    [cdkDropListData]="store.todoIssues()"
    (cdkDropListDropped)="drop($event, 'todo')"
  >
    @for (issue of store.todoIssues(); track issue.id) {
    <mat-card cdkDrag [cdkDragData]="issue">
      <!-- Card content -->
    </mat-card>
    }
  </div>
  <!-- Other columns... -->
</div>
```

**Hierarchy:**

```
cdkDropListGroup (parent)
  ├─ cdkDropList (TODO column)
  │   ├─ cdkDrag (Issue 1)
  │   ├─ cdkDrag (Issue 2)
  │   └─ cdkDrag (Issue 3)
  ├─ cdkDropList (IN PROGRESS column)
  └─ cdkDropList (DONE column)
```

---

#### **2. Drag Start**

```
User mousedown on issue card
   ↓
CDK detects drag start
   ↓
Create drag preview (clone of card)
   ↓
Add .cdk-drag-preview class
   ↓
Original card becomes placeholder (.cdk-drag-placeholder)
```

**CSS:**

```css
.cdk-drag-preview {
  box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2);
  background-color: white;
  z-index: 1000;
}

.cdk-drag-placeholder {
  opacity: 0.5;
  background: #e0e0e0;
  border: 1px dashed #999;
}
```

**Visual:**

```
Before drag:              During drag:
┌─────────────┐          ┌─────────────┐ ← Preview (follows mouse)
│ Issue 1     │          │ Issue 1     │
├─────────────┤          ├─────────────┤
│ Issue 2     │          │ ░░░░░░░░░░░ │ ← Placeholder (dashed)
├─────────────┤          ├─────────────┤
│ Issue 3     │          │ Issue 3     │
└─────────────┘          └─────────────┘
```

---

#### **3. Drag Over**

```
User drags over different column
   ↓
CDK calculates drop position
   ↓
Animate other items to make space
   ↓
Update placeholder position
```

**Animation:**

```css
.issue-list.cdk-drop-list-dragging .issue-card:not(.cdk-drag-placeholder) {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}
```

**Visual:**

```
Drag from TODO to IN PROGRESS:

TODO Column:           IN PROGRESS Column:
┌─────────────┐       ┌─────────────┐
│ Issue 1     │       │ Issue A     │
├─────────────┤       ├─────────────┤
│ ░░░░░░░░░░░ │       │ ░░░░░░░░░░░ │ ← Space for drop
├─────────────┤       ├─────────────┤
│ Issue 3     │       │ Issue B     │
└─────────────┘       └─────────────┘
                           ↑
                      Preview here
```

---

#### **4. Drop**

```
User releases mouse
   ↓
(cdkDropListDropped) event fired
   ↓
drop($event, 'in-progress') called
   ↓
store.moveIssue(event, 'in-progress')
```

**Event Object:**

```typescript
{
  previousIndex: 1,           // Position in TODO column
  currentIndex: 1,            // Position in IN PROGRESS column
  previousContainer: todoDropList,
  container: inProgressDropList,
  item: { data: issue }
}
```

---

#### **5. Store Update**

```typescript
// board.store.ts - moveIssue method
moveIssue: async (event: CdkDragDrop<Issue[]>, newStatus: string) => {
  const issue = event.item.data;

  // Same column - reorder only
  if (event.previousContainer === event.container) {
    // Update order in Firestore
  }
  // Different column - move to new status
  else {
    // Update status and order in Firestore
    await issueService.updateIssue(issue.id, {
      statusColumnId: newStatus,
      order: event.currentIndex,
    });
  }
};
```

---

#### **6. UI Update**

```
Firestore updated
   ↓
collectionData() emits new issues
   ↓
BoardStore issues signal updated
   ↓
Computed signals re-compute:
  - todoIssues
  - inProgressIssues
  - doneIssues
   ↓
Template re-render
   ↓
Issue appears in new column
```

---

### **Drag & Drop Scenarios**

#### **Scenario 1: Reorder trong cùng column**

```
TODO Column (before):
1. Issue A (order: 0)
2. Issue B (order: 1)
3. Issue C (order: 2)

User drags Issue C to position 0:

TODO Column (after):
1. Issue C (order: 0)
2. Issue A (order: 1)
3. Issue B (order: 2)
```

**Code:**

```typescript
// Update orders
transferArrayItem(
  event.previousContainer.data,
  event.container.data,
  event.previousIndex,
  event.currentIndex
);

// Update Firestore
await issueService.updateIssue(issue.id, { order: event.currentIndex });
```

---

#### **Scenario 2: Move giữa columns**

```
TODO Column (before):        IN PROGRESS Column (before):
1. Issue A                   1. Issue X
2. Issue B ← Drag this       2. Issue Y
3. Issue C

User drags Issue B to IN PROGRESS at position 1:

TODO Column (after):         IN PROGRESS Column (after):
1. Issue A                   1. Issue X
2. Issue C                   2. Issue B ← Moved here
                             3. Issue Y
```

**Code:**

```typescript
// Update status and order
await issueService.updateIssue(issue.id, {
  statusColumnId: 'in-progress',
  order: event.currentIndex,
});

// Reorder other issues in target column
const targetIssues = store.inProgressIssues();
targetIssues.forEach((issue, index) => {
  if (index >= event.currentIndex) {
    issueService.updateIssue(issue.id, { order: index + 1 });
  }
});
```

---

## 💻 Component Class

### **Dòng 580-710: Class Definition**

```typescript
export class Board implements OnInit {
  readonly store = inject(BoardStore);
  readonly projectsStore = inject(ProjectsStore);
  readonly authStore = inject(AuthStore);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  constructor() { ... }
  ngOnInit() { ... }

  // Event handlers
  onSearch(event: Event) { ... }
  toggleMyIssues() { ... }
  drop(event: CdkDragDrop<Issue[]>, newStatus: string) { ... }

  // Dialog methods
  openIssueDialog(statusColumnId: string, issue?: Issue) { ... }
  openMembersDialog() { ... }

  // Helper methods
  getAssignee(assigneeId: string | undefined) { ... }
  getPriorityIcon(priority: IssuePriority): string { ... }
  getPriorityColor(priority: IssuePriority): string { ... }
  isOverdue(dateStr: string): boolean { ... }
  getSubtaskStats(issue: Issue) { ... }
  deleteIssue(issueId: string) { ... }
}
```

---

### **Constructor (Dòng 587-594)**

```typescript
constructor() {
  effect(() => {
    const user = this.authStore.user();
    if (user && this.projectsStore.projects().length === 0) {
      this.projectsStore.loadProjects(user.uid);
    }
  });
}
```

**Tại sao cần effect này?**

```
Scenario: User refresh page tại /project/abc123/board
   ↓
App reload
   ↓
AuthStore restore user từ Firebase Auth
   ↓
ProjectsStore chưa có projects (empty array)
   ↓
effect() detect user có giá trị và projects = []
   ↓
loadProjects(user.uid) được gọi
   ↓
Load projects từ Firestore
   ↓
selectedProject() có giá trị
   ↓
Board header hiển thị project name
```

**Không có effect này:**

- ❌ Projects không load
- ❌ selectedProject() = undefined
- ❌ Board header trống

---

### **ngOnInit (Dòng 596-604)**

```typescript
ngOnInit() {
  this.route.parent?.paramMap.subscribe((params) => {
    const projectId = params.get('projectId');
    if (projectId) {
      this.store.loadIssues(projectId);
      this.projectsStore.selectProject(projectId);

      
    }
  });
}
```

**Tại sao `route.parent`?**

```
Route hierarchy:
/project/:projectId (parent) ← projectId param ở đây
  └─ /board (current route)
```

**Luồng:**

```
Component init
   ↓
Subscribe to route.parent.paramMap
   ↓
Get projectId from params
   ↓
store.loadIssues(projectId)
   ↓
Load issues từ Firestore
   ↓
projectsStore.selectProject(projectId)
   ↓
Set selectedProjectId
   ↓
selectedProject() computed signal update
   ↓
Template hiển thị project name và issues
```

---

### **openIssueDialog (Dòng 624-652)**

```typescript
openIssueDialog(statusColumnId: string, issue?: Issue) {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '500px',
    data: { statusColumnId, issue },
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      if (issue) {
        // Update existing
        this.store.updateIssue(issue.id, result);
      } else {
        // Create new
        const projectId = this.projectsStore.selectedProjectId();
        if (projectId) {
          this.store.addIssue({
            ...result,
            projectId,
            boardId: projectId,
            order: 0,
            key: `${this.projectsStore.selectedProject()?.key}-${Math.floor(
              Math.random() * 1000
            )}`,
          });
        }
      }
    }
  });
}
```

**2 Modes:**

#### **Mode 1: Create New Issue**

```typescript
openIssueDialog('todo'); // No issue param
```

```
User click "+" button in TODO column
   ↓
openIssueDialog('todo') called
   ↓
Dialog opens với empty form
   ↓
User fills: title, description, assignee, priority, dueDate
   ↓
User clicks "Create"
   ↓
Dialog closes với result = form data
   ↓
afterClosed() callback
   ↓
issue = undefined → Create mode
   ↓
store.addIssue({
  ...result,
  projectId: "abc123",
  statusColumnId: "todo",
  key: "PROJ-742"
})
   ↓
Firestore addDoc()
   ↓
collectionData() emits new issues
   ↓
UI updates với new issue
```

---

#### **Mode 2: Edit Existing Issue**

```typescript
openIssueDialog('todo', issue); // With issue param
```

```
User clicks issue card
   ↓
openIssueDialog('todo', issue) called
   ↓
Dialog opens với pre-filled form (issue data)
   ↓
User edits: title, assignee, etc.
   ↓
User clicks "Save"
   ↓
Dialog closes với result = updated data
   ↓
afterClosed() callback
   ↓
issue !== undefined → Update mode
   ↓
store.updateIssue(issue.id, result)
   ↓
Firestore updateDoc()
   ↓
collectionData() emits updated issues
   ↓
UI updates với edited issue
```

---

## 🎨 Styling Deep Dive

### **Key CSS Patterns**

#### **1. Flexbox Layout**

```css
.board-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.board-columns {
  display: flex;
  gap: 24px;
  overflow-x: auto; /* Horizontal scroll nếu nhiều columns */
}

.column {
  flex: 1;
  min-width: 280px;
  max-width: 350px;
  display: flex;
  flex-direction: column;
}
```

**Layout:**

```
┌─────────────────────────────────────┐
│ Board Container (flex column)       │
│ ┌─────────────────────────────────┐ │
│ │ Header (fixed height)           │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Columns (flex row, flex: 1)     │ │
│ │ ┌───────┬───────┬───────┐       │ │
│ │ │Column │Column │Column │       │ │
│ │ │flex:1 │flex:1 │flex:1 │       │ │
│ │ └───────┴───────┴───────┘       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

#### **2. Scrollable Issue List**

```css
.column {
  max-height: 100%;
  overflow: hidden; /* Column không scroll */
}

.issue-list {
  flex: 1;
  overflow-y: auto; /* Chỉ issue list scroll */
  padding: 4px;
}
```

**Tại sao?**

```
Without overflow-y: auto:
┌─────────────┐
│ TO DO       │
│ Issue 1     │
│ Issue 2     │
│ Issue 3     │
│ Issue 4     │
│ Issue 5     │ ← Overflow ra ngoài
│ Issue 6     │
└─────────────┘

With overflow-y: auto:
┌─────────────┐
│ TO DO       │ ← Fixed header
│ Issue 1     │
│ Issue 2     │ ↕ Scrollable
│ Issue 3     │
│ ...         │
└─────────────┘
```

---

#### **3. Hover Effects**

```css
.issue-card {
  transition: background 0.1s, box-shadow 0.1s;
}

.issue-card:hover {
  background-color: #ebecf0;
}

.issue-card .delete-btn {
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.issue-card:hover .delete-btn {
  opacity: 1;
}
```

**Visual:**

```
Normal:                  Hover:
┌─────────────────┐     ┌─────────────────┐
│ Fix login bug   │     │ Fix login bug 🗑│
│ PROJ-123        │     │ PROJ-123        │
└─────────────────┘     └─────────────────┘
  white background        #ebecf0 background
  no delete button        delete button visible
```

---

#### **4. Drag & Drop Animations**

```css
.cdk-drag-animating {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}

.issue-list.cdk-drop-list-dragging .issue-card:not(.cdk-drag-placeholder) {
  transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
}
```

**Smooth animation khi:**

- Drop item vào vị trí mới
- Other items shift để make space

---

## 🔄 State Management Flow

### **Data Flow Diagram**

```
User Actions
   ↓
Component Methods
   ↓
BoardStore Methods
   ↓
IssueService (Firestore)
   ↓
Firestore Database
   ↓
collectionData() Observable
   ↓
BoardStore issues signal
   ↓
Computed Signals (todoIssues, inProgressIssues, doneIssues)
   ↓
Template Re-render
   ↓
UI Update
```

---

### **Example: Create Issue Flow**

```
1. User clicks "+" button
   ↓
2. openIssueDialog('todo') called
   ↓
3. Dialog opens
   ↓
4. User fills form and clicks "Create"
   ↓
5. Dialog closes with result
   ↓
6. store.addIssue(issueData) called
   ↓
7. BoardStore.addIssue() method
   ↓
8. issueService.addIssue(issue) called
   ↓
9. Firestore addDoc()
   ↓
10. Document created in Firestore
   ↓
11. collectionData() detects change
   ↓
12. Observable emits new issues array
   ↓
13. BoardStore issues signal updated
   ↓
14. filteredIssues computed signal re-compute
   ↓
15. todoIssues computed signal re-compute
   ↓
16. Template detects todoIssues() changed
   ↓
17. @for loop re-renders
   ↓
18. New issue card appears in TODO column
```

**Total time: ~100-200ms**

---

## 🎯 Best Practices

### **1. Signal-based Reactivity**

```typescript
// ✅ GOOD: Use signals from store
{{ store.todoIssues().length }}

// ❌ BAD: Local state
todoIssues: Issue[] = [];
```

### **2. Computed Signals for Filtering**

```typescript
// ✅ GOOD: Computed in store
todoIssues: computed(() =>
  sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo')
)

// ❌ BAD: Filter in template
@for (issue of store.issues().filter(i => i.statusColumnId === 'todo'))
```

### **3. Event Propagation Control**

```typescript
// ✅ GOOD: Stop propagation
click = '$event.stopPropagation(); deleteIssue(issue.id)'(
  // ❌ BAD: No stop propagation (triggers parent click)
  click
) = 'deleteIssue(issue.id)';
```

### **4. Optional Chaining**

```typescript
// ✅ GOOD: Safe navigation
{
  {
    projectsStore.selectedProject()?.name;
  }
}

// ❌ BAD: Can crash if undefined
{
  {
    projectsStore.selectedProject().name;
  }
}
```

### **5. Track Function in @for**

```typescript
// ✅ GOOD: Track by unique ID
@for (issue of store.todoIssues(); track issue.id)

// ❌ BAD: Track by index (poor performance)
@for (issue of store.todoIssues(); track $index)
```

---

## 🎓 Tóm Tắt

### **Board Component Làm Gì?**

1. **Hiển thị Kanban board** với 3 columns (TODO, IN PROGRESS, DONE)
2. **Drag & drop** issues giữa columns
3. **Search & filter** issues theo nhiều criteria
4. **CRUD operations** cho issues
5. **Visual indicators** cho priority, due dates, subtasks, assignees

### **Công Nghệ Sử Dụng**

- **Angular CDK Drag & Drop**: Drag & drop functionality
- **NgRx Signal Store**: State management
- **Material Components**: UI components
- **RxJS**: Reactive programming
- **Firestore**: Real-time database

### **Luồng Hoạt Động Chính**

```
Component Init
   ↓
Load issues từ Firestore
   ↓
Computed signals filter và sort issues
   ↓
Template render 3 columns với filtered issues
   ↓
User interactions (drag, click, search)
   ↓
Update Firestore
   ↓
collectionData() auto-update
   ↓
UI re-render
```

### **File Size Breakdown**

- **Template**: 322 lines (45%) - Complex UI with 3 columns
- **Styles**: 254 lines (36%) - Detailed styling for cards, drag & drop
- **Logic**: 135 lines (19%) - Event handlers, helper methods

---

**Tạo bởi:** Antigravity AI Assistant  
**Ngày:** 2026-01-12
