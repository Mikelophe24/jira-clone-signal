# Hướng dẫn Deploy dự án lên Firebase Hosting

Dự án này sử dụng **Angular** và **Firebase**. Dưới đây là các bước để deploy ứng dụng của bạn lên Firebase Hosting.

## 1. Chuẩn bị

Đảm bảo bạn đã cài đặt **Firebase CLI**. Nếu chưa, hãy mở terminal và chạy:

```bash
npm install -g firebase-tools
```

## 2. Đăng nhập vào Firebase

Để cấp quyền cho Firebase CLI truy cập vào tài khoản của bạn:

```bash
firebase login
```

Trình duyệt sẽ mở ra để bạn đăng nhập bằng tài khoản Google (tài khoản chứa dự án Firebase của bạn).

## 3. Khởi tạo Hosting (Chỉ làm lần đầu)

Chạy lệnh sau tại thư mục gốc của dự án:

```bash
firebase init hosting
```

Trả lời các câu hỏi như sau:

1.  **What do you want to use as your public directory?**
    - Nhập: `dist/signal-jira-clone/browser`
    - _(Kiểm tra lại thư mục `dist` sau khi build để chắc chắn đường dẫn này đúng. Angular newer versions thường build ra `dist/<project-name>/browser`)_

2.  **Configure as a single-page app (rewrite all urls to /index.html)?**
    - Nhập: `y` (Yes) - Vì đây là ứng dụng Angular SPA.

3.  **Set up automatic builds and deploys with GitHub?**
    - Nhập: `n` (No) - Trừ khi bạn muốn setup CI/CD ngay bây giờ.

4.  **File index.html already exists. Overwrite?**
    - Nhập: `n` (No) - **QUAN TRỌNG**: Không được ghi đè file `index.html` của bạn.

## 4. Build dự án

Trước khi deploy, bạn cần build code TypeScript thành JavaScript tối ưu cho production.

```bash
ng build
```

_Lưu ý: Tôi đã cập nhật `angular.json` để tăng giới hạn kích thước bundle (budget) giúp lệnh build không bị lỗi._

## 5. Deploy

Sau khi build xong, chạy lệnh:

```bash
firebase deploy --only hosting
```

Nếu bạn muốn deploy cả Firestore Rules (để bảo mật DB) và Indexes:

```bash
firebase deploy
```

## 6. Kiểm tra

Sau khi deploy thành công, terminal sẽ hiển thị **Hosting URL**. Bạn có thể truy cập link đó để xem ứng dụng của mình chạy online.

---

## Tự động hóa (Optional)

Bạn có thể thêm script vào `package.json` để deploy nhanh hơn:

```json
"scripts": {
  "deploy": "ng build && firebase deploy --only hosting"
}
```

Sau đó chỉ cần chạy:

```bash
npm run deploy
```
