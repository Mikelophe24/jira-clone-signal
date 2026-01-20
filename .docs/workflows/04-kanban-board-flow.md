# Luồng Kanban Board (Board Flow) - Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Kiến Trúc Board Component](#2-kiến-trúc-board-component)
3. [Drag & Drop System](#3-drag--drop-system)
4. [Fractional Ordering System](#4-fractional-ordering-system)
5. [Filter & Search](#5-filter--search)
6. [Only My Issues Toggle](#6-only-my-issues-toggle)
7. [Real-time Updates](#7-real-time-updates)
8. [Performance Optimization](#8-performance-optimization)
9. [Advanced Features](#9-advanced-features)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng Quan

### 1.1 Kanban Board Là Gì?

Kanban Board là **visual workflow management tool**:

- 📊 Hiển thị công việc dưới dạng cards
- 🔄 Workflow: TODO → IN PROGRESS → DONE
- 👁️ Team visibility: Ai đang làm gì
- 🚀 Pull-based system: Kéo công việc khi sẵn sàng

### 1.2 Board Structure

```
┌────────────────────────────────────────────────────────────────┐
│                        KANBAN BOARD                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │     TODO     │  │ IN PROGRESS  │  │     DONE     │         │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤         │
│  │              │  │              │  │              │         │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │         │
│  │  │ Issue  │  │  │  │ Issue  │  │  │  │ Issue  │  │         │
│  │  │  #1    │  │  │  │  #4    │  │  │  │  #7    │  │         │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │         │
│  │              │  │              │  │              │         │
│  │  ┌────────┐  │  │  ┌────────┐  │  │  ┌────────┐  │         │
│  │  │ Issue  │  │  │  │ Issue  │  │  │  │ Issue  │  │         │
│  │  │  #2    │  │  │  │  #5    │  │  │  │  #8    │  │         │
│  │  └────────┘  │  │  └────────┘  │  │  └────────┘  │         │
│  │              │  │              │  │              │         │
│  │  ┌────────┐  │  │  ┌────────┐  │  │              │         │
│  │  │ Issue  │  │  │  │ Issue  │  │  │              │         │
│  │  │  #3    │  │  │  │  #6    │  │  │              │         │
│  │  └────────┘  │  │  └────────┘  │  │              │         │
│  │              │  │              │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 1.3 Column Definitions

```typescript
const BOARD_COLUMNS = {
  TODO: {
    id: 'todo',
    name: 'To Do',
    description: 'Work not yet started',
    color: '#DFE1E6',
    limit: null, // No WIP limit
  },
  IN_PROGRESS: {
    id: 'in-progress',
    name: 'In Progress',
    description: 'Work currently being done',
    color: '#DEEBFF',
    limit: 5, // WIP limit (optional)
  },
  DONE: {
    id: 'done',
    name: 'Done',
    description: 'Completed work',
    color: '#E3FCEF',
    limit: null,
  },
};
```

### 1.4 Files Liên Quan

```
src/app/features/board/
├── board/
│   └── board.ts                    # Main board component
├── board.store.ts                  # State management
├── issue/
│   ├── issue.service.ts            # Issue CRUD operations
│   └── issue-dialog/
│       └── issue-dialog.ts         # Issue create/edit dialog
└── sprint.store.ts                 # Sprint state
```

---

## 2. Kiến Trúc Board Component

### 2.1 Component Structure

```typescript
// File: src/app/features/board/board/board.ts
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,      // Angular CDK Drag & Drop
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    FormsModule
  ],
  template: `...`,
  styles: [`...`]
})
export class Board implements OnInit {
  // Stores
  readonly store = inject(BoardStore);
  readonly sprintStore = inject(SprintStore);
  readonly projectsStore = inject(ProjectsStore);
  readonly authStore = inject(AuthStore);

  // Services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  // Local state
  searchQuery = signal('');

  ngOnInit() {
    // Load data when project changes
    this.route.parent?.paramMap.subscribe((params) => {
      const projectId = params.get('projectId');
      if (projectId) {
        this.store.loadIssues(projectId);
        this.sprintStore.loadSprints(projectId);
        this.projectsStore.selectProject(projectId);
      }
    });
  }

  // Methods
  onSearch(event: Event) { ... }
  toggleMyIssues() { ... }
  drop(event: CdkDragDrop<Issue[]>, newStatus: string) { ... }
  openIssueDialog(statusColumnId: string, issue?: Issue) { ... }
  deleteIssue(issueId: string) { ... }
}
```

### 2.2 Template Structure

```typescript
template: `
  <div class="board-container">
    <!-- Header with filters -->
    <div class="board-header">
      <h2>{{ sprintStore.activeSprint()?.name || 'Board' }}</h2>
      
      <!-- Search -->
      <mat-form-field>
        <input matInput 
               placeholder="Search issues..." 
               (input)="onSearch($event)" />
      </mat-form-field>
      
      <!-- Only My Issues Toggle -->
      <mat-slide-toggle (change)="toggleMyIssues()">
        Only My Issues
      </mat-slide-toggle>
    </div>
    
    <!-- Kanban Columns -->
    <div class="board-columns" cdkDropListGroup>
      <!-- TODO Column -->
      <div class="board-column">
        <div class="column-header">
          <h3>To Do ({{ store.todoIssues().length }})</h3>
          <button mat-icon-button (click)="openIssueDialog('todo')">
            <mat-icon>add</mat-icon>
          </button>
        </div>
        
        <div class="issue-list"
             cdkDropList
             [cdkDropListData]="store.todoIssues()"
             (cdkDropListDropped)="drop($event, 'todo')">
          
          @for (issue of store.todoIssues(); track issue.id) {
            <div class="issue-card" cdkDrag [cdkDragData]="issue">
              <!-- Issue content -->
            </div>
          }
        </div>
      </div>
      
      <!-- IN PROGRESS Column -->
      <div class="board-column">
        <!-- Similar structure -->
      </div>
      
      <!-- DONE Column -->
      <div class="board-column">
        <!-- Similar structure -->
      </div>
    </div>
  </div>
`;
```

### 2.3 BoardStore Computed Values

```typescript
// File: src/app/features/board/board.store.ts
withComputed(({ issues, filter }) => {
  const sprintStore = inject(SprintStore);

  // Filter issues
  const filteredIssues = computed(() => {
    let result = issues();

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      result = result.filter(
        (i) => i.title.toLowerCase().includes(query) || i.key.toLowerCase().includes(query),
      );
    }

    // Filter by assignee
    if (filter.assignee.length > 0) {
      result = result.filter((i) => filter.assignee.includes(i.assigneeId));
    }

    // Filter "Only My Issues"
    if (filter.onlyMyIssues && filter.userId) {
      result = result.filter((i) => i.assigneeId === filter.userId);
    }

    // Filter out backlog & archived
    result = result.filter((i) => !i.isInBacklog && !i.isArchived);

    // Filter by active sprint
    const activeSprint = sprintStore.activeSprint();
    if (activeSprint) {
      result = result.filter((i) => i.sprintId === activeSprint.id);
    }

    return result;
  });

  // Sort by order
  const sortedFilteredIssues = computed(() => {
    return [...filteredIssues()].sort((a, b) => a.order - b.order);
  });

  // Group by status
  return {
    todoIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'todo')),
    inProgressIssues: computed(() =>
      sortedFilteredIssues().filter((i) => i.statusColumnId === 'in-progress'),
    ),
    doneIssues: computed(() => sortedFilteredIssues().filter((i) => i.statusColumnId === 'done')),
  };
});
```

---

## 3. Drag & Drop System

### 3.1 Angular CDK Drag & Drop

**Setup:**

```typescript
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
```

**Template:**

```html
<!-- Container group - allows dragging between lists -->
<div cdkDropListGroup>
  <!-- Drop list (column) -->
  <div cdkDropList [cdkDropListData]="todoIssues()" (cdkDropListDropped)="drop($event, 'todo')">
    <!-- Draggable item (issue card) -->
    <div cdkDrag [cdkDragData]="issue">
      <!-- Card content -->
    </div>
  </div>
</div>
```

### 3.2 Drag & Drop Flow Diagram

```
User Action                    CDK Event                  Store Update
─────────────────────────────────────────────────────────────────────

1. User grabs issue card
   │
   ├─> cdkDragStarted
   │   └─> Visual feedback (card lifts)
   │
2. User drags over column
   │
   ├─> cdkDragMoved
   │   └─> Preview position shown
   │
3. User releases card
   │
   ├─> cdkDropListDropped
   │   │
   │   ├─> Check: Same column?
   │   │   │
   │   │   ├─> YES: Reorder
   │   │   │   └─> moveItemInArray()
   │   │   │
   │   │   └─> NO: Transfer
   │   │       └─> transferArrayItem()
   │   │
   │   ├─> Calculate new order
   │   │   └─> Fractional ordering
   │   │
   │   └─> Update Firestore
   │       │
   │       ├─> updateIssue({
   │       │     statusColumnId: newStatus,
   │       │     order: newOrder
   │       │   })
   │       │
   │       └─> Firestore listener
   │           └─> UI updates
```

### 3.3 Drop Handler Implementation

```typescript
// File: src/app/features/board/board/board.ts
drop(event: CdkDragDrop<Issue[]>, newStatus: string) {
  // Delegate to BoardStore
  this.store.moveIssue(event, newStatus);
}
```

```typescript
// File: src/app/features/board/board.store.ts
moveIssue: (event: CdkDragDrop<Issue[]>, newStatus: string) => {
  const issue = event.item.data as Issue;

  // CASE 1: Same column (reorder)
  if (event.previousContainer === event.container) {
    // Visual update
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);

    // Calculate new order
    const newOrder = calculateOrder(event.container.data, event.currentIndex);

    // Update Firestore
    issueService.updateIssue(issue.id, { order: newOrder });
  }

  // CASE 2: Different column (transfer)
  else {
    // Visual update
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    // Calculate new order in target column
    const targetIssues = getIssuesByStatus(newStatus);
    const newOrder = calculateOrder(targetIssues, event.currentIndex);

    // Update Firestore
    issueService.updateIssue(issue.id, {
      statusColumnId: newStatus,
      order: newOrder,
    });
  }
};
```

### 3.4 Visual Feedback

```scss
// Drag styles
.issue-card {
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  // While dragging
  &.cdk-drag-dragging {
    opacity: 0.8;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    transform: rotate(2deg);
    cursor: grabbing;
  }

  // Placeholder where card was
  &.cdk-drag-placeholder {
    opacity: 0.3;
    border: 2px dashed #ccc;
  }
}

// Drop zone
.issue-list {
  min-height: 100px;

  // When dragging over
  &.cdk-drop-list-dragging {
    background: rgba(0, 0, 0, 0.02);
  }
}

// Preview (ghost card following cursor)
.cdk-drag-preview {
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
  opacity: 0.9;
}
```

---

## 4. Fractional Ordering System

### 4.1 Why Fractional Ordering?

**Problem with Integer Ordering:**

```typescript
// Issues with order: 1, 2, 3, 4, 5
// Want to insert between 2 and 3?
// Must update: 3→4, 4→5, 5→6, etc.
// = N database writes!
```

**Solution: Fractional Ordering:**

```typescript
// Issues with order: 1.0, 2.0, 3.0, 4.0, 5.0
// Want to insert between 2.0 and 3.0?
// New order: 2.5
// = 1 database write!
```

### 4.2 Order Calculation Algorithm

```typescript
// File: src/app/features/board/board.store.ts
function calculateOrder(issues: Issue[], targetIndex: number): number {
  // CASE 1: Empty list
  if (issues.length === 0) {
    return 1.0;
  }

  // CASE 2: Insert at beginning
  if (targetIndex === 0) {
    const firstOrder = issues[0].order;
    return firstOrder - 1.0;
  }

  // CASE 3: Insert at end
  if (targetIndex >= issues.length) {
    const lastOrder = issues[issues.length - 1].order;
    return lastOrder + 1.0;
  }

  // CASE 4: Insert in middle
  const prevOrder = issues[targetIndex - 1].order;
  const nextOrder = issues[targetIndex].order;
  return (prevOrder + nextOrder) / 2.0;
}
```

### 4.3 Detailed Examples

#### Example 1: Insert at Beginning

```typescript
// Current issues
[
  { id: 'A', order: 1.0 },
  { id: 'B', order: 2.0 },
  { id: 'C', order: 3.0 }
]

// Drop issue 'X' at index 0
targetIndex = 0
firstOrder = 1.0
newOrder = 1.0 - 1.0 = 0.0

// Result
[
  { id: 'X', order: 0.0 },  // ← New
  { id: 'A', order: 1.0 },
  { id: 'B', order: 2.0 },
  { id: 'C', order: 3.0 }
]
```

#### Example 2: Insert at End

```typescript
// Current issues
[
  { id: 'A', order: 1.0 },
  { id: 'B', order: 2.0 },
  { id: 'C', order: 3.0 }
]

// Drop issue 'X' at end
targetIndex = 3
lastOrder = 3.0
newOrder = 3.0 + 1.0 = 4.0

// Result
[
  { id: 'A', order: 1.0 },
  { id: 'B', order: 2.0 },
  { id: 'C', order: 3.0 },
  { id: 'X', order: 4.0 }  // ← New
]
```

#### Example 3: Insert in Middle

```typescript
// Current issues
[
  { id: 'A', order: 1.0 },
  { id: 'B', order: 2.0 },
  { id: 'C', order: 3.0 }
]

// Drop issue 'X' between B and C (index 2)
targetIndex = 2
prevOrder = 2.0  // B's order
nextOrder = 3.0  // C's order
newOrder = (2.0 + 3.0) / 2.0 = 2.5

// Result
[
  { id: 'A', order: 1.0 },
  { id: 'B', order: 2.0 },
  { id: 'X', order: 2.5 },  // ← New
  { id: 'C', order: 3.0 }
]
```

#### Example 4: Multiple Inserts

```typescript
// Start
[
  { id: 'A', order: 1.0 },
  { id: 'B', order: 2.0 }
]

// Insert X between A and B
newOrder = (1.0 + 2.0) / 2 = 1.5
[
  { id: 'A', order: 1.0 },
  { id: 'X', order: 1.5 },
  { id: 'B', order: 2.0 }
]

// Insert Y between A and X
newOrder = (1.0 + 1.5) / 2 = 1.25
[
  { id: 'A', order: 1.0 },
  { id: 'Y', order: 1.25 },
  { id: 'X', order: 1.5 },
  { id: 'B', order: 2.0 }
]

// Insert Z between Y and X
newOrder = (1.25 + 1.5) / 2 = 1.375
[
  { id: 'A', order: 1.0 },
  { id: 'Y', order: 1.25 },
  { id: 'Z', order: 1.375 },
  { id: 'X', order: 1.5 },
  { id: 'B', order: 2.0 }
]
```

### 4.4 Precision Issues & Rebalancing

**Problem:** After many inserts, numbers become very small

```typescript
// After 50+ inserts
{ id: 'A', order: 1.0000000000000001 }
{ id: 'B', order: 1.0000000000000002 }
// JavaScript floating point precision issues!
```

**Solution:** Rebalance periodically

```typescript
async rebalanceOrders(columnId: string) {
  const issues = this.getIssuesByStatus(columnId);

  // Reassign orders: 1, 2, 3, 4, ...
  const updates = issues.map((issue, index) => ({
    id: issue.id,
    data: { order: index + 1 }
  }));

  await this.issueService.batchUpdateIssues(updates);
}

// Trigger rebalance when needed
if (Math.abs(prevOrder - nextOrder) < 0.0001) {
  await this.rebalanceOrders(newStatus);
  // Then recalculate order
}
```

---

## 5. Filter & Search

### 5.1 Search Implementation

```typescript
// File: src/app/features/board/board/board.ts
searchQuery = signal('');

onSearch(event: Event) {
  const input = event.target as HTMLInputElement;
  const query = input.value;

  this.store.updateFilter({
    searchQuery: query
  });
}
```

**Template:**

```html
<mat-form-field class="search-field">
  <mat-icon matPrefix>search</mat-icon>
  <input
    matInput
    placeholder="Search by title or key..."
    (input)="onSearch($event)"
    [value]="searchQuery()"
  />

  @if (searchQuery()) {
  <button matSuffix mat-icon-button (click)="clearSearch()">
    <mat-icon>close</mat-icon>
  </button>
  }
</mat-form-field>
```

### 5.2 Filter Logic in Store

```typescript
// File: src/app/features/board/board.store.ts
updateFilter: (newFilter: Partial<BoardFilter>) => {
  patchState(store, {
    filter: {
      ...store.filter(),
      ...newFilter,
    },
  });
};
```

**Filter State:**

```typescript
type BoardFilter = {
  searchQuery: string;
  onlyMyIssues: boolean;
  userId: string | null;
  assignee: string[];
  status: string[];
  priority: string[];
};
```

### 5.3 Advanced Filters

```typescript
// File: src/app/features/board/board/board.ts
@Component({
  template: `
    <!-- Filter Panel -->
    <mat-expansion-panel>
      <mat-expansion-panel-header>
        <mat-icon>filter_list</mat-icon>
        Filters
      </mat-expansion-panel-header>

      <!-- Assignee Filter -->
      <mat-form-field>
        <mat-label>Assignee</mat-label>
        <mat-select multiple [(value)]="selectedAssignees" (selectionChange)="onAssigneeChange()">
          @for (member of projectsStore.members(); track member.uid) {
            <mat-option [value]="member.uid">
              {{ member.displayName }}
            </mat-option>
          }
        </mat-select>
      </mat-form-field>

      <!-- Priority Filter -->
      <mat-form-field>
        <mat-label>Priority</mat-label>
        <mat-select multiple [(value)]="selectedPriorities" (selectionChange)="onPriorityChange()">
          <mat-option value="high">High</mat-option>
          <mat-option value="medium">Medium</mat-option>
          <mat-option value="low">Low</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Type Filter -->
      <mat-form-field>
        <mat-label>Type</mat-label>
        <mat-select multiple [(value)]="selectedTypes" (selectionChange)="onTypeChange()">
          <mat-option value="story">Story</mat-option>
          <mat-option value="bug">Bug</mat-option>
          <mat-option value="task">Task</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Clear Filters -->
      <button mat-button (click)="clearAllFilters()">Clear All Filters</button>
    </mat-expansion-panel>
  `,
})
export class Board {
  selectedAssignees: string[] = [];
  selectedPriorities: string[] = [];
  selectedTypes: string[] = [];

  onAssigneeChange() {
    this.store.updateFilter({
      assignee: this.selectedAssignees,
    });
  }

  onPriorityChange() {
    this.store.updateFilter({
      priority: this.selectedPriorities,
    });
  }

  onTypeChange() {
    this.store.updateFilter({
      type: this.selectedTypes,
    });
  }

  clearAllFilters() {
    this.selectedAssignees = [];
    this.selectedPriorities = [];
    this.selectedTypes = [];

    this.store.updateFilter({
      searchQuery: '',
      assignee: [],
      priority: [],
      type: [],
      onlyMyIssues: false,
    });
  }
}
```

### 5.4 Filter Computed Logic

```typescript
// File: src/app/features/board/board.store.ts
const filteredIssues = computed(() => {
  let issues = store.issues();
  const filter = store.filter();

  // 1. Search query
  if (filter.searchQuery) {
    const query = filter.searchQuery.toLowerCase();
    issues = issues.filter(
      (i) =>
        i.title.toLowerCase().includes(query) ||
        i.key.toLowerCase().includes(query) ||
        i.description?.toLowerCase().includes(query),
    );
  }

  // 2. Assignee filter
  if (filter.assignee.length > 0) {
    issues = issues.filter((i) => i.assigneeId && filter.assignee.includes(i.assigneeId));
  }

  // 3. Priority filter
  if (filter.priority.length > 0) {
    issues = issues.filter((i) => filter.priority.includes(i.priority));
  }

  // 4. Type filter
  if (filter.type && filter.type.length > 0) {
    issues = issues.filter((i) => filter.type.includes(i.type));
  }

  // 5. Status filter (if needed)
  if (filter.status.length > 0) {
    issues = issues.filter((i) => filter.status.includes(i.statusColumnId));
  }

  // 6. Only My Issues
  if (filter.onlyMyIssues && filter.userId) {
    issues = issues.filter((i) => i.assigneeId === filter.userId);
  }

  // 7. Exclude backlog & archived
  issues = issues.filter((i) => !i.isInBacklog && !i.isArchived);

  // 8. Active sprint only
  const activeSprint = sprintStore.activeSprint();
  if (activeSprint) {
    issues = issues.filter((i) => i.sprintId === activeSprint.id);
  }

  return issues;
});
```

---

## 6. Only My Issues Toggle

### 6.1 Implementation

```typescript
// File: src/app/features/board/board/board.ts
toggleMyIssues() {
  const currentValue = this.store.filter().onlyMyIssues;
  const userId = this.authStore.user()?.uid;

  this.store.updateFilter({
    onlyMyIssues: !currentValue,
    userId: userId || null
  });
}
```

**Template:**

```html
<mat-slide-toggle [checked]="store.filter().onlyMyIssues" (change)="toggleMyIssues()">
  <mat-icon>person</mat-icon>
  Only My Issues
</mat-slide-toggle>
```

### 6.2 Visual Indicator

```html
<!-- Show active filter count -->
<div class="filter-summary">
  @if (activeFilterCount() > 0) {
  <mat-chip-set>
    @if (store.filter().onlyMyIssues) {
    <mat-chip (removed)="toggleMyIssues()">
      Only My Issues
      <mat-icon matChipRemove>cancel</mat-icon>
    </mat-chip>
    } @if (store.filter().searchQuery) {
    <mat-chip (removed)="clearSearch()">
      Search: "{{ store.filter().searchQuery }}"
      <mat-icon matChipRemove>cancel</mat-icon>
    </mat-chip>
    } @for (assigneeId of store.filter().assignee; track assigneeId) {
    <mat-chip (removed)="removeAssigneeFilter(assigneeId)">
      {{ getAssigneeName(assigneeId) }}
      <mat-icon matChipRemove>cancel</mat-icon>
    </mat-chip>
    }
  </mat-chip-set>
  }
</div>
```

```typescript
activeFilterCount = computed(() => {
  const filter = this.store.filter();
  let count = 0;

  if (filter.searchQuery) count++;
  if (filter.onlyMyIssues) count++;
  if (filter.assignee.length > 0) count += filter.assignee.length;
  if (filter.priority.length > 0) count += filter.priority.length;
  if (filter.type && filter.type.length > 0) count += filter.type.length;

  return count;
});
```

---

## 7. Real-time Updates

### 7.1 Firestore Listener

```typescript
// File: src/app/features/board/board.store.ts
loadIssues: rxMethod<string | null>(
  pipe(
    tap(() => store.setLoading(true)),
    switchMap((projectId) => {
      if (!projectId) {
        patchState(store, { issues: [] });
        return of([]);
      }

      // Real-time query
      const issuesRef = collection(firestore, 'issues');
      const q = query(issuesRef, where('projectId', '==', projectId), orderBy('order', 'asc'));

      // Subscribe to real-time updates
      return collectionData(q, { idField: 'id' }).pipe(
        tap((issues) => {
          patchState(store, { issues });
          store.setLoading(false);
        }),
        catchError((error) => {
          errorService.showError('Failed to load issues');
          return of([]);
        }),
      );
    }),
  ),
);
```

### 7.2 Optimistic Updates

```typescript
// Update UI immediately, then sync with server
moveIssue: (event: CdkDragDrop<Issue[]>, newStatus: string) => {
  const issue = event.item.data as Issue;

  // 1. OPTIMISTIC: Update UI immediately
  if (event.previousContainer === event.container) {
    moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
  } else {
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
  }

  // 2. Calculate new order
  const newOrder = calculateOrder(event.container.data, event.currentIndex);

  // 3. PERSISTENCE: Update Firestore
  issueService
    .updateIssue(issue.id, {
      statusColumnId: newStatus,
      order: newOrder,
    })
    .catch((error) => {
      // 4. ROLLBACK: If fails, revert UI
      errorService.showError('Failed to move issue');
      // Reload issues to get correct state
      store.loadIssues(issue.projectId);
    });
};
```

### 7.3 Conflict Resolution

**Scenario:** Two users drag same issue simultaneously

```typescript
// User A: Drags issue to "In Progress"
// User B: Drags same issue to "Done"

// Firestore handles this with "last write wins"
// Both users see the final state via listener

// To prevent conflicts:
// 1. Show who is editing (presence system)
// 2. Lock issues during drag (advanced)
// 3. Show conflict notification
```

---

## 8. Performance Optimization

### 8.1 Virtual Scrolling

For boards with 100+ issues:

```typescript
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="100" class="issue-list">
      <div *cdkVirtualFor="let issue of todoIssues()"
           class="issue-card"
           cdkDrag>
        <!-- Issue content -->
      </div>
    </cdk-virtual-scroll-viewport>
  `
})
```

### 8.2 Track By Function

```typescript
// Efficient rendering
@for (issue of todoIssues(); track issue.id) {
  <div class="issue-card">{{ issue.title }}</div>
}

// Instead of:
@for (issue of todoIssues(); track $index) {
  // Re-renders all items on any change
}
```

### 8.3 Lazy Loading Images

```typescript
<img [src]="issue.assignee?.photoURL"
     loading="lazy"
     [alt]="issue.assignee?.displayName" />
```

### 8.4 Debounce Search

```typescript
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

searchQuery$ = new Subject<string>();

ngOnInit() {
  this.searchQuery$.pipe(
    debounceTime(300),  // Wait 300ms after typing stops
    distinctUntilChanged()  // Only if value changed
  ).subscribe(query => {
    this.store.updateFilter({ searchQuery: query });
  });
}

onSearch(event: Event) {
  const input = event.target as HTMLInputElement;
  this.searchQuery$.next(input.value);
}
```

### 8.5 Memoization

```typescript
// Cache expensive computations
private assigneeCache = new Map<string, AppUser>();

getAssignee(assigneeId: string): AppUser | undefined {
  if (this.assigneeCache.has(assigneeId)) {
    return this.assigneeCache.get(assigneeId);
  }

  const assignee = this.projectsStore.members().find(
    m => m.uid === assigneeId
  );

  if (assignee) {
    this.assigneeCache.set(assigneeId, assignee);
  }

  return assignee;
}
```

---

## 9. Advanced Features

### 9.1 Keyboard Shortcuts

```typescript
@HostListener('window:keydown', ['$event'])
handleKeyboardEvent(event: KeyboardEvent) {
  // Ctrl/Cmd + K: Focus search
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    this.searchInput.nativeElement.focus();
  }

  // Ctrl/Cmd + N: Create new issue
  if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
    event.preventDefault();
    this.openIssueDialog('todo');
  }

  // Escape: Clear filters
  if (event.key === 'Escape') {
    this.clearAllFilters();
  }
}
```

### 9.2 Bulk Operations

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

// Bulk move
async bulkMove(targetStatus: string) {
  const updates = this.selectedIssues().map(id => ({
    id,
    data: { statusColumnId: targetStatus }
  }));

  await this.issueService.batchUpdateIssues(updates);
  this.selectedIssues.set([]);
}

// Bulk delete
async bulkDelete() {
  if (confirm(`Delete ${this.selectedIssues().length} issues?`)) {
    for (const id of this.selectedIssues()) {
      await this.issueService.deleteIssue(id);
    }
    this.selectedIssues.set([]);
  }
}
```

### 9.3 Column Customization

```typescript
// Customize column names, colors, limits
columnConfig = signal({
  todo: {
    name: 'To Do',
    color: '#DFE1E6',
    limit: null
  },
  'in-progress': {
    name: 'In Progress',
    color: '#DEEBFF',
    limit: 5  // WIP limit
  },
  done: {
    name: 'Done',
    color: '#E3FCEF',
    limit: null
  }
});

// Check WIP limit
canDropInColumn(columnId: string, currentCount: number): boolean {
  const limit = this.columnConfig()[columnId].limit;
  return limit === null || currentCount < limit;
}
```

### 9.4 Swimlanes

```typescript
// Group issues by assignee
swimlanes = computed(() => {
  const issues = this.store.filteredIssues();
  const grouped = new Map<string, Issue[]>();

  issues.forEach((issue) => {
    const key = issue.assigneeId || 'unassigned';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(issue);
  });

  return grouped;
});
```

**Template:**

```html
@for (swimlane of swimlanes() | keyvalue; track swimlane.key) {
<div class="swimlane">
  <h3>{{ getAssigneeName(swimlane.key) }}</h3>

  <div class="swimlane-columns">
    <!-- TODO column for this assignee -->
    <div class="column">
      @for (issue of getIssuesByStatus(swimlane.value, 'todo'); track issue.id) {
      <div class="issue-card">...</div>
      }
    </div>

    <!-- IN PROGRESS column -->
    <!-- DONE column -->
  </div>
</div>
}
```

---

## 10. Troubleshooting

### 10.1 Issue: Drag not working

**Symptoms:** Can't drag issue cards

**Debug:**

```typescript
// Check if DragDropModule imported
imports: [DragDropModule]

// Check cdkDrag directive
<div cdkDrag>...</div>

// Check cdkDropList
<div cdkDropList>...</div>

// Check cdkDropListGroup
<div cdkDropListGroup>...</div>
```

**Solution:**

```typescript
// Ensure proper nesting
<div cdkDropListGroup>
  <div cdkDropList>
    <div cdkDrag>
      <!-- Content -->
    </div>
  </div>
</div>
```

---

### 10.2 Issue: Order not updating

**Symptoms:** Issues jump back to original position

**Debug:**

```typescript
// Check Firestore update
console.log('Updating issue:', issueId, 'with order:', newOrder);

// Check listener
this.store.issues().subscribe((issues) => {
  console.log('Issues updated:', issues);
});
```

**Solution:**

```typescript
// Ensure order is saved to Firestore
await this.issueService.updateIssue(issue.id, {
  order: newOrder,
  updatedAt: new Date().toISOString(),
});
```

---

### 10.3 Issue: Filters not working

**Symptoms:** All issues shown despite filters

**Debug:**

```typescript
// Check filter state
console.log('Current filter:', this.store.filter());

// Check filtered issues
console.log('Filtered issues:', this.store.filteredIssues());

// Check computed logic
const filtered = computed(() => {
  console.log('Computing filtered issues...');
  // ... filter logic
});
```

**Solution:**

```typescript
// Ensure filter is applied in computed
filteredIssues = computed(() => {
  let issues = store.issues();
  const filter = store.filter();

  // Apply each filter
  if (filter.searchQuery) {
    issues = issues.filter(...);
  }

  return issues;
});
```

---

### 10.4 Issue: Performance slow with many issues

**Symptoms:** Lag when dragging, slow rendering

**Solutions:**

1. **Virtual Scrolling:**

```typescript
<cdk-virtual-scroll-viewport itemSize="100">
  <div *cdkVirtualFor="let issue of issues()">
    ...
  </div>
</cdk-virtual-scroll-viewport>
```

2. **Pagination:**

```typescript
pageSize = 50;
currentPage = 0;

paginatedIssues = computed(() => {
  const start = this.currentPage * this.pageSize;
  return this.filteredIssues().slice(start, start + this.pageSize);
});
```

3. **Lazy Loading:**

```typescript
// Load issues on scroll
@HostListener('scroll', ['$event'])
onScroll(event: any) {
  const threshold = 100;
  const position = event.target.scrollTop + event.target.offsetHeight;
  const height = event.target.scrollHeight;

  if (position > height - threshold) {
    this.loadMoreIssues();
  }
}
```

---

### 10.5 Issue: Duplicate issues after drag

**Symptoms:** Issue appears in both columns

**Cause:** Optimistic update + listener conflict

**Solution:**

```typescript
// Use transaction for atomic updates
async moveIssue(issueId: string, newStatus: string, newOrder: number) {
  const issueRef = doc(this.firestore, 'issues', issueId);

  await runTransaction(this.firestore, async (transaction) => {
    const issueDoc = await transaction.get(issueRef);

    if (!issueDoc.exists()) {
      throw new Error('Issue does not exist');
    }

    transaction.update(issueRef, {
      statusColumnId: newStatus,
      order: newOrder,
      updatedAt: new Date().toISOString()
    });
  });
}
```

---

## 📝 Summary

Kanban Board Flow:

✅ **Drag & Drop**: Angular CDK cho smooth interactions
✅ **Fractional Ordering**: Efficient reordering without cascade updates
✅ **Filters**: Search, assignee, priority, type filters
✅ **Only My Issues**: Quick toggle cho personal view
✅ **Real-time**: Firestore listeners cho instant sync
✅ **Optimistic Updates**: Immediate UI feedback
✅ **Performance**: Virtual scrolling, debouncing, memoization
✅ **Advanced**: Keyboard shortcuts, bulk operations, swimlanes

**Key Concepts:**

1. CDK Drag & Drop cho visual feedback
2. Fractional ordering cho efficient reordering
3. Computed signals cho reactive filtering
4. Real-time listeners cho collaboration
5. Optimistic updates cho better UX
6. Performance optimization cho scalability

**Best Practices:**

- Use track by for efficient rendering
- Debounce search input
- Implement virtual scrolling for large lists
- Cache expensive computations
- Handle conflicts gracefully
- Provide visual feedback during operations
