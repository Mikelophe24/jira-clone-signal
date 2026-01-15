# Home Dashboard - Deep Dive

> **Mục đích tài liệu**: Giải thích chi tiết cách hoạt động của trang Home Dashboard, từ UI layout, computed signals, đến logic hiển thị thống kê và danh sách công việc.

---

## 📋 MỤC LỤC

1. [Tổng quan](#-tổng-quan)
2. [Kiến trúc UI](#-kiến-trúc-ui)
3. [Component Logic](#-component-logic)
4. [Computed Signals](#-computed-signals)
5. [Helper Methods](#-helper-methods)
6. [Luồng dữ liệu](#-luồng-dữ-liệu)
7. [Key Takeaways](#-key-takeaways)

---

## 🎯 TỔNG QUAN

### Chức năng

Trang **Home Dashboard** là màn hình chính sau khi user đăng nhập, hiển thị:

- **Thống kê tổng quan**: Total Projects, Total Tasks, Completed Tasks, Overdue Tasks
- **Assigned Tasks Widget**: Danh sách công việc được giao cho user (có thể expand/collapse)
- **Projects Widget**: Grid hiển thị tất cả projects

### Đặc điểm nổi bật

- ✅ **Real-time Stats**: Số liệu tự động cập nhật khi dữ liệu thay đổi
- ✅ **Computed Signals**: Sử dụng `computed()` để tính toán thống kê
- ✅ **Responsive Design**: Grid layout tự động điều chỉnh theo màn hình
- ✅ **Interactive**: Expand/Collapse tasks, click để navigate

---

## 🏗️ KIẾN TRÚC UI

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard Header                      │
└─────────────────────────────────────────────────────────┘
┌──────────┬──────────┬──────────┬──────────┐
│  Total   │  Total   │Completed │ Overdue  │
│ Projects │  Tasks   │  Tasks   │  Tasks   │
│    5     │    12    │    3     │    2     │
└──────────┴──────────┴──────────┴──────────┘
┌─────────────────────────┬─────────────────────────┐
│   Assigned Tasks (12)   │    Projects (5)         │
├─────────────────────────┼─────────────────────────┤
│ ┌─────────────────────┐ │ ┌─────┐ ┌─────┐ ┌─────┐│
│ │ Fix login bug       │ │ │  P  │ │  J  │ │  M  ││
│ │ Project A • 2 days  │ │ │Proj │ │Jira │ │Mkt  ││
│ └─────────────────────┘ │ └─────┘ └─────┘ └─────┘│
│ ┌─────────────────────┐ │                         │
│ │ Add feature         │ │                         │
│ │ Project B • Overdue │ │                         │
│ └─────────────────────┘ │                         │
│ [Show All / Show Less]  │                         │
└─────────────────────────┴─────────────────────────┘
```

---

## 📊 COMPONENT LOGIC

### File: `home.ts`

### 1. Dependencies Injection

```typescript
export class Home {
  projectsStore = inject(ProjectsStore);
  myTasksStore = inject(MyTasksStore);
  authStore = inject(AuthStore);
  router = inject(Router);

  isExpanded = signal(false);
}
```

**Giải thích**:

- `projectsStore`: Lấy danh sách projects
- `myTasksStore`: Lấy danh sách tasks được assign cho user
- `authStore`: Lấy thông tin user hiện tại
- `router`: Để navigate (nếu cần)
- `isExpanded`: Signal quản lý trạng thái expand/collapse của task list

---

### 2. Constructor - Auto Load Data

```typescript
constructor() {
  effect(() => {
    const user = this.authStore.user();
    this.myTasksStore.loadMyIssues(user ? user.uid : null);
  });
}
```

**Cơ chế hoạt động**:

1. **effect()**: Tạo reactive effect tự động chạy lại khi dependencies thay đổi
2. **authStore.user()**: Đọc Signal từ AuthStore
3. **Kích hoạt**: Khi user đăng nhập/đăng xuất → `authStore.user()` thay đổi → effect chạy lại
4. **loadMyIssues()**: Tải danh sách tasks của user

**Kịch bản**:

```
User đăng nhập → authStore.user() = User object
                ↓
        effect() phát hiện thay đổi
                ↓
        Gọi myTasksStore.loadMyIssues(user.uid)
                ↓
        Query Firestore → Cập nhật myTasksStore.issues
                ↓
        UI tự động hiển thị stats và tasks
```

---

## 🧮 COMPUTED SIGNALS

### 1. Completed Tasks Count

```typescript
completedTasksCount = computed(
  () => this.myTasksStore.issues().filter((i) => i.statusColumnId === 'done').length
);
```

**Cách hoạt động**:

- `computed()`: Tạo một Signal được tính toán từ Signal khác
- `myTasksStore.issues()`: Đọc danh sách tasks (Signal)
- `.filter(...)`: Lọc các tasks có status = 'done'
- `.length`: Đếm số lượng

**Reactive Update**:

```
myTasksStore.issues() thay đổi
        ↓
completedTasksCount() tự động tính lại
        ↓
Template đọc {{ completedTasksCount() }}
        ↓
UI hiển thị số mới
```

**Template sử dụng**:

```html
<div class="stat-value">{{ completedTasksCount() }}</div>
```

---

### 2. Overdue Tasks Count

```typescript
overdueTasksCount = computed(() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.myTasksStore
    .issues()
    .filter((i) => i.dueDate && new Date(i.dueDate) < today && i.statusColumnId !== 'done').length;
});
```

**Logic chi tiết**:

#### Bước 1: Chuẩn bị ngày hiện tại

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
```

- Tạo object Date đại diện cho hôm nay
- `setHours(0, 0, 0, 0)`: Reset giờ/phút/giây về 0 để so sánh chỉ theo ngày

**Tại sao phải reset?**

```javascript
// ❌ Không reset
const today = new Date(); // 2026-01-14 15:30:45
const dueDate = new Date('2026-01-14'); // 2026-01-14 00:00:00
// dueDate < today → true (sai! vì cùng ngày)

// ✅ Reset
const today = new Date();
today.setHours(0, 0, 0, 0); // 2026-01-14 00:00:00
const dueDate = new Date('2026-01-14'); // 2026-01-14 00:00:00
// dueDate < today → false (đúng!)
```

#### Bước 2: Filter logic

```typescript
.filter((i) =>
  i.dueDate &&                        // 1. Có due date
  new Date(i.dueDate) < today &&      // 2. Due date < hôm nay
  i.statusColumnId !== 'done'         // 3. Chưa hoàn thành
)
```

**Điều kiện overdue**:

1. Task phải có due date (không phải null/undefined)
2. Due date phải nhỏ hơn ngày hiện tại (quá hạn)
3. Status không phải 'done' (nếu đã xong thì không tính overdue)

---

### 3. Displayed Tasks (Expand/Collapse Logic)

```typescript
displayedTasks = computed(() => {
  const all = this.myTasksStore.issues();
  return this.isExpanded() ? all : all.slice(0, 3);
});
```

**Cách hoạt động**:

- `isExpanded()`: Đọc Signal trạng thái expand
- Nếu `true`: Hiển thị tất cả tasks
- Nếu `false`: Chỉ hiển thị 3 tasks đầu tiên (`.slice(0, 3)`)

**Template sử dụng**:

```html
@for (task of displayedTasks(); track task.id) {
<mat-card class="task-card"> {{ task.title }} </mat-card>
}
```

**Toggle Method**:

```typescript
toggleExpand() {
  this.isExpanded.update((v) => !v);
}
```

- `update()`: Method của Signal để cập nhật giá trị
- `(v) => !v`: Đảo ngược giá trị (true → false, false → true)

---

## 🛠️ HELPER METHODS

### 1. getProjectName()

```typescript
getProjectName(projectId: string) {
  return this.projectsStore.projects().find((p) => p.id === projectId)?.name || 'Unknown Project';
}
```

**Mục đích**: Chuyển đổi `projectId` thành tên Project.

**Cách hoạt động**:

1. `projectsStore.projects()`: Lấy danh sách projects (Signal)
2. `.find(...)`: Tìm project có id khớp
3. `?.name`: Optional chaining - lấy name nếu tìm thấy
4. `|| 'Unknown Project'`: Fallback nếu không tìm thấy

**Template sử dụng**:

```html
<span class="project-name">{{ getProjectName(task.projectId) }}</span>
```

---

### 2. isOverdue()

```typescript
isOverdue(dateStr: string, status: string): boolean {
  if (status === 'done') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}
```

**Logic**:

1. Nếu task đã hoàn thành (`status === 'done'`) → Không tính overdue
2. So sánh due date với ngày hiện tại
3. Trả về `true` nếu quá hạn

**Template sử dụng**:

```html
<span class="due-date" [class.overdue]="isOverdue(task.dueDate, task.statusColumnId)">
  {{ getDaysRemaining(task.dueDate, task.statusColumnId) }}
</span>
```

**CSS**:

```css
.due-date.overdue {
  color: #de350b; /* Màu đỏ */
  font-weight: 500;
}
```

---

### 3. getDaysRemaining()

```typescript
getDaysRemaining(dateStr: string, status: string): string {
  if (status === 'done') return 'Completed';
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  return diffDays + ' days left';
}
```

**Phân tích từng bước**:

#### Bước 1: Kiểm tra status

```typescript
if (status === 'done') return 'Completed';
```

- Nếu đã xong → Hiển thị "Completed"

#### Bước 2: Tính khoảng cách thời gian

```typescript
const diffTime = date.getTime() - today.getTime();
```

- `.getTime()`: Chuyển Date thành milliseconds (số nguyên)
- Trừ để tính khoảng cách

**Ví dụ**:

```javascript
const today = new Date('2026-01-14');
const dueDate = new Date('2026-01-16');

today.getTime()   // 1736812800000
dueDate.getTime() // 1736985600000

diffTime = 1736985600000 - 1736812800000 = 172800000 ms
```

#### Bước 3: Chuyển đổi sang ngày

```typescript
const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
```

**Công thức**:

```
1 ngày = 24 giờ × 60 phút × 60 giây × 1000 ms = 86,400,000 ms

diffDays = diffTime / 86,400,000
```

**`Math.ceil()`**: Làm tròn lên

```javascript
Math.ceil(1.1); // 2
Math.ceil(1.9); // 2
Math.ceil(-1.1); // -1
```

**Tại sao dùng `ceil`?**

- Nếu còn 1.5 ngày → Hiển thị "2 days left" (làm tròn lên để an toàn)

#### Bước 4: Format text

```typescript
if (diffDays < 0) return 'Overdue';
if (diffDays === 0) return 'Today';
return diffDays + ' days left';
```

**Kết quả**:
| diffDays | Output |
|----------|--------|
| -3 | "Overdue" |
| 0 | "Today" |
| 1 | "1 days left" |
| 5 | "5 days left" |

---

## 🔄 LUỒNG DỮ LIỆU

### Scenario: User đăng nhập và mở Home Dashboard

```
1. User đăng nhập
   ↓
2. AuthStore.user() thay đổi từ null → User object
   ↓
3. Home component constructor → effect() kích hoạt
   ↓
4. Gọi myTasksStore.loadMyIssues(user.uid)
   ↓
5. MyTasksStore query Firestore:
   query(where('assigneeId', '==', user.uid))
   ↓
6. Firestore trả về Observable<Issue[]>
   ↓
7. MyTasksStore.issues Signal cập nhật
   ↓
8. Computed Signals tự động tính lại:
   - completedTasksCount()
   - overdueTasksCount()
   - displayedTasks()
   ↓
9. Template đọc các Signals
   ↓
10. UI render:
    - Stats cards hiển thị số liệu
    - Task list hiển thị 3 tasks đầu
    - Projects grid hiển thị projects
```

---

### Real-time Update Flow

```
User A tạo Issue mới và assign cho User B
         ↓
Firestore nhận document mới (assigneeId = User B)
         ↓
MyTasksStore collectionData() Observable emit
         ↓
myTasksStore.issues Signal cập nhật
         ↓
Computed Signals tự động tính lại:
  - completedTasksCount() (nếu status = 'done')
  - overdueTasksCount() (nếu quá hạn)
  - displayedTasks() (thêm task mới vào list)
         ↓
Angular Change Detection
         ↓
UI tự động cập nhật:
  - "Total Tasks" tăng lên
  - Task mới xuất hiện trong list
```

---

## 🎨 UI COMPONENTS BREAKDOWN

### 1. Stats Row

```html
<div class="stats-row">
  <mat-card class="stat-card">
    <mat-card-content>
      <div class="stat-label">Total Projects</div>
      <div class="stat-value">{{ projectsStore.projects().length }}</div>
    </mat-card-content>
  </mat-card>
  <!-- 3 cards khác tương tự -->
</div>
```

**CSS Grid Layout**:

```css
.stats-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 140px;
}
```

**Responsive**:

- Desktop: 4 cards ngang hàng
- Mobile: Tự động wrap xuống dòng

---

### 2. Assigned Tasks Widget

```html
<div class="widget assigned-tasks">
  <div class="widget-header">
    <h3>Assigned Tasks ({{ myTasksStore.issues().length }})</h3>
  </div>
  <div class="widget-content">
    @for (task of displayedTasks(); track task.id) {
    <mat-card class="task-card" [routerLink]="['/project', task.projectId, 'board']">
      <mat-card-content>
        <div class="task-title">{{ task.title }}</div>
        <div class="task-meta">
          <span class="project-name">{{ getProjectName(task.projectId) }}</span>
          @if (task.dueDate) {
          <span class="due-date" [class.overdue]="isOverdue(task.dueDate, task.statusColumnId)">
            {{ getDaysRemaining(task.dueDate, task.statusColumnId) }}
          </span>
          }
        </div>
      </mat-card-content>
    </mat-card>
    }
  </div>
  <div class="widget-footer">
    <button mat-button color="primary" (click)="toggleExpand()">
      {{ isExpanded() ? 'Show Less' : 'Show All' }}
    </button>
  </div>
</div>
```

**Tính năng**:

- Click vào task card → Navigate đến Board của project đó
- Hiển thị tên project và due date
- Tô màu đỏ nếu overdue
- Nút expand/collapse

---

### 3. Projects Widget

```html
<div class="widget projects-list">
  <div class="widget-header">
    <h3>Projects ({{ projectsStore.projects().length }})</h3>
    <button mat-icon-button><mat-icon>add</mat-icon></button>
  </div>
  <div class="widget-content project-grid">
    @for (project of projectsStore.projects(); track project.id) {
    <mat-card class="project-card" [routerLink]="['/project', project.id]">
      <mat-card-content>
        <div class="project-icon">{{ project.name.charAt(0).toUpperCase() }}</div>
        <div class="project-name">{{ project.name }}</div>
      </mat-card-content>
    </mat-card>
    }
  </div>
</div>
```

**Project Icon Logic**:

```typescript
{
  {
    project.name.charAt(0).toUpperCase();
  }
}
```

- `.charAt(0)`: Lấy ký tự đầu tiên
- `.toUpperCase()`: Viết hoa

**Ví dụ**:

- "Jira Clone" → "J"
- "marketing" → "M"

**CSS Grid**:

```css
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
```

- `auto-fill`: Tự động điền vào các cột
- `minmax(200px, 1fr)`: Mỗi card tối thiểu 200px, tối đa chia đều

---

## 🎯 KEY TAKEAWAYS

### 1. **Computed Signals for Derived State**

```typescript
completedTasksCount = computed(
  () => this.myTasksStore.issues().filter((i) => i.statusColumnId === 'done').length
);
```

**Lợi ích**:

- ✅ Tự động cập nhật khi source Signal thay đổi
- ✅ Không cần gọi method thủ công
- ✅ Memoization (cache kết quả, chỉ tính lại khi cần)

---

### 2. **Effect for Side Effects**

```typescript
constructor() {
  effect(() => {
    const user = this.authStore.user();
    this.myTasksStore.loadMyIssues(user ? user.uid : null);
  });
}
```

**Pattern này dùng để**:

- Tự động load data khi user thay đổi
- Không cần `ngOnInit()` phức tạp
- Reactive và declarative

---

### 3. **Signal Update Pattern**

```typescript
isExpanded = signal(false);

toggleExpand() {
  this.isExpanded.update((v) => !v);
}
```

**So sánh với cách cũ**:

```typescript
// ❌ Cách cũ (property thường)
isExpanded = false;
toggleExpand() {
  this.isExpanded = !this.isExpanded;
}

// ✅ Cách mới (Signal)
isExpanded = signal(false);
toggleExpand() {
  this.isExpanded.update((v) => !v);
}
```

**Lợi ích Signal**:

- Angular tự động track dependencies
- Change detection hiệu quả hơn

---

### 4. **Date Manipulation Best Practices**

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0); // Reset time to midnight
```

**Tại sao quan trọng?**

- So sánh ngày chính xác (không bị ảnh hưởng bởi giờ/phút/giây)
- Tránh bug khi so sánh "hôm nay" với due date

---

### 5. **Responsive Grid Layout**

```css
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}

@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
```

**Pattern**:

- Desktop: 2 cột (Tasks | Projects)
- Mobile: 1 cột (stack vertically)

---

### 6. **RouterLink for Navigation**

```html
<mat-card [routerLink]="['/project', task.projectId, 'board']"></mat-card>
```

**Tương đương**:

```typescript
this.router.navigate(['/project', task.projectId, 'board']);
```

**Lợi ích `routerLink`**:

- Declarative (khai báo trong template)
- Hỗ trợ Ctrl+Click mở tab mới
- SEO friendly

---

## 📝 TÓM TẮT

**Home Dashboard** là một ví dụ điển hình về **Reactive Dashboard** trong Angular:

1. **Computed Signals** để tính toán stats tự động
2. **Effect** để auto-load data khi user thay đổi
3. **Helper methods** để format và transform data
4. **Responsive layout** với CSS Grid
5. **Interactive widgets** với expand/collapse

**Pattern này có thể tái sử dụng cho**:

- Analytics Dashboard
- Admin Panel
- Reporting Page

---

**Tài liệu này giúp bạn hiểu sâu về cách Home Dashboard hoạt động. Hãy áp dụng các pattern này vào các tính năng tương tự!** 🎉
