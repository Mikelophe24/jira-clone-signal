# Kiến Trúc & Design Patterns - Jira Clone

## 📋 Mục Lục

1. [Architectural Overview](#1-architectural-overview)
2. [Design Patterns](#2-design-patterns)
3. [State Management Strategy](#3-state-management-strategy)
4. [Component Communication](#4-component-communication)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Scalability Considerations](#6-scalability-considerations)

---

## 1. Architectural Overview

### 1.1. Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                     │
│  (Components, Templates, Styles)                        │
│  - Hiển thị UI                                          │
│  - Xử lý user interactions                              │
│  - Không chứa business logic                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  STATE MANAGEMENT LAYER                  │
│  (Stores - AuthStore, ProjectsStore, BoardStore)       │
│  - Quản lý application state                            │
│  - Computed signals cho derived state                   │
│  - Business logic                                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                        │
│  (Services - AuthService, ProjectsService, IssueService)│
│  - API calls                                            │
│  - Data transformation                                  │
│  - Firebase integration                                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                      DATA LAYER                          │
│  (Firebase - Firestore, Authentication)                 │
│  - Data persistence                                     │
│  - Real-time synchronization                            │
│  - Security rules                                       │
└─────────────────────────────────────────────────────────┘
```

### 1.2. Feature-Based Structure

```
app/
├── core/                    # Singleton services, guards, interceptors
│   ├── auth/               # Authentication logic
│   ├── models/             # Shared interfaces
│   └── utils/              # Helper functions
│
├── features/               # Feature modules
│   ├── auth/              # Login/Register
│   ├── projects/          # Project management
│   ├── board/             # Kanban board
│   └── issue/             # Issue management
│
└── shared/                # Shared components, directives, pipes
    ├── components/        # Reusable UI components
    ├── directives/        # Custom directives
    └── pipes/             # Custom pipes
```

**Lợi ích:**

- ✅ **Modularity**: Mỗi feature độc lập
- ✅ **Scalability**: Dễ thêm features mới
- ✅ **Maintainability**: Dễ tìm và sửa code
- ✅ **Team Collaboration**: Nhiều người làm song song

### 1.3. Dependency Injection Hierarchy

```
Root Injector (providedIn: 'root')
├── AuthStore (Singleton)
├── ProjectsStore (Singleton)
├── BoardStore (Singleton)
├── AuthService (Singleton)
├── ProjectsService (Singleton)
└── IssueService (Singleton)

Component Injector (per component instance)
├── Component-specific services
└── Local state (if any)
```

**Tại sao dùng Singleton?**

- ✅ Share state across entire app
- ✅ Single source of truth
- ✅ Memory efficient

---

## 2. Design Patterns

### 2.1. Repository Pattern

**Mục đích:** Tách biệt data access logic khỏi business logic

**Implementation:**

```typescript
// Abstract repository interface
export interface Repository<T> {
  getAll(): Observable<T[]>;
  getById(id: string): Observable<T | null>;
  create(item: Partial<T>): Promise<string>;
  update(id: string, item: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

// Firestore implementation
export class FirestoreRepository<T> implements Repository<T> {
  constructor(private firestore: Firestore, private collectionName: string) {}

  getAll(): Observable<T[]> {
    const ref = collection(this.firestore, this.collectionName);
    return collectionData(ref, { idField: 'id' }) as Observable<T[]>;
  }

  getById(id: string): Observable<T | null> {
    const docRef = doc(this.firestore, this.collectionName, id);
    return docData(docRef, { idField: 'id' }) as Observable<T | null>;
  }

  async create(item: Partial<T>): Promise<string> {
    const ref = collection(this.firestore, this.collectionName);
    const docRef = await addDoc(ref, item);
    return docRef.id;
  }

  async update(id: string, item: Partial<T>): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await updateDoc(docRef, item);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, id);
    await deleteDoc(docRef);
  }
}

// Usage in service
@Injectable({ providedIn: 'root' })
export class IssueService {
  private repository: Repository<Issue>;

  constructor(firestore: Firestore) {
    this.repository = new FirestoreRepository<Issue>(firestore, 'issues');
  }

  getIssues(projectId: string): Observable<Issue[]> {
    // Add custom logic on top of repository
    return this.repository
      .getAll()
      .pipe(map((issues) => issues.filter((i) => i.projectId === projectId)));
  }
}
```

**Lợi ích:**

- ✅ Dễ thay đổi database (Firestore → PostgreSQL)
- ✅ Dễ test (mock repository)
- ✅ Reusable code

### 2.2. Facade Pattern

**Mục đích:** Cung cấp interface đơn giản cho hệ thống phức tạp

**Implementation:**

```typescript
// Complex subsystems
class AuthService { ... }
class UserService { ... }
class ProjectsService { ... }

// Facade
@Injectable({ providedIn: 'root' })
export class AppFacade {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private projectsService = inject(ProjectsService);

  // Simplified API
  async loginAndLoadUserData(email: string, password: string) {
    // 1. Login
    await this.authService.loginWithEmail(email, password);

    // 2. Get user
    const user = await this.authService.getCurrentUser();

    // 3. Load user profile
    const profile = await this.userService.getUserProfile(user.uid);

    // 4. Load projects
    const projects = await this.projectsService.getProjects(user.uid);

    return { user, profile, projects };
  }

  async createProjectWithDefaults(name: string) {
    const user = await this.authService.getCurrentUser();

    // Create project with default settings
    const projectId = await this.projectsService.createProject({
      name,
      key: this.generateKey(name),
      ownerId: user.uid,
      memberIds: [user.uid],
    });

    // Create default board
    await this.boardService.createBoard({
      projectId,
      name: 'Main Board',
      columns: ['todo', 'in-progress', 'done'],
    });

    return projectId;
  }

  private generateKey(name: string): string {
    return name.toUpperCase().replace(/\s+/g, '').slice(0, 5);
  }
}
```

**Lợi ích:**

- ✅ Giảm complexity cho components
- ✅ Encapsulate business logic
- ✅ Easier to use

### 2.3. Observer Pattern (Signals)

**Mục đích:** Tự động notify khi state thay đổi

**Implementation:**

```typescript
// Signal = Observable + Current Value
export const BoardStore = signalStore(
  withState({ issues: [] }),

  withComputed(({ issues }) => ({
    // Observers: Automatically re-compute when issues change
    todoIssues: computed(() => issues().filter((i) => i.status === 'todo')),

    issueCount: computed(() => issues().length),

    hasIssues: computed(() => issues().length > 0),
  }))
);

// Component automatically re-renders when signals change
@Component({
  template: `
    <p>Total: {{ store.issueCount() }}</p>

    @if (store.hasIssues()) { @for (issue of store.todoIssues(); track issue.id) {
    <div>{{ issue.title }}</div>
    } }
  `,
})
export class Board {
  store = inject(BoardStore);
}
```

**So sánh với RxJS:**

| Aspect         | Signals      | RxJS               |
| -------------- | ------------ | ------------------ |
| Syntax         | `value()`    | `value$ \| async`  |
| Memory         | Auto cleanup | Manual unsubscribe |
| Performance    | Fine-grained | Zone-based         |
| Learning curve | Easy         | Hard               |

### 2.4. Strategy Pattern (Filtering)

**Mục đích:** Cho phép thay đổi algorithm runtime

**Implementation:**

```typescript
// Strategy interface
interface FilterStrategy {
  filter(issues: Issue[]): Issue[];
}

// Concrete strategies
class PriorityFilterStrategy implements FilterStrategy {
  constructor(private priorities: string[]) {}

  filter(issues: Issue[]): Issue[] {
    if (this.priorities.length === 0) return issues;
    return issues.filter((i) => this.priorities.includes(i.priority));
  }
}

class AssigneeFilterStrategy implements FilterStrategy {
  constructor(private assignees: string[]) {}

  filter(issues: Issue[]): Issue[] {
    if (this.assignees.length === 0) return issues;
    return issues.filter((i) => i.assigneeId && this.assignees.includes(i.assigneeId));
  }
}

class SearchFilterStrategy implements FilterStrategy {
  constructor(private query: string) {}

  filter(issues: Issue[]): Issue[] {
    if (!this.query) return issues;
    const q = this.query.toLowerCase();
    return issues.filter(
      (i) => i.title.toLowerCase().includes(q) || i.key.toLowerCase().includes(q)
    );
  }
}

// Context
class IssueFilterContext {
  private strategies: FilterStrategy[] = [];

  addStrategy(strategy: FilterStrategy) {
    this.strategies.push(strategy);
  }

  filter(issues: Issue[]): Issue[] {
    return this.strategies.reduce((filtered, strategy) => strategy.filter(filtered), issues);
  }
}

// Usage
const context = new IssueFilterContext();
context.addStrategy(new PriorityFilterStrategy(['high']));
context.addStrategy(new AssigneeFilterStrategy(['user123']));
context.addStrategy(new SearchFilterStrategy('bug'));

const filtered = context.filter(allIssues);
```

### 2.5. Command Pattern (Undo/Redo)

**Mục đích:** Encapsulate actions as objects

**Implementation:**

```typescript
// Command interface
interface Command {
  execute(): void;
  undo(): void;
}

// Concrete commands
class MoveIssueCommand implements Command {
  private oldStatus: string;

  constructor(private store: BoardStore, private issueId: string, private newStatus: string) {
    const issue = store.issues().find((i) => i.id === issueId);
    this.oldStatus = issue?.statusColumnId || '';
  }

  execute() {
    this.store.updateIssue(this.issueId, {
      statusColumnId: this.newStatus,
    });
  }

  undo() {
    this.store.updateIssue(this.issueId, {
      statusColumnId: this.oldStatus,
    });
  }
}

class UpdateIssueTitleCommand implements Command {
  private oldTitle: string;

  constructor(private store: BoardStore, private issueId: string, private newTitle: string) {
    const issue = store.issues().find((i) => i.id === issueId);
    this.oldTitle = issue?.title || '';
  }

  execute() {
    this.store.updateIssue(this.issueId, { title: this.newTitle });
  }

  undo() {
    this.store.updateIssue(this.issueId, { title: this.oldTitle });
  }
}

// Command manager
class CommandManager {
  private history: Command[] = [];
  private currentIndex = -1;

  execute(command: Command) {
    command.execute();

    // Remove future commands if we're in the middle of history
    this.history = this.history.slice(0, this.currentIndex + 1);

    this.history.push(command);
    this.currentIndex++;
  }

  undo() {
    if (this.currentIndex < 0) return;

    const command = this.history[this.currentIndex];
    command.undo();
    this.currentIndex--;
  }

  redo() {
    if (this.currentIndex >= this.history.length - 1) return;

    this.currentIndex++;
    const command = this.history[this.currentIndex];
    command.execute();
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
}

// Usage
const manager = new CommandManager();

// Move issue
const moveCommand = new MoveIssueCommand(store, 'issue123', 'done');
manager.execute(moveCommand);

// Undo
manager.undo(); // Issue moved back

// Redo
manager.redo(); // Issue moved to done again
```

---

## 3. State Management Strategy

### 3.1. Single Source of Truth

```
┌─────────────────────────────────────────────────────────┐
│                      AuthStore                           │
│  - user: Signal<User | null>                            │
│  - Toàn bộ app đọc từ đây                               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   ProjectsStore                          │
│  - projects: Signal<Project[]>                          │
│  - selectedProjectId: Signal<string | null>             │
│  - members: Signal<AppUser[]>                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     BoardStore                           │
│  - issues: Signal<Issue[]>                              │
│  - filter: Signal<BoardFilter>                          │
└─────────────────────────────────────────────────────────┘
```

**Rules:**

1. ❌ **KHÔNG** lưu state trong component
2. ❌ **KHÔNG** duplicate state giữa các stores
3. ✅ **LUÔN** đọc từ store
4. ✅ **LUÔN** update qua store methods

### 3.2. Derived State với Computed Signals

```typescript
// ❌ BAD: Duplicate state
type BoardState = {
  issues: Issue[];
  todoIssues: Issue[]; // ❌ Duplicate!
  inProgressIssues: Issue[]; // ❌ Duplicate!
  doneIssues: Issue[]; // ❌ Duplicate!
};

// ✅ GOOD: Derived state
type BoardState = {
  issues: Issue[]; // Single source of truth
};

withComputed(({ issues }) => ({
  // Derived from issues
  todoIssues: computed(() => issues().filter((i) => i.status === 'todo')),
  inProgressIssues: computed(() => issues().filter((i) => i.status === 'in-progress')),
  doneIssues: computed(() => issues().filter((i) => i.status === 'done')),
}));
```

**Lợi ích:**

- ✅ Không bao giờ out-of-sync
- ✅ Ít memory hơn
- ✅ Tự động update

### 3.3. Optimistic Updates

```typescript
async updateIssue(issueId: string, updates: Partial<Issue>) {
  // 1. Lưu old state (để rollback nếu cần)
  const oldIssues = [...store.issues()];

  // 2. Update UI ngay lập tức (Optimistic)
  const newIssues = oldIssues.map(i =>
    i.id === issueId ? { ...i, ...updates } : i
  );
  patchState(store, { issues: newIssues });

  // 3. Sync to backend
  try {
    await issueService.updateIssue(issueId, updates);
    console.log('✅ Synced to backend');
  } catch (error) {
    // 4. Rollback on error
    console.error('❌ Failed, rolling back', error);
    patchState(store, { issues: oldIssues });

    // 5. Show error to user
    notificationService.showError('Failed to update issue');
  }
}
```

**Khi nào dùng:**

- ✅ User actions (drag, edit, delete)
- ✅ High-frequency updates
- ❌ Critical operations (payment, permissions)

### 3.4. State Normalization

**Problem:** Nested data structures

```typescript
// ❌ BAD: Nested structure
type BadState = {
  projects: {
    id: string;
    name: string;
    members: {
      id: string;
      name: string;
      avatar: string;
    }[];
    issues: {
      id: string;
      title: string;
      assignee: {
        id: string;
        name: string;
      };
    }[];
  }[];
};

// Problem: Hard to update, duplicate data
```

**Solution:** Normalize data

```typescript
// ✅ GOOD: Normalized structure
type NormalizedState = {
  users: { [id: string]: User };
  projects: { [id: string]: Project };
  issues: { [id: string]: Issue };
};

// Project only stores IDs
interface Project {
  id: string;
  name: string;
  memberIds: string[]; // Reference to users
  issueIds: string[]; // Reference to issues
}

// Issue only stores IDs
interface Issue {
  id: string;
  title: string;
  projectId: string; // Reference to project
  assigneeId: string; // Reference to user
}

// Easy to update
function updateUser(userId: string, updates: Partial<User>) {
  patchState(store, {
    users: {
      ...store.users(),
      [userId]: { ...store.users()[userId], ...updates },
    },
  });
  // All projects and issues automatically see the update!
}
```

---

## 4. Component Communication

### 4.1. Parent → Child (Input)

```typescript
// Parent
@Component({
  template: ` <app-issue-card [issue]="selectedIssue" /> `,
})
export class Board {
  selectedIssue = signal<Issue | null>(null);
}

// Child
@Component({
  selector: 'app-issue-card',
})
export class IssueCard {
  issue = input.required<Issue>();

  // Use in template
  // {{ issue().title }}
}
```

### 4.2. Child → Parent (Output)

```typescript
// Child
@Component({
  selector: 'app-issue-card',
})
export class IssueCard {
  delete = output<string>();

  onDelete() {
    this.delete.emit(this.issue().id);
  }
}

// Parent
@Component({
  template: ` <app-issue-card [issue]="issue" (delete)="handleDelete($event)" /> `,
})
export class Board {
  handleDelete(issueId: string) {
    this.store.deleteIssue(issueId);
  }
}
```

### 4.3. Sibling Communication (via Store)

```typescript
// Component A
export class IssueList {
  store = inject(BoardStore);

  selectIssue(issueId: string) {
    this.store.setSelectedIssue(issueId);
  }
}

// Component B
export class IssueDetail {
  store = inject(BoardStore);

  // Automatically updates when selection changes
  selectedIssue = this.store.selectedIssue;
}
```

### 4.4. Cross-Feature Communication (via Services)

```typescript
// Shared service
@Injectable({ providedIn: 'root' })
export class EventBusService {
  private events = new Subject<AppEvent>();

  emit(event: AppEvent) {
    this.events.next(event);
  }

  on(eventType: string): Observable<AppEvent> {
    return this.events.pipe(filter((e) => e.type === eventType));
  }
}

// Feature A
export class ProjectList {
  eventBus = inject(EventBusService);

  deleteProject(id: string) {
    // ... delete logic
    this.eventBus.emit({
      type: 'project.deleted',
      payload: { id },
    });
  }
}

// Feature B
export class Board implements OnInit {
  eventBus = inject(EventBusService);

  ngOnInit() {
    this.eventBus
      .on('project.deleted')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // React to project deletion
        this.router.navigate(['/projects']);
      });
  }
}
```

---

## 5. Data Flow Diagrams

### 5.1. Authentication Flow

```
┌─────────┐
│  User   │ Click "Login with Google"
└────┬────┘
     │
     ▼
┌──────────────┐
│   Login      │ authStore.login()
│  Component   │
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  AuthStore   │ patchState({ loading: true })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ AuthService  │ signInWithPopup(GoogleAuthProvider)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│   Firebase   │ Authenticate & return User
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ AuthService  │ onAuthStateChanged() triggered
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  AuthStore   │ _setUser(user)
│              │ patchState({ user, loading: false })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  authGuard   │ Check user() signal
└────┬─────────┘
     │
     ▼
┌──────────────┐
│   Router     │ Navigate to /projects
└──────────────┘
```

### 5.2. Issue Creation Flow

```
┌─────────┐
│  User   │ Click "Create Issue"
└────┬────┘
     │
     ▼
┌──────────────┐
│    Board     │ openIssueDialog()
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  MatDialog   │ Open IssueDialog
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ IssueDialog  │ User fills form
└────┬─────────┘
     │
     ▼
┌──────────────┐
│ IssueDialog  │ dialogRef.close(formData)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│    Board     │ dialog.afterClosed()
│              │ store.addIssue(issue)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  BoardStore  │ Call IssueService
└────┬─────────┘
     │
     ▼
┌──────────────┐
│IssueService  │ addDoc(collection('issues'), issue)
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  Firestore   │ Create document & trigger snapshot
└────┬─────────┘
     │
     ▼
┌──────────────┐
│IssueService  │ Observable emits new issue list
└────┬─────────┘
     │
     ▼
┌──────────────┐
│  BoardStore  │ patchState({ issues: [...] })
└────┬─────────┘
     │
     ▼
┌──────────────┐
│    Board     │ Template auto re-renders
│  Component   │ New issue appears!
└──────────────┘
```

### 5.3. Drag & Drop Flow (Same Column)

```
User drags issue
     │
     ▼
CDK Drop Event
     │
     ▼
Board.drop(event, status)
     │
     ▼
BoardStore.moveIssue(event, status)
     │
     ├─────────────────────────┐
     │                         │
     ▼                         ▼
Check: Same column?      Different column?
     │                         │
     ▼                         ▼
moveItemInArray()        Calculate new order
     │                         │
     ▼                         ▼
Recalculate all orders   Update single issue
     │                         │
     ▼                         ▼
Optimistic Update        Optimistic Update
patchState({ issues })   patchState({ issues })
     │                         │
     ▼                         ▼
Batch update Firestore   Update Firestore
     │                         │
     └─────────┬───────────────┘
               │
               ▼
          UI Updated!
```

---

## 6. Scalability Considerations

### 6.1. Code Splitting

```typescript
// Lazy load features
const routes: Routes = [
  {
    path: 'projects',
    loadComponent: () => import('./features/projects/project-list').then((m) => m.ProjectList),
  },
  {
    path: 'board',
    loadComponent: () => import('./features/board/board').then((m) => m.Board),
  },
];
```

**Benefits:**

- ✅ Smaller initial bundle
- ✅ Faster first load
- ✅ Load features on-demand

### 6.2. Virtual Scrolling

```typescript
// For large lists
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';

@Component({
  template: `
    <cdk-virtual-scroll-viewport itemSize="50" class="viewport">
      @for (issue of issues(); track issue.id) {
        <app-issue-card [issue]="issue" />
      }
    </cdk-virtual-scroll-viewport>
  `
})
```

**Benefits:**

- ✅ Render only visible items
- ✅ Smooth scrolling with 1000+ items
- ✅ Better performance

### 6.3. Pagination

```typescript
// Load data in chunks
withMethods((store, service = inject(IssueService)) => ({
  loadPage: rxMethod<{ projectId: string; page: number }>(
    pipe(
      switchMap(({ projectId, page }) => service.getIssuesPaginated(projectId, page, 20)),
      tap(({ issues, hasMore }) => {
        patchState(store, {
          issues: page === 1 ? issues : [...store.issues(), ...issues],
          hasMore,
        });
      })
    )
  ),
}));
```

### 6.4. Caching

```typescript
// Cache frequently accessed data
@Injectable({ providedIn: 'root' })
export class CacheService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private TTL = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.TTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }
}
```

### 6.5. Database Indexing

```javascript
// Firestore indexes for better query performance
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "issues",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "statusColumnId", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "issues",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "assigneeId", "order": "ASCENDING" },
        { "fieldPath": "priority", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 📚 Kết Luận

### Key Takeaways

1. **Layered Architecture**: Tách biệt concerns rõ ràng
2. **Design Patterns**: Sử dụng patterns phù hợp
3. **State Management**: Single source of truth với Signals
4. **Component Communication**: Rõ ràng và type-safe
5. **Scalability**: Chuẩn bị cho growth

### Best Practices Summary

✅ **DO:**

- Use feature-based structure
- Keep components small and focused
- Use signals for reactive state
- Implement optimistic updates
- Cache frequently accessed data

❌ **DON'T:**

- Put business logic in components
- Duplicate state
- Mutate signals directly
- Forget error handling
- Ignore performance

---

**Tác giả:** [Your Name]
**Ngày tạo:** 2026-01-07
**Phiên bản:** 1.0.0
