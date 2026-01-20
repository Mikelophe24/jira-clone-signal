# Sprint Workflow - Tài liệu Chi tiết (Updated)

## Mục lục

1. [Tổng quan](#tổng-quan)
2. [Data Model](#data-model)
3. [Quy tắc Trạng thái (State Rules)](#quy-tắc-trạng-thái-state-rules)
4. [Luồng hoạt động Sprint](#luồng-hoạt-động-sprint)
   - [Tạo Sprint](#1-tạo-sprint-create-sprint)
   - [Start Sprint](#3-start-sprint)
   - [Complete Sprint](#7-complete-sprint-logic-phức-tạp)
5. [Cấu trúc Components & Store](#cấu-trúc-components--store)
6. [Firestore & Security](#firestore--security)

---

## Tổng quan

Hệ thống quản lý Sprint được thiết kế để hỗ trợ quy trình Agile/Scrum trên nền tảng Angular + Firebase (Firestore).
Core logic xoay quanh việc quản lý trạng thái của **Sprint** và **Issue** thông qua `SprintStore` và `BoardStore` (NgRx Signals).

### Các loại Sprint

- **Active Sprint**: Sprint đang chạy. Issues hiển thị trên cột Kanban Board.
- **Future Sprint**: Sprint đã lên kế hoạch nhưng chưa bắt đầu. Issues hiển thị trong panel riêng ở màn hình Backlog.
- **Completed Sprint**: Sprint đã kết thúc. Issues hoàn thành được lưu trữ (archived).

---

## Data Model

### 1. Sprint Model (`sprint.model.ts`)

```typescript
export interface Sprint {
  id: string;
  projectId: string;
  name: string; // VD: "Sprint 1"
  goal?: string; // Mục tiêu sprint
  startDate: string; // ISO String
  endDate: string; // ISO String
  status: 'future' | 'active' | 'completed';
}
```

### 2. Issue Model (`issue.model.ts`)

Các trường quan trọng liên quan đến Sprint:

```typescript
export interface Issue {
  id: string;
  projectId: string;

  // Liên kết Sprint
  sprintId?: string | null; // ID của sprint hiện tại. Null = Backlog thuần

  // Hiển thị
  isInBacklog?: boolean; // QUAN TRỌNG: Quyết định issue hiện ở Backlog hay Board
  // true: Luôn hiện ở màn hình Backlog (dù có sprintId hay không)
  // false: Hiện ở màn hình Board (chỉ khi sprintId = activeSprintId)

  // Trạng thái công việc
  statusColumnId: string; // 'todo' | 'in-progress' | 'done'

  // Lưu trữ
  isArchived?: boolean; // true: Issue đã xong từ sprint cũ (Soft Delete khỏi view hiện tại)

  // Subtasks (ảnh hưởng logic Complete Sprint)
  subtasks?: Subtask[]; // [{ completed: boolean, title: string }]
}
```

---

## Quy tắc Trạng thái (State Rules)

Ma trận quyết định vị trí hiển thị của một Issue:

| Trạng thái Sprint                                  | `sprintId` | `isInBacklog` | `isArchived` | Vị trí hiển thị                          |
| :------------------------------------------------- | :--------- | :------------ | :----------- | :--------------------------------------- |
| **Không có (Backlog)**                             | `null`     | `true`        | `false`      | **Backlog View** (Danh sách Issues)      |
| **Future Sprint**                                  | `UUID`     | `true`        | `false`      | **Backlog View** (Trong Panel Sprint đó) |
| **Active Sprint**                                  | `UUID`     | `false`       | `false`      | **Board View** (Cột Kanban)              |
| **Active Sprint** (đang làm nhưng đẩy lại Backlog) | `UUID`     | `true`        | `false`      | **Backlog View** (Trong Panel Sprint đó) |
| **Completed Sprint** (Đã xong)                     | `UUID`     | `false`       | `true`       | **Ẩn** (Chỉ hiện trong report/history)   |

---

## Luồng hoạt động Sprint

### 1. Tạo Sprint (Create Sprint)

- **Vị trí**: Màn hình Backlog (`backlog.ts`).
- **Hành động**: User click "Create Sprint".
- **Logic**:
  1. Tạo sprint mới với `status: 'future'`.
  2. Tên tự động: `Sprint {tổng số sprint + 1}`.
  3. Không có issue nào được gán ban đầu.

### 2. Kéo thả Issue (Drag & Drop)

- **Logic (`backlog.ts -> drop`)**:
  - Kéo vào **Active Sprint**: Set `sprintId = activeId`, `isInBacklog = false`. -> **Bay thẳng lên Board**.
  - Kéo vào **Future Sprint**: Set `sprintId = futureId`, `isInBacklog = true`. -> **Nằm chờ trong panel**.
  - Kéo ra **Backlog**: Set `sprintId = null`, `isInBacklog = true`.

### 3. Start Sprint

- **Điều kiện**: Sprint đang ở trạng thái `future` và có ít nhất 1 issue.
- **Dialog (`start-sprint-dialog.ts`)**: Cho phép user chỉnh sửa `startDate`, `endDate`, `goal`.
- **Logic Xử lý**:
  1. Update Sprint: `status` -> `'active'`.
  2. Batch Update Issues trong sprint đó: `isInBacklog` -> `false`.
  3. Navigate sang màn hình Board.

### 7. Complete Sprint (Logic Phức tạp)

Đây là luồng phức tạp nhất trong hệ thống, nằm ở `Board.completeSprint` (`board.ts`) & `Backlog.completeSprint` (`backlog.ts`).

#### Bước 1: Validate Subtasks

Khi user nhấn "Complete Sprint", hệ thống kiểm tra toàn bộ issues trong sprint:

- Nếu có issue nào **có subtask chưa hoàn thành** (`subtask.completed === false`):
  - **Chặn** việc complete sprint.
  - Hiển thị danh sách các issue bị kẹt.
  - User phải click vào link issue để resolve hoặc mark done subtasks trước.

#### Bước 2: Phân loại Issue

Hệ thống chia issues thành 2 nhóm:

1. **Completed Issues**: `statusColumnId === 'done'`.
2. **Incomplete Issues**: `statusColumnId !== 'done'` (VD: todo, in-progress).

#### Bước 3: Chọn điểm đến cho Incomplete Issues

User chọn nơi đẩy các issue chưa làm xong:

- **Backlog**: Issues sẽ về list backlog.
- **New Sprint**: Hệ thống tự tạo một Future Sprint mới và đẩy issue vào đó.
- **Existing Future Sprint**: Đẩy vào sprint tương lai đã có sẵn.

#### Bước 4: Thực thi (Batch Update)

Sau khi user confirm:

1. **Update Sprint**: `status` -> `'completed'`, `completedAt` -> `now`.
2. **Xử lý Incomplete Issues**:
   - `sprintId` -> `destinationId` (hoặc `null` nếu về Backlog).
   - `isInBacklog` -> `true`.
3. **Xử lý Completed Issues (Archiving)**:
   - `isArchived` -> `true`.
   - Giữ nguyên `sprintId` là sprint vừa complete (để lưu lịch sử: issue này thuộc sprint nào).
   - `isInBacklog` -> `false` (hoặc không quan trọng vì đã archived).

---

## Cấu trúc Components & Store

### 1. SprintStore (`sprint.store.ts`)

Store quản lý state của sprints.

- **Selectors**:
  - `activeSprint`: Sprint đang chạy (thường chỉ có 1).
  - `futureSprints`: Danh sách sprint chưa chạy.
  - `completedSprints`: Lịch sử.
- **Effects**: Tự động load sprint theo `projectId`.

### 2. BoardStore (`board.store.ts`)

Store quản lý issues, nơi diễn ra logic lọc hiển thị quan trọng.

- **Computed `filteredIssues`**:
  ```typescript
  // Logic lọc issue hiển thị trên Board
  return issues().filter((issue) => {
    const isActiveSprint = issue.sprintId === activeSprintId;
    const isNotBacklog = !issue.isInBacklog;
    const isNotArchived = !issue.isArchived; // Mới thêm logic này

    return isActiveSprint && isNotBacklog && isNotArchived;
  });
  ```

### 3. Backlog Component (`backlog.ts`)

- Quản lý 2 danh sách chính:
  - `backlogIssues`: Issues có `sprintId === null`.
  - `sprintIssuesMap`: Map nhóm issues theo sprintId (cho các Future Sprints).

### 4. Board Component (`board.ts`)

- Hiển thị Kanban columns (Todo, In Progress, Done).
- Chỉ render khi `activeSprint` tồn tại.
- Quản lý logic `completeSprint`.

---

## Firestore & Security

### Collections

- `/projects/{id}/sprints`: Chứa documents sprint.
- `/issues`: Chứa tất cả issues (query theo `projectId`).

### Batch Operations (`issue.service.ts`)

- `batchUpdateIssues`: Dùng mạnh mẽ trong Start/Complete sprint để update hàng loạt (tối đa 500 docs/batch). Đảm bảo tính toàn vẹn dữ liệu (all or nothing).

### Security Rules (Giả định)

- User phải là Member của Project mới được Start/Complete Sprint.
- Viewer chỉ được xem (`read`).

---

_Tài liệu này được cập nhật dựa trên source code ngày 20/01/2026._
