# Luồng Backlog Planning (Backlog Planning Flow) - Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Backlog vs Board](#2-backlog-vs-board)
3. [isInBacklog Flag Logic](#3-isinbacklog-flag-logic)
4. [Drag & Drop Planning](#4-drag--drop-planning)
5. [Sprint Planning Session](#5-sprint-planning-session)
6. [Backlog Component Deep Dive](#6-backlog-component-deep-dive)
7. [Planning Best Practices](#7-planning-best-practices)
8. [Advanced Planning Features](#8-advanced-planning-features)
9. [Common Scenarios](#9-common-scenarios)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng Quan

### 1.1 Backlog Planning Là Gì?

Backlog Planning là **giai đoạn lập kế hoạch** trong Scrum:

- 📋 Tổ chức công việc trước khi thực thi
- 🎯 Ưu tiên issues theo business value
- 📦 Phân bổ issues vào sprints
- 🔄 Linh hoạt điều chỉnh scope
- 👥 Team collaboration để estimate

### 1.2 Planning vs Execution

```
┌─────────────────────────────────────────────────────────────┐
│              Planning vs Execution Phases                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PLANNING PHASE (Backlog View)                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  isInBacklog: true                                 │     │
│  │                                                     │     │
│  │  ┌──────────────┐  ┌──────────────┐               │     │
│  │  │   BACKLOG    │  │  SPRINT 3    │               │     │
│  │  │              │  │  (Future)    │               │     │
│  │  │  ┌────────┐  │  │              │               │     │
│  │  │  │Issue 1 │  │  │  ┌────────┐  │               │     │
│  │  │  └────────┘  │  │  │Issue 4 │  │               │     │
│  │  │              │  │  └────────┘  │               │     │
│  │  │  ┌────────┐  │  │              │               │     │
│  │  │  │Issue 2 │  │  │  ┌────────┐  │               │     │
│  │  │  └────────┘  │  │  │Issue 5 │  │               │     │
│  │  │              │  │  └────────┘  │               │     │
│  │  │  ┌────────┐  │  │              │               │     │
│  │  │  │Issue 3 │  │  │              │               │     │
│  │  │  └────────┘  │  │              │               │     │
│  │  └──────────────┘  └──────────────┘               │     │
│  │                                                     │     │
│  │  Drag & Drop to organize                          │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│                           │ Start Sprint                     │
│                           ▼                                  │
│  EXECUTION PHASE (Board View)                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  isInBacklog: false                                │     │
│  │                                                     │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │     │
│  │  │   TODO   │  │IN PROGRESS│ │   DONE   │         │     │
│  │  │          │  │           │  │          │         │     │
│  │  │ Issue 4  │  │           │  │          │         │     │
│  │  │ Issue 5  │  │           │  │          │         │     │
│  │  └──────────┘  └──────────┘  └──────────┘         │     │
│  │                                                     │     │
│  │  Drag & Drop to update status                     │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Key Concepts

**Backlog:**

- Repository of all work items
- Prioritized by product owner
- Continuously refined
- Issues have `isInBacklog: true`

**Sprint:**

- Time-boxed iteration (1-4 weeks)
- Contains subset of backlog
- Committed scope
- Issues move to `isInBacklog: false` when started

### 1.4 Files Liên Quan

```
src/app/features/board/
├── backlog/
│   └── backlog.ts                 # Main backlog component
├── board.store.ts                 # Issue state management
├── sprint.store.ts                # Sprint state management
└── issue/
    └── issue.service.ts           # Issue CRUD operations
```

---

## 2. Backlog vs Board

### 2.1 View Comparison

| Aspect            | Backlog View           | Board View           |
| ----------------- | ---------------------- | -------------------- |
| **Purpose**       | Planning               | Execution            |
| **Layout**        | Vertical lists         | Kanban columns       |
| **Grouping**      | By sprint              | By status            |
| **isInBacklog**   | `true`                 | `false`              |
| **Drag & Drop**   | Sprint assignment      | Status change        |
| **Sprint Status** | Future sprints         | Active sprint only   |
| **URL**           | `/project/:id/backlog` | `/project/:id/board` |

### 2.2 Data Flow

```typescript
// BACKLOG VIEW
// Shows issues where isInBacklog = true
backlogIssues = computed(() =>
  store.issues().filter(
    (i) => i.isInBacklog === true && i.isArchived === false && i.sprintId === null, // Not assigned to sprint
  ),
);

sprintIssues = computed(() =>
  store.issues().filter(
    (i) => i.isInBacklog === true && i.isArchived === false && i.sprintId === sprintId, // Assigned to future sprint
  ),
);

// BOARD VIEW
// Shows issues where isInBacklog = false
todoIssues = computed(() =>
  store
    .issues()
    .filter(
      (i) =>
        i.isInBacklog === false &&
        i.isArchived === false &&
        i.statusColumnId === 'todo' &&
        i.sprintId === activeSprint.id,
    ),
);
```

### 2.3 Navigation

```typescript
// File: src/app/app.routes.ts
{
  path: 'project/:projectId',
  component: ProjectLayout,
  children: [
    {
      path: 'backlog',  // Planning view
      component: Backlog
    },
    {
      path: 'board',    // Execution view
      component: Board
    }
  ]
}
```

---

## 3. isInBacklog Flag Logic

### 3.1 Flag Purpose

`isInBacklog` flag phân biệt **2 giai đoạn** của issue lifecycle:

```typescript
isInBacklog: true; // PLANNING - Issue đang được lập kế hoạch
isInBacklog: false; // EXECUTION - Issue đang được thực thi
```

### 3.2 State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                isInBacklog State Machine                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                            │
│  │   CREATE     │  New issue created                        │
│  │   ISSUE      │  → isInBacklog: true (default)            │
│  └──────┬───────┘  → sprintId: null (in backlog)            │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                            │
│  │  BACKLOG     │  Issue in general backlog                 │
│  │  (No Sprint) │  → isInBacklog: true                      │
│  └──────┬───────┘  → sprintId: null                         │
│         │                                                    │
│         │  Drag to Future Sprint                            │
│         ▼                                                    │
│  ┌──────────────┐                                            │
│  │   FUTURE     │  Issue assigned to future sprint          │
│  │   SPRINT     │  → isInBacklog: true (still planning)     │
│  └──────┬───────┘  → sprintId: "sprint_3"                   │
│         │                                                    │
│         │  Start Sprint                                     │
│         ▼                                                    │
│  ┌──────────────┐                                            │
│  │   ACTIVE     │  Sprint started, issue on board           │
│  │   SPRINT     │  → isInBacklog: false (now executing)     │
│  └──────┬───────┘  → sprintId: "sprint_3"                   │
│         │          → statusColumnId: "todo"                 │
│         │                                                    │
│         │  Complete Sprint                                  │
│         ▼                                                    │
│  ┌──────────────┐                                            │
│  │  ARCHIVED    │  Issue completed and archived             │
│  │  OR MOVED    │  → isArchived: true (if done)             │
│  └──────────────┘  → OR isInBacklog: true (if incomplete)   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Flag Update Scenarios

#### Scenario 1: Create Issue

```typescript
// New issue always starts in backlog
const newIssue = {
  title: 'Implement feature X',
  isInBacklog: true, // ← Planning phase
  sprintId: null, // ← Not assigned yet
  statusColumnId: 'todo',
};
```

#### Scenario 2: Drag to Future Sprint

```typescript
// Issue moved from backlog to future sprint
// Before
{
  isInBacklog: true,
  sprintId: null
}

// After drag
{
  isInBacklog: true,      // ← Still planning
  sprintId: "sprint_3"    // ← Assigned to sprint
}
```

#### Scenario 3: Start Sprint

```typescript
// Sprint started - ALL issues move to execution
// Before
{
  isInBacklog: true,
  sprintId: "sprint_3",
  statusColumnId: "todo"
}

// After start
{
  isInBacklog: false,     // ← Now executing!
  sprintId: "sprint_3",
  statusColumnId: "todo"
}
```

#### Scenario 4: Complete Sprint (Incomplete Issue)

```typescript
// Issue not done when sprint completes
// Before
{
  isInBacklog: false,
  sprintId: "sprint_3",
  statusColumnId: "in-progress"
}

// After complete (moved to backlog)
{
  isInBacklog: true,      // ← Back to planning
  sprintId: null,         // ← Removed from sprint
  statusColumnId: "in-progress"
}

// OR moved to next sprint
{
  isInBacklog: true,      // ← Back to planning
  sprintId: "sprint_4",   // ← Assigned to next sprint
  statusColumnId: "in-progress"
}
```

#### Scenario 5: Complete Sprint (Done Issue)

```typescript
// Issue done when sprint completes
// Before
{
  isInBacklog: false,
  sprintId: "sprint_3",
  statusColumnId: "done"
}

// After complete (archived)
{
  isInBacklog: false,     // ← Keep execution state
  sprintId: "sprint_3",   // ← Keep sprint reference
  statusColumnId: "done",
  isArchived: true        // ← Archived!
}
```

### 3.4 Filter Logic

```typescript
// File: src/app/features/board/backlog/backlog.ts

// Backlog issues (not in any sprint)
backlogIssues = computed(() => {
  return this.boardStore.issues().filter(issue =>
    issue.isInBacklog === true &&      // In planning phase
    issue.isArchived === false &&      // Not archived
    issue.sprintId === null            // Not assigned to sprint
  );
});

// Sprint issues (assigned to specific sprint)
getSprintIssues(sprintId: string) {
  return this.boardStore.issues().filter(issue =>
    issue.isInBacklog === true &&      // In planning phase
    issue.isArchived === false &&      // Not archived
    issue.sprintId === sprintId        // Assigned to this sprint
  );
}
```

```typescript
// File: src/app/features/board/board/board.ts

// Board issues (active sprint only)
filteredIssues = computed(() => {
  let issues = this.boardStore.issues();

  // Only execution phase issues
  issues = issues.filter((i) => i.isInBacklog === false);

  // Only non-archived
  issues = issues.filter((i) => i.isArchived === false);

  // Only active sprint
  const activeSprint = this.sprintStore.activeSprint();
  if (activeSprint) {
    issues = issues.filter((i) => i.sprintId === activeSprint.id);
  }

  return issues;
});
```

---

## 4. Drag & Drop Planning

### 4.1 Drag & Drop Zones

```html
<!-- File: src/app/features/board/backlog/backlog.ts -->
<div class="backlog-container" cdkDropListGroup>
  <!-- Backlog Drop Zone -->
  <div class="backlog-section">
    <h3>Backlog ({{ backlogIssues().length }})</h3>

    <div
      class="issue-list"
      cdkDropList
      id="backlog"
      [cdkDropListData]="backlogIssues()"
      (cdkDropListDropped)="drop($event)"
    >
      @for (issue of backlogIssues(); track issue.id) {
      <div class="issue-card" cdkDrag [cdkDragData]="issue">
        <!-- Issue content -->
      </div>
      }
    </div>
  </div>

  <!-- Sprint Drop Zones -->
  @for (sprint of visibleSprints(); track sprint.id) {
  <div class="sprint-section">
    <h3>{{ sprint.name }} ({{ getSprintIssues(sprint.id).length }})</h3>

    <div
      class="issue-list"
      cdkDropList
      [id]="sprint.id"
      [cdkDropListData]="getSprintIssues(sprint.id)"
      (cdkDropListDropped)="drop($event)"
    >
      @for (issue of getSprintIssues(sprint.id); track issue.id) {
      <div class="issue-card" cdkDrag [cdkDragData]="issue">
        <!-- Issue content -->
      </div>
      }
    </div>
  </div>
  }
</div>
```

### 4.2 Drop Handler

```typescript
// File: src/app/features/board/backlog/backlog.ts
drop(event: CdkDragDrop<Issue[]>) {
  const issue = event.item.data as Issue;
  const targetContainerId = event.container.id;

  console.log('Drop Event:', {
    issue: issue.key,
    from: event.previousContainer.id,
    to: targetContainerId,
    previousIndex: event.previousIndex,
    currentIndex: event.currentIndex
  });

  // CASE 1: Same container (reorder within same list)
  if (event.previousContainer === event.container) {
    // Visual update
    moveItemInArray(
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    // Calculate new order
    const newOrder = this.calculateOrder(
      event.container.data,
      event.currentIndex
    );

    // Update Firestore
    this.issueService.updateIssue(issue.id, {
      order: newOrder
    });
  }

  // CASE 2: Different container (move between backlog/sprints)
  else {
    // Visual update
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );

    // Determine new sprintId
    let newSprintId: string | null = null;

    if (targetContainerId !== 'backlog') {
      // Dropped into a sprint
      newSprintId = targetContainerId;
    }
    // else: Dropped into backlog, sprintId = null

    // Calculate new order in target container
    const newOrder = this.calculateOrder(
      event.container.data,
      event.currentIndex
    );

    // Update Firestore
    this.issueService.updateIssue(issue.id, {
      sprintId: newSprintId,
      isInBacklog: true,  // Always true in backlog view
      order: newOrder
    });

    console.log('Issue moved:', {
      issueKey: issue.key,
      newSprintId: newSprintId || 'backlog',
      newOrder
    });
  }
}
```

### 4.3 Detailed Flow Diagram

```
User Action                    Event Handler                 Firestore Update
─────────────────────────────────────────────────────────────────────────────

1. User grabs issue from Backlog
   │
   ├─> cdkDragStarted
   │   └─> Visual feedback
   │
2. User drags over Sprint 3
   │
   ├─> cdkDragMoved
   │   └─> Preview position
   │
3. User releases in Sprint 3
   │
   ├─> cdkDropListDropped
   │   │
   │   ├─> event.previousContainer.id = "backlog"
   │   ├─> event.container.id = "sprint_3"
   │   ├─> Different containers!
   │   │
   │   ├─> transferArrayItem()
   │   │   └─> Visual: Issue moves to Sprint 3 list
   │   │
   │   ├─> Calculate new order
   │   │   └─> newOrder = 2.5
   │   │
   │   └─> updateIssue({
   │         sprintId: "sprint_3",
   │         isInBacklog: true,
   │         order: 2.5
   │       })
   │
   └─> Firestore listener
       │
       ├─> Emit updated issue
       │
       └─> UI re-renders (already updated optimistically)
```

### 4.4 Order Calculation

```typescript
// File: src/app/features/board/backlog/backlog.ts
calculateOrder(issues: Issue[], targetIndex: number): number {
  // Empty list
  if (issues.length === 0) {
    return 1.0;
  }

  // Insert at beginning
  if (targetIndex === 0) {
    return issues[0].order - 1.0;
  }

  // Insert at end
  if (targetIndex >= issues.length) {
    return issues[issues.length - 1].order + 1.0;
  }

  // Insert in middle
  const prevOrder = issues[targetIndex - 1].order;
  const nextOrder = issues[targetIndex].order;
  return (prevOrder + nextOrder) / 2.0;
}
```

---

## 5. Sprint Planning Session

### 5.1 Planning Session Workflow

```
┌─────────────────────────────────────────────────────────────┐
│              Sprint Planning Session                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  STEP 1: Review Backlog                                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  • Product Owner presents top priority items       │     │
│  │  • Team asks clarifying questions                  │     │
│  │  • Refine issue descriptions                       │     │
│  │  • Add acceptance criteria                         │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  STEP 2: Create Sprint                                      │
│  ┌────────────────────────────────────────────────────┐     │
│  │  • Click "Create Sprint"                           │     │
│  │  • Auto-named: "Sprint N"                          │     │
│  │  • Default duration: 2 weeks                       │     │
│  │  • Status: 'future'                                │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  STEP 3: Estimate & Select Issues                           │
│  ┌────────────────────────────────────────────────────┐     │
│  │  • Team estimates each issue (story points)        │     │
│  │  • Drag high-priority issues to sprint            │     │
│  │  • Check team capacity                             │     │
│  │  • Stop when sprint is full                        │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  STEP 4: Define Sprint Goal                                 │
│  ┌────────────────────────────────────────────────────┐     │
│  │  • Click "Edit Sprint"                             │     │
│  │  • Set sprint goal                                 │     │
│  │  • Example: "Complete user authentication"        │     │
│  │  • Align team on objective                         │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  STEP 5: Start Sprint                                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │  • Click "Start Sprint"                            │     │
│  │  • Confirm dates & goal                            │     │
│  │  • All issues: isInBacklog → false                │     │
│  │  • Navigate to Board                               │     │
│  │  • Team starts working!                            │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Planning Session UI

```typescript
// File: src/app/features/board/backlog/backlog.ts
@Component({
  template: `
    <div class="backlog-page">
      <!-- Header Actions -->
      <div class="backlog-header">
        <h2>Backlog Planning</h2>

        <div class="actions">
          <button mat-raised-button (click)="createSprint()">
            <mat-icon>add</mat-icon>
            Create Sprint
          </button>

          <button mat-raised-button (click)="createIssue()">
            <mat-icon>add_task</mat-icon>
            Create Issue
          </button>
        </div>
      </div>

      <!-- Sprint Planning Area -->
      <div class="planning-area" cdkDropListGroup>
        <!-- Active Sprint (if exists) -->
        @if (sprintStore.activeSprint(); as activeSprint) {
          <div class="active-sprint-banner">
            <mat-icon>play_circle</mat-icon>
            <span> {{ activeSprint.name }} is currently running </span>
            <button mat-button (click)="goToBoard()">Go to Board</button>
          </div>
        }

        <!-- Future Sprints -->
        @for (sprint of sprintStore.futureSprints(); track sprint.id) {
          <div class="sprint-container">
            <!-- Sprint Header -->
            <div class="sprint-header">
              <div class="sprint-info">
                <h3>{{ sprint.name }}</h3>

                @if (sprint.goal) {
                  <p class="sprint-goal">
                    <mat-icon>flag</mat-icon>
                    {{ sprint.goal }}
                  </p>
                }

                <div class="sprint-meta">
                  <span>
                    <mat-icon>calendar_today</mat-icon>
                    {{ formatDate(sprint.startDate) }} -
                    {{ formatDate(sprint.endDate) }}
                  </span>
                  <span>
                    <mat-icon>schedule</mat-icon>
                    {{ calculateDuration(sprint) }} days
                  </span>
                </div>
              </div>

              <div class="sprint-actions">
                <button mat-icon-button [matMenuTriggerFor]="sprintMenu">
                  <mat-icon>more_vert</mat-icon>
                </button>

                <mat-menu #sprintMenu="matMenu">
                  <button mat-menu-item (click)="editSprint(sprint)">
                    <mat-icon>edit</mat-icon>
                    Edit Sprint
                  </button>
                  <button mat-menu-item (click)="startSprint(sprint)">
                    <mat-icon>play_arrow</mat-icon>
                    Start Sprint
                  </button>
                  <button mat-menu-item (click)="deleteSprint(sprint.id)">
                    <mat-icon>delete</mat-icon>
                    Delete Sprint
                  </button>
                </mat-menu>
              </div>
            </div>

            <!-- Sprint Issues Drop Zone -->
            <div
              class="sprint-issues"
              cdkDropList
              [id]="sprint.id"
              [cdkDropListData]="getSprintIssues(sprint.id)"
              (cdkDropListDropped)="drop($event)"
            >
              @for (issue of getSprintIssues(sprint.id); track issue.id) {
                <div class="issue-card" cdkDrag [cdkDragData]="issue">
                  <!-- Issue card content -->
                  <app-issue-card [issue]="issue"></app-issue-card>
                </div>
              } @empty {
                <div class="empty-sprint">
                  <mat-icon>inbox</mat-icon>
                  <p>Drag issues here to plan this sprint</p>
                </div>
              }
            </div>

            <!-- Sprint Footer -->
            <div class="sprint-footer">
              <span>{{ getSprintIssues(sprint.id).length }} issues</span>

              @if (getSprintIssues(sprint.id).length > 0) {
                <button mat-raised-button color="primary" (click)="startSprint(sprint)">
                  <mat-icon>play_arrow</mat-icon>
                  Start Sprint
                </button>
              }
            </div>
          </div>
        }

        <!-- Backlog Section -->
        <div class="backlog-container">
          <div class="backlog-header-section">
            <h3>Backlog ({{ backlogIssues().length }} issues)</h3>

            <div class="backlog-actions">
              <mat-form-field appearance="outline" class="search-field">
                <mat-icon matPrefix>search</mat-icon>
                <input matInput placeholder="Search backlog..." [(ngModel)]="searchQuery" />
              </mat-form-field>

              <button mat-icon-button [matMenuTriggerFor]="sortMenu">
                <mat-icon>sort</mat-icon>
              </button>

              <mat-menu #sortMenu="matMenu">
                <button mat-menu-item (click)="sortBy('priority')">Sort by Priority</button>
                <button mat-menu-item (click)="sortBy('created')">Sort by Created Date</button>
                <button mat-menu-item (click)="sortBy('updated')">Sort by Updated Date</button>
              </mat-menu>
            </div>
          </div>

          <!-- Backlog Issues Drop Zone -->
          <div
            class="backlog-issues"
            cdkDropList
            id="backlog"
            [cdkDropListData]="backlogIssues()"
            (cdkDropListDropped)="drop($event)"
          >
            @for (issue of filteredBacklogIssues(); track issue.id) {
              <div class="issue-card" cdkDrag [cdkDragData]="issue">
                <app-issue-card [issue]="issue"></app-issue-card>
              </div>
            } @empty {
              <div class="empty-backlog">
                <mat-icon>check_circle</mat-icon>
                <p>No issues in backlog</p>
                <button mat-raised-button (click)="createIssue()">Create First Issue</button>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Backlog {
  // ... component implementation
}
```

### 5.3 Planning Metrics

```typescript
// Calculate sprint capacity
getSprintCapacity(sprint: Sprint): {
  issueCount: number;
  storyPoints: number;
  estimatedHours: number;
} {
  const issues = this.getSprintIssues(sprint.id);

  return {
    issueCount: issues.length,
    storyPoints: issues.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
    estimatedHours: issues.reduce((sum, i) => sum + (i.estimatedHours || 0), 0)
  };
}

// Check if sprint is overcommitted
isSprintOvercommitted(sprint: Sprint): boolean {
  const capacity = this.getSprintCapacity(sprint);
  const teamCapacity = this.calculateTeamCapacity(sprint);

  return capacity.storyPoints > teamCapacity.storyPoints;
}

// Calculate team capacity
calculateTeamCapacity(sprint: Sprint): {
  storyPoints: number;
  hours: number;
} {
  const members = this.projectsStore.members();
  const durationDays = this.calculateDuration(sprint);

  // Assume each member can do 5 story points per day
  const storyPointsPerDay = 5;
  const hoursPerDay = 6; // 6 productive hours per day

  return {
    storyPoints: members.length * durationDays * storyPointsPerDay,
    hours: members.length * durationDays * hoursPerDay
  };
}
```

---

## 6. Backlog Component Deep Dive

### 6.1 Component Structure

```typescript
// File: src/app/features/board/backlog/backlog.ts
@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    IssueCard,
  ],
  templateUrl: './backlog.html',
  styleUrls: ['./backlog.scss'],
})
export class Backlog implements OnInit {
  // Stores
  readonly boardStore = inject(BoardStore);
  readonly sprintStore = inject(SprintStore);
  readonly projectsStore = inject(ProjectsStore);
  readonly authStore = inject(AuthStore);

  // Services
  private issueService = inject(IssueService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // Local state
  searchQuery = signal('');
  sortField = signal<'priority' | 'created' | 'updated'>('priority');

  // Computed values
  backlogIssues = computed(() => {
    return this.boardStore
      .issues()
      .filter(
        (issue) =>
          issue.isInBacklog === true && issue.isArchived === false && issue.sprintId === null,
      );
  });

  filteredBacklogIssues = computed(() => {
    let issues = this.backlogIssues();

    // Search filter
    const query = this.searchQuery().toLowerCase();
    if (query) {
      issues = issues.filter(
        (i) => i.title.toLowerCase().includes(query) || i.key.toLowerCase().includes(query),
      );
    }

    // Sort
    const field = this.sortField();
    issues = [...issues].sort((a, b) => {
      if (field === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (field === 'created') {
        return new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime();
      } else {
        return new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime();
      }
    });

    return issues;
  });

  visibleSprints = computed(() => {
    // Show future sprints only
    return this.sprintStore.futureSprints();
  });

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const projectId = params.get('projectId');
      if (projectId) {
        this.boardStore.loadIssues(projectId);
        this.sprintStore.loadSprints(projectId);
        this.projectsStore.selectProject(projectId);
      }
    });
  }

  // Sprint methods
  createSprint() {
    /* ... */
  }
  editSprint(sprint: Sprint) {
    /* ... */
  }
  startSprint(sprint: Sprint) {
    /* ... */
  }
  deleteSprint(sprintId: string) {
    /* ... */
  }

  // Issue methods
  createIssue() {
    /* ... */
  }
  editIssue(issue: Issue) {
    /* ... */
  }
  deleteIssue(issueId: string) {
    /* ... */
  }

  // Drag & drop
  drop(event: CdkDragDrop<Issue[]>) {
    /* ... */
  }

  // Helpers
  getSprintIssues(sprintId: string): Issue[] {
    return this.boardStore
      .issues()
      .filter(
        (issue) =>
          issue.isInBacklog === true && issue.isArchived === false && issue.sprintId === sprintId,
      );
  }

  calculateDuration(sprint: Sprint): number {
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString();
  }

  sortBy(field: 'priority' | 'created' | 'updated') {
    this.sortField.set(field);
  }

  goToBoard() {
    this.router.navigate(['../board'], { relativeTo: this.route });
  }
}
```

### 6.2 Issue Card Component

```typescript
// File: src/app/features/board/components/issue-card/issue-card.ts
@Component({
  selector: 'app-issue-card',
  standalone: true,
  template: `
    <div class="issue-card-content">
      <!-- Header -->
      <div class="issue-header">
        <span class="issue-key">{{ issue.key }}</span>

        <mat-icon class="issue-type" [class]="issue.type">
          {{ getTypeIcon(issue.type) }}
        </mat-icon>
      </div>

      <!-- Title -->
      <div class="issue-title">{{ issue.title }}</div>

      <!-- Footer -->
      <div class="issue-footer">
        <!-- Priority -->
        <mat-icon class="priority-icon" [style.color]="getPriorityColor(issue.priority)">
          {{ getPriorityIcon(issue.priority) }}
        </mat-icon>

        <!-- Assignee -->
        @if (issue.assigneeId) {
          <img
            [src]="getAssignee(issue.assigneeId)?.photoURL || defaultAvatar"
            [alt]="getAssignee(issue.assigneeId)?.displayName"
            class="assignee-avatar"
            [matTooltip]="getAssignee(issue.assigneeId)?.displayName || ''"
          />
        } @else {
          <mat-icon class="unassigned-icon" matTooltip="Unassigned"> person_outline </mat-icon>
        }

        <!-- Subtasks Progress -->
        @if (issue.subtasks && issue.subtasks.length > 0) {
          <div class="subtasks-indicator">
            <mat-icon>checklist</mat-icon>
            <span>{{ getCompletedSubtasks(issue) }}/{{ issue.subtasks.length }}</span>
          </div>
        }

        <!-- Comments Count -->
        @if (issue.comments && issue.comments.length > 0) {
          <div class="comments-indicator">
            <mat-icon>comment</mat-icon>
            <span>{{ issue.comments.length }}</span>
          </div>
        }

        <!-- Due Date -->
        @if (issue.dueDate) {
          <div class="due-date" [class.overdue]="isOverdue(issue.dueDate)">
            <mat-icon>schedule</mat-icon>
            <span>{{ formatDueDate(issue.dueDate) }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .issue-card-content {
        padding: 12px;
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: grab;
        transition: box-shadow 0.2s;

        &:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
      }

      .issue-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .issue-key {
        font-size: 12px;
        color: #666;
        font-weight: 500;
      }

      .issue-type {
        font-size: 16px;
        width: 16px;
        height: 16px;

        &.story {
          color: #4caf50;
        }
        &.bug {
          color: #f44336;
        }
        &.task {
          color: #2196f3;
        }
      }

      .issue-title {
        font-size: 14px;
        line-height: 1.4;
        margin-bottom: 12px;
        color: #333;
      }

      .issue-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }

      .priority-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .assignee-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
      }

      .unassigned-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
        color: #999;
      }

      .subtasks-indicator,
      .comments-indicator,
      .due-date {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #666;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }

      .due-date.overdue {
        color: #f44336;
      }
    `,
  ],
})
export class IssueCard {
  @Input() issue!: Issue;

  projectsStore = inject(ProjectsStore);

  getTypeIcon(type: string): string {
    const icons = {
      story: 'book',
      bug: 'bug_report',
      task: 'task',
    };
    return icons[type] || 'task';
  }

  getPriorityIcon(priority: string): string {
    const icons = {
      high: 'arrow_upward',
      medium: 'remove',
      low: 'arrow_downward',
    };
    return icons[priority] || 'remove';
  }

  getPriorityColor(priority: string): string {
    const colors = {
      high: '#de350b',
      medium: '#ff9900',
      low: '#0065ff',
    };
    return colors[priority] || '#666';
  }

  getAssignee(assigneeId: string) {
    return this.projectsStore.members().find((m) => m.uid === assigneeId);
  }

  getCompletedSubtasks(issue: Issue): number {
    return issue.subtasks.filter((s) => s.completed).length;
  }

  isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }

  formatDueDate(dueDate: string): string {
    const date = new Date(dueDate);
    const today = new Date();
    const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;

    return date.toLocaleDateString();
  }
}
```

---

## 7. Planning Best Practices

### 7.1 Backlog Refinement

**✅ DO:**

- Refine backlog regularly (weekly)
- Keep top items detailed
- Prioritize by business value
- Break down large stories
- Estimate top 20-30 items
- Remove obsolete issues

**❌ DON'T:**

- Let backlog grow indefinitely
- Keep vague requirements
- Prioritize everything as "High"
- Estimate entire backlog
- Hoard "nice to have" items

### 7.2 Sprint Planning

**✅ DO:**

- Set clear sprint goal
- Commit to realistic scope
- Consider team capacity
- Include buffer for unknowns
- Get team buy-in
- Document decisions

**❌ DON'T:**

- Overcommit team
- Skip sprint goal
- Plan without team input
- Ignore velocity data
- Add scope mid-sprint
- Plan too far ahead

### 7.3 Issue Organization

**✅ DO:**

```typescript
// Good: Well-organized backlog
Backlog (Prioritized):
1. [HIGH] User authentication (8 points)
2. [HIGH] Payment integration (13 points)
3. [MEDIUM] Email notifications (5 points)
4. [MEDIUM] User profile page (3 points)
5. [LOW] Dark mode (2 points)

Sprint 3 (Committed):
- User authentication (8 points)
- Email notifications (5 points)
- User profile page (3 points)
Total: 16 points (within capacity)
```

**❌ DON'T:**

```typescript
// Bad: Disorganized backlog
Backlog (No priority):
- Fix bugs
- Improve performance
- Add features
- Refactor code
- Update dependencies

Sprint 3 (Overcommitted):
- Everything from backlog
Total: Unknown (no estimates)
```

---

## 8. Advanced Planning Features

### 8.1 Bulk Operations

```typescript
// Select multiple issues
selectedIssues = signal<string[]>([]);

toggleIssueSelection(issueId: string) {
  const current = this.selectedIssues();
  if (current.includes(issueId)) {
    this.selectedIssues.set(current.filter(id => id !== issueId));
  } else {
    this.selectedIssues.set([...current, issueId]);
  }
}

// Bulk move to sprint
async bulkMoveToSprint(sprintId: string | null) {
  const updates = this.selectedIssues().map(id => ({
    id,
    data: {
      sprintId,
      isInBacklog: true
    }
  }));

  await this.issueService.batchUpdateIssues(updates);
  this.selectedIssues.set([]);
}

// Bulk update priority
async bulkUpdatePriority(priority: IssuePriority) {
  const updates = this.selectedIssues().map(id => ({
    id,
    data: { priority }
  }));

  await this.issueService.batchUpdateIssues(updates);
  this.selectedIssues.set([]);
}
```

### 8.2 Backlog Filters

```typescript
// Advanced filtering
filterConfig = signal({
  types: [] as IssueType[],
  priorities: [] as IssuePriority[],
  assignees: [] as string[],
  hasSubtasks: null as boolean | null,
  hasComments: null as boolean | null,
  overdue: false,
});

filteredBacklogIssues = computed(() => {
  let issues = this.backlogIssues();
  const config = this.filterConfig();

  // Type filter
  if (config.types.length > 0) {
    issues = issues.filter((i) => config.types.includes(i.type));
  }

  // Priority filter
  if (config.priorities.length > 0) {
    issues = issues.filter((i) => config.priorities.includes(i.priority));
  }

  // Assignee filter
  if (config.assignees.length > 0) {
    issues = issues.filter((i) => i.assigneeId && config.assignees.includes(i.assigneeId));
  }

  // Has subtasks
  if (config.hasSubtasks !== null) {
    issues = issues.filter((i) =>
      config.hasSubtasks
        ? i.subtasks && i.subtasks.length > 0
        : !i.subtasks || i.subtasks.length === 0,
    );
  }

  // Has comments
  if (config.hasComments !== null) {
    issues = issues.filter((i) =>
      config.hasComments
        ? i.comments && i.comments.length > 0
        : !i.comments || i.comments.length === 0,
    );
  }

  // Overdue
  if (config.overdue) {
    issues = issues.filter((i) => i.dueDate && new Date(i.dueDate) < new Date());
  }

  return issues;
});
```

### 8.3 Sprint Templates

```typescript
// Save sprint as template
async saveSprintTemplate(sprint: Sprint) {
  const template = {
    name: sprint.name,
    duration: this.calculateDuration(sprint),
    goal: sprint.goal,
    issueTypes: this.getSprintIssues(sprint.id).map(i => i.type),
    estimatedCapacity: this.getSprintCapacity(sprint).storyPoints
  };

  // Save to Firestore
  await this.sprintService.saveTemplate(template);
}

// Create sprint from template
async createSprintFromTemplate(templateId: string) {
  const template = await this.sprintService.getTemplate(templateId);

  const newSprint = {
    name: template.name,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + template.duration * 24 * 60 * 60 * 1000).toISOString(),
    goal: template.goal,
    status: 'future' as const
  };

  await this.sprintStore.addSprint(newSprint);
}
```

---

## 9. Common Scenarios

### 9.1 Scenario: Moving Issue Between Sprints

```typescript
// User drags issue from Sprint 2 to Sprint 3

// Before
{
  id: "issue_123",
  title: "Add payment gateway",
  sprintId: "sprint_2",
  isInBacklog: true,
  order: 3.0
}

// After drop event
drop(event) {
  // event.previousContainer.id = "sprint_2"
  // event.container.id = "sprint_3"

  this.issueService.updateIssue("issue_123", {
    sprintId: "sprint_3",
    isInBacklog: true,  // Still in planning
    order: 2.5  // New position in Sprint 3
  });
}

// Result
{
  id: "issue_123",
  title: "Add payment gateway",
  sprintId: "sprint_3",  // ← Changed
  isInBacklog: true,
  order: 2.5  // ← Changed
}
```

### 9.2 Scenario: Moving Issue from Sprint to Backlog

```typescript
// User drags issue from Sprint 3 back to Backlog

// Before
{
  id: "issue_456",
  title: "Refactor database",
  sprintId: "sprint_3",
  isInBacklog: true,
  order: 1.5
}

// After drop
{
  id: "issue_456",
  title: "Refactor database",
  sprintId: null,  // ← Removed from sprint
  isInBacklog: true,
  order: 5.0  // ← New position in backlog
}
```

### 9.3 Scenario: Creating Issue Directly in Sprint

```typescript
// User clicks "Create Issue" while viewing Sprint 3

createIssue(sprintId?: string) {
  const dialogRef = this.dialog.open(IssueDialog, {
    width: '600px',
    data: {
      statusColumnId: 'todo',
      sprintId: sprintId  // Pre-select sprint
    }
  });

  dialogRef.afterClosed().subscribe((result) => {
    if (result) {
      const newIssue = {
        ...result,
        sprintId: sprintId || null,  // Assign to sprint
        isInBacklog: true  // Always true when created
      };

      this.boardStore.addIssue(newIssue);
    }
  });
}
```

---

## 10. Troubleshooting

### 10.1 Issue: Issues not showing in backlog

**Symptoms:** Backlog appears empty despite having issues

**Debug:**

```typescript
// Check issue state
console.log('All issues:', this.boardStore.issues());

// Check filters
const backlogIssues = this.boardStore.issues().filter((i) => {
  console.log(`Issue ${i.key}:`, {
    isInBacklog: i.isInBacklog,
    isArchived: i.isArchived,
    sprintId: i.sprintId,
  });

  return i.isInBacklog === true && i.isArchived === false && i.sprintId === null;
});

console.log('Backlog issues:', backlogIssues);
```

**Solution:**

```typescript
// Ensure issues have correct flags
await this.issueService.updateIssue(issueId, {
  isInBacklog: true,
  isArchived: false,
  sprintId: null,
});
```

---

### 10.2 Issue: Issues appear in both backlog and board

**Symptoms:** Same issue visible in both views

**Cause:** `isInBacklog` flag not updated when starting sprint

**Solution:**

```typescript
// When starting sprint, ensure ALL issues updated
async startSprint(sprint: Sprint) {
  const issues = this.getSprintIssues(sprint.id);

  // Batch update all issues
  const updates = issues.map(issue => ({
    id: issue.id,
    data: { isInBacklog: false }  // ← Critical!
  }));

  await this.issueService.batchUpdateIssues(updates);

  // Then update sprint
  await this.sprintStore.updateSprint(sprint.id, {
    status: 'active'
  });
}
```

---

### 10.3 Issue: Drag & drop not working

**Symptoms:** Can't drag issues between lists

**Debug:**

```typescript
// Check CDK setup
<div cdkDropListGroup>  <!-- ← Must wrap all drop lists -->
  <div cdkDropList id="backlog">  <!-- ← Unique ID -->
    <div cdkDrag>  <!-- ← Draggable item -->
    </div>
  </div>
</div>

// Check event handler
drop(event: CdkDragDrop<Issue[]>) {
  console.log('Drop event:', event);
  console.log('Previous container:', event.previousContainer.id);
  console.log('Current container:', event.container.id);
}
```

**Solution:**

```typescript
// Ensure proper nesting and IDs
<div cdkDropListGroup>
  <div cdkDropList id="backlog" [cdkDropListData]="backlogIssues()">
    <div cdkDrag *ngFor="let issue of backlogIssues()">
      {{ issue.title }}
    </div>
  </div>

  <div cdkDropList [id]="sprint.id" [cdkDropListData]="getSprintIssues(sprint.id)">
    <div cdkDrag *ngFor="let issue of getSprintIssues(sprint.id)">
      {{ issue.title }}
    </div>
  </div>
</div>
```

---

### 10.4 Issue: Sprint issues not showing after creation

**Symptoms:** Issues assigned to sprint don't appear

**Debug:**

```typescript
// Check sprint ID
console.log('Sprint ID:', sprint.id);

// Check issue sprintId
console.log('Issue sprintId:', issue.sprintId);

// Check filter
const sprintIssues = this.boardStore.issues().filter((i) => {
  const match = i.sprintId === sprint.id;
  console.log(`Issue ${i.key} matches sprint ${sprint.id}:`, match);
  return match;
});
```

**Solution:**

```typescript
// Ensure sprintId is set correctly
await this.issueService.updateIssue(issueId, {
  sprintId: sprint.id, // ← Exact match
  isInBacklog: true,
});
```

---

## 📝 Summary

Backlog Planning Flow:

✅ **Separation**: Clear distinction between planning (backlog) and execution (board)
✅ **isInBacklog Flag**: Critical flag for phase separation
✅ **Drag & Drop**: Intuitive sprint assignment
✅ **Sprint Planning**: Structured workflow for planning sessions
✅ **Bulk Operations**: Efficient multi-issue management
✅ **Filters & Search**: Easy backlog navigation
✅ **Real-time Sync**: Firestore listeners for team collaboration

**Key Concepts:**

1. `isInBacklog: true` = Planning phase
2. `isInBacklog: false` = Execution phase
3. Drag & drop updates `sprintId`
4. Starting sprint updates `isInBacklog`
5. Completing sprint resets incomplete issues
6. Backlog is continuously refined

**Best Practices:**

- Refine backlog regularly
- Set clear sprint goals
- Estimate realistically
- Prioritize by value
- Keep top items detailed
- Don't overcommit

**State Transitions:**

```
Create → Backlog (isInBacklog: true, sprintId: null)
       ↓
Assign → Sprint (isInBacklog: true, sprintId: X)
       ↓
Start  → Board (isInBacklog: false, sprintId: X)
       ↓
Complete → Archive/Backlog
```
