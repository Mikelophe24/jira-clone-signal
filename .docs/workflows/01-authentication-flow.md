# Luồng Xác Thực (Authentication Flow) - Chi Tiết

## 📋 Mục Lục

1. [Tổng Quan](#1-tổng-quan)
2. [Kiến Trúc Authentication](#2-kiến-trúc-authentication)
3. [Đăng Nhập Google OAuth](#3-đăng-nhập-google-oauth)
4. [Đăng Nhập Email/Password](#4-đăng-nhập-emailpassword)
5. [Đăng Ký Tài Khoản](#5-đăng-ký-tài-khoản)
6. [Đăng Xuất](#6-đăng-xuất)
7. [Route Protection với AuthGuard](#7-route-protection-với-authguard)
8. [Persistent Authentication](#8-persistent-authentication)
9. [Error Handling](#9-error-handling)
10. [Code Examples](#10-code-examples)

---

## 1. Tổng Quan

### 1.1 Mục Đích

Authentication flow đảm bảo:

- ✅ Chỉ user đã đăng nhập mới truy cập được app
- ✅ User identity được xác thực qua Firebase
- ✅ Session được duy trì khi refresh page
- ✅ Protected routes không thể truy cập khi chưa login

### 1.2 Tech Stack

- **Firebase Authentication**: Backend authentication service
- **NgRx Signals**: State management cho user state
- **Angular Router Guards**: Route protection
- **RxJS Observables**: Reactive auth state changes

### 1.3 Files Liên Quan

```
src/app/core/auth/
├── auth.store.ts          # State management
├── auth.service.ts        # Firebase API calls
├── auth.guard.ts          # Route protection
└── auth.model.ts          # Type definitions

src/app/features/auth/
└── login/
    └── login.ts           # Login UI component
```

---

## 2. Kiến Trúc Authentication

### 2.1 AuthStore Structure

**File**: `src/app/core/auth/auth.store.ts`

```typescript
import { signalStore, withState, withMethods, withHooks } from '@ngrx/signals';
import { User } from '@angular/fire/auth';

// State Type
type AuthState = {
  user: User | null;
}

// Initial State
const initialState: AuthState = {
  user: null,
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),      // Custom feature: loading & error state
  withState(initialState),
  withMethods(...),
  withHooks(...)
);
```

**State Properties:**

- `user`: Firebase User object hoặc null
- `loading`: Boolean (từ withLoadingError)
- `error`: String | null (từ withLoadingError)

### 2.2 AuthService Structure

**File**: `src/app/core/auth/auth.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth = inject(Auth);  // Firebase Auth instance

  // Observable stream of auth state changes
  user$ = authState(this.auth);

  async loginWithGoogle() { ... }
  async loginWithEmail(email: string, password: string) { ... }
  async registerWithEmail(email: string, password: string, name: string) { ... }
  async logout() { ... }
}
```

**Key Concepts:**

- `authState(auth)`: Observable từ @angular/fire/auth
- Emit User object khi login, null khi logout
- Auto-sync với Firebase backend

### 2.3 Data Flow Diagram

```
┌─────────────┐
│   Browser   │
│  (UI Layer) │
└──────┬──────┘
       │ User clicks "Login"
       ▼
┌─────────────────┐
│ LoginComponent  │
│  (Presentation) │
└──────┬──────────┘
       │ authStore.loginGoogle()
       ▼
┌─────────────────┐
│   AuthStore     │
│ (State Manager) │
└──────┬──────────┘
       │ authService.loginWithGoogle()
       ▼
┌─────────────────┐
│  AuthService    │
│  (API Layer)    │
└──────┬──────────┘
       │ signInWithPopup(GoogleAuthProvider)
       ▼
┌─────────────────┐
│    Firebase     │
│   (Backend)     │
└──────┬──────────┘
       │ User authenticated
       ▼
┌─────────────────┐
│  authState($)   │
│  (Observable)   │
└──────┬──────────┘
       │ emit User object
       ▼
┌─────────────────┐
│ AuthStore Hook  │
│   (onInit)      │
└──────┬──────────┘
       │ _setUser(user)
       ▼
┌─────────────────┐
│  State Updated  │
│ { user: User }  │
└──────┬──────────┘
       │ Reactive update
       ▼
┌─────────────────┐
│   UI Re-render  │
│ Navigate /home  │
└─────────────────┘
```

---

## 3. Đăng Nhập Google OAuth

### 3.1 Sequence Diagram

```
User          LoginComponent    AuthStore      AuthService     Firebase      AuthGuard
 │                 │                │              │              │              │
 │  Click Login    │                │              │              │              │
 │────────────────>│                │              │              │              │
 │                 │ loginGoogle()  │              │              │              │
 │                 │───────────────>│              │              │              │
 │                 │                │ setLoading   │              │              │
 │                 │                │ (true)       │              │              │
 │                 │                │              │              │              │
 │                 │                │ loginWith    │              │              │
 │                 │                │ Google()     │              │              │
 │                 │                │─────────────>│              │              │
 │                 │                │              │ signInWith   │              │
 │                 │                │              │ Popup()      │              │
 │                 │                │              │─────────────>│              │
 │                 │                │              │              │              │
 │  Google Popup   │                │              │  OAuth Flow  │              │
 │<────────────────┼────────────────┼──────────────┼──────────────│              │
 │                 │                │              │              │              │
 │  Select Account │                │              │              │              │
 │────────────────>│                │              │              │              │
 │                 │                │              │              │              │
 │                 │                │              │  User Token  │              │
 │                 │                │              │<─────────────│              │
 │                 │                │              │              │              │
 │                 │                │  user$ emit  │              │              │
 │                 │                │<─────────────│              │              │
 │                 │                │              │              │              │
 │                 │  _setUser()    │              │              │              │
 │                 │<───────────────│              │              │              │
 │                 │                │              │              │              │
 │                 │                │              │              │  canActivate │
 │                 │                │              │              │  (check user)│
 │                 │                │              │              │<─────────────│
 │                 │                │              │              │              │
 │                 │                │              │              │  true        │
 │                 │                │              │              │─────────────>│
 │                 │                │              │              │              │
 │  Navigate /home │                │              │              │              │
 │<────────────────┼────────────────┼──────────────┼──────────────┼──────────────│
```

### 3.2 Step-by-Step Breakdown

#### Step 1: User Interaction

```typescript
// File: src/app/features/auth/login/login.ts
<button (click)="authStore.loginGoogle()">
  <mat-icon>google</mat-icon>
  Sign in with Google
</button>
```

**Trigger**: User clicks button
**Action**: Gọi method `loginGoogle()` từ AuthStore

---

#### Step 2: AuthStore.loginGoogle()

```typescript
// File: src/app/core/auth/auth.store.ts
loginGoogle: async () => {
  // 1. Set loading state
  store.setLoading(true);
  store.clearError();

  // 2. Setup focus listener (để detect popup close)
  const onFocus = () => {
    store.setLoading(false);
  };
  window.addEventListener('focus', onFocus);

  try {
    // 3. Call AuthService
    await authService.loginWithGoogle();

    // 4. Success notification
    console.log('Login successful');
    errorService.showSuccess('Welcome! Login successful');
  } catch (error: any) {
    // 5. Error handling
    if (
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request'
    ) {
      // Silent fail - user đóng popup
      console.log('Popup closed by user');
    } else {
      // Real error - show notification
      const errorMessage = error?.message || 'Login failed';
      console.error('Login failed', error);
      errorService.showError(errorMessage);
    }
  } finally {
    // 6. Cleanup
    window.removeEventListener('focus', onFocus);
    store.setLoading(false);
  }
};
```

**Key Points:**

- ✅ Loading state để hiển thị spinner
- ✅ Focus listener để detect khi user quay lại tab (popup closed)
- ✅ Error handling phân biệt user cancel vs real error
- ✅ Cleanup listener trong finally block

---

#### Step 3: AuthService.loginWithGoogle()

```typescript
// File: src/app/core/auth/auth.service.ts
async loginWithGoogle() {
  const provider = new GoogleAuthProvider();

  // Optional: Request additional scopes
  provider.addScope('profile');
  provider.addScope('email');

  // Open popup and wait for result
  const result = await signInWithPopup(this.auth, provider);

  // result.user contains User object
  // result.credential contains OAuth credentials
  return result;
}
```

**Firebase API:**

- `signInWithPopup()`: Mở popup window cho OAuth flow
- `GoogleAuthProvider`: Provider cho Google authentication
- Return `UserCredential` object

---

#### Step 4: Firebase OAuth Flow

```
1. Popup window mở với Google login page
   ↓
2. User chọn Google account
   ↓
3. Google xác thực user credentials
   ↓
4. Google redirect về Firebase với authorization code
   ↓
5. Firebase exchange code for access token
   ↓
6. Firebase tạo/update user record
   ↓
7. Firebase return User object
```

**User Object Structure:**

```typescript
interface User {
  uid: string; // Unique user ID
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  providerId: string; // "google.com"
  metadata: {
    creationTime: string;
    lastSignInTime: string;
  };
}
```

---

#### Step 5: AuthState Observable Emission

```typescript
// File: src/app/core/auth/auth.service.ts
user$ = authState(this.auth);
```

**authState() behavior:**

- Observable từ @angular/fire/auth
- Emit mỗi khi auth state thay đổi
- Emit `User` khi login
- Emit `null` khi logout
- Auto-sync với Firebase backend

**Subscription trong AuthStore:**

```typescript
// File: src/app/core/auth/auth.store.ts
withHooks({
  onInit(store, authService = inject(AuthService)) {
    // Subscribe to auth state changes
    authService.user$.subscribe((user) => {
      store._setUser(user);
    });
  },
});
```

---

#### Step 6: State Update

```typescript
_setUser: (user: User | null) => {
  patchState(store, { user });
  store.setLoading(false);
};
```

**State Before:**

```typescript
{
  user: null,
  loading: true,
  error: null
}
```

**State After:**

```typescript
{
  user: {
    uid: "abc123...",
    email: "user@gmail.com",
    displayName: "John Doe",
    photoURL: "https://...",
    ...
  },
  loading: false,
  error: null
}
```

---

#### Step 7: AuthGuard Check

```typescript
// File: src/app/core/auth/auth.guard.ts
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.user()) {
    return true; // Allow navigation
  } else {
    router.navigate(['/login']);
    return false; // Block navigation
  }
};
```

**Applied to routes:**

```typescript
// File: src/app/app.routes.ts
{
  path: 'home',
  canActivate: [authGuard],  // Protected route
  loadComponent: () => import('./features/home/home')
}
```

---

#### Step 8: Navigation

```typescript
// Automatic navigation after successful login
// Firebase auth state change triggers:
authService.user$.subscribe((user) => {
  if (user) {
    router.navigate(['/home']);
  }
});
```

---

### 3.3 Error Scenarios

#### A. User Closes Popup

```typescript
Error Code: 'auth/popup-closed-by-user'
Handling: Silent fail (không hiện error)
Reason: User intentionally cancelled
```

#### B. Popup Blocked

```typescript
Error Code: 'auth/popup-blocked'
Message: "Popup was blocked by browser"
Solution: Hướng dẫn user enable popups
```

#### C. Network Error

```typescript
Error Code: 'auth/network-request-failed'
Message: "Network error, please try again"
Solution: Retry mechanism
```

#### D. Account Disabled

```typescript
Error Code: 'auth/user-disabled'
Message: "This account has been disabled"
Solution: Contact admin
```

---

### 3.4 Testing Checklist

- [ ] Login thành công với Google account
- [ ] Loading spinner hiển thị đúng
- [ ] Error message khi network fail
- [ ] Silent fail khi user đóng popup
- [ ] Navigate to /home sau login
- [ ] User info hiển thị trên toolbar
- [ ] Logout button hoạt động
- [ ] Protected routes accessible sau login

---

## 4. Đăng Nhập Email/Password

### 4.1 Sequence Diagram

```
User          LoginComponent    AuthStore      AuthService     Firebase
 │                 │                │              │              │
 │  Enter Email    │                │              │              │
 │  & Password     │                │              │              │
 │────────────────>│                │              │              │
 │                 │                │              │              │
 │  Click Login    │                │              │              │
 │────────────────>│                │              │              │
 │                 │ loginEmail()   │              │              │
 │                 │───────────────>│              │              │
 │                 │                │ setLoading   │              │
 │                 │                │              │              │
 │                 │                │ loginWith    │              │
 │                 │                │ Email()      │              │
 │                 │                │─────────────>│              │
 │                 │                │              │ signInWith   │
 │                 │                │              │ EmailAnd     │
 │                 │                │              │ Password()   │
 │                 │                │              │─────────────>│
 │                 │                │              │              │
 │                 │                │              │  Verify      │
 │                 │                │              │  Credentials │
 │                 │                │              │              │
 │                 │                │              │  User Token  │
 │                 │                │              │<─────────────│
 │                 │                │              │              │
 │                 │                │  user$ emit  │              │
 │                 │                │<─────────────│              │
 │                 │                │              │              │
 │  Navigate /home │                │              │              │
 │<────────────────┼────────────────┼──────────────┼──────────────│
```

### 4.2 Implementation

#### Step 1: Login Form

```typescript
// File: src/app/features/auth/login/login.ts
loginForm = this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(6)]]
});

onLoginEmail() {
  if (this.loginForm.valid) {
    const { email, password } = this.loginForm.value;
    this.authStore.loginEmail(email!, password!);
  }
}
```

**Template:**

```html
<form [formGroup]="loginForm" (ngSubmit)="onLoginEmail()">
  <mat-form-field>
    <mat-label>Email</mat-label>
    <input matInput formControlName="email" type="email" />
    <mat-error *ngIf="loginForm.get('email')?.hasError('required')"> Email is required </mat-error>
    <mat-error *ngIf="loginForm.get('email')?.hasError('email')"> Invalid email format </mat-error>
  </mat-form-field>

  <mat-form-field>
    <mat-label>Password</mat-label>
    <input matInput formControlName="password" type="password" />
    <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
      Password is required
    </mat-error>
    <mat-error *ngIf="loginForm.get('password')?.hasError('minlength')">
      Password must be at least 6 characters
    </mat-error>
  </mat-form-field>

  <button
    mat-raised-button
    color="primary"
    type="submit"
    [disabled]="!loginForm.valid || authStore.loading()"
  >
    @if (authStore.loading()) {
    <mat-spinner diameter="20"></mat-spinner>
    } @else { Login }
  </button>
</form>
```

---

#### Step 2: AuthStore.loginEmail()

```typescript
// File: src/app/core/auth/auth.store.ts
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
    store.setLoading(false);
  }
};
```

---

#### Step 3: AuthService.loginWithEmail()

```typescript
// File: src/app/core/auth/auth.service.ts
async loginWithEmail(email: string, password: string) {
  return await signInWithEmailAndPassword(
    this.auth,
    email,
    password
  );
}
```

**Firebase API:**

- `signInWithEmailAndPassword()`: Verify credentials
- Return `UserCredential` object
- Throw error nếu credentials invalid

---

### 4.3 Error Scenarios

#### A. Invalid Email

```typescript
Error Code: 'auth/invalid-email'
Message: "Invalid email address"
UI: Hiển thị error dưới email field
```

#### B. Wrong Password

```typescript
Error Code: 'auth/wrong-password'
Message: "Incorrect password"
UI: Hiển thị error dưới password field
```

#### C. User Not Found

```typescript
Error Code: 'auth/user-not-found'
Message: "No account found with this email"
UI: Suggest "Create account" link
```

#### D. Too Many Requests

```typescript
Error Code: 'auth/too-many-requests'
Message: "Too many failed attempts. Try again later"
UI: Disable login button temporarily
```

---

## 5. Đăng Ký Tài Khoản

### 5.1 Sequence Diagram

```
User          LoginComponent    AuthStore      AuthService     Firebase
 │                 │                │              │              │
 │  Enter Email,   │                │              │              │
 │  Password, Name │                │              │              │
 │────────────────>│                │              │              │
 │                 │                │              │              │
 │  Click Register │                │              │              │
 │────────────────>│                │              │              │
 │                 │ register()     │              │              │
 │                 │───────────────>│              │              │
 │                 │                │ register     │              │
 │                 │                │ WithEmail()  │              │
 │                 │                │─────────────>│              │
 │                 │                │              │ createUser   │
 │                 │                │              │ WithEmail    │
 │                 │                │              │ AndPassword()│
 │                 │                │              │─────────────>│
 │                 │                │              │              │
 │                 │                │              │  Create User │
 │                 │                │              │              │
 │                 │                │              │  User Object │
 │                 │                │              │<─────────────│
 │                 │                │              │              │
 │                 │                │  Update      │              │
 │                 │                │  Profile()   │              │
 │                 │                │─────────────>│              │
 │                 │                │              │ updateProfile│
 │                 │                │              │ (displayName)│
 │                 │                │              │─────────────>│
 │                 │                │              │              │
 │                 │                │              │  Updated     │
 │                 │                │              │<─────────────│
 │                 │                │              │              │
 │                 │                │  user$ emit  │              │
 │                 │                │<─────────────│              │
 │                 │                │              │              │
 │  Navigate /home │                │              │              │
 │<────────────────┼────────────────┼──────────────┼──────────────│
```

### 5.2 Implementation

#### Step 1: Register Form

```typescript
// File: src/app/features/auth/login/login.ts
registerForm = this.fb.group({
  name: ['', [Validators.required, Validators.minLength(2)]],
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(6)]],
  confirmPassword: ['', [Validators.required]]
}, {
  validators: this.passwordMatchValidator
});

passwordMatchValidator(form: AbstractControl) {
  const password = form.get('password')?.value;
  const confirmPassword = form.get('confirmPassword')?.value;

  if (password !== confirmPassword) {
    form.get('confirmPassword')?.setErrors({ mismatch: true });
    return { mismatch: true };
  }
  return null;
}

onRegister() {
  if (this.registerForm.valid) {
    const { name, email, password } = this.registerForm.value;
    this.authStore.register(email!, password!, name!);
  }
}
```

---

#### Step 2: AuthStore.register()

```typescript
// File: src/app/core/auth/auth.store.ts
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
    store.setLoading(false);
  }
};
```

---

#### Step 3: AuthService.registerWithEmail()

```typescript
// File: src/app/core/auth/auth.service.ts
async registerWithEmail(email: string, password: string, name: string) {
  // 1. Create user account
  const userCredential = await createUserWithEmailAndPassword(
    this.auth,
    email,
    password
  );

  // 2. Update profile with display name
  if (userCredential.user) {
    await updateProfile(userCredential.user, {
      displayName: name
    });
  }

  return userCredential;
}
```

**Firebase APIs:**

- `createUserWithEmailAndPassword()`: Tạo account mới
- `updateProfile()`: Update displayName, photoURL

---

### 5.3 Error Scenarios

#### A. Email Already Exists

```typescript
Error Code: 'auth/email-already-in-use'
Message: "Email already registered"
UI: Suggest "Login instead" link
```

#### B. Weak Password

```typescript
Error Code: 'auth/weak-password'
Message: "Password should be at least 6 characters"
UI: Show password strength indicator
```

#### C. Invalid Email

```typescript
Error Code: 'auth/invalid-email'
Message: "Invalid email format"
UI: Validate on blur
```

---

## 6. Đăng Xuất

### 6.1 Implementation

```typescript
// File: src/app/core/auth/auth.store.ts
logout: async () => {
  try {
    await authService.logout();
    patchState(store, { user: null });
    errorService.showInfo('You have been logged out');
    router.navigate(['/login']);
  } catch (error: any) {
    const errorMessage = error?.message || 'Logout failed';
    errorService.showError(errorMessage);
  }
};
```

```typescript
// File: src/app/core/auth/auth.service.ts
async logout() {
  return await signOut(this.auth);
}
```

**Flow:**

1. User clicks logout button
2. `authService.logout()` gọi Firebase `signOut()`
3. Firebase clear session
4. `authState($)` emit `null`
5. AuthStore update `user = null`
6. Navigate to `/login`

---

## 7. Route Protection với AuthGuard

### 7.1 Implementation

```typescript
// File: src/app/core/auth/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from './auth.store';
import type { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Check if user is logged in
  if (authStore.user()) {
    return true; // Allow access
  } else {
    // Redirect to login with return URL
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url },
    });
    return false; // Block access
  }
};
```

### 7.2 Usage in Routes

```typescript
// File: src/app/app.routes.ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login'),
  },
  {
    path: 'home',
    canActivate: [authGuard], // Protected
    loadComponent: () => import('./features/home/home'),
  },
  {
    path: 'projects',
    canActivate: [authGuard], // Protected
    loadComponent: () => import('./features/projects/project-list'),
  },
  {
    path: 'project/:projectId',
    canActivate: [authGuard], // Protected
    loadComponent: () => import('./features/projects/project-layout'),
    children: [
      {
        path: 'board',
        loadComponent: () => import('./features/board/board'),
      },
      {
        path: 'backlog',
        loadComponent: () => import('./features/board/backlog'),
      },
    ],
  },
];
```

### 7.3 Return URL Feature

```typescript
// After successful login, redirect to original URL
loginEmail: async (email: string, pass: string) => {
  try {
    await authService.loginWithEmail(email, pass);

    // Get return URL from query params
    const returnUrl = route.snapshot.queryParams['returnUrl'] || '/home';
    router.navigate([returnUrl]);
  } catch (error) {
    // Handle error
  }
};
```

---

## 8. Persistent Authentication

### 8.1 How It Works

Firebase tự động lưu auth token vào browser storage:

```
┌─────────────────────────────────────────┐
│         Browser Storage                 │
├─────────────────────────────────────────┤
│ Key: firebase:authUser:[API_KEY]       │
│ Value: {                                │
│   uid: "abc123...",                     │
│   email: "user@gmail.com",              │
│   stsTokenManager: {                    │
│     accessToken: "eyJhbGc...",          │
│     refreshToken: "AMf-vBy...",         │
│     expirationTime: 1234567890          │
│   }                                     │
│ }                                       │
└─────────────────────────────────────────┘
```

### 8.2 Auto-Restore Session

```typescript
// File: src/app/core/auth/auth.store.ts
withHooks({
  onInit(store, authService = inject(AuthService)) {
    // Subscribe to auth state changes
    authService.user$.subscribe((user) => {
      store._setUser(user);
    });
  },
});
```

**Flow khi refresh page:**

```
1. App khởi động
   ↓
2. AuthStore.onInit() được gọi
   ↓
3. Subscribe to authService.user$
   ↓
4. Firebase check browser storage
   ↓
5. Nếu có valid token:
   - Firebase restore session
   - user$ emit User object
   - AuthStore update state
   - User vẫn đăng nhập
   ↓
6. Nếu không có token hoặc expired:
   - user$ emit null
   - User phải login lại
```

### 8.3 Token Refresh

Firebase tự động refresh token khi:

- Access token sắp hết hạn (< 5 phút)
- User thực hiện authenticated request
- Background refresh mỗi 1 giờ

**No manual intervention needed!**

---

## 9. Error Handling

### 9.1 Error Notification Service

```typescript
// File: src/app/core/services/error-notification.service.ts
@Injectable({ providedIn: 'root' })
export class ErrorNotificationService {
  private snackBar = inject(MatSnackBar);

  showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }

  showInfo(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['info-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    });
  }
}
```

### 9.2 Error Code Mapping

```typescript
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'Invalid email address',
  'auth/user-disabled': 'This account has been disabled',
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/email-already-in-use': 'Email already registered',
  'auth/weak-password': 'Password should be at least 6 characters',
  'auth/network-request-failed': 'Network error. Please check your connection',
  'auth/too-many-requests': 'Too many failed attempts. Try again later',
  'auth/popup-blocked': 'Popup was blocked. Please enable popups',
  'auth/popup-closed-by-user': 'Login cancelled',
  'auth/cancelled-popup-request': 'Login cancelled',
};

function getErrorMessage(error: any): string {
  return AUTH_ERROR_MESSAGES[error.code] || error.message || 'An error occurred';
}
```

---

## 10. Code Examples

### 10.1 Complete Login Component

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthStore } from '../../../core/auth/auth.store';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title>Welcome to Jira Clone</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <!-- Google Login -->
          <button
            mat-raised-button
            color="primary"
            (click)="authStore.loginGoogle()"
            [disabled]="authStore.loading()"
            class="google-btn"
          >
            <mat-icon>google</mat-icon>
            Sign in with Google
          </button>

          <div class="divider">
            <span>OR</span>
          </div>

          <!-- Email Login Form -->
          <form [formGroup]="loginForm" (ngSubmit)="onLoginEmail()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput formControlName="email" type="email" />
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">
                Email is required
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">
                Invalid email format
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput formControlName="password" type="password" />
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">
                Password is required
              </mat-error>
            </mat-form-field>

            <button
              mat-raised-button
              color="accent"
              type="submit"
              [disabled]="!loginForm.valid || authStore.loading()"
            >
              @if (authStore.loading()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Login
              }
            </button>
          </form>

          <!-- Register Link -->
          <div class="register-link">
            Don't have an account?
            <button mat-button (click)="showRegister = true">Register</button>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      .login-card {
        width: 400px;
        padding: 24px;
      }

      .google-btn {
        width: 100%;
        margin-bottom: 16px;
      }

      .divider {
        text-align: center;
        margin: 24px 0;
        position: relative;

        &::before,
        &::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 40%;
          height: 1px;
          background: #ddd;
        }

        &::before {
          left: 0;
        }
        &::after {
          right: 0;
        }

        span {
          background: white;
          padding: 0 16px;
          color: #888;
        }
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .register-link {
        text-align: center;
        margin-top: 16px;
      }
    `,
  ],
})
export class Login {
  authStore = inject(AuthStore);
  private fb = inject(FormBuilder);

  showRegister = false;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onLoginEmail() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      this.authStore.loginEmail(email!, password!);
    }
  }
}
```

---

## 📝 Summary

Authentication flow trong Jira Clone:

✅ **Multi-provider**: Google OAuth + Email/Password
✅ **Reactive**: NgRx Signals cho state management
✅ **Secure**: Firebase Authentication backend
✅ **Persistent**: Auto-restore session on refresh
✅ **Protected**: AuthGuard cho route protection
✅ **User-friendly**: Error handling & notifications
✅ **Type-safe**: TypeScript interfaces

**Key Takeaways:**

1. Firebase handles all authentication complexity
2. AuthStore provides reactive state
3. AuthGuard protects routes
4. Error handling provides good UX
5. Session persists across page refreshes
