# Luồng Quản Lý Issue/Task (Issue Management Flow) - Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Issue Model & Structure](#2-issue-model--structure)
3. [Tạo Issue Mới](#3-tạo-issue-mới)
4. [Auto-Generated Issue Key](#4-auto-generated-issue-key)
5. [Cập Nhật Issue](#5-cập-nhật-issue)
6. [Comments System](#6-comments-system)
7. [Subtasks System](#7-subtasks-system)
8. [Xóa Issue](#8-xóa-issue)
9. [Issue Dialog Deep Dive](#9-issue-dialog-deep-dive)
10. [Best Practices](#10-best-practices)

---

## 1. Tổng Quan

### 1.1 Issue Là Gì?

Issue (hay Task) là **đơn vị công việc** trong Jira Clone:

- 📝 Mô tả công việc cần làm
- 👤 Được assign cho team member
- 🏷️ Có type, priority, status
- 💬 Có comments để discussion
- ✅ Có subtasks để break down
- 📊 Track progress và history

### 1.2 Issue Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Issue Lifecycle                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐                                                │
│  │  CREATE  │  User clicks "Create Issue"                   │
│  │  ISSUE   │  → Opens IssueDialog                          │
│  └────┬─────┘  → Fills form (title, type, priority, etc)   │
│       │        → Auto-generates key (PROJ-123)              │
│       ▼                                                      │
│  ┌──────────┐                                                │
│  │   TODO   │  Issue created in TODO column                 │
│  │  STATUS  │  → isInBacklog: true (in planning)            │
│  └────┬─────┘  → Can add comments, subtasks                 │
│       │        → Can edit details                           │
│       │                                                      │
│       │  Drag to IN PROGRESS                                │
│       ▼                                                      │
│  ┌──────────┐                                                │
│  │    IN    │  Work started                                 │
│  │ PROGRESS │  → Assignee working on it                     │
│  └────┬─────┘  → Comments for updates                       │
│       │        → Subtasks being completed                   │
│       │                                                      │
│       │  Drag to DONE                                       │
│       ▼                                                      │
│  ┌──────────┐                                                │
│  │   DONE   │  Work completed                               │
│  │  STATUS  │  → All subtasks done                          │
│  └────┬─────┘  → Ready for review                           │
│       │                                                      │
│       │  Sprint Complete                                    │
│       ▼                                                      │
│  ┌──────────┐                                                │
│  │ ARCHIVED │  Issue archived                               │
│  │          │  → isArchived: true                           │
│  └──────────┘  → Kept for historical data                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Files Liên Quan

```
src/app/features/issue/
├── issue.model.ts              # Type definitions
├── issue.service.ts            # CRUD operations
└── issue-dialog/
    └── issue-dialog.ts         # Create/Edit dialog

src/app/features/board/
├── board.store.ts              # Issue state management
├── board/
│   └── board.ts                # Board view
└── backlog/
    └── backlog.ts              # Backlog view
```

---

## 2. Issue Model & Structure

### 2.1 Complete Issue Interface

```typescript
// File: src/app/features/issue/issue.model.ts
export interface Issue {
  // Identity
  id: string; // Firestore document ID
  key: string; // Human-readable key (PROJ-123)

  // Content
  title: string; // Issue title
  description: string; // Rich text description

  // Classification
  type: IssueType; // 'story' | 'bug' | 'task'
  priority: IssuePriority; // 'low' | 'medium' | 'high'

  // Status & Location
  statusColumnId: StatusColumn; // 'todo' | 'in-progress' | 'done'
  projectId: string; // Parent project
  boardId: string; // Board ID (usually same as projectId)
  sprintId: string | null; // Current sprint (null if in backlog)

  // Assignment
  assigneeId: string | null; // Assigned user UID
  reporterId: string; // Creator user UID

  // Ordering
  order: number; // Position in column (fractional)

  // Flags
  isInBacklog: boolean; // true = planning, false = execution
  isArchived?: boolean; // true = archived (soft delete)

  // Dates
  dueDate?: string; // ISO date string
  createdAt?: string;
  updatedAt?: string;

  // Nested Data
  comments: Comment[]; // Array of comments
  subtasks: Subtask[]; // Array of subtasks
}

// Supporting Types
export type IssueType = 'story' | 'bug' | 'task';
export type IssuePriority = 'low' | 'medium' | 'high';
export type StatusColumn = 'todo' | 'in-progress' | 'done';

export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}
```

### 2.2 Example Issue Document

```json
{
  "id": "issue_abc123",
  "key": "PROJ-42",
  "title": "Implement user authentication",
  "description": "Add login/logout functionality with Firebase Auth",
  "type": "story",
  "priority": "high",
  "statusColumnId": "in-progress",
  "projectId": "proj_xyz789",
  "boardId": "proj_xyz789",
  "sprintId": "sprint_def456",
  "assigneeId": "user_123",
  "reporterId": "user_456",
  "order": 2.5,
  "isInBacklog": false,
  "isArchived": false,
  "dueDate": "2026-01-25T00:00:00.000Z",
  "createdAt": "2026-01-20T10:00:00.000Z",
  "updatedAt": "2026-01-20T15:30:00.000Z",
  "comments": [
    {
      "id": "comment_1",
      "userId": "user_123",
      "text": "Started working on this",
      "createdAt": "2026-01-20T11:00:00.000Z"
    }
  ],
  "subtasks": [
    {
      "id": "subtask_1",
      "title": "Setup Firebase project",
      "completed": true
    },
    {
      "id": "subtask_2",
      "title": "Implement login UI",
      "completed": false
    }
  ]
}
```

---

## 3. Tạo Issue Mới

### 3.1 Sequence Diagram

```
User          Board/Backlog   IssueDialog    BoardStore     IssueService   Firestore
 │                 │               │              │              │              │
 │  Click          │               │              │              │              │
 │  "Create        │               │              │              │              │
 │   Issue"        │               │              │              │              │
 │────────────────>│               │              │              │              │
 │                 │               │              │              │              │
 │                 │ Open dialog   │              │              │              │
 │                 │──────────────>│              │              │              │
 │                 │               │              │              │              │
 │  Fill form:     │               │              │              │              │
 │  - Title        │               │              │              │              │
 │  - Description  │               │              │              │              │
 │  - Type         │               │              │              │              │
 │  - Priority     │               │              │              │              │
 │  - Assignee     │               │              │              │              │
 │  - Sprint       │               │              │              │              │
 │  - Due Date     │               │              │              │              │
 │  - Subtasks     │               │              │              │              │
 │────────────────────────────────>│              │              │              │
 │                 │               │              │              │              │
 │  Click Save     │               │              │              │              │
 │────────────────────────────────>│              │              │              │
 │                 │               │              │              │              │
 │                 │               │ Validate     │              │              │
 │                 │               │ form         │              │              │
 │                 │               │              │              │              │
 │                 │               │ Close with   │              │              │
 │                 │               │ data         │              │              │
 │                 │<──────────────│              │              │              │
 │                 │               │              │              │              │
 │                 │ createIssue() │              │              │              │
 │                 │──────────────────────────────>│              │              │
 │                 │               │              │              │              │
 │                 │               │              │ Generate key │              │
 │                 │               │              │ (PROJ-123)   │              │
 │                 │               │              │              │              │
 │                 │               │              │ addIssue()   │              │
 │                 │               │              │─────────────>│              │
 │                 │               │              │              │ add()        │
 │                 │               │              │              │─────────────>│
 │                 │               │              │              │              │
 │                 │               │              │              │ Validate     │
 │                 │               │              │              │ Rules        │
 │                 │               │              │              │              │
 │                 │               │              │              │ Create Doc   │
 │                 │               │              │              │              │
 │                 │               │              │              │ Snapshot     │
 │                 │               │              │              │ Listener     │
 │                 │               │              │              │<─────────────│
 │                 │               │              │              │              │
 │                 │               │              │  loadIssues  │              │
 │                 │               │              │  (emit new)  │              │
 │                 │               │              │<─────────────│              │
 │                 │               │              │              │              │
 │                 │               │              │ patchState   │              │
 │                 │               │              │ (add issue)  │              │
 │                 │               │              │              │              │
 │  UI Update      │               │              │              │              │
 │  (New Issue     │               │              │              │              │
 │   Card)         │               │              │              │              │
 │<────────────────┼───────────────┼──────────────┼──────────────┼──────────────│
```

### 3.2 Step-by-Step Implementation

#### Step 1: Open Issue Dialog

```typescript
// File: src/app/features/board/backlog/backlog.ts
createIssue() {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '600px',
    data: {
      statusColumnId: 'todo'  // Default status
    }
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      this.handleCreateIssue(result);
    }
  });
}
```

**From Board:**

```typescript
// File: src/app/features/board/board/board.ts
openIssueDialog(statusColumnId: string, issue?: Issue) {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '600px',
    data: {
      statusColumnId,
      issue  // undefined for create, Issue object for edit
    }
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      if (issue) {
        // Edit mode
        this.store.updateIssue(issue.id, result);
      } else {
        // Create mode
        this.handleCreateIssue(result);
      }
    }
  });
}
```

---

#### Step 2: Issue Dialog Form

```typescript
// File: src/app/features/issue/issue-dialog/issue-dialog.ts
@Component({
  selector: 'app-issue-dialog',
  template: `
    <h2 mat-dialog-title>
      {{ data.issue ? 'Edit Issue' : 'Create Issue' }}
    </h2>

    <mat-dialog-content>
      <form [formGroup]="issueForm">
        <!-- Title -->
        <mat-form-field appearance="outline">
          <mat-label>Title *</mat-label>
          <input matInput formControlName="title" placeholder="What needs to be done?" />
          <mat-error *ngIf="issueForm.get('title')?.hasError('required')">
            Title is required
          </mat-error>
        </mat-form-field>

        <!-- Description -->
        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="5"
            placeholder="Add more details..."
          ></textarea>
        </mat-form-field>

        <!-- Type -->
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select formControlName="type">
            <mat-option value="story">
              <mat-icon>book</mat-icon>
              Story
            </mat-option>
            <mat-option value="bug">
              <mat-icon>bug_report</mat-icon>
              Bug
            </mat-option>
            <mat-option value="task">
              <mat-icon>task</mat-icon>
              Task
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Priority -->
        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority">
            <mat-option value="low">
              <mat-icon [style.color]="'#0065ff'">arrow_downward</mat-icon>
              Low
            </mat-option>
            <mat-option value="medium">
              <mat-icon [style.color]="'#ff9900'">remove</mat-icon>
              Medium
            </mat-option>
            <mat-option value="high">
              <mat-icon [style.color]="'#de350b'">arrow_upward</mat-icon>
              High
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Assignee -->
        <mat-form-field appearance="outline">
          <mat-label>Assignee</mat-label>
          <mat-select formControlName="assigneeId">
            <mat-option [value]="null">Unassigned</mat-option>
            @for (member of projectsStore.members(); track member.uid) {
              <mat-option [value]="member.uid">
                <img [src]="member.photoURL || defaultAvatar" class="avatar-small" />
                {{ member.displayName }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <!-- Sprint -->
        <mat-form-field appearance="outline">
          <mat-label>Sprint</mat-label>
          <mat-select formControlName="sprintId">
            <mat-option [value]="null">Backlog</mat-option>
            @for (sprint of selectableSprints(); track sprint.id) {
              <mat-option [value]="sprint.id">
                {{ sprint.name }}
                <span class="sprint-status">{{ sprint.status }}</span>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <!-- Status -->
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="statusColumnId">
            <mat-option value="todo">To Do</mat-option>
            <mat-option value="in-progress">In Progress</mat-option>
            <mat-option value="done">Done</mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Due Date -->
        <mat-form-field appearance="outline">
          <mat-label>Due Date</mat-label>
          <input matInput type="date" formControlName="dueDate" />
        </mat-form-field>
      </form>

      <!-- Subtasks Section -->
      <div class="subtasks-section">
        <h3>Subtasks</h3>
        <!-- Subtasks list (see section 7) -->
      </div>

      <!-- Comments Section (only in edit mode) -->
      @if (data.issue) {
        <div class="comments-section">
          <h3>Comments</h3>
          <!-- Comments list (see section 6) -->
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!issueForm.valid">
        {{ data.issue ? 'Update' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class IssueDialog {
  dialogRef = inject(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);
  projectsStore = inject(ProjectsStore);
  authStore = inject(AuthStore);
  sprintStore = inject(SprintStore);
  private fb = inject(FormBuilder);

  // Selectable sprints (future + active)
  selectableSprints = computed(() =>
    this.sprintStore.sprints().filter((s) => s.status === 'future' || s.status === 'active'),
  );

  issueForm = this.fb.group({
    title: ['', [Validators.required]],
    description: [''],
    type: ['task', [Validators.required]],
    priority: ['medium', [Validators.required]],
    assigneeId: [null],
    sprintId: [null],
    statusColumnId: [this.data.statusColumnId || 'todo'],
    dueDate: [''],
  });

  constructor() {
    // If editing, populate form
    if (this.data.issue) {
      this.initForm();
    }
  }

  initForm() {
    const issue = this.data.issue;
    this.issueForm.patchValue({
      title: issue.title,
      description: issue.description,
      type: issue.type,
      priority: issue.priority,
      assigneeId: issue.assigneeId,
      sprintId: issue.sprintId,
      statusColumnId: issue.statusColumnId,
      dueDate: issue.dueDate ? issue.dueDate.split('T')[0] : '',
    });
  }

  save() {
    if (this.issueForm.valid) {
      const formValue = this.issueForm.value;

      const result = {
        title: formValue.title,
        description: formValue.description,
        type: formValue.type,
        priority: formValue.priority,
        assigneeId: formValue.assigneeId,
        sprintId: formValue.sprintId,
        statusColumnId: formValue.statusColumnId,
        dueDate: formValue.dueDate ? new Date(formValue.dueDate).toISOString() : undefined,
        subtasks: this.subtasks, // From subtasks section
      };

      this.dialogRef.close(result);
    }
  }
}
```

---

#### Step 3: Handle Create Issue

```typescript
// File: src/app/features/board/backlog/backlog.ts
handleCreateIssue(result: any) {
  const projectId = this.projectsStore.selectedProjectId();
  const projectKey = this.projectsStore.selectedProject()?.key;
  const currentUser = this.authStore.user();

  if (!projectId || !projectKey || !currentUser) {
    alert('Missing required data');
    return;
  }

  const newIssue: Partial<Issue> = {
    title: result.title,
    description: result.description || '',
    type: result.type,
    priority: result.priority,
    statusColumnId: result.statusColumnId,
    projectId: projectId,
    boardId: projectId,
    order: 0,  // Will be recalculated
    key: this.boardStore.getNextIssueKey(projectKey),  // Auto-generate
    reporterId: currentUser.uid,
    assigneeId: result.assigneeId || null,
    isInBacklog: true,  // Default to backlog
    comments: [],
    subtasks: result.subtasks || [],
  };

  // Add optional fields
  if (result.dueDate) {
    newIssue.dueDate = result.dueDate;
  }

  if (result.sprintId) {
    newIssue.sprintId = result.sprintId;
  } else {
    newIssue.sprintId = null;
  }

  console.log('Creating Issue:', newIssue);
  this.boardStore.addIssue(newIssue);
}
```

---

#### Step 4: BoardStore.addIssue()

```typescript
// File: src/app/features/board/board.store.ts
addIssue: async (issue: Partial<Issue>) => {
  try {
    await issueService.addIssue(issue);
    errorService.showSuccess('Issue created successfully');
  } catch (error: any) {
    errorService.showError(error?.message || 'Failed to create issue');
  }
};
```

---

#### Step 5: IssueService.addIssue()

```typescript
// File: src/app/features/issue/issue.service.ts
@Injectable({ providedIn: 'root' })
export class IssueService {
  private firestore = inject(Firestore);
  private issuesCollection = collection(this.firestore, 'issues');

  async addIssue(issue: Partial<Issue>): Promise<string> {
    const newIssue = {
      ...issue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(this.issuesCollection, newIssue);
    return docRef.id;
  }
}
```

---

## 4. Auto-Generated Issue Key

### 4.1 Key Format

```
Format: {PROJECT_KEY}-{NUMBER}

Examples:
- PROJ-1
- PROJ-2
- ECOM-42
- AUTH-123
```

### 4.2 Generation Algorithm

```typescript
// File: src/app/features/board/board.store.ts
getNextIssueKey: (projectKey: string): string => {
  // 1. Get all issues for this project
  const projectIssues = store.issues().filter((i) => i.key.startsWith(projectKey));

  // 2. Extract numbers from keys
  const numbers = projectIssues.map((i) => {
    const parts = i.key.split('-');
    return parseInt(parts[1]) || 0;
  });

  // 3. Find max number
  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;

  // 4. Generate next key
  return `${projectKey}-${maxNumber + 1}`;
};
```

### 4.3 Detailed Examples

```typescript
// Scenario 1: First issue in project
projectKey = 'PROJ';
projectIssues = [];
maxNumber = 0;
nextKey = 'PROJ-1';

// Scenario 2: Project has 5 issues
projectKey = 'PROJ';
projectIssues = [
  { key: 'PROJ-1' },
  { key: 'PROJ-2' },
  { key: 'PROJ-3' },
  { key: 'PROJ-4' },
  { key: 'PROJ-5' },
];
numbers = [1, 2, 3, 4, 5];
maxNumber = 5;
nextKey = 'PROJ-6';

// Scenario 3: Issues deleted (gaps in sequence)
projectKey = 'PROJ';
projectIssues = [
  { key: 'PROJ-1' },
  { key: 'PROJ-3' }, // PROJ-2 was deleted
  { key: 'PROJ-5' }, // PROJ-4 was deleted
];
numbers = [1, 3, 5];
maxNumber = 5;
nextKey = 'PROJ-6'; // Still uses max, not filling gaps

// Scenario 4: Multiple projects
projectKey = 'AUTH';
allIssues = [
  { key: 'PROJ-1' },
  { key: 'PROJ-2' },
  { key: 'AUTH-1' },
  { key: 'AUTH-2' },
  { key: 'ECOM-1' },
];
projectIssues = [{ key: 'AUTH-1' }, { key: 'AUTH-2' }];
numbers = [1, 2];
maxNumber = 2;
nextKey = 'AUTH-3';
```

### 4.4 Race Condition Handling

**Problem:** Two users create issue simultaneously

```typescript
// User A and User B both get maxNumber = 5
// Both generate key "PROJ-6"
// Conflict!
```

**Solution 1: Firestore Transaction**

```typescript
async addIssueWithUniqueKey(issue: Partial<Issue>, projectKey: string) {
  const issuesRef = collection(this.firestore, 'issues');

  return await runTransaction(this.firestore, async (transaction) => {
    // 1. Query current max
    const q = query(
      issuesRef,
      where('projectId', '==', issue.projectId),
      orderBy('key', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);

    // 2. Calculate next key
    let nextNumber = 1;
    if (!snapshot.empty) {
      const lastKey = snapshot.docs[0].data().key;
      const lastNumber = parseInt(lastKey.split('-')[1]);
      nextNumber = lastNumber + 1;
    }

    // 3. Create with new key
    const newIssue = {
      ...issue,
      key: `${projectKey}-${nextNumber}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newDocRef = doc(issuesRef);
    transaction.set(newDocRef, newIssue);

    return newDocRef.id;
  });
}
```

**Solution 2: Server-side Cloud Function**

```typescript
// Firebase Cloud Function
exports.createIssue = functions.https.onCall(async (data, context) => {
  const { projectId, projectKey, ...issueData } = data;

  // Use Firestore counter
  const counterRef = db.doc(`counters/${projectId}`);

  return await db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let nextNumber = 1;
    if (counterDoc.exists) {
      nextNumber = counterDoc.data().issueCount + 1;
    }

    // Update counter
    transaction.set(counterRef, { issueCount: nextNumber }, { merge: true });

    // Create issue
    const issueRef = db.collection('issues').doc();
    transaction.set(issueRef, {
      ...issueData,
      key: `${projectKey}-${nextNumber}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { id: issueRef.id, key: `${projectKey}-${nextNumber}` };
  });
});
```

---

## 5. Cập Nhật Issue

### 5.1 Edit Issue Flow

```typescript
// File: src/app/features/board/board/board.ts
editIssue(issue: Issue) {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '600px',
    data: { issue }  // Pass existing issue
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      this.store.updateIssue(issue.id, result);
    }
  });
}
```

### 5.2 BoardStore.updateIssue()

```typescript
// File: src/app/features/board/board.store.ts
updateIssue: async (issueId: string, updates: Partial<Issue>) => {
  try {
    // Optimistic update
    const currentIssues = store.issues();
    const index = currentIssues.findIndex((i) => i.id === issueId);

    if (index !== -1) {
      const updatedIssues = [...currentIssues];
      updatedIssues[index] = {
        ...updatedIssues[index],
        ...updates,
      };
      patchState(store, { issues: updatedIssues });
    }

    // Persist to Firestore
    await issueService.updateIssue(issueId, updates);

    errorService.showSuccess('Issue updated');
  } catch (error: any) {
    errorService.showError('Failed to update issue');

    // Rollback: reload issues
    const projectId = updates.projectId || store.issues()[0]?.projectId;
    if (projectId) {
      store.loadIssues(projectId);
    }
  }
};
```

### 5.3 IssueService.updateIssue()

```typescript
// File: src/app/features/issue/issue.service.ts
async updateIssue(issueId: string, updates: Partial<Issue>) {
  const issueRef = doc(this.firestore, 'issues', issueId);

  await updateDoc(issueRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
}
```

### 5.4 Partial Updates

```typescript
// Update only specific fields
this.store.updateIssue(issueId, {
  title: 'New title',
});

// Update multiple fields
this.store.updateIssue(issueId, {
  title: 'New title',
  priority: 'high',
  assigneeId: 'user_123',
});

// Update status (from drag & drop)
this.store.updateIssue(issueId, {
  statusColumnId: 'done',
  order: 5.5,
});
```

---

## 6. Comments System

### 6.1 Comment Model

```typescript
export interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
}
```

### 6.2 Add Comment UI

```typescript
// File: src/app/features/issue/issue-dialog/issue-dialog.ts
@Component({
  template: `
    <div class="comments-section">
      <h3>Comments ({{ comments.length }})</h3>

      <!-- Comment List -->
      <div class="comments-list">
        @for (comment of comments; track comment.id) {
          <div class="comment-item">
            <img
              [src]="getUser(comment.userId)?.photoURL || defaultAvatar"
              class="comment-avatar"
            />

            <div class="comment-content">
              <div class="comment-header">
                <strong>{{ getUser(comment.userId)?.displayName }}</strong>
                <span class="comment-time">
                  {{ formatTime(comment.createdAt) }}
                </span>
              </div>

              <div class="comment-text">{{ comment.text }}</div>

              @if (canDeleteComment(comment)) {
                <button
                  mat-icon-button
                  (click)="deleteComment(comment.id)"
                  class="delete-comment-btn"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Add Comment Form -->
      <div class="add-comment-form">
        <img [src]="authStore.user()?.photoURL || defaultAvatar" class="comment-avatar" />

        <mat-form-field appearance="outline" class="comment-input">
          <textarea
            matInput
            [(ngModel)]="newCommentText"
            placeholder="Add a comment..."
            rows="2"
            (keydown.enter)="$event.ctrlKey && addComment()"
          >
          </textarea>
          <mat-hint>Press Ctrl+Enter to submit</mat-hint>
        </mat-form-field>

        <button
          mat-raised-button
          color="primary"
          (click)="addComment()"
          [disabled]="!newCommentText.trim()"
        >
          <mat-icon>send</mat-icon>
          Comment
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .comments-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #ddd;
      }

      .comments-list {
        max-height: 400px;
        overflow-y: auto;
        margin-bottom: 16px;
      }

      .comment-item {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 8px;

        &:hover {
          background: #eeeeee;
        }
      }

      .comment-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
      }

      .comment-content {
        flex: 1;
        position: relative;
      }

      .comment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;

        strong {
          font-size: 14px;
        }
      }

      .comment-time {
        font-size: 12px;
        color: #666;
      }

      .comment-text {
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .delete-comment-btn {
        position: absolute;
        top: 0;
        right: 0;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .comment-item:hover .delete-comment-btn {
        opacity: 1;
      }

      .add-comment-form {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .comment-input {
        flex: 1;
      }
    `,
  ],
})
export class IssueDialog {
  comments: Comment[] = [];
  newCommentText = '';

  constructor() {
    if (this.data.issue) {
      this.comments = this.data.issue.comments || [];
    }
  }

  addComment() {
    const text = this.newCommentText.trim();
    if (!text) return;

    const currentUser = this.authStore.user();
    if (!currentUser) return;

    const newComment: Comment = {
      id: this.generateId(),
      userId: currentUser.uid,
      text: text,
      createdAt: new Date().toISOString(),
    };

    // If editing existing issue, update immediately
    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        comments: arrayUnion(newComment),
      });

      // Update local state
      this.comments = [...this.comments, newComment];
    } else {
      // If creating new issue, just add to local array
      this.comments = [...this.comments, newComment];
    }

    // Clear input
    this.newCommentText = '';
  }

  deleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return;

    const commentToDelete = this.comments.find((c) => c.id === commentId);
    if (!commentToDelete) return;

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        comments: arrayRemove(commentToDelete),
      });
    }

    this.comments = this.comments.filter((c) => c.id !== commentId);
  }

  canDeleteComment(comment: Comment): boolean {
    const currentUser = this.authStore.user();
    return currentUser?.uid === comment.userId;
  }

  getUser(userId: string) {
    return this.projectsStore.members().find((m) => m.uid === userId);
  }

  formatTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  }

  private generateId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 6.3 Comment Persistence Strategy

**Edit Mode (Existing Issue):**

```typescript
// Update Firestore immediately
addComment() {
  const newComment = { ... };

  // Immediate Firestore update
  this.issueService.updateIssue(this.data.issue.id, {
    comments: arrayUnion(newComment)
  });

  // Firestore listener will update UI
}
```

**Create Mode (New Issue):**

```typescript
// Store in local state, save when creating issue
addComment() {
  const newComment = { ... };

  // Just add to local array
  this.comments = [...this.comments, newComment];

  // Will be saved when user clicks "Create"
}

save() {
  const result = {
    ...formValue,
    comments: this.comments  // Include comments
  };

  this.dialogRef.close(result);
}
```

---

## 7. Subtasks System

### 7.1 Subtask Model

```typescript
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}
```

### 7.2 Subtasks UI

```typescript
// File: src/app/features/issue/issue-dialog/issue-dialog.ts
@Component({
  template: `
    <div class="subtasks-section">
      <h3>
        Subtasks ({{ completedSubtasks() }}/{{ subtasks.length }})
        <mat-progress-bar mode="determinate" [value]="calculateProgress()"> </mat-progress-bar>
      </h3>

      <!-- Subtasks List -->
      <div class="subtasks-list">
        @for (subtask of subtasks; track subtask.id) {
          <div class="subtask-item">
            <mat-checkbox [checked]="subtask.completed" (change)="toggleSubtask(subtask)">
            </mat-checkbox>

            <span [class.completed]="subtask.completed">
              {{ subtask.title }}
            </span>

            <button mat-icon-button (click)="deleteSubtask(subtask.id)" class="delete-subtask-btn">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        }
      </div>

      <!-- Add Subtask Form -->
      <div class="add-subtask-form">
        <mat-form-field appearance="outline">
          <input
            matInput
            [(ngModel)]="newSubtaskTitle"
            placeholder="Add a subtask..."
            (keydown.enter)="addSubtask()"
          />
        </mat-form-field>

        <button mat-icon-button (click)="addSubtask()" [disabled]="!newSubtaskTitle.trim()">
          <mat-icon>add</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .subtasks-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #ddd;
      }

      .subtasks-list {
        margin: 16px 0;
      }

      .subtask-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px;
        border-radius: 4px;

        &:hover {
          background: #f5f5f5;
        }

        span {
          flex: 1;

          &.completed {
            text-decoration: line-through;
            color: #999;
          }
        }
      }

      .delete-subtask-btn {
        opacity: 0;
        transition: opacity 0.2s;
      }

      .subtask-item:hover .delete-subtask-btn {
        opacity: 1;
      }

      .add-subtask-form {
        display: flex;
        gap: 8px;
        align-items: center;
      }
    `,
  ],
})
export class IssueDialog {
  subtasks: Subtask[] = [];
  newSubtaskTitle = '';

  constructor() {
    if (this.data.issue) {
      this.subtasks = this.data.issue.subtasks || [];
    }
  }

  completedSubtasks = computed(() => this.subtasks.filter((s) => s.completed).length);

  addSubtask() {
    const title = this.newSubtaskTitle.trim();
    if (!title) return;

    const newSubtask: Subtask = {
      id: this.generateId(),
      title: title,
      completed: false,
    };

    // If editing existing issue, update immediately
    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        subtasks: [...this.subtasks, newSubtask],
      });
    }

    // Update local state
    this.subtasks = [...this.subtasks, newSubtask];
    this.newSubtaskTitle = '';
  }

  toggleSubtask(subtask: Subtask) {
    const updatedSubtasks = this.subtasks.map((s) =>
      s.id === subtask.id ? { ...s, completed: !s.completed } : s,
    );

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        subtasks: updatedSubtasks,
      });
    }

    this.subtasks = updatedSubtasks;
  }

  deleteSubtask(subtaskId: string) {
    const updatedSubtasks = this.subtasks.filter((s) => s.id !== subtaskId);

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        subtasks: updatedSubtasks,
      });
    }

    this.subtasks = updatedSubtasks;
  }

  calculateProgress(): number {
    if (this.subtasks.length === 0) return 0;
    const completed = this.subtasks.filter((s) => s.completed).length;
    return (completed / this.subtasks.length) * 100;
  }

  private generateId(): string {
    return `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 7.3 Progress Visualization

```typescript
// Show progress in issue card
@Component({
  template: `
    <div class="issue-card">
      <div class="issue-header">
        <span class="issue-key">{{ issue.key }}</span>
        <span class="issue-title">{{ issue.title }}</span>
      </div>

      @if (issue.subtasks && issue.subtasks.length > 0) {
        <div class="subtask-progress">
          <mat-icon>checklist</mat-icon>
          <span>{{ getCompletedCount(issue) }}/{{ issue.subtasks.length }}</span>
          <mat-progress-bar mode="determinate" [value]="getProgressPercent(issue)">
          </mat-progress-bar>
        </div>
      }
    </div>
  `,
})
export class IssueCard {
  getCompletedCount(issue: Issue): number {
    return issue.subtasks.filter((s) => s.completed).length;
  }

  getProgressPercent(issue: Issue): number {
    if (issue.subtasks.length === 0) return 0;
    return (this.getCompletedCount(issue) / issue.subtasks.length) * 100;
  }
}
```

---

## 8. Xóa Issue

### 8.1 Delete Confirmation

```typescript
// File: src/app/features/board/board/board.ts
deleteIssue(issueId: string, issueKey: string) {
  const confirmed = confirm(
    `Are you sure you want to delete issue ${issueKey}?\n\n` +
    `This action cannot be undone.`
  );

  if (confirmed) {
    this.store.deleteIssue(issueId);
  }
}
```

### 8.2 BoardStore.deleteIssue()

```typescript
// File: src/app/features/board/board.store.ts
deleteIssue: async (issueId: string) => {
  try {
    // Optimistic delete
    const currentIssues = store.issues();
    const filteredIssues = currentIssues.filter((i) => i.id !== issueId);
    patchState(store, { issues: filteredIssues });

    // Persist to Firestore
    await issueService.deleteIssue(issueId);

    errorService.showSuccess('Issue deleted');
  } catch (error: any) {
    errorService.showError('Failed to delete issue');

    // Rollback: reload issues
    const projectId = store.issues()[0]?.projectId;
    if (projectId) {
      store.loadIssues(projectId);
    }
  }
};
```

### 8.3 IssueService.deleteIssue()

```typescript
// File: src/app/features/issue/issue.service.ts
async deleteIssue(issueId: string) {
  const issueRef = doc(this.firestore, 'issues', issueId);
  await deleteDoc(issueRef);
}
```

### 8.4 Firestore Security Rules

```javascript
// File: firestore.rules
match /issues/{issueId} {
  // Delete: Reporter OR Admin
  allow delete: if signedIn() && (
    resource.data.reporterId == request.auth.uid ||
    isProjectAdmin(resource.data.projectId)
  );
}
```

**Who can delete:**

- ✅ Issue reporter (creator)
- ✅ Project admin
- ✅ Project owner
- ❌ Regular members
- ❌ Viewers

---

## 9. Issue Dialog Deep Dive

### 9.1 Complete Dialog Component

```typescript
// File: src/app/features/issue/issue-dialog/issue-dialog.ts
import { Component, Inject, inject, computed, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProjectsStore } from '../../projects/projects.store';
import { SprintStore } from '../../board/sprint.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { IssueService } from '../issue.service';
import { Issue, Comment, Subtask } from '../issue.model';

interface IssueDialogData {
  statusColumnId: string;
  issue?: Issue;
  sprintId?: string;
}

@Component({
  selector: 'app-issue-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressBarModule,
  ],
  templateUrl: './issue-dialog.html',
  styleUrls: ['./issue-dialog.scss'],
})
export class IssueDialog {
  dialogRef = inject(MatDialogRef);
  data = inject(MAT_DIALOG_DATA) as IssueDialogData;
  projectsStore = inject(ProjectsStore);
  authStore = inject(AuthStore);
  sprintStore = inject(SprintStore);
  issueService = inject(IssueService);
  private fb = inject(FormBuilder);

  // Form
  issueForm: FormGroup;

  // Subtasks
  subtasks: Subtask[] = [];
  newSubtaskTitle = '';

  // Comments
  comments: Comment[] = [];
  newCommentText = '';

  // Computed
  selectableSprints = computed(() =>
    this.sprintStore.sprints().filter((s) => s.status === 'future' || s.status === 'active'),
  );

  completedSubtasks = computed(() => this.subtasks.filter((s) => s.completed).length);

  constructor() {
    this.issueForm = this.fb.group({
      title: ['', [Validators.required]],
      description: [''],
      type: ['task', [Validators.required]],
      priority: ['medium', [Validators.required]],
      assigneeId: [null],
      sprintId: [this.data.sprintId || null],
      statusColumnId: [this.data.statusColumnId || 'todo'],
      dueDate: [''],
    });

    if (this.data.issue) {
      this.initForm();
      this.subtasks = this.data.issue.subtasks || [];
      this.comments = this.data.issue.comments || [];
    }
  }

  initForm() {
    const issue = this.data.issue!;
    this.issueForm.patchValue({
      title: issue.title,
      description: issue.description,
      type: issue.type,
      priority: issue.priority,
      assigneeId: issue.assigneeId,
      sprintId: issue.sprintId,
      statusColumnId: issue.statusColumnId,
      dueDate: issue.dueDate ? issue.dueDate.split('T')[0] : '',
    });
  }

  // Subtask methods
  addSubtask() {
    const title = this.newSubtaskTitle.trim();
    if (!title) return;

    const newSubtask: Subtask = {
      id: `subtask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: title,
      completed: false,
    };

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        subtasks: [...this.subtasks, newSubtask],
      });
    }

    this.subtasks = [...this.subtasks, newSubtask];
    this.newSubtaskTitle = '';
  }

  toggleSubtask(subtask: Subtask) {
    const updatedSubtasks = this.subtasks.map((s) =>
      s.id === subtask.id ? { ...s, completed: !s.completed } : s,
    );

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        subtasks: updatedSubtasks,
      });
    }

    this.subtasks = updatedSubtasks;
  }

  deleteSubtask(subtaskId: string) {
    const updatedSubtasks = this.subtasks.filter((s) => s.id !== subtaskId);

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        subtasks: updatedSubtasks,
      });
    }

    this.subtasks = updatedSubtasks;
  }

  calculateProgress(): number {
    if (this.subtasks.length === 0) return 0;
    return (this.completedSubtasks() / this.subtasks.length) * 100;
  }

  // Comment methods
  addComment() {
    const text = this.newCommentText.trim();
    if (!text) return;

    const currentUser = this.authStore.user();
    if (!currentUser) return;

    const newComment: Comment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: currentUser.uid,
      text: text,
      createdAt: new Date().toISOString(),
    };

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        comments: [...this.comments, newComment],
      });
    }

    this.comments = [...this.comments, newComment];
    this.newCommentText = '';
  }

  deleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return;

    const updatedComments = this.comments.filter((c) => c.id !== commentId);

    if (this.data.issue) {
      this.issueService.updateIssue(this.data.issue.id, {
        comments: updatedComments,
      });
    }

    this.comments = updatedComments;
  }

  canDeleteComment(comment: Comment): boolean {
    return this.authStore.user()?.uid === comment.userId;
  }

  // Helper methods
  getUser(userId: string) {
    return this.projectsStore.members().find((m) => m.uid === userId);
  }

  getSprint(sprintId: string) {
    return this.sprintStore.sprints().find((s) => s.id === sprintId);
  }

  formatTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  }

  // Save
  save() {
    if (!this.issueForm.valid) return;

    const formValue = this.issueForm.value;

    const result = {
      title: formValue.title,
      description: formValue.description,
      type: formValue.type,
      priority: formValue.priority,
      assigneeId: formValue.assigneeId,
      sprintId: formValue.sprintId,
      statusColumnId: formValue.statusColumnId,
      dueDate: formValue.dueDate ? new Date(formValue.dueDate).toISOString() : undefined,
      subtasks: this.subtasks,
      comments: this.comments,
    };

    this.dialogRef.close(result);
  }
}
```

---

## 10. Best Practices

### 10.1 Issue Creation

**✅ DO:**

- Write clear, descriptive titles
- Add detailed description
- Set appropriate priority
- Assign to team member
- Add subtasks for complex work
- Set realistic due dates
- Link to related issues (future feature)

**❌ DON'T:**

- Create vague issues ("Fix bugs")
- Skip description
- Set all issues as "High" priority
- Leave issues unassigned for too long
- Create duplicate issues
- Set unrealistic deadlines

### 10.2 Comments

**✅ DO:**

- Provide status updates
- Ask clarifying questions
- Share relevant information
- @mention team members (future)
- Be respectful and professional

**❌ DON'T:**

- Spam with unnecessary comments
- Use comments for chat
- Share sensitive information
- Delete others' comments
- Use offensive language

### 10.3 Subtasks

**✅ DO:**

- Break down complex issues
- Keep subtasks atomic
- Update completion status
- Use for tracking progress

**❌ DON'T:**

- Create too many subtasks (>10)
- Make subtasks too granular
- Forget to update status
- Use instead of separate issues

### 10.4 Code Quality

```typescript
// Good: Descriptive issue
{
  title: "Add email verification to registration flow",
  description: `
    Users should receive a verification email after registering.

    Acceptance Criteria:
    - Email sent immediately after registration
    - Email contains verification link
    - Link expires after 24 hours
    - User cannot login until verified
  `,
  type: "story",
  priority: "high",
  subtasks: [
    { title: "Setup email service", completed: true },
    { title: "Create email template", completed: true },
    { title: "Implement verification logic", completed: false },
    { title: "Add UI feedback", completed: false }
  ]
}

// Bad: Vague issue
{
  title: "Email stuff",
  description: "Do email things",
  type: "task",
  priority: "high"
}
```

---

## 📝 Summary

Issue Management Flow:

✅ **Create**: Rich dialog với full form validation
✅ **Auto-Key**: Intelligent key generation (PROJ-123)
✅ **Update**: Optimistic updates với rollback
✅ **Comments**: Real-time collaboration
✅ **Subtasks**: Progress tracking
✅ **Delete**: Permission-based với confirmation
✅ **Real-time**: Firestore listeners cho instant sync
✅ **Validation**: Client & server-side rules

**Key Concepts:**

1. Auto-generated keys prevent conflicts
2. Optimistic updates improve UX
3. Comments enable team communication
4. Subtasks track granular progress
5. Firestore rules enforce permissions
6. Real-time sync keeps team aligned

**Best Practices:**

- Write clear, actionable issues
- Use subtasks for complex work
- Keep comments professional
- Update status regularly
- Set realistic deadlines
- Assign appropriately
