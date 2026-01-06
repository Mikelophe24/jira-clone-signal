# Phân Tích Luồng Hoạt Động Chi Tiết (Deep Dive Flows)

Tài liệu này bổ sung cho `DOCUMENTATION_VN.md`, đi sâu vào **luồng dữ liệu (Data Flow)** và **thứ tự thực thi (Execution Sequence)** ở cấp độ code.

---

## 1. Luồng Khởi Động Ứng Dụng (Bootstrap Flow)

Đây là những gì xảy ra khi bạn tải lại trang (F5):

1.  **`main.ts`**:

    - Gọi `bootstrapApplication(AppComponent, appConfig)`.
    - Khởi tạo Angular Context và Dependency Injection (DI) Root.

2.  **`app.config.ts` (Cấu hình Global)**:

    - `provideRouter(routes)`: Kích hoạt hệ thống định tuyến.
    - `provideFirebaseApp(...)` & `provideFirestore(...)`: Kết nối tới Firebase ngay lập tức.
    - **Quan Trọng**: Các Store (`AuthStore`, `ProjectsStore`) được cung cấp ở dạng `providedIn: 'root'`, nghĩa là chúng là Singleton (chỉ có 1 bản thể duy nhất toàn app).

3.  **Authentication Init (`auth.store.ts`)**:

    - Ngay khi App khởi chạy, `AuthStore` (được inject ở đâu đó hoặc chạy ngầm) sẽ kích hoạt hook `onInit`.
    - Hook này gọi `onAuthStateChanged` của Firebase SDK.
    - **Kết quả**: Firebase trả về user session (nếu đã login trước đó). Signal `user` trong Store chuyển từ `null` -> `Object User`.

4.  **Routing (`app.routes.ts`)**:
    - Router kiểm tra URL hiện tại (ví dụ `/project/...`).
    - Chạy **`auth.guard.ts`**:
      - Guard kiểm tra `authStore.user()`.
      - Nếu User chưa load xong (loading=true)? Guard có thể chờ hoặc redirect (tùy logic implement).
      - Nếu User OK -> Cho phép render Component.

---

## 2. Luồng Dữ Liệu "Reactive" Với Signals (The Signal Chain)

Mô hình dữ liệu của app này khác hoàn toàn với cách viết Angular cũ. Nó là **đơn chiều (One-way Data Flow)** và **tự động tính toán (Derived State)**.

**Ví dụ: Tính năng Filter trên Bảng Kanban**

Hãy hình dung các Signal như các ô trong Excel. Khi ô A đổi, ô B tự đổi.

1.  **Nguồn Dữ Liệu (Source Signals)**:

    - `issues()`: Array chứa 100 task lấy từ API.
    - `filter()`: Object `{ query: '', priority: ['high'] }`.

2.  **Tín Hiệu Tính Toán (Computed Signals - The "Brain")**:

    - Trong `board.store.ts`:
      ```typescript
      // "Ô B" trong Excel tương đương:
      filteredIssues = computed(() => {
          const all = issues(); // Lắng nghe ô A
          const currentFilter = filter(); // Lắng nghe ô Filter

          // Logic chạy tự động mỗi khi A hoặc Filter thay đổi
          return all.filter(t => t.priority === currentFilter.priority ...);
      });
      ```

3.  **Tín Hiệu Phân Nhóm (Derived Grouping)**:

    - UI cần 3 cột, nên ta có thêm computed:
      ```typescript
      // "Ô C" lắng nghe "Ô B"
      todoIssues = computed(() => filteredIssues().filter((t) => t.status === 'todo'));
      doneIssues = computed(() => filteredIssues().filter((t) => t.status === 'done'));
      ```

4.  **UI Update (Effect)**:
    - Template HTML chỉ việc gọi `store.todoIssues()`. Khi "Ô C" đổi -> UI tự vẽ lại. **Không cần gọi hàm render thủ công.**

---

## 3. Luồng Kéo Thả & Optimistic UI (Detailed Drag & Drop)

Tính năng kéo thả làm sao để mượt mà (không giật lag chờ server)?

**Kịch bản**: Kéo Task A từ "TO DO" sang "DONE".

1.  **User Drop Item**:

    - Sự kiện `cdkDropListDropped` kích hoạt tại `board.ts`.
    - Gọi `store.moveIssue(event, 'done')`.

2.  **Cập Nhật Tức Thì (Optimistic Update)**:

    - Ngay lập tức, `patchState` cập nhật `issues` array trong Store.
    - Task A được gán `status = 'done'`.
    - **Kết quả**: Trên màn hình, User thấy task nhảy sang cột mới **ngay lập tức** (0ms latency).

3.  **Xử Lý Bất Đồng Bộ (Side Effect)**:

    - Sau khi update UI, Store mới lặng lẽ gọi `firestore.updateDoc(...)` để lưu xuống server.

4.  **Xử Lý Lỗi (Rollback Strategy)**:
    - Nếu server báo lỗi (ví dụ: mất mạng)?
    - (Cần implement thêm): Catch error -> Revert `status` của Task A về lại 'todo' -> Hiện thông báo lỗi.

---

## 4. Luồng Fix Lỗi "Mất Avatar Khi F5"

Đây là vấn đề "Race Condition" (Chạy đua kiến trúc) điển hình.

**Vấn đề:**

- Thread 1: Load issues (Nhanh).
- Thread 2: Load project metadata & members (Chậm hơn hoặc không chạy do mất state).

**Giải pháp (Code trong `board.ts` constructor):**

```typescript
effect(() => {
  // Signal Effect: Chạy bất cứ khi nào user() hoặc projects() thay đổi
  const user = this.authStore.user();

  // Điều kiện kích hoạt: Đã login NHƯNG chưa có data projects
  if (user && this.projectsStore.projects().length === 0) {
    // -> BẮT BUỘC gọi load lại
    this.projectsStore.loadProjects(user.uid);
  }
});
```

**Thứ tự chạy khi F5:**

1.  App Init. `projects` = `[]`.
2.  Auth Init. `user` load xong -> có data.
3.  Effect phát hiện: "Có user mà `projects` rỗng kìa!" -> Gọi `loadProjects()`.
4.  `loadProjects` xong -> `projects` có data.
5.  Logic cũ: `projectsStore.selectProject(id)` chạy lại (do signal update).
6.  Store tìm thấy project -> Load members -> Avatar hiển thị.

---

## 5. Tóm Tắt Code Map

- **Logic UI**: Xem `*.component.ts`.
- **Logic Dữ Liệu/Xử Lý**: Xem `*.store.ts` (Đây là nơi quan trọng nhất).
- **Định nghĩa Dữ Liệu**: Xem `*.model.ts`.
- **Kết nối Backend**: Xem `*.service.ts` (Chỉ dùng để gọi API thô, không chứa state).
