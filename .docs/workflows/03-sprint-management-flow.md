# Luồng Quản Lý Sprint (Sprint Management Flow) - Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Kiến Trúc SprintStore](#2-kiến-trúc-sprintstore)
3. [Tạo Sprint Mới](#3-tạo-sprint-mới)
4. [Bắt Đầu Sprint (Start Sprint)](#4-bắt-đầu-sprint-start-sprint)
5. [Kết Thúc Sprint (Complete Sprint)](#5-kết-thúc-sprint-complete-sprint)
6. [Xử Lý Issues Khi Complete](#6-xử-lý-issues-khi-complete)
7. [Archive System](#7-archive-system)
8. [Sprint Lifecycle](#8-sprint-lifecycle)
9. [Best Practices](#9-best-practices)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng Quan

### 1.1 Sprint Là Gì?

Sprint là một **time-boxed iteration** trong Scrum methodology:

- ⏱️ Thời gian cố định (thường 1-4 tuần)
- 🎯 Có mục tiêu cụ thể (Sprint Goal)
- 📦 Chứa một tập hợp issues cần hoàn thành
- 🔄 Lặp lại liên tục (Sprint 1 → Sprint 2 → Sprint 3...)

### 1.2 Sprint States

```
┌─────────────────────────────────────────────────────────┐
│                    Sprint Lifecycle                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐   Start Sprint   ┌──────────┐            │
│  │  FUTURE  │ ─────────────────>│  ACTIVE  │            │
│  └──────────┘                   └──────────┘            │
│       │                              │                  │
│       │                              │ Complete Sprint  │
│       │                              ▼                  │
│       │                         ┌──────────┐            │
│       └────────────────────────>│COMPLETED │            │
│         (Delete Sprint)          └──────────┘            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**State Descriptions:**

- **FUTURE**: Sprint đã được tạo nhưng chưa bắt đầu
- **ACTIVE**: Sprint đang chạy, issues đang được làm
- **COMPLETED**: Sprint đã kết thúc, issues đã được xử lý

### 1.3 Sprint Model

```typescript
interface Sprint {
  id: string;
  projectId: string;
  name: string; // "Sprint 1", "Sprint 2"
  status: 'future' | 'active' | 'completed';
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  goal?: string; // Sprint goal/objective
  createdAt?: string;
  updatedAt?: string;
}
```

### 1.4 Files Liên Quan

```
src/app/features/board/
├── sprint.store.ts                    # State management
├── sprint.service.ts                  # Firestore API
├── sprint.model.ts                    # Type definitions
├── backlog/
│   ├── backlog.ts                     # Backlog view (planning)
│   ├── start-sprint-dialog/           # Start sprint dialog
│   ├── complete-sprint-dialog/        # Complete sprint dialog
│   └── edit-sprint-dialog/            # Edit sprint dialog
└── board/
    └── board.ts                       # Board view (execution)
```

---

## 2. Kiến Trúc SprintStore

### 2.1 State Structure

```typescript
// File: src/app/features/board/sprint.store.ts
type SprintState = {
  sprints: Sprint[];
};

const initialState: SprintState = {
  sprints: [],
};
```

### 2.2 Computed Values

```typescript
withComputed(({ sprints }) => ({
  // First active sprint (convenience method)
  // Returns the first active sprint found, useful for quick access
  activeSprint: computed(() => sprints().find((s) => s.status === 'active')),
  
  // Returns array of all active sprints - this is the primary method
  // Used in: CompleteSprintDialog, Board view, validation logic
  activeSprints: computed(() => sprints().filter((s) => s.status === 'active')),

  // Future sprints (not started yet)
  futureSprints: computed(() => sprints().filter((s) => s.status === 'future')),

  // Completed sprints (archived)
  completedSprints: computed(() => sprints().filter((s) => s.status === 'completed')),
}));
```

### 2.3 Methods Overview

```typescript
export const SprintStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(...),
  withMethods((store, sprintService) => ({
    // Loading
    loadSprints: rxMethod<string | null>(...),

    // CRUD Operations
    addSprint(sprint: Partial<Sprint>),
    updateSprint(id: string, updates: Partial<Sprint>),
    deleteSprint(id: string),

    // State Transitions
    startSprint(id: string),
    completeSprint(id: string),
  }))
);
```

---

## 3. Tạo Sprint Mới

### 3.1 Sequence Diagram

```
User          Backlog        SprintStore    SprintService    Firestore
 │                │                │              │              │
 │  Click         │                │              │              │
 │  "Create       │                │              │              │
 │   Sprint"      │                │              │              │
 │───────────────>│                │              │              │
 │                │ createSprint() │              │              │
 │                │───────────────>│              │              │
 │                │                │              │              │
 │                │                │ Calculate    │              │
 │                │                │ sprint name  │              │
 │                │                │ & dates      │              │
 │                │                │              │              │
 │                │                │ addSprint()  │              │
 │                │                │─────────────>│              │
 │                │                │              │ add()        │
 │                │                │              │─────────────>│
 │                │                │              │              │
 │                │                │              │ Validate     │
 │                │                │              │ Rules        │
 │                │                │              │              │
 │                │                │              │ Create Doc   │
 │                │                │              │              │
 │                │                │              │ Snapshot     │
 │                │                │              │ Listener     │
 │                │                │              │<─────────────│
 │                │                │              │              │
 │                │                │  loadSprints │              │
 │                │                │  (emit new)  │              │
 │                │                │<─────────────│              │
 │                │                │              │              │
 │                │                │ patchState   │              │
 │                │                │ (add sprint) │              │
 │                │                │              │              │
 │  UI Update     │                │              │              │
 │  (New Sprint   │                │              │              │
 │   Appears)     │                │              │              │
 │<───────────────┼────────────────┼──────────────┼──────────────│
```

### 3.2 Step-by-Step Implementation

#### Step 1: User Clicks "Create Sprint"

```typescript
// File: src/app/features/board/backlog/backlog.ts
@Component({
  template: `
    <div class="backlog-header-section">
      <h3>Backlog ({{ backlogIssues().length }} issues)</h3>
      <div class="backlog-actions">
        <button mat-stroked-button (click)="createSprint()">Create Sprint</button>
        <button mat-stroked-button (click)="createIssue()">Create Issue</button>
      </div>
    </div>
  `,
})
export class Backlog {
  projectsStore = inject(ProjectsStore);
  sprintStore = inject(SprintStore);

  createSprint() {
    const projectId = this.projectsStore.selectedProjectId();
    if (!projectId) {
      alert('No project selected');
      return;
    }

    // Auto-name sprint: Sprint <count + 1>
    const count = this.sprintStore.sprints().length;
    const name = `Sprint ${count + 1}`;

    // Default dates: 2 weeks from now
    const startDate = new Date();
    const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    this.sprintStore.addSprint({
      projectId,
      name,
      status: 'future',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
  }
}
```

**Auto-naming Logic:**

```typescript
// If project has 0 sprints → "Sprint 1"
// If project has 2 sprints → "Sprint 3"
// If project has 5 sprints → "Sprint 6"

const count = this.sprintStore.sprints().length;
const name = `Sprint ${count + 1}`;
```

---

#### Step 2: SprintStore.addSprint()

```typescript
// File: src/app/features/board/sprint.store.ts
addSprint: async (sprint: Partial<Sprint>) => {
  try {
    // Default status if not provided
    if (!sprint.status) {
      sprint.status = 'future';
    }

    const sprintId = await sprintService.addSprint(sprint);

    if (sprintId) {
      errorService.showSuccess(`${sprint.name} created`);
    }

    return sprintId;
  } catch (err: any) {
    errorService.showError(err?.message || 'Failed to create sprint');
    return undefined;
  }
};
```

---

#### Step 3: SprintService.addSprint()

```typescript
// File: src/app/features/board/sprint.service.ts
@Injectable({ providedIn: 'root' })
export class SprintService {
  private firestore = inject(Firestore);
  private sprintsCollection = collection(this.firestore, 'sprints');

  async addSprint(sprint: Partial<Sprint>): Promise<string | undefined> {
    const newSprint = {
      ...sprint,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(this.sprintsCollection, newSprint);
    return docRef.id;
  }
}
```

**Firestore Document Created:**

```json
{
  "id": "sprint_abc123",
  "projectId": "proj_xyz789",
  "name": "Sprint 3",
  "status": "future",
  "startDate": "2026-01-20T15:00:00.000Z",
  "endDate": "2026-02-03T15:00:00.000Z",
  "createdAt": "2026-01-20T15:00:00.000Z",
  "updatedAt": "2026-01-20T15:00:00.000Z"
}
```

---

#### Step 4: Firestore Security Rules Check

```javascript
// File: firestore.rules
match /sprints/{sprintId} {
  // Create: Admin only
  allow create: if signedIn()
    && isProjectAdmin(request.resource.data.projectId)
    && !isProjectViewer(request.resource.data.projectId);
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
```

**Validation:**

- ✅ User is authenticated
- ✅ User is project admin or owner
- ✅ User is not a viewer
- ❌ If any check fails → "Permission denied"

---

#### Step 5: Real-time Listener Update

```typescript
// File: src/app/features/board/sprint.store.ts
loadSprints: rxMethod<string | null>(
  pipe(
    tap(() => store.setLoading(true)),
    switchMap((projectId) => {
      if (!projectId) {
        patchState(store, { sprints: [] });
        store.setLoading(false);
        return of([]);
      }

      // Query sprints for this project
      const sprintsRef = collection(firestore, 'sprints');
      const q = query(
        sprintsRef,
        where('projectId', '==', projectId),
        orderBy('createdAt', 'desc'),
      );

      return collectionData(q, { idField: 'id' }).pipe(
        tap((sprints) => {
          patchState(store, { sprints });
          store.setLoading(false);
        }),
        catchError((error) => {
          const errorMessage = error?.message || 'Failed to load sprints';
          errorService.showError(errorMessage);
          store.setLoading(false);
          return of([]);
        }),
      );
    }),
  ),
);
```

**Query Result:**

```typescript
sprints: [
  {
    id: "sprint_abc123",
    name: "Sprint 3",
    status: "future",
    ...
  },
  {
    id: "sprint_def456",
    name: "Sprint 2",
    status: "active",
    ...
  },
  {
    id: "sprint_ghi789",
    name: "Sprint 1",
    status: "completed",
    ...
  }
]
```

---

### 3.3 Edit Sprint

User có thể edit sprint name, dates, và goal:

```typescript
// File: src/app/features/board/backlog/backlog.ts
editSprint(sprint: any) {
  const dialogRef = this.dialog.open(EditSprintDialog, {
    width: '500px',
    data: { sprint }
  });

  dialogRef.afterClosed().subscribe((updates) => {
    if (updates) {
      this.sprintStore.updateSprint(sprint.id, updates);
    }
  });
}
```

**Edit Sprint Dialog:**

```typescript
// File: src/app/features/board/backlog/edit-sprint-dialog/edit-sprint-dialog.ts
@Component({
  template: `
    <h2 mat-dialog-title>Edit Sprint</h2>

    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field>
          <mat-label>Sprint Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Start Date</mat-label>
          <input matInput type="date" formControlName="startDate" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>End Date</mat-label>
          <input matInput type="date" formControlName="endDate" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Sprint Goal (Optional)</mat-label>
          <textarea matInput formControlName="goal" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
})
export class EditSprintDialog {
  dialogRef = inject(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);

  form = new FormGroup({
    name: new FormControl(this.data.sprint.name, [Validators.required]),
    startDate: new FormControl(this.formatDate(this.data.sprint.startDate)),
    endDate: new FormControl(this.formatDate(this.data.sprint.endDate)),
    goal: new FormControl(this.data.sprint.goal || ''),
  });

  formatDate(isoString: string): string {
    return isoString.split('T')[0]; // "2026-01-20"
  }

  save() {
    if (this.form.valid) {
      const values = this.form.value;
      this.dialogRef.close({
        name: values.name,
        startDate: new Date(values.startDate!).toISOString(),
        endDate: new Date(values.endDate!).toISOString(),
        goal: values.goal,
      });
    }
  }
}
```

---

## 4. Bắt Đầu Sprint (Start Sprint)

### 4.1 Sequence Diagram

```
User          Backlog        StartDialog    SprintStore    IssueService    Firestore
 │                │                │              │              │              │
 │  Click         │                │              │              │              │
 │  "Start        │                │              │              │              │
 │   Sprint"      │                │              │              │              │
 │───────────────>│                │              │              │              │
 │                │                │              │              │              │
 │                │ Check issues   │              │              │              │
 │                │ count          │              │              │              │
 │                │                │              │              │              │
 │                │ Open dialog    │              │              │              │
 │                │───────────────>│              │              │              │
 │                │                │              │              │              │
 │  Edit dates    │                │              │              │              │
 │  & goal        │                │              │              │              │
 │───────────────────────────────>│              │              │              │
 │                │                │              │              │              │
 │  Click Start   │                │              │              │              │
 │───────────────────────────────>│              │              │              │
 │                │                │ Close with   │              │              │
 │                │                │ updates      │              │              │
 │                │<───────────────│              │              │              │
 │                │                │              │              │              │
 │                │ updateSprint() │              │              │              │
 │                │───────────────────────────────>│              │              │
 │                │                │              │ update()     │              │
 │                │                │              │─────────────────────────────>│
 │                │                │              │              │              │
 │                │                │              │              │ Update       │
 │                │                │              │              │ status =     │
 │                │                │              │              │ 'active'     │
 │                │                │              │              │              │
 │                │ batchUpdate    │              │              │              │
 │                │ Issues()       │              │              │              │
 │                │───────────────────────────────────────────────>              │
 │                │                │              │              │              │
 │                │                │              │              │ Update all   │
 │                │                │              │              │ issues:      │
 │                │                │              │              │ isInBacklog  │
 │                │                │              │              │ = false      │
 │                │                │              │              │              │
 │                │ navigate       │              │              │              │
 │                │ to /board      │              │              │              │
 │                │                │              │              │              │
 │  Board View    │                │              │              │              │
 │  (Issues       │                │              │              │              │
 │   visible)     │                │              │              │              │
 │<───────────────┼────────────────┼──────────────┼──────────────┼──────────────│
```

### 4.2 Step-by-Step Implementation

#### Step 1: Check Issues Count

```typescript
// File: src/app/features/board/backlog/backlog.ts
startSprint(sprint: any) {
  const issues = this.getSprintIssues(sprint.id);

  // Validation: Sprint must have issues
  if (issues.length === 0) {
    alert('Please add issues to the sprint before starting it.');
    return;
  }

  // Open dialog
  const dialogRef = this.dialog.open(StartSprintDialog, {
    width: '500px',
    data: {
      sprint,
      issueCount: issues.length
    }
  });

  dialogRef.afterClosed().subscribe(async (updates) => {
    if (updates) {
      await this.handleStartSprint(sprint, issues, updates);
    }
  });
}
```

**Why check issues count?**

- Sprint không có issues = không có gì để làm
- Ngăn user start empty sprint
- Better UX: remind user to plan sprint first

---

#### Step 2: Start Sprint Dialog

```typescript
// File: src/app/features/board/backlog/start-sprint-dialog/start-sprint-dialog.ts
@Component({
  template: `
    <h2 mat-dialog-title>Start Sprint: {{ data.sprint.name }}</h2>

    <mat-dialog-content>
      <div class="sprint-info">
        <mat-icon>info</mat-icon>
        <span>This sprint contains {{ data.issueCount }} issues</span>
      </div>

      <form [formGroup]="form">
        <mat-form-field>
          <mat-label>Sprint Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Start Date</mat-label>
          <input matInput type="date" formControlName="startDate" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>End Date</mat-label>
          <input matInput type="date" formControlName="endDate" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Sprint Goal</mat-label>
          <textarea
            matInput
            formControlName="goal"
            rows="3"
            placeholder="What is the goal of this sprint?"
          ></textarea>
          <mat-hint>Optional but recommended</mat-hint>
        </mat-form-field>

        <div class="duration-info">
          <mat-icon>schedule</mat-icon>
          <span>Duration: {{ calculateDuration() }} days</span>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="start()">
        <mat-icon>play_arrow</mat-icon>
        Start Sprint
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .sprint-info {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #e3f2fd;
        border-radius: 4px;
        margin-bottom: 16px;

        mat-icon {
          color: #1976d2;
        }
      }

      .duration-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        color: #666;

        mat-icon {
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    `,
  ],
})
export class StartSprintDialog {
  dialogRef = inject(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);

  form = new FormGroup({
    name: new FormControl(this.data.sprint.name, [Validators.required]),
    startDate: new FormControl(this.formatDate(this.data.sprint.startDate), [Validators.required]),
    endDate: new FormControl(this.formatDate(this.data.sprint.endDate), [Validators.required]),
    goal: new FormControl(this.data.sprint.goal || ''),
  });

  formatDate(isoString: string): string {
    return isoString.split('T')[0];
  }

  calculateDuration(): number {
    const start = new Date(this.form.value.startDate!);
    const end = new Date(this.form.value.endDate!);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  start() {
    if (this.form.valid) {
      const values = this.form.value;
      this.dialogRef.close({
        status: 'active',
        name: values.name,
        startDate: new Date(values.startDate!).toISOString(),
        endDate: new Date(values.endDate!).toISOString(),
        goal: values.goal || undefined,
      });
    }
  }
}
```

---

#### Step 3: Handle Start Sprint

```typescript
// File: src/app/features/board/backlog/backlog.ts
async handleStartSprint(sprint: any, issues: Issue[], updates: any) {
  try {
    // 1. Update Sprint (status = active, dates, goal, etc)
    await this.sprintStore.updateSprint(sprint.id, updates);

    // 2. Move issues to board (isInBacklog = false)
    const issueUpdates = issues.map((issue) => ({
      id: issue.id,
      data: { isInBacklog: false }
    }));

    if (issueUpdates.length > 0) {
      await this.issueService.batchUpdateIssues(issueUpdates);
    }

    // 3. Navigate to board
    this.router.navigate(['../board'], { relativeTo: this.route });

  } catch (error) {
    console.error('Failed to start sprint:', error);
    alert('Failed to start sprint. Please try again.');
  }
}
```

**Critical Logic: `isInBacklog` Flag**

```typescript
// BEFORE Start Sprint
{
  id: "issue_1",
  title: "Implement login",
  sprintId: "sprint_3",
  isInBacklog: true,    // ← In planning phase
  statusColumnId: "todo"
}

// AFTER Start Sprint
{
  id: "issue_1",
  title: "Implement login",
  sprintId: "sprint_3",
  isInBacklog: false,   // ← Moved to execution phase
  statusColumnId: "todo"
}
```

**Why `isInBacklog` matters:**

- `isInBacklog: true` → Issue hiển thị trong **Backlog view** (planning)
- `isInBacklog: false` → Issue hiển thị trong **Board view** (execution)
- Cho phép tách biệt planning vs execution phases

---

#### Step 4: Batch Update Issues

```typescript
// File: src/app/features/issue/issue.service.ts
@Injectable({ providedIn: 'root' })
export class IssueService {
  private firestore = inject(Firestore);

  async batchUpdateIssues(updates: Array<{ id: string; data: any }>) {
    const batch = writeBatch(this.firestore);

    updates.forEach(({ id, data }) => {
      const docRef = doc(this.firestore, 'issues', id);
      batch.update(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
  }
}
```

**Batch Operation Benefits:**

- ✅ Atomic: All updates succeed or all fail
- ✅ Efficient: Single network request
- ✅ Fast: No waiting for individual updates
- ✅ Consistent: All issues updated at same time

**Example Batch:**

```typescript
batchUpdateIssues([
  { id: 'issue_1', data: { isInBacklog: false } },
  { id: 'issue_2', data: { isInBacklog: false } },
  { id: 'issue_3', data: { isInBacklog: false } },
  { id: 'issue_4', data: { isInBacklog: false } },
  { id: 'issue_5', data: { isInBacklog: false } },
]);
```

---

#### Step 5: Navigate to Board

```typescript
// File: src/app/features/board/backlog/backlog.ts
this.router.navigate(['../board'], { relativeTo: this.route });
```

**URL Changes:**

```
Before: /project/proj_123/backlog
After:  /project/proj_123/board
```

**Board View Filters:**

```typescript
// File: src/app/features/board/board.store.ts
filteredIssues = computed(() => {
  let issues = store.issues();

  // Filter out backlog issues
  issues = issues.filter((i) => !i.isInBacklog);

  // Filter by active sprint
  const activeSprint = sprintStore.activeSprint();
  if (activeSprint) {
    issues = issues.filter((i) => i.sprintId === activeSprint.id);
  }

  return issues;
});
```

**Result:** User thấy tất cả issues của active sprint trên Kanban board!

---

### 4.3 Complete Start Sprint Flow

```typescript
// Summary of what happens when starting a sprint:

1. User clicks "Start Sprint" on Future Sprint
   ↓
2. Validate: Sprint has issues? ✓
   ↓
3. Open StartSprintDialog
   ↓
4. User reviews/edits:
   - Sprint name
   - Start date
   - End date
   - Sprint goal
   ↓
5. User clicks "Start Sprint"
   ↓
6. Update Sprint document:
   {
     status: 'future' → 'active',
     startDate: updated,
     endDate: updated,
     goal: updated
   }
   ↓
7. Batch update all sprint issues:
   {
     isInBacklog: true → false
   }
   ↓
8. Navigate to /board
   ↓
9. Board displays active sprint issues
   ↓
10. Team starts working on issues!
```

---

## 5. Kết Thúc Sprint (Complete Sprint)

### 5.1 Sequence Diagram

```
User          Board/Backlog  CompleteDialog  SprintStore    IssueService    Firestore
 │                │                │              │              │              │
 │  Click         │                │              │              │              │
 │  "Complete     │                │              │              │              │
 │   Sprint"      │                │              │              │              │
 │───────────────>│                │              │              │              │
 │                │                │              │              │              │
 │                │ Get sprint     │              │              │              │
 │                │ issues         │              │              │              │
 │                │                │              │              │              │
 │                │ Calculate      │              │              │              │
 │                │ stats          │              │              │              │
 │                │                │              │              │              │
 │                │ Open dialog    │              │              │              │
 │                │───────────────>│              │              │              │
 │                │                │              │              │              │
 │  View stats:   │                │              │              │              │
 │  - Total: 20   │                │              │              │              │
 │  - Done: 15    │                │              │              │              │
 │  - Incomplete: │                │              │              │              │
 │    5           │                │              │              │              │
 │                │                │              │              │              │
 │  Select        │                │              │              │              │
 │  destination   │                │              │              │              │
 │  for           │                │              │              │              │
 │  incomplete    │                │              │              │              │
 │───────────────────────────────>│              │              │              │
 │                │                │              │              │              │
 │  Click         │                │              │              │              │
 │  Complete      │                │              │              │              │
 │───────────────────────────────>│              │              │              │
 │                │                │ Close with   │              │              │
 │                │                │ destination  │              │              │
 │                │<───────────────│              │              │              │
 │                │                │              │              │              │
 │                │ completeSprint()              │              │              │
 │                │───────────────────────────────>│              │              │
 │                │                │              │ update()     │              │
 │                │                │              │─────────────────────────────>│
 │                │                │              │              │              │
 │                │                │              │              │ Update       │
 │                │                │              │              │ status =     │
 │                │                │              │              │ 'completed'  │
 │                │                │              │              │              │
 │                │ Handle         │              │              │              │
 │                │ incomplete     │              │              │              │
 │                │ issues         │              │              │              │
 │                │───────────────────────────────────────────────>              │
 │                │                │              │              │              │
 │                │                │              │              │ Move to      │
 │                │                │              │              │ destination  │
 │                │                │              │              │ (backlog or  │
 │                │                │              │              │ future       │
 │                │                │              │              │ sprint)      │
 │                │                │              │              │              │
 │                │ Archive        │              │              │              │
 │                │ completed      │              │              │              │
 │                │ issues         │              │              │              │
 │                │───────────────────────────────────────────────>              │
 │                │                │              │              │              │
 │                │                │              │              │ Set          │
 │                │                │              │              │ isArchived = │
 │                │                │              │              │ true         │
 │                │                │              │              │              │
 │  Sprint        │                │              │              │              │
 │  Completed!    │                │              │              │              │
 │<───────────────┼────────────────┼──────────────┼──────────────┼──────────────│
```

### 5.2 Step-by-Step Implementation

#### Step 1: Click "Complete Sprint"

```typescript
// File: src/app/features/board/backlog/backlog.ts (or board.ts)
completeSprint(sprint: any) {
  const issues = this.getSprintIssues(sprint.id);
  const futureSprints = this.sprintStore.futureSprints();
  const activeSprints = this.sprintStore.activeSprints();

  const dialogRef = this.dialog.open(CompleteSprintDialog, {
    width: '500px',
    data: {
      sprint,
      activeSprints,
      allIssues: this.boardStore.issues(),
      futureSprints
    }
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      this.handleCompleteSprint(sprint, issues, result.destinationId);
    }
  });
}
```

---

#### Step 2: Complete Sprint Dialog

```typescript
// File: src/app/features/board/backlog/complete-sprint-dialog/complete-sprint-dialog.ts
@Component({
  template: `
    <h2 mat-dialog-title>Complete Sprint: {{ data.sprint.name }}</h2>

    <mat-dialog-content>
      <!-- Sprint Statistics -->
      <div class="sprint-stats">
        <div class="stat-card total">
          <mat-icon>assignment</mat-icon>
          <div class="stat-info">
            <div class="stat-value">{{ totalIssues }}</div>
            <div class="stat-label">Total Issues</div>
          </div>
        </div>

        <div class="stat-card completed">
          <mat-icon>check_circle</mat-icon>
          <div class="stat-info">
            <div class="stat-value">{{ completedIssues }}</div>
            <div class="stat-label">Completed</div>
          </div>
        </div>

        <div class="stat-card incomplete">
          <mat-icon>pending</mat-icon>
          <div class="stat-info">
            <div class="stat-value">{{ incompleteIssues }}</div>
            <div class="stat-label">Incomplete</div>
          </div>
        </div>
      </div>

      <!-- Completion Rate -->
      <div class="completion-rate">
        <div class="rate-label">Completion Rate: {{ completionRate }}%</div>
        <mat-progress-bar
          mode="determinate"
          [value]="completionRate"
          [color]="completionRate >= 80 ? 'primary' : 'warn'"
        >
        </mat-progress-bar>
      </div>

      <!-- Incomplete Issues Destination -->
      @if (incompleteIssues > 0) {
        <div class="destination-section">
          <h3>What to do with incomplete issues?</h3>
          <mat-form-field>
            <mat-label>Move to</mat-label>
            <mat-select [(value)]="selectedDestination">
              <mat-option [value]="null">
                <mat-icon>backspace</mat-icon>
                Backlog
              </mat-option>
              @for (sprint of data.futureSprints; track sprint.id) {
                <mat-option [value]="sprint.id">
                  <mat-icon>sprint</mat-icon>
                  {{ sprint.name }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      }

      <!-- Completed Issues Info -->
      @if (completedIssues > 0) {
        <div class="archive-info">
          <mat-icon>archive</mat-icon>
          <span> {{ completedIssues }} completed issues will be archived </span>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" (click)="complete()">
        <mat-icon>done_all</mat-icon>
        Complete Sprint
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .sprint-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 24px;
      }

      .stat-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        border-radius: 8px;

        &.total {
          background: #e3f2fd;
          mat-icon {
            color: #1976d2;
          }
        }

        &.completed {
          background: #e8f5e9;
          mat-icon {
            color: #388e3c;
          }
        }

        &.incomplete {
          background: #fff3e0;
          mat-icon {
            color: #f57c00;
          }
        }

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
        }
      }

      .stat-value {
        font-size: 24px;
        font-weight: bold;
      }

      .stat-label {
        font-size: 12px;
        color: #666;
      }

      .completion-rate {
        margin-bottom: 24px;

        .rate-label {
          margin-bottom: 8px;
          font-weight: 500;
        }
      }

      .destination-section {
        margin-bottom: 16px;

        h3 {
          margin-bottom: 12px;
          font-size: 14px;
        }
      }

      .archive-info {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #f5f5f5;
        border-radius: 4px;

        mat-icon {
          color: #666;
        }
      }
    `,
  ],
})
export class CompleteSprintDialog {
  dialogRef = inject(MatDialogRef);
  data = inject(MAT_DIALOG_DATA);

  selectedDestination: string | null = null;

  get sprintIssues() {
    return this.data.allIssues.filter((i: Issue) => i.sprintId === this.data.sprint.id);
  }

  get totalIssues() {
    return this.sprintIssues.length;
  }

  get completedIssues() {
    return this.sprintIssues.filter((i: Issue) => i.statusColumnId === 'done').length;
  }

  get incompleteIssues() {
    return this.totalIssues - this.completedIssues;
  }

  get completionRate() {
    if (this.totalIssues === 0) return 0;
    return Math.round((this.completedIssues / this.totalIssues) * 100);
  }

  complete() {
    this.dialogRef.close({
      destinationId: this.selectedDestination,
    });
  }
}
```

---

#### Step 3: Handle Complete Sprint

```typescript
// File: src/app/features/board/backlog/backlog.ts
async handleCompleteSprint(
  sprint: any,
  issues: Issue[],
  destinationId: string | null
) {
  try {
    // 1. Update sprint status to completed
    this.sprintStore.completeSprint(sprint.id);

    // 2. Separate issues by status
    const incompleteIssues = issues.filter(i => i.statusColumnId !== 'done');
    const completedIssues = issues.filter(i => i.statusColumnId === 'done');

    console.log('Complete Sprint - Sprint ID:', sprint.id);
    console.log('Complete Sprint - Total issues:', issues.length);
    console.log('Complete Sprint - Incomplete issues:', incompleteIssues.length);
    console.log('Complete Sprint - Completed issues:', completedIssues.length);

    let updates: any[] = [];

    // 3. Move incomplete issues to destination
    if (incompleteIssues.length > 0) {
      updates = updates.concat(
        incompleteIssues.map((issue) => ({
          id: issue.id,
          data: {
            sprintId: destinationId,  // null (backlog) or future sprint ID
            isInBacklog: true          // Always true - back to planning
          }
        }))
      );
    }

    // 4. Archive completed issues
    if (completedIssues.length > 0) {
      updates = updates.concat(
        completedIssues.map((issue) => ({
          id: issue.id,
          data: {
            isArchived: true  // Soft delete - keep for history
            // sprintId stays the same - for reporting
          }
        }))
      );
    }

    console.log('Complete Sprint - Updates to send:', updates);

    // 5. Batch update all issues
    if (updates.length > 0) {
      await this.issueService.batchUpdateIssues(updates);
    }

    alert('Sprint completed successfully!');

  } catch (error) {
    console.error('Failed to complete sprint:', error);
    alert('Failed to complete sprint. Please try again.');
  }
}
```

---

## 6. Xử Lý Issues Khi Complete

### 6.1 Issue States After Completion

```typescript
// SCENARIO 1: Incomplete Issue → Move to Backlog
// Before Complete
{
  id: "issue_1",
  title: "Implement payment",
  sprintId: "sprint_2",
  statusColumnId: "in-progress",  // Not done!
  isInBacklog: false,
  isArchived: false
}

// After Complete (destinationId = null)
{
  id: "issue_1",
  title: "Implement payment",
  sprintId: null,                 // ← Removed from sprint
  statusColumnId: "in-progress",
  isInBacklog: true,              // ← Back to backlog
  isArchived: false
}
```

```typescript
// SCENARIO 2: Incomplete Issue → Move to Future Sprint
// Before Complete
{
  id: "issue_2",
  title: "Add notifications",
  sprintId: "sprint_2",
  statusColumnId: "todo",         // Not done!
  isInBacklog: false,
  isArchived: false
}

// After Complete (destinationId = "sprint_3")
{
  id: "issue_2",
  title: "Add notifications",
  sprintId: "sprint_3",           // ← Moved to next sprint
  statusColumnId: "todo",
  isInBacklog: true,              // ← Back to planning
  isArchived: false
}
```

```typescript
// SCENARIO 3: Completed Issue → Archive
// Before Complete
{
  id: "issue_3",
  title: "User authentication",
  sprintId: "sprint_2",
  statusColumnId: "done",         // ✓ Done!
  isInBacklog: false,
  isArchived: false
}

// After Complete
{
  id: "issue_3",
  title: "User authentication",
  sprintId: "sprint_2",           // ← Keep sprint reference
  statusColumnId: "done",
  isInBacklog: false,
  isArchived: true                // ← Archived (soft delete)
}
```

### 6.2 Why Keep sprintId for Archived Issues?

**Reason:** Historical data & reporting

```typescript
// Query: Get all issues completed in Sprint 2
const completedInSprint2 = issues.filter((i) => i.sprintId === 'sprint_2' && i.isArchived === true);

// Use cases:
// - Sprint retrospective
// - Velocity calculation
// - Team performance metrics
// - Burndown charts
// - Historical reports
```

---

## 7. Archive System

### 7.1 What is Archiving?

**Archive = Soft Delete**

- Issues are NOT deleted from database
- They are hidden from active views
- They can be restored if needed
- They are kept for reporting/analytics

### 7.2 Archive Filter

```typescript
// File: src/app/features/board/board.store.ts
filteredIssues = computed(() => {
  let issues = store.issues();

  // Filter out archived issues
  issues = issues.filter((i) => !i.isArchived);

  // Filter out backlog issues
  issues = issues.filter((i) => !i.isInBacklog);

  // ... other filters

  return issues;
});
```

**Result:** Archived issues không hiển thị trong:

- ❌ Board view
- ❌ Backlog view
- ❌ My Tasks view
- ❌ Home dashboard
- ✅ Reports view (future feature)

### 7.3 Archive vs Delete

| Operation        | Archive          | Delete         |
| ---------------- | ---------------- | -------------- |
| Data kept?       | ✅ Yes           | ❌ No          |
| Reversible?      | ✅ Yes           | ❌ No          |
| Historical data? | ✅ Yes           | ❌ No          |
| Firestore cost?  | Higher           | Lower          |
| Use case         | Completed issues | Spam/test data |

### 7.4 Restore Archived Issue

```typescript
// Future feature: Restore archived issue
async restoreIssue(issueId: string) {
  await this.issueService.updateIssue(issueId, {
    isArchived: false,
    isInBacklog: true,  // Back to backlog
    sprintId: null      // Remove from completed sprint
  });
}
```

### 7.5 View Archived Issues

```typescript
// Future feature: Archived issues view
@Component({
  template: `
    <h2>Archived Issues</h2>

    @for (issue of archivedIssues(); track issue.id) {
      <div class="archived-issue">
        <span>{{ issue.key }}: {{ issue.title }}</span>
        <span>Completed in {{ getSprintName(issue.sprintId) }}</span>
        <button (click)="restoreIssue(issue.id)">Restore</button>
      </div>
    }
  `,
})
export class ArchivedIssuesView {
  archivedIssues = computed(() => this.boardStore.issues().filter((i) => i.isArchived));
}
```

---

## 8. Sprint Lifecycle

### 8.1 Complete Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sprint Lifecycle                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                                │
│  │   CREATE     │  Admin clicks "Create Sprint"                 │
│  │   SPRINT     │  → Auto-name: "Sprint N"                      │
│  └──────┬───────┘  → Default dates: 2 weeks                     │
│         │          → Status: 'future'                           │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │   FUTURE     │  Sprint is created but not started            │
│  │   STATE      │  → Issues can be added via drag & drop        │
│  └──────┬───────┘  → Can edit name, dates, goal                 │
│         │          → Can delete sprint                          │
│         │                                                        │
│         │  User clicks "Start Sprint"                           │
│         │  → Opens StartSprintDialog                            │
│         │  → User confirms dates & goal                         │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │  START       │  1. Update sprint: status = 'active'          │
│  │  SPRINT      │  2. Batch update issues: isInBacklog = false  │
│  └──────┬───────┘  3. Navigate to /board                        │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │   ACTIVE     │  Sprint is running                            │
│  │   STATE      │  → Issues visible on Kanban board             │
│  └──────┬───────┘  → Team works on issues                       │
│         │          → Issues move: Todo → In Progress → Done     │
│         │          → Can add/remove issues                      │
│         │                                                        │
│         │  User clicks "Complete Sprint"                        │
│         │  → Opens CompleteSprintDialog                         │
│         │  → Shows completion stats                             │
│         │  → User selects destination for incomplete issues     │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │  COMPLETE    │  1. Update sprint: status = 'completed'       │
│  │  SPRINT      │  2. Move incomplete issues to destination     │
│  └──────┬───────┘  3. Archive completed issues                  │
│         │          4. Sprint disappears from Backlog view       │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │  COMPLETED   │  Sprint is finished                           │
│  │   STATE      │  → Hidden from active views                   │
│  └──────────────┘  → Kept for historical data                   │
│                    → Can view in Reports (future)               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 State Transition Rules

```typescript
// Valid transitions
'future' → 'active'     ✅ (Start Sprint)
'active' → 'completed'  ✅ (Complete Sprint)

// Invalid transitions
'future' → 'completed'  ❌ (Must start first)
'completed' → 'active'  ❌ (Cannot reopen)
'active' → 'future'     ❌ (Cannot revert)
```

### 8.3 Sprint Constraints

```typescript
// Business Rules
const SPRINT_RULES = {
  // Only one active sprint per project
  maxActiveSprints: 1,

  // Minimum sprint duration
  minDurationDays: 1,

  // Maximum sprint duration
  maxDurationDays: 30,

  // Minimum issues to start
  minIssuesToStart: 1,

  // Can delete sprint?
  canDelete: (sprint: Sprint) => {
    return sprint.status === 'future'; // Only future sprints
  },

  // Can edit sprint?
  canEdit: (sprint: Sprint) => {
    return sprint.status !== 'completed'; // Not completed
  },
};
```

---

## 9. Best Practices

### 9.1 Sprint Planning

**✅ DO:**

- Plan sprint goal before starting
- Estimate capacity realistically
- Include buffer for unexpected work
- Review team velocity from previous sprints
- Break down large stories into smaller tasks

**❌ DON'T:**

- Start sprint without issues
- Overcommit team capacity
- Change sprint scope mid-sprint (unless critical)
- Skip sprint retrospective
- Ignore incomplete issues from previous sprint

### 9.2 Sprint Execution

**✅ DO:**

- Daily standup to sync team
- Update issue status regularly
- Move blocked issues to "Blocked" column
- Communicate blockers immediately
- Track progress with burndown chart

**❌ DON'T:**

- Let issues sit in "In Progress" for days
- Add new issues mid-sprint without discussion
- Skip code reviews to "finish faster"
- Ignore technical debt
- Work on issues outside current sprint

### 9.3 Sprint Completion

**✅ DO:**

- Review all issues before completing
- Discuss why issues weren't completed
- Document learnings in retrospective
- Celebrate completed work
- Plan next sprint based on learnings

**❌ DON'T:**

- Mark incomplete issues as "Done"
- Skip retrospective
- Blame team members for incomplete work
- Carry over too many issues to next sprint
- Ignore patterns in incomplete issues

### 9.4 Code Example: Sprint Validation

```typescript
// File: src/app/features/board/sprint.validator.ts
export class SprintValidator {
  static canStartSprint(sprint: Sprint, issues: Issue[]): ValidationResult {
    const errors: string[] = [];

    // Check: Has issues
    if (issues.length === 0) {
      errors.push('Sprint must have at least one issue');
    }

    // Check: Valid dates
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);

    if (end <= start) {
      errors.push('End date must be after start date');
    }

    // Check: Duration
    const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

    if (durationDays < 1) {
      errors.push('Sprint must be at least 1 day long');
    }

    if (durationDays > 30) {
      errors.push('Sprint cannot be longer than 30 days');
    }

    // Check: No other active sprint
    // (handled by business logic)

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static canCompleteSprint(sprint: Sprint): ValidationResult {
    const errors: string[] = [];

    // Check: Sprint is active
    if (sprint.status !== 'active') {
      errors.push('Only active sprints can be completed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

## 10. Troubleshooting

### 10.1 Common Issues

#### Issue 1: "Cannot start sprint - no issues"

**Problem:** User tries to start empty sprint

**Solution:**

```typescript
// Add validation in startSprint()
if (issues.length === 0) {
  this.errorService.showError('Please add issues to the sprint before starting it');
  return;
}
```

---

#### Issue 2: Issues not appearing on board after start

**Problem:** `isInBacklog` not updated correctly

**Debug:**

```typescript
// Check issue state
console.log('Issue after start:', issue);
// Should show: isInBacklog: false

// Check board filter
console.log('Filtered issues:', this.boardStore.filteredIssues());
// Should include sprint issues
```

**Solution:**

```typescript
// Ensure batch update completes before navigation
await this.issueService.batchUpdateIssues(updates);
await new Promise((resolve) => setTimeout(resolve, 500)); // Wait for Firestore
this.router.navigate(['../board']);
```

---

#### Issue 3: Multiple active sprints

**Problem:** User can start multiple sprints

**Solution:**

```typescript
// Add validation
startSprint(sprint: Sprint) {
  const activeSprints = this.sprintStore.activeSprints();

  if (activeSprints.length > 0) {
    this.errorService.showError(
      'Please complete the current sprint before starting a new one'
    );
    return;
  }

  // Proceed with start
}
```

---

#### Issue 4: Archived issues still visible

**Problem:** Filter not working correctly

**Debug:**

```typescript
// Check issue state
console.log('Issue archived?', issue.isArchived);

// Check filter
const filtered = issues.filter((i) => !i.isArchived);
console.log('Filtered count:', filtered.length);
```

**Solution:**

```typescript
// Ensure filter is applied in computed
filteredIssues = computed(() => {
  let issues = store.issues();

  // IMPORTANT: Filter archived first
  issues = issues.filter((i) => !i.isArchived);

  // Then other filters
  issues = issues.filter((i) => !i.isInBacklog);

  return issues;
});
```

---

#### Issue 5: Permission denied when creating sprint

**Problem:** User is not admin

**Debug:**

```typescript
// Check user role
const project = this.projectsStore.selectedProject();
const currentUser = this.authStore.user();

console.log('Project owner:', project?.ownerId);
console.log('Current user:', currentUser?.uid);
console.log('User role:', project?.roles?.[currentUser?.uid!]);
```

**Solution:**

```typescript
// Show appropriate error
if (!this.canCreateSprint()) {
  this.errorService.showError(
    'Only project admins can create sprints'
  );
  return;
}

canCreateSprint(): boolean {
  const project = this.projectsStore.selectedProject();
  const user = this.authStore.user();

  return project?.ownerId === user?.uid ||
         project?.roles?.[user?.uid!] === 'admin';
}
```

---

## 📝 Summary

Sprint Management Flow:

✅ **Create**: Admin tạo sprint với auto-naming
✅ **Plan**: Kéo issues vào sprint trong Backlog view
✅ **Start**: Update status, move issues to board
✅ **Execute**: Team làm việc trên Kanban board
✅ **Complete**: Archive done issues, move incomplete issues
✅ **Archive**: Soft delete cho historical data
✅ **Lifecycle**: Future → Active → Completed
✅ **Validation**: Business rules enforced
✅ **Real-time**: Firestore listeners cho instant updates

**Key Concepts:**

1. `isInBacklog` flag separates planning vs execution
2. Batch updates for atomic operations
3. Archive system preserves historical data
4. Sprint lifecycle enforces workflow
5. Validation prevents invalid states
6. Real-time sync keeps team in sync

**Next Steps:**

- Implement sprint reports
- Add burndown charts
- Create velocity tracking
- Build retrospective tool
- Add sprint templates
