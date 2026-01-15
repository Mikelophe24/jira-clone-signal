# Dark Mode Implementation Summary

> **Ngày thực hiện:** 15/01/2026  
> **Mục tiêu:** Xây dựng tính năng Toggle Theme (Light/Dark Mode) theo chuẩn Atlassian Jira Design System

---

## 📋 Tổng Quan

Dự án đã được nâng cấp với hệ thống theme động, cho phép người dùng chuyển đổi giữa chế độ Sáng (Light) và Tối (Dark) một cách mượt mà. Toàn bộ giao diện được thiết kế lại theo chuẩn màu sắc của Jira để đảm bảo trải nghiệm người dùng chuyên nghiệp.

---

## 🎯 Các File Đã Thay Đổi

### 1. **Core Theme Management**

#### `src/app/core/theme/theme.store.ts` (MỚI)

- **Mục đích:** Quản lý trạng thái theme toàn ứng dụng
- **Công nghệ:** NgRx SignalStore
- **Tính năng:**
  - Lưu trữ trạng thái `isDark` (boolean)
  - Đồng bộ với `localStorage` để nhớ lựa chọn của user
  - Tự động thêm/xóa class `dark-theme` vào `<html>`
  - Hỗ trợ phát hiện theme hệ thống (system preference)

```typescript
// Các method chính:
- toggleTheme(): Chuyển đổi theme
- setTheme(isDark: boolean): Đặt theme cụ thể
- onInit: Load theme từ localStorage hoặc system
```

---

### 2. **Global Styles**

#### `src/styles.scss`

- **Thay đổi chính:**
  - Định nghĩa 2 theme riêng biệt: `$light-theme` và `$dark-theme`
  - Tạo CSS Variables cho màu sắc động
  - Áp dụng theme dựa trên class `.dark-theme`

**CSS Variables được định nghĩa:**

| Variable                  | Light Mode           | Dark Mode               | Mục đích           |
| ------------------------- | -------------------- | ----------------------- | ------------------ |
| `--jira-surface`          | `#ffffff`            | `#1d2125`               | Nền chính          |
| `--jira-surface-raised`   | `#ffffff`            | `#22272b`               | Nền card/dialog    |
| `--jira-surface-sunken`   | `#f4f5f7`            | `#161a1d`               | Nền sidebar        |
| `--jira-text`             | `#172b4d`            | `#b6c2cf`               | Chữ chính          |
| `--jira-text-high`        | -                    | `#ffffff`               | Chữ nổi bật (dark) |
| `--jira-text-secondary`   | `#5e6c84`            | `#8c9bab`               | Chữ phụ            |
| `--jira-border`           | `#dfe1e6`            | `#282e33`               | Đường viền         |
| `--jira-header-bg`        | `#ffffff`            | `#1d2125`               | Nền header         |
| `--jira-sidebar-bg`       | `#f4f5f7`            | `#1d2125`               | Nền sidebar        |
| `--jira-active-link-bg`   | `rgba(0,82,204,0.1)` | `rgba(87,157,255,0.15)` | Nền link active    |
| `--jira-active-link-text` | `#0052cc`            | `#579dff`               | Chữ link active    |

---

### 3. **Main Application Component**

#### `src/app/app.ts`

- **Thêm:**
  - Import `ThemeStore`
  - Inject `themeStore` vào component
  - Nút toggle theme trên toolbar
  - Cập nhật styles để sử dụng CSS variables

**Template Changes:**

```html
<!-- Theme Toggle Button -->
<button mat-icon-button (click)="themeStore.toggleTheme()" class="theme-toggle">
  <mat-icon>{{ themeStore.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
</button>
```

**Style Updates:**

- `.main-toolbar`: Sử dụng `--jira-header-bg`, `--jira-text`, `--jira-border`
- `.main-sidenav`: Sử dụng `--jira-sidebar-bg`, `--jira-border`
- `.active-link`: Sử dụng `--jira-active-link-bg`, `--jira-active-link-text`

---

### 4. **Feature Components**

#### `src/app/features/projects/project-layout/project-layout.ts`

**Thay đổi:**

- Sidebar dự án: `background: var(--jira-sidebar-bg)`
- Header text: `color: var(--jira-text)`
- Active link: Sử dụng theme variables
- Content wrapper: `background-color: var(--jira-surface)`

---

#### `src/app/features/board/backlog/backlog.ts`

**Thay đổi:**

- Container background: `var(--jira-surface)`
- Header title: `color: var(--jira-text)`
- Backlog items:
  - Background: `var(--jira-surface-raised)`
  - Border: `var(--jira-border)`
  - Hover: `var(--jira-border)`
- Issue key/title: Sử dụng `--jira-text` và `--jira-text-secondary`
- Empty state: `background: var(--jira-sidebar-bg)`

---

#### `src/app/features/board/board/board.ts`

**Thay đổi:**

- Board container: `background-color: var(--jira-surface)`
- Board header h2: `color: var(--jira-text)`
- Columns:
  - Background: `var(--jira-sidebar-bg)`
  - Border: `var(--jira-border)`
  - Header text: `var(--jira-text-secondary)`
- Issue cards:
  - Background: `var(--jira-surface-raised)`
  - Title: `color: var(--jira-text)`
  - Key: `color: var(--jira-text-secondary)`
  - Hover: `background-color: var(--jira-border)`
- Drag & Drop:
  - Preview: `background-color: var(--jira-surface-raised)`
  - Placeholder: `background: var(--jira-sidebar-bg)`

---

#### `src/app/features/home/home.ts`

**Thay đổi:**

- Home container: `background-color: var(--jira-surface)`
- Header h1: `color: var(--jira-text)`
- Stat cards:
  - Background: `var(--jira-surface-raised)`
  - Label: `color: var(--jira-text-secondary)`
  - Value: `color: var(--jira-text)`
- Task cards:
  - Background: `var(--jira-surface-raised)`
  - Title: `color: var(--jira-text)`
  - Hover: `background-color: var(--jira-border)`
- Project cards: Tương tự task cards
- Empty state: `color: var(--jira-text-secondary)`

---

#### `src/app/features/my-tasks/my-tasks.ts`

**Thay đổi:**

- Container: `background: var(--jira-surface)`
- Header h2: `color: var(--jira-text)`
- Search icon: `color: var(--jira-text-secondary)`
- Tasks table:
  - Background: `var(--jira-surface-raised)`
  - Border: `var(--jira-border)`
- Issue title: `color: var(--jira-text)`

---

## 🔧 Cơ Chế Hoạt Động

### 1. **Initialization Flow**

```
App Start
    ↓
ThemeStore.onInit()
    ↓
Check localStorage['theme']
    ↓
If exists → Apply saved theme
If not → Check system preference
    ↓
Set isDark signal
    ↓
Effect triggers → Add/Remove .dark-theme class
    ↓
CSS Variables update automatically
```

### 2. **Toggle Flow**

```
User clicks toggle button
    ↓
themeStore.toggleTheme()
    ↓
Update isDark signal
    ↓
Effect triggers:
  - Save to localStorage
  - Update <html> class
  - Update data-theme attribute
    ↓
All components re-render with new colors
```

### 3. **CSS Variable Cascade**

```
html.dark-theme
    ↓
CSS Variables redefined
    ↓
All components using var(--jira-*)
    ↓
Automatic color update
```

---

## 🎨 Design Principles

### 1. **Atlassian Color Palette**

- Tuân thủ chuẩn màu của Jira
- Đảm bảo độ tương phản WCAG AA
- Sử dụng màu xanh dương (#0052cc / #579dff) làm accent color

### 2. **Consistency**

- Tất cả components đều sử dụng chung CSS variables
- Không có hardcoded colors (trừ priority/status badges)
- Đồng nhất về spacing và typography

### 3. **Performance**

- Sử dụng CSS Variables thay vì class switching
- Transition mượt mà (0.3s ease)
- Không re-render toàn bộ app khi toggle

---

## 📊 Thống Kê Thay Đổi

| Loại File               | Số Lượng | Ghi Chú                                                  |
| ----------------------- | -------- | -------------------------------------------------------- |
| **New Files**           | 1        | `theme.store.ts`                                         |
| **Modified Core**       | 2        | `styles.scss`, `app.ts`                                  |
| **Modified Features**   | 5        | `project-layout`, `backlog`, `board`, `home`, `my-tasks` |
| **CSS Variables**       | 12       | Định nghĩa cho cả Light và Dark                          |
| **Total Lines Changed** | ~500+    | Ước tính                                                 |

---

## ✅ Checklist Hoàn Thành

- [x] Tạo ThemeStore với SignalStore
- [x] Định nghĩa Light và Dark theme trong styles.scss
- [x] Tạo CSS Variables cho tất cả màu sắc
- [x] Thêm toggle button vào toolbar
- [x] Cập nhật AppComponent styles
- [x] Cập nhật ProjectLayout styles
- [x] Cập nhật Backlog styles
- [x] Cập nhật Board styles
- [x] Cập nhật Home (Dashboard) styles
- [x] Cập nhật MyTasks styles
- [x] Lưu theme preference vào localStorage
- [x] Hỗ trợ system preference detection
- [x] Smooth transition giữa themes
- [x] Active link highlighting cho cả 2 modes

---

## 🚀 Hướng Dẫn Sử Dụng

### Cho Developer:

1. **Thêm component mới:** Luôn sử dụng CSS variables thay vì hardcoded colors
2. **Kiểm tra theme:** Test component trong cả Light và Dark mode
3. **Extend variables:** Nếu cần thêm màu, định nghĩa trong `styles.scss`

### Cho User:

1. Click vào icon 🌙/☀️ trên thanh header
2. Theme sẽ tự động lưu và áp dụng cho lần truy cập sau

---

## 🔮 Cải Tiến Tương Lai

- [ ] Thêm theme "Auto" (theo giờ trong ngày)
- [ ] Thêm theme "High Contrast" cho accessibility
- [ ] Animation khi chuyển theme
- [ ] Theme customization (cho phép user chọn màu accent)
- [ ] Export/Import theme settings

---

## 📝 Notes

- Tất cả màu sắc đã được test trên cả Light và Dark mode
- Độ tương phản đảm bảo WCAG AA standard
- Code tuân thủ Angular best practices
- Sử dụng Signals để reactive state management
- Performance: Không có memory leak, smooth transitions

---

**Tác giả:** Antigravity AI  
**Ngày hoàn thành:** 15/01/2026  
**Version:** 1.0.0
