# Login Component - Deep Dive

## Tổng quan

Component **Login** là điểm vào chính cho việc xác thực người dùng trong ứng dụng Jira Clone. Component này được xây dựng theo kiến trúc hiện đại của Angular với:

- **Standalone Component**: Không cần NgModule, tự quản lý dependencies
- **Angular Signals**: Quản lý state reactive và tự động
- **NgRx SignalStore**: Quản lý state toàn cục cho authentication
- **Firebase Authentication**: Backend xác thực với Google OAuth và Email/Password
- **Angular Material**: UI components đẹp và nhất quán

---

## 1. Cấu trúc UI (Template)

### 1.1. Layout tổng thể

```
┌─────────────────────────────────────┐
│      .login-container (100vh)       │
│  ┌───────────────────────────────┐  │
│  │     .login-card (max 400px)   │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  Header: Jira Clone     │  │  │
│  │  ├─────────────────────────┤  │  │
│  │  │  [Spinner] (nếu loading)│  │  │
│  │  │  [Error] (nếu có lỗi)   │  │  │
│  │  ├─────────────────────────┤  │  │
│  │  │  ┌─────┬──────────────┐ │  │  │
│  │  │  │Login│  Register    │ │  │  │
│  │  │  ├─────┴──────────────┤ │  │  │
│  │  │  │  Email Input       │ │  │  │
│  │  │  │  Password Input    │ │  │  │
│  │  │  │  [Action Button]   │ │  │  │
│  │  │  └────────────────────┘ │  │  │
│  │  ├─────────────────────────┤  │  │
│  │  │         OR              │  │  │
│  │  ├─────────────────────────┤  │  │
│  │  │  [Sign in with Google] │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 1.2. Phân tích các phần UI

#### **A. Container & Card**

```html
<div class="login-container">
  <mat-card class="login-card">
    <!-- Nội dung -->
  </mat-card>
</div>
```

- **`.login-container`**: Flexbox container căn giữa màn hình (100vh)
- **`mat-card`**: Material Design card với max-width 400px

#### **B. Header**

```html
<mat-card-header>
  <mat-card-title class="title">Jira Clone</mat-card-title>
  <mat-card-subtitle>Sign in to continue</mat-card-subtitle>
</mat-card-header>
```

Hiển thị tiêu đề ứng dụng và subtitle hướng dẫn.

#### **C. Loading & Error States**

```html
@if (store.loading()) {
<div class="spinner-container">
  <mat-spinner diameter="40"></mat-spinner>
</div>
} @if (store.error()) {
<p class="error-message">{{ store.error() }}</p>
}
```

**Cơ chế hoạt động:**

- `store.loading()` là một **Signal** từ AuthStore
- Khi giá trị thay đổi, Angular tự động re-render phần này
- `@if` là cú pháp mới của Angular (thay thế `*ngIf`)

#### **D. Tabs - Login & Register**

```html
<mat-tab-group>
  <mat-tab label="Login">
    <!-- Login Form -->
  </mat-tab>
  <mat-tab label="Register">
    <!-- Register Form -->
  </mat-tab>
</mat-tab-group>
```

**Material Tabs** cho phép chuyển đổi giữa 2 chế độ:

1. **Login Tab**: Email + Password
2. **Register Tab**: Name + Email + Password

#### **E. Form Inputs (Two-way Binding)**

```html
<mat-form-field appearance="outline">
  <mat-label>Email</mat-label>
  <input matInput [(ngModel)]="email" type="email" />
</mat-form-field>
```

**`[(ngModel)]`** - Two-way data binding:

- User gõ → cập nhật biến `email` trong component
- Biến `email` thay đổi → cập nhật giá trị trong input

#### **F. Action Buttons**

```html
<!-- Login Button -->
<button mat-raised-button color="primary" (click)="login()" [disabled]="store.loading()">
  Login
</button>

<!-- Google Sign-in Button -->
<button mat-stroked-button class="google-btn" (click)="store.login()" [disabled]="store.loading()">
  <mat-icon>login</mat-icon>
  Sign in with Google
</button>
```

**Các điểm chú ý:**

- `(click)`: Event binding - gọi hàm khi click
- `[disabled]`: Property binding - disable khi đang loading
- `store.login()`: Gọi trực tiếp method từ AuthStore

---

## 2. Styling (CSS)

### 2.1. Layout Centering

```css
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background-color: #f4f5f7;
}
```

**Kỹ thuật Flexbox** để căn giữa hoàn hảo:

- `align-items: center` → căn giữa theo trục ngang
- `justify-content: center` → căn giữa theo trục dọc
- `height: 100vh` → chiều cao toàn màn hình

### 2.2. Form Layout

```css
.form-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0;
}
```

**Flexbox column** với `gap` để tạo khoảng cách đều giữa các elements.

### 2.3. Error Styling

```css
.error-message {
  color: #d32f2f; /* Material Red 700 */
  font-weight: 500;
  text-align: center;
  margin-bottom: 16px;
}
```

Màu đỏ nổi bật để thu hút sự chú ý của user.

### 2.4. Divider

```css
.divider {
  text-align: center;
  color: #888;
  margin: 16px 0;
  font-size: 12px;
  font-weight: 500;
}
```

Tạo phân cách giữa form login và Google sign-in.

---

## 3. Component Logic (TypeScript)

### 3.1. Class Definition & Dependencies

```typescript
export class Login {
  readonly store = inject(AuthStore);
  private router = inject(Router);

  email = '';
  password = '';
  name = '';

  // ...
}
```

#### **Dependency Injection:**

- **`AuthStore`**: Store quản lý state authentication (user, loading, error)
- **`Router`**: Điều hướng trang sau khi login thành công

#### **Form Data:**

- `email`, `password`, `name`: Biến lưu trữ dữ liệu form (two-way binding)

### 3.2. Constructor & Effect (Auto Navigation)

```typescript
constructor() {
  effect(() => {
    if (this.store.user()) {
      this.router.navigate(['/projects']);
    }
  });
}
```

#### **Angular Effect - Reactive Programming:**

**Effect** là một tính năng mạnh mẽ của Angular Signals:

- Tự động chạy lại khi **bất kỳ signal nào** bên trong nó thay đổi
- Trong trường hợp này: theo dõi `this.store.user()`

**Luồng hoạt động:**

1. User đăng nhập thành công
2. `AuthStore` cập nhật signal `user` (từ `null` → `User object`)
3. Effect phát hiện thay đổi → tự động chạy
4. `router.navigate(['/projects'])` → chuyển hướng đến trang projects

**Lợi ích:**

- ✅ Không cần subscribe/unsubscribe thủ công
- ✅ Tự động cleanup khi component bị destroy
- ✅ Code gọn gàng, dễ đọc

### 3.3. Login Method

```typescript
login() {
  if (this.email && this.password) {
    this.store.loginEmail(this.email, this.password);
  }
}
```

**Validation đơn giản:**

- Kiểm tra email và password có giá trị
- Gọi `store.loginEmail()` để xử lý logic đăng nhập

**Tại sao không xử lý trực tiếp ở đây?**

- Tách biệt UI logic và Business logic
- AuthStore chịu trách nhiệm quản lý state và gọi API
- Component chỉ là "cầu nối" giữa UI và Store

### 3.4. Register Method

```typescript
register() {
  if (this.email && this.password && this.name) {
    this.store.register(this.email, this.password, this.name);
  }
}
```

Tương tự `login()`, nhưng yêu cầu thêm `name`.

---

## 4. AuthStore - State Management

File: `src/app/core/auth/auth.store.ts`

### 4.1. Store Structure

```typescript
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withMethods(/* ... */),
  withHooks(/* ... */)
);
```

#### **NgRx SignalStore Features:**

1. **`providedIn: 'root'`**: Singleton store, dùng chung toàn app
2. **`withLoadingError()`**: Custom feature cung cấp:
   - `loading` signal
   - `error` signal
   - `setLoading()`, `setError()`, `clearError()` methods
3. **`withState()`**: Định nghĩa state ban đầu
4. **`withMethods()`**: Định nghĩa các actions/methods
5. **`withHooks()`**: Lifecycle hooks (onInit, onDestroy)

### 4.2. State Definition

```typescript
type AuthState = {
  user: User | null;
};

const initialState: AuthState = {
  user: null,
};
```

State đơn giản chỉ chứa thông tin user hiện tại.

### 4.3. Methods - Login with Email

```typescript
loginEmail: async (email: string, pass: string) => {
  store.setLoading(true);
  store.clearError();
  try {
    await authService.loginWithEmail(email, pass);
    errorService.showSuccess('Welcome back!');
    store.setLoading(false);
  } catch (error: any) {
    const errorMessage = error?.message || 'Login failed';
    errorService.showError(errorMessage);
  }
};
```

#### **Luồng xử lý:**

1. **Set loading state**: `store.setLoading(true)`

   - UI hiển thị spinner
   - Disable các buttons

2. **Clear previous errors**: `store.clearError()`

3. **Call AuthService**: `await authService.loginWithEmail(email, pass)`

   - Gọi Firebase Authentication API
   - Nếu thành công: Firebase tự động cập nhật auth state
   - Nếu thất bại: throw error

4. **Success handling**:

   - Hiển thị success notification
   - Set loading = false

5. **Error handling**:
   - Catch error
   - Hiển thị error notification qua `ErrorNotificationService`

**Lưu ý quan trọng:**

- Không cần set `user` thủ công ở đây
- Firebase auth state listener sẽ tự động cập nhật (xem phần 4.5)

### 4.4. Methods - Register

```typescript
register: async (email: string, pass: string, name: string) => {
  store.setLoading(true);
  store.clearError();
  try {
    await authService.registerWithEmail(email, pass, name);
    errorService.showSuccess('Account created successfully! Welcome!');
    store.setLoading(false);
  } catch (error: any) {
    const errorMessage = error?.message || 'Registration failed';
    errorService.showError(errorMessage);
  }
};
```

Tương tự `loginEmail`, nhưng gọi `registerWithEmail()` và truyền thêm `name`.

### 4.5. Methods - Login with Google

```typescript
login: async () => {
  store.setLoading(true);
  store.clearError();

  const onFocus = () => {
    store.setLoading(false);
  };
  window.addEventListener('focus', onFocus);

  try {
    await authService.loginWithGoogle();
    errorService.showSuccess('Welcome! Login successful');
  } catch (error: any) {
    if (
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request'
    ) {
      console.log('Popup closed by user');
    } else {
      errorService.showError(error?.message || 'Login failed');
    }
  } finally {
    window.removeEventListener('focus', onFocus);
    store.setLoading(false);
  }
};
```

#### **Xử lý đặc biệt cho Google Popup:**

1. **Focus listener**: Khi user đóng popup và quay lại tab

   - Set loading = false để không bị "kẹt" ở trạng thái loading

2. **Error handling**:

   - Bỏ qua lỗi "popup-closed-by-user" (user tự đóng)
   - Hiển thị lỗi thực sự nếu có

3. **Cleanup**: Remove event listener trong `finally`

### 4.6. Hooks - Auth State Listener

```typescript
withHooks({
  onInit(store, authService = inject(AuthService)) {
    authService.user$.subscribe((user) => {
      store._setUser(user);
    });
  },
});
```

#### **Cơ chế tự động cập nhật user:**

1. **`authService.user$`**: Observable từ Firebase

   - Emit mỗi khi auth state thay đổi (login/logout)

2. **Subscribe**: Lắng nghe thay đổi

   - Khi user login → emit `User` object
   - Khi user logout → emit `null`

3. **`_setUser()`**: Internal method cập nhật state
   ```typescript
   _setUser: (user: User | null) => {
     patchState(store, { user });
     store.setLoading(false);
   };
   ```

**Đây là "trái tim" của auto-sync:**

- Không cần gọi `_setUser()` thủ công
- Firebase tự động notify khi auth state thay đổi
- Store tự động cập nhật → UI tự động re-render

---

## 5. AuthService - Firebase Integration

File: `src/app/core/auth/auth.service.ts`

### 5.1. Service Structure

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);
  user$: Observable<User | null> = user(this.auth);
  private firestore = inject(Firestore);

  // Methods...
}
```

#### **Dependencies:**

- **`Auth`**: Firebase Authentication instance
- **`Firestore`**: Firebase Firestore database
- **`user$`**: Observable theo dõi auth state

### 5.2. Login with Google

```typescript
async loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  const cred = await signInWithPopup(this.auth, provider);
  await this.syncUserToFirestore(cred.user);
  return cred;
}
```

#### **Luồng hoạt động:**

1. **Tạo provider**: `GoogleAuthProvider`
2. **Set custom params**: `prompt: 'select_account'`
   - Luôn hiển thị account picker (không auto-login)
3. **Show popup**: `signInWithPopup()`
   - Mở popup Google OAuth
   - User chọn account và authorize
4. **Sync to Firestore**: Lưu thông tin user vào database
5. **Return credentials**: Trả về thông tin đăng nhập

### 5.3. Login with Email

```typescript
async loginWithEmail(email: string, pass: string) {
  return signInWithEmailAndPassword(this.auth, email, pass);
}
```

Wrapper đơn giản cho Firebase method.

### 5.4. Register with Email

```typescript
async registerWithEmail(email: string, pass: string, name: string) {
  const cred = await createUserWithEmailAndPassword(this.auth, email, pass);
  if (cred.user) {
    await updateProfile(cred.user, { displayName: name });
    await cred.user.reload();
    await this.syncUserToFirestore(this.auth.currentUser || cred.user);
  }
  return cred;
}
```

#### **Các bước:**

1. **Create account**: `createUserWithEmailAndPassword()`
2. **Update profile**: Set `displayName` = name
3. **Reload user**: Refresh để lấy thông tin mới nhất
4. **Sync to Firestore**: Lưu vào database

### 5.5. Sync User to Firestore

```typescript
private async syncUserToFirestore(user: User) {
  const userDoc = doc(this.firestore, 'users', user.uid);
  await setDoc(
    userDoc,
    {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    },
    { merge: true }
  );
}
```

#### **Tại sao cần sync?**

Firebase Auth chỉ lưu thông tin xác thực. Để query users (ví dụ: lấy danh sách members), cần lưu vào Firestore.

**`{ merge: true }`**: Chỉ update các fields có trong object, không xóa fields khác.

---

## 6. Luồng dữ liệu hoàn chỉnh (Data Flow)

### 6.1. Login Flow - Email/Password

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                               │
│    User nhập email/password và click "Login"                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. LOGIN COMPONENT                                           │
│    login() {                                                 │
│      this.store.loginEmail(email, password)                  │
│    }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. AUTH STORE                                                │
│    loginEmail: async (email, pass) => {                      │
│      store.setLoading(true)  ───────────┐                   │
│      await authService.loginWithEmail() │                    │
│    }                                     │                   │
└──────────────────────┬───────────────────┼───────────────────┘
                       │                   │
                       │                   ▼
                       │         ┌─────────────────────┐
                       │         │ UI UPDATE           │
                       │         │ - Show spinner      │
                       │         │ - Disable buttons   │
                       │         └─────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. AUTH SERVICE                                              │
│    loginWithEmail(email, pass) {                             │
│      return signInWithEmailAndPassword(auth, email, pass)    │
│    }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. FIREBASE AUTHENTICATION                                   │
│    - Verify credentials                                      │
│    - Update auth state                                       │
│    - Emit user object via user$ Observable                   │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. AUTH STORE HOOK (Auto-triggered)                          │
│    authService.user$.subscribe((user) => {                   │
│      store._setUser(user)  ──────────┐                      │
│    })                                 │                      │
└───────────────────────────────────────┼──────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────────┐
                              │ STATE UPDATE        │
                              │ user: User object   │
                              │ loading: false      │
                              └──────────┬──────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. LOGIN COMPONENT EFFECT (Auto-triggered)                   │
│    effect(() => {                                            │
│      if (this.store.user()) {                                │
│        this.router.navigate(['/projects'])                   │
│      }                                                       │
│    })                                                        │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. NAVIGATION                                                │
│    User được chuyển hướng đến /projects                      │
└──────────────────────────────────────────────────────────────┘
```

### 6.2. Login Flow - Google OAuth

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                               │
│    User click "Sign in with Google"                          │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. AUTH STORE (Direct call from template)                    │
│    store.login()                                             │
│    - setLoading(true)                                        │
│    - Add focus listener                                      │
│    - await authService.loginWithGoogle()                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. AUTH SERVICE                                              │
│    loginWithGoogle() {                                       │
│      - Create GoogleAuthProvider                             │
│      - signInWithPopup()  ────────────┐                     │
│      - syncUserToFirestore()          │                      │
│    }                                   │                     │
└────────────────────┬───────────────────┼─────────────────────┘
                     │                   │
                     │                   ▼
                     │         ┌─────────────────────┐
                     │         │ GOOGLE POPUP        │
                     │         │ User selects account│
                     │         │ and authorizes      │
                     │         └─────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. FIREBASE AUTH + FIRESTORE                                 │
│    - Authenticate with Google                                │
│    - Save user to Firestore 'users' collection               │
│    - Update auth state                                       │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
         (Same as steps 6-8 above)
```

### 6.3. Register Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. USER ACTION                                               │
│    User nhập name/email/password và click "Register"        │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. LOGIN COMPONENT                                           │
│    register() {                                              │
│      this.store.register(email, password, name)              │
│    }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. AUTH STORE                                                │
│    register: async (email, pass, name) => {                  │
│      store.setLoading(true)                                  │
│      await authService.registerWithEmail()                   │
│    }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. AUTH SERVICE                                              │
│    registerWithEmail(email, pass, name) {                    │
│      - createUserWithEmailAndPassword()                      │
│      - updateProfile(displayName: name)                      │
│      - reload user                                           │
│      - syncUserToFirestore()                                 │
│    }                                                         │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
         (Same as steps 5-8 in Login Flow)
```

---

## 7. Các khái niệm quan trọng

### 7.1. Angular Signals

**Signal** là một primitive reactive value trong Angular:

```typescript
// Tạo signal
const count = signal(0);

// Đọc giá trị
console.log(count()); // 0

// Cập nhật giá trị
count.set(1);
count.update((v) => v + 1);
```

**Lợi ích:**

- ✅ Fine-grained reactivity (chỉ update đúng phần cần thiết)
- ✅ Tự động track dependencies
- ✅ Performance tốt hơn Zone.js

**Trong Login component:**

- `store.user()`: Signal chứa user object
- `store.loading()`: Signal chứa loading state
- `store.error()`: Signal chứa error message

### 7.2. Effect

**Effect** tự động chạy lại khi signals bên trong thay đổi:

```typescript
effect(() => {
  console.log('User:', this.store.user());
  // Tự động chạy lại khi store.user() thay đổi
});
```

**Use cases:**

- Logging
- Sync với localStorage
- Navigation (như trong Login component)
- Side effects khác

### 7.3. NgRx SignalStore

**SignalStore** là state management solution mới của NgRx:

```typescript
export const MyStore = signalStore(
  { providedIn: 'root' },
  withState({ count: 0 }),
  withMethods((store) => ({
    increment: () => patchState(store, { count: store.count() + 1 }),
  }))
);
```

**So với NgRx Store cũ:**

- ✅ Ít boilerplate hơn
- ✅ Type-safe hơn
- ✅ Dễ học hơn
- ✅ Performance tốt hơn

### 7.4. Dependency Injection với inject()

**Cách cũ (Constructor injection):**

```typescript
constructor(private authStore: AuthStore, private router: Router) {}
```

**Cách mới (inject function):**

```typescript
readonly store = inject(AuthStore);
private router = inject(Router);
```

**Lợi ích:**

- ✅ Có thể inject ở bất kỳ đâu (không chỉ constructor)
- ✅ Code ngắn gọn hơn
- ✅ Dễ test hơn

### 7.5. Two-way Binding với [(ngModel)]

```html
<input [(ngModel)]="email" />
```

**Tương đương với:**

```html
<input [ngModel]="email" (ngModelChange)="email = $event" />
```

**Banana in a box syntax:** `[()]`

- `[]` = Property binding (component → view)
- `()` = Event binding (view → component)

---

## 8. Best Practices được áp dụng

### 8.1. Separation of Concerns

✅ **Component**: Chỉ xử lý UI logic
✅ **Store**: Quản lý state và orchestrate business logic
✅ **Service**: Gọi API và xử lý data

### 8.2. Reactive Programming

✅ Sử dụng Signals thay vì manual state management
✅ Effect tự động xử lý side effects
✅ Observable cho async data streams

### 8.3. Error Handling

✅ Centralized error notification service
✅ User-friendly error messages
✅ Loading states để improve UX

### 8.4. Type Safety

✅ TypeScript strict mode
✅ Typed state và methods
✅ Firebase types từ `@angular/fire`

### 8.5. Modern Angular Features

✅ Standalone components
✅ New control flow syntax (`@if`, `@for`)
✅ Signal-based reactivity
✅ inject() function

---

## 9. Potential Improvements

### 9.1. Form Validation

**Hiện tại:** Chỉ kiểm tra truthy values
**Cải thiện:** Sử dụng Reactive Forms với validators

```typescript
loginForm = new FormGroup({
  email: new FormControl('', [Validators.required, Validators.email]),
  password: new FormControl('', [Validators.required, Validators.minLength(6)]),
});
```

### 9.2. Password Visibility Toggle

Thêm button để show/hide password:

```html
<mat-form-field>
  <input matInput [type]="hidePassword ? 'password' : 'text'" />
  <button mat-icon-button matSuffix (click)="hidePassword = !hidePassword">
    <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
  </button>
</mat-form-field>
```

### 9.3. Remember Me

Lưu email vào localStorage:

```typescript
if (rememberMe) {
  localStorage.setItem('rememberedEmail', email);
}
```

### 9.4. Password Reset

Thêm link "Forgot Password?" và implement reset flow.

### 9.5. Loading State per Action

Hiện tại: Chỉ có 1 loading state chung
Cải thiện: Tách loading cho từng action (loginLoading, registerLoading, googleLoading)

---

## 10. Tổng kết

Component **Login** là một ví dụ tuyệt vời về:

- ✅ Modern Angular architecture
- ✅ Clean separation of concerns
- ✅ Reactive state management
- ✅ Type-safe code
- ✅ User-friendly UI/UX

**Key Takeaways:**

1. **Signals + Effects** = Powerful reactive programming
2. **SignalStore** = Simple yet powerful state management
3. **Firebase Auth** = Easy authentication with multiple providers
4. **Material Design** = Beautiful, accessible UI components
5. **Standalone Components** = Simpler, more modular architecture

Đây là foundation vững chắc cho việc xây dựng các features phức tạp hơn trong ứng dụng!
