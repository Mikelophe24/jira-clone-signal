# 📐 Project Layout - Giải Thích Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#tổng-quan)
2. [Vai Trò Trong Routing](#vai-trò-trong-routing)
3. [Imports & Dependencies](#imports--dependencies)
4. [Template Structure](#template-structure)
5. [Styling Analysis](#styling-analysis)
6. [Component Class](#component-class)
7. [Luồng Hoạt Động](#luồng-hoạt-động)
8. [Material Sidenav Deep Dive](#material-sidenav-deep-dive)
9. [Router Outlet & Child Routes](#router-outlet--child-routes)
10. [Best Practices & Patterns](#best-practices--patterns)

---

## 🎯 Tổng Quan

**`ProjectLayout`** là một **Layout Component** (còn gọi là Container Component) đóng vai trò:

### **Chức Năng Chính**

- 🏗️ **Layout Wrapper**: Cung cấp cấu trúc layout cho tất cả pages trong một project
- 📍 **Navigation Hub**: Hiển thị sidebar navigation cho Backlog và Board
- 🔄 **Router Outlet Host**: Render child routes (Board/Backlog) vào content area
- 📊 **Context Provider**: Hiển thị thông tin project hiện tại

### **Vị Trí Trong App**

```
App Root
  └─ Main Layout (app.ts)
      └─ Router Outlet
          ├─ /projects → ProjectList
          ├─ /home → Home
          ├─ /my-tasks → MyTasks
          └─ /project/:projectId → ProjectLayout ← ĐÂY!
              └─ Router Outlet (nested)
                  ├─ board → Board Component
                  └─ backlog → Backlog Component
```

---

## 🗺️ Vai Trò Trong Routing

### **Route Configuration**

```typescript
// app.routes.ts - Dòng 16-34
{
  path: 'project/:projectId',
  canActivate: [authGuard],
  loadComponent: () => import('./features/projects/project-layout/project-layout')
                       .then((m) => m.ProjectLayout),
  children: [
    {
      path: 'board',
      loadComponent: () => import('./features/board/board/board')
                           .then((m) => m.Board),
    },
    {
      path: 'backlog',
      loadComponent: () => import('./features/board/backlog/backlog')
                           .then((m) => m.Backlog),
    },
    {
      path: '',
      redirectTo: 'board',
      pathMatch: 'full',
    },
  ],
}
```

### **URL Mapping**

| URL                       | Component Hierarchy     | Hiển Thị                           |
| ------------------------- | ----------------------- | ---------------------------------- |
| `/project/abc123`         | ProjectLayout           | Redirect → `/project/abc123/board` |
| `/project/abc123/board`   | ProjectLayout → Board   | Sidebar + Board                    |
| `/project/abc123/backlog` | ProjectLayout → Backlog | Sidebar + Backlog                  |

### **Nested Routing Flow**

```
User navigate to: /project/abc123/board
   ↓
1. Angular Router khớp route: 'project/:projectId'
   ↓
2. Load ProjectLayout component
   ↓
3. ProjectLayout render với sidebar + <router-outlet>
   ↓
4. Router tiếp tục khớp child route: 'board'
   ↓
5. Load Board component
   ↓
6. Board component render vào <router-outlet> của ProjectLayout
   ↓
7. Kết quả: Sidebar (ProjectLayout) + Board content
```

---

## 📦 Imports & Dependencies

### **Dòng 1-7: Import Statements**

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { ProjectsStore } from '../projects.store';
```

#### **Angular Core**

- **`Component`**: Decorator để định nghĩa component
- **`inject`**: Function injection (modern approach)

#### **Router Modules**

- **`RouterLink`**: Directive để navigate (`routerLink="./board"`)
- **`RouterOutlet`**: Directive để render child routes
- **`RouterLinkActive`**: Directive để highlight active link

#### **Material Modules**

- **`MatSidenavModule`**: Sidebar container với animation
- **`MatListModule`**: Navigation list styling
- **`MatIconModule`**: Material icons

#### **Store**

- **`ProjectsStore`**: Truy cập `selectedProject()` signal

---

## 🖼️ Template Structure

### **Dòng 21-54: Template HTML**

Tôi sẽ phân tích từng phần:

### **A. Container Wrapper (Dòng 22-23)**

```html
<div class="project-container">
  <mat-sidenav-container class="sidenav-container"></mat-sidenav-container>
</div>
```

**Giải thích:**

- **`.project-container`**: Wrapper ngoài cùng, chiếm 100% height
- **`<mat-sidenav-container>`**: Material component quản lý sidebar + content
  - Tự động handle responsive behavior
  - Quản lý overlay khi sidebar mở/đóng (mobile)

---

### **B. Sidebar (Dòng 24-46)**

```html
<mat-sidenav mode="side" opened class="sidenav">
  <!-- Sidebar content -->
</mat-sidenav>
```

#### **Attributes:**

- **`mode="side"`**: Sidebar luôn hiển thị bên cạnh content (không overlay)
  - Các mode khác: `'over'` (overlay), `'push'` (đẩy content)
- **`opened`**: Sidebar mở mặc định
- **`class="sidenav"`**: Custom styling (width: 240px, background: #f4f5f7)

---

#### **B.1. Sidebar Header (Dòng 25-30)**

```html
<div class="sidenav-header">
  @if(store.selectedProject(); as project) {
  <h3>{{ project.name }}</h3>
  <p class="project-key">{{ project.key }} software project</p>
  }
</div>
```

**Luồng hoạt động:**

```typescript
// 1. Component inject ProjectsStore
store = inject(ProjectsStore);

// 2. Template đọc selectedProject() signal
store.selectedProject()  // Signal<Project | undefined>

// 3. @if syntax với alias
@if(store.selectedProject(); as project) {
  // project = giá trị của signal (type: Project)
}
```

**Ví dụ hiển thị:**

```
┌─────────────────────────┐
│  My Awesome Project     │ ← project.name
│  MAP software project   │ ← project.key
└─────────────────────────┘
```

**Khi nào `selectedProject()` có giá trị?**

```typescript
// projects.store.ts - Dòng 108-110
selectProject: (projectId: string) => {
  patchState(store, { selectedProjectId: projectId });
};

// Computed signal - Dòng 41-43
selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId()));
```

**Luồng:**

```
User navigate to /project/abc123
   ↓
Route param 'projectId' = 'abc123'
   ↓
Guard hoặc component gọi store.selectProject('abc123')
   ↓
selectedProjectId signal = 'abc123'
   ↓
selectedProject computed signal tìm project với id = 'abc123'
   ↓
Template hiển thị project.name và project.key
```

---

#### **B.2. Navigation List (Dòng 32-41)**

```html
<mat-nav-list>
  <a mat-list-item routerLink="./backlog" routerLinkActive="active-link">
    <mat-icon matListItemIcon>list_alt</mat-icon>
    <div matListItemTitle>Backlog</div>
  </a>
  <a mat-list-item routerLink="./board" routerLinkActive="active-link">
    <mat-icon matListItemIcon>dashboard</mat-icon>
    <div matListItemTitle>Board</div>
  </a>
</mat-nav-list>
```

**Chi tiết từng phần:**

##### **`<mat-nav-list>`**

Material component tạo navigation list với styling chuẩn.

##### **`<a mat-list-item>`**

- **`mat-list-item`**: Directive tạo list item với Material styling
- **`<a>`**: Anchor tag để navigate

##### **`routerLink="./backlog"`**

- **Relative path**: `./` = relative to current route
- **Current route**: `/project/abc123`
- **Result**: `/project/abc123/backlog`

**So sánh:**

```typescript
routerLink = './backlog'; // → /project/abc123/backlog (relative)
routerLink = '/backlog'; // → /backlog (absolute)
routerLink = 'backlog'; // → /project/abc123/backlog (cũng relative)
```

##### **`routerLinkActive="active-link"`**

Tự động thêm class `active-link` khi route hiện tại khớp với `routerLink`.

**Ví dụ:**

```
Current URL: /project/abc123/board
   ↓
Board link có class "active-link"
   ↓
CSS apply: background: #ebecf0, color: #0052cc
```

**Cơ chế hoạt động:**

```typescript
// Angular Router tự động check
if (currentUrl.includes(routerLink)) {
  element.classList.add('active-link');
} else {
  element.classList.remove('active-link');
}
```

##### **Material List Directives**

```html
<mat-icon matListItemIcon>list_alt</mat-icon>
<div matListItemTitle>Backlog</div>
```

- **`matListItemIcon`**: Đặt icon ở đầu item
- **`matListItemTitle`**: Đặt text chính của item

**Kết quả render:**

```
┌─────────────────────────┐
│ 📋 Backlog              │ ← Icon + Title
│ 📊 Board                │
└─────────────────────────┘
```

---

#### **B.3. Divider (Dòng 43)**

```html
<div class="divider"></div>
```

Đường kẻ ngang để phân tách sections (border-top: 1px solid #dfe1e6).

---

### **C. Content Area (Dòng 48-52)**

```html
<mat-sidenav-content>
  <div class="content-wrapper">
    <router-outlet></router-outlet>
  </div>
</mat-sidenav-content>
```

#### **`<mat-sidenav-content>`**

Material component chứa main content, tự động:

- Adjust width khi sidebar mở/đóng
- Handle responsive behavior

#### **`<router-outlet>`**

**Đây là điểm quan trọng nhất!**

```typescript
// Router sẽ render child component vào đây
<router-outlet></router-outlet>

// Khi URL = /project/abc123/board
// → Board component được render vào đây

// Khi URL = /project/abc123/backlog
// → Backlog component được render vào đây
```

**Luồng render:**

```
ProjectLayout template
   ↓
<router-outlet> placeholder
   ↓
Angular Router inject child component
   ↓
Board/Backlog component render tại vị trí <router-outlet>
```

---

## 🎨 Styling Analysis

### **Dòng 56-103: Component Styles**

Tôi sẽ phân tích từng style rule:

### **A. Container Styles (Dòng 58-63)**

```css
.project-container {
  height: 100%;
}
.sidenav-container {
  height: 100%;
}
```

**Tại sao cần `height: 100%`?**

```
HTML structure:
<div class="project-container">        ← height: 100%
  <mat-sidenav-container>              ← height: 100%
    <mat-sidenav>...</mat-sidenav>     ← Full height sidebar
    <mat-sidenav-content>...</mat-sidenav-content>
  </mat-sidenav-container>
</div>
```

**Nếu không có `height: 100%`:**

- Container chỉ cao bằng content
- Sidebar không full height
- Scrollbar xuất hiện sai vị trí

---

### **B. Sidebar Styles (Dòng 64-68)**

```css
.sidenav {
  width: 240px;
  background: #f4f5f7;
  border-right: 1px solid #dfe1e6;
}
```

**Phân tích:**

- **`width: 240px`**: Fixed width (Jira standard)
- **`background: #f4f5f7`**: Light gray (Jira color scheme)
- **`border-right`**: Subtle separator

**Visual:**

```
┌──────────────┬─────────────────────┐
│              │                     │
│   Sidebar    │   Main Content      │
│   240px      │   Flexible width    │
│   #f4f5f7    │                     │
│              │                     │
└──────────────┴─────────────────────┘
       ↑
   border-right
```

---

### **C. Sidebar Header Styles (Dòng 69-84)**

```css
.sidenav-header {
  padding: 24px 16px;

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #42526e;
  }

  .project-key {
    margin: 4px 0 0;
    font-size: 12px;
    color: #5e6c84;
  }
}
```

**Nested SCSS:**

```scss
.sidenav-header {
  // Outer container
  padding: 24px 16px;

  h3 {
    // Nested selector = .sidenav-header h3
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #42526e; // Dark blue-gray
  }

  .project-key {
    // Nested selector = .sidenav-header .project-key
    margin: 4px 0 0; // Top margin only
    font-size: 12px;
    color: #5e6c84; // Lighter gray
  }
}
```

**Visual hierarchy:**

```
┌─────────────────────────┐
│  ↕ 24px padding         │
│                         │
│  My Awesome Project     │ ← h3: 16px, #42526e, bold
│  ↕ 4px margin           │
│  MAP software project   │ ← .project-key: 12px, #5e6c84
│                         │
│  ↕ 24px padding         │
└─────────────────────────┘
```

---

### **D. Active Link Styles (Dòng 85-92)**

```css
.active-link {
  background: #ebecf0;
  color: #0052cc !important;

  mat-icon {
    color: #0052cc;
  }
}
```

**Khi nào apply?**

```html
<a routerLink="./board" routerLinkActive="active-link">
  <!-- Khi URL = /project/abc123/board → class="active-link" được thêm -->
</a>
```

**Visual comparison:**

```
Normal state:
┌─────────────────────────┐
│ 📋 Backlog              │ ← Default color
│ 📊 Board                │
└─────────────────────────┘

Active state (URL = /board):
┌─────────────────────────┐
│ 📋 Backlog              │
│ 📊 Board                │ ← background: #ebecf0, color: #0052cc
└─────────────────────────┘
```

**`!important` tại sao?**

```css
/* Material List có default styles với high specificity */
.mat-mdc-list-item {
  color: rgba(0, 0, 0, 0.87); /* Default */
}

/* Cần !important để override */
.active-link {
  color: #0052cc !important;
}
```

**Nested icon styling:**

```scss
.active-link {
  mat-icon {
    // = .active-link mat-icon
    color: #0052cc;
  }
}
```

---

### **E. Divider & Content Wrapper (Dòng 93-102)**

```css
.divider {
  margin: 8px 0;
  border-top: 1px solid #dfe1e6;
}

.content-wrapper {
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}
```

**`.content-wrapper` analysis:**

```css
display: flex;
flex-direction: column;
```

**Tại sao cần flexbox?**

```
Content wrapper
   ↓
<router-outlet> render child component
   ↓
Child component (Board/Backlog) có thể:
   - Chiếm full height
   - Tự quản lý scroll
   - Có header + content area riêng
```

**Ví dụ:**

```html
<div class="content-wrapper">
  <!-- flex container, column direction -->
  <router-outlet></router-outlet>

  <!-- Board component được inject vào đây -->
  <div class="board-container">
    <div class="board-header">...</div>
    <!-- Flex item 1 -->
    <div class="board-content">...</div>
    <!-- Flex item 2 (grow) -->
  </div>
</div>
```

---

## 💻 Component Class

### **Dòng 105-108: Class Definition**

```typescript
export class ProjectLayout {
  store = inject(ProjectsStore);
}
```

**Cực kỳ đơn giản!** Chỉ có 1 property:

### **`store = inject(ProjectsStore)`**

**Giải thích:**

```typescript
// Modern injection syntax (Angular 14+)
store = inject(ProjectsStore);

// Tương đương với constructor injection:
constructor(private store: ProjectsStore) {}
```

**Tại sao chỉ cần store?**

Component này chỉ làm 2 việc:

1. **Hiển thị project info**: `store.selectedProject()`
2. **Render child routes**: `<router-outlet>`

Không cần:

- ❌ Methods (navigation handled by `routerLink`)
- ❌ State (managed by ProjectsStore)
- ❌ Lifecycle hooks (no special initialization)

---

## 🔄 Luồng Hoạt Động

### **Scenario: User Navigate to Board**

#### **Step 1: User Click Link**

```
User ở trang: /projects
   ↓
Click vào project "My Project" (id: abc123)
   ↓
Navigate to: /project/abc123
```

#### **Step 2: Router Redirect**

```typescript
// app.routes.ts - Dòng 30-33
{
  path: '',
  redirectTo: 'board',
  pathMatch: 'full',
}
```

```
URL: /project/abc123
   ↓
Khớp route: 'project/:projectId'
   ↓
Child route: '' (empty)
   ↓
Redirect to: 'board'
   ↓
Final URL: /project/abc123/board
```

#### **Step 3: Load ProjectLayout**

```
Router load ProjectLayout component
   ↓
inject(ProjectsStore)
   ↓
Template render với sidebar + <router-outlet>
```

#### **Step 4: Update Selected Project**

```typescript
// Thường được gọi trong route guard hoặc component init
store.selectProject('abc123');
   ↓
patchState(store, { selectedProjectId: 'abc123' })
   ↓
selectedProject() computed signal update
   ↓
Template hiển thị project name và key
```

#### **Step 5: Load Board Component**

```
Router tiếp tục resolve child route: 'board'
   ↓
Lazy load Board component
   ↓
Inject Board vào <router-outlet>
   ↓
Board component render
```

#### **Step 6: Final Render**

```
┌─────────────────────────────────────────┐
│  Sidebar (ProjectLayout)                │
│  ┌─────────────────┐                    │
│  │ My Project      │                    │
│  │ MAP software    │                    │
│  ├─────────────────┤                    │
│  │ 📋 Backlog      │                    │
│  │ 📊 Board  ←     │  Board Component   │
│  └─────────────────┘  (router-outlet)   │
└─────────────────────────────────────────┘
```

---

### **Scenario: User Switch to Backlog**

#### **Step 1: User Click Backlog Link**

```html
<a routerLink="./backlog">Backlog</a>
```

```
Current URL: /project/abc123/board
   ↓
Click Backlog link
   ↓
Navigate to: /project/abc123/backlog
```

#### **Step 2: Router Update**

```
Router detect URL change
   ↓
ProjectLayout KHÔNG reload (vẫn là parent route)
   ↓
Chỉ child route thay đổi: 'board' → 'backlog'
```

#### **Step 3: Swap Child Component**

```
Router unload Board component
   ↓
Lazy load Backlog component
   ↓
Inject Backlog vào <router-outlet>
   ↓
Backlog component render
```

#### **Step 4: Update Active Link**

```html
<!-- routerLinkActive tự động update -->
<a routerLink="./backlog" class="active-link">
  ← Thêm class <a routerLink="./board"> ← Xóa class</a></a
>
```

**Visual:**

```
Before (Board active):
┌─────────────────┐
│ 📋 Backlog      │
│ 📊 Board  ←     │ ← Highlighted
└─────────────────┘

After (Backlog active):
┌─────────────────┐
│ 📋 Backlog  ←   │ ← Highlighted
│ 📊 Board        │
└─────────────────┘
```

---

## 🏗️ Material Sidenav Deep Dive

### **`<mat-sidenav-container>`**

**Cấu trúc:**

```html
<mat-sidenav-container>
  <mat-sidenav>...</mat-sidenav>
  <!-- Sidebar -->
  <mat-sidenav-content>...</mat-sidenav-content>
  <!-- Main content -->
</mat-sidenav-container>
```

### **Modes**

```typescript
mode = 'side'; // Sidebar bên cạnh content (default trong code)
mode = 'over'; // Sidebar overlay lên content
mode = 'push'; // Sidebar đẩy content sang
```

**Visual comparison:**

#### **Mode: side**

```
┌──────────┬─────────────┐
│ Sidebar  │  Content    │
│          │             │
└──────────┴─────────────┘
```

#### **Mode: over**

```
┌─────────────────────────┐
│ ┌──────────┐            │
│ │ Sidebar  │  Content   │
│ │ (overlay)│            │
│ └──────────┘            │
└─────────────────────────┘
```

#### **Mode: push**

```
┌──────────┬──────────────┐
│ Sidebar  │   Content    │
│          │   (pushed)   │
└──────────┴──────────────┘
```

### **Opened State**

```html
<mat-sidenav opened> <!-- Mở mặc định --></mat-sidenav>
```

**Programmatic control:**

```typescript
@ViewChild('sidenav') sidenav!: MatSidenav;

toggleSidenav() {
  this.sidenav.toggle();
}
```

---

## 🔀 Router Outlet & Child Routes

### **Nested Router Outlets**

```
App Level:
<router-outlet></router-outlet>  ← Render top-level routes
   ↓
ProjectLayout được render vào đây
   ↓
ProjectLayout template:
<router-outlet></router-outlet>  ← Render child routes
   ↓
Board/Backlog được render vào đây
```

### **Route Params Access**

```typescript
// Trong Board component, access projectId:
import { ActivatedRoute } from '@angular/router';

export class Board {
  route = inject(ActivatedRoute);

  ngOnInit() {
    const projectId = this.route.parent?.snapshot.params['projectId'];
    // hoặc
    this.route.parent?.params.subscribe((params) => {
      console.log(params['projectId']);
    });
  }
}
```

**Tại sao `route.parent`?**

```
Route hierarchy:
/project/:projectId (parent) ← projectId param ở đây
  └─ /board (child)
```

---

## ✅ Best Practices & Patterns

### **1. Layout Component Pattern**

```typescript
// ✅ GOOD: Separate layout from content
ProjectLayout (layout only)
  └─ Board (content only)

// ❌ BAD: Mix layout and content
ProjectBoard (layout + board logic)
```

**Ưu điểm:**

- ✅ Reusable layout cho nhiều pages
- ✅ Dễ maintain
- ✅ Clear separation of concerns

---

### **2. Relative Routing**

```html
<!-- ✅ GOOD: Relative paths -->
<a routerLink="./board">Board</a>
<a routerLink="./backlog">Backlog</a>

<!-- ❌ BAD: Hardcoded absolute paths -->
<a [routerLink]="['/project', projectId, 'board']">Board</a>
```

**Ưu điểm:**

- ✅ Không cần biết projectId
- ✅ Tự động adapt khi route structure thay đổi
- ✅ Code đơn giản hơn

---

### **3. Signal-based State**

```typescript
// ✅ GOOD: Use signals from store
@if(store.selectedProject(); as project) {
  <h3>{{ project.name }}</h3>
}

// ❌ BAD: Local state management
export class ProjectLayout {
  project?: Project;

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.service.getProject(params['projectId']).subscribe(
        project => this.project = project
      );
    });
  }
}
```

**Ưu điểm:**

- ✅ Centralized state
- ✅ Automatic updates
- ✅ No manual subscriptions

---

### **4. Lazy Loading**

```typescript
// ✅ GOOD: Lazy load child components
loadComponent: () => import('./features/board/board/board').then((m) => m.Board);

// ❌ BAD: Eager loading
import { Board } from './features/board/board/board';
```

**Ưu điểm:**

- ✅ Smaller initial bundle
- ✅ Faster app startup
- ✅ Load on demand

---

## 📊 Component Responsibility Summary

| Responsibility       | ProjectLayout | Board/Backlog |
| -------------------- | ------------- | ------------- |
| Layout structure     | ✅            | ❌            |
| Navigation           | ✅            | ❌            |
| Project info display | ✅            | ❌            |
| Business logic       | ❌            | ✅            |
| Data fetching        | ❌            | ✅            |
| User interactions    | ❌            | ✅            |

---

## 🎓 Tóm Tắt

### **ProjectLayout Làm Gì?**

1. **Cung cấp layout** với sidebar + content area
2. **Hiển thị project info** từ `store.selectedProject()`
3. **Navigation links** cho Board và Backlog
4. **Host router-outlet** để render child components
5. **Highlight active route** với `routerLinkActive`

### **Tại Sao Cần Component Này?**

- ✅ **Reusability**: Layout dùng chung cho Board và Backlog
- ✅ **Consistency**: UI consistent across project pages
- ✅ **Separation**: Tách layout khỏi business logic
- ✅ **Maintainability**: Dễ update layout mà không ảnh hưởng content

### **Luồng Hoạt Động Tổng Quan**

```
User navigate to /project/abc123/board
   ↓
Router load ProjectLayout
   ↓
ProjectLayout render sidebar + <router-outlet>
   ↓
Router load Board component vào <router-outlet>
   ↓
Final UI: Sidebar (ProjectLayout) + Board content
   ↓
User click Backlog link
   ↓
Router swap Board → Backlog (ProjectLayout không reload)
   ↓
Final UI: Sidebar (ProjectLayout) + Backlog content
```

---

**Tạo bởi:** Antigravity AI Assistant  
**Ngày:** 2026-01-12
