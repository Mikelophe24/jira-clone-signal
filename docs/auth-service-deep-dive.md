# AuthService - Deep Dive

## Tổng quan

**AuthService** là lớp service chịu trách nhiệm **giao tiếp trực tiếp với Firebase Authentication**. Đây là "cầu nối" giữa ứng dụng Angular và Firebase Backend.

### **Vai trò chính:**

- 🔐 Gọi Firebase Authentication APIs
- 👤 Quản lý user authentication state
- 💾 Đồng bộ user data với Firestore
- 📡 Cung cấp Observable để theo dõi auth state changes

### **Vị trí trong Architecture:**

```
┌──────────────┐
│  Component   │  ← UI Layer
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  AuthStore   │  ← State Management Layer
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ AuthService  │  ← Service Layer (File này!)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Firebase   │  ← Backend
└──────────────┘
```

---

## 1. Imports và Dependencies

```typescript
import { Injectable, inject } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { Firestore } from '@angular/fire/firestore';
import { doc, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';
```

### **Phân loại Imports:**

#### **A. Angular Core**

- **`Injectable`**: Decorator để đánh dấu class là service
- **`inject`**: Function để inject dependencies

#### **B. Angular Fire - Auth Module**

- **`Auth`**: Firebase Authentication instance
- **`user`**: Helper function tạo Observable theo dõi auth state

#### **C. Firebase Auth SDK**

- **`signInWithPopup`**: Đăng nhập bằng popup (Google OAuth)
- **`GoogleAuthProvider`**: Provider cho Google authentication
- **`signOut`**: Đăng xuất
- **`User`**: Type definition cho Firebase user
- **`signInWithEmailAndPassword`**: Đăng nhập bằng email/password
- **`createUserWithEmailAndPassword`**: Tạo account mới
- **`updateProfile`**: Cập nhật profile (displayName, photoURL)

#### **D. Angular Fire - Firestore Module**

- **`Firestore`**: Firestore database instance
- **`doc`**: Tạo document reference
- **`setDoc`**: Ghi data vào document

#### **E. RxJS**

- **`Observable`**: Type cho reactive streams

---

## 2. Service Declaration

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  // ...
}
```

### **@Injectable({ providedIn: 'root' })**

**Ý nghĩa:**

- Service là **singleton** (chỉ có 1 instance duy nhất)
- Tự động được provide ở root level
- Có thể inject ở bất kỳ đâu trong app
- Angular tự động quản lý lifecycle

**So sánh với cách cũ:**

```typescript
// Cách cũ (Angular < 6)
@Injectable()
export class AuthService { }

// Phải khai báo trong providers của NgModule
@NgModule({
  providers: [AuthService]
})
```

---

## 3. Properties

```typescript
private auth = inject(Auth);
user$: Observable<User | null> = user(this.auth);
private firestore = inject(Firestore);
```

### **A. `private auth = inject(Auth)`**

**Firebase Authentication Instance:**

- Inject Firebase Auth module
- Dùng để gọi các auth methods
- `private` → chỉ dùng trong service

**Tương đương với:**

```typescript
constructor(private auth: Auth) { }
```

### **B. `user$: Observable<User | null>`**

**Auth State Observable:**

```typescript
user$: Observable<User | null> = user(this.auth);
```

**Đây là property QUAN TRỌNG NHẤT!**

#### **`user(this.auth)` là gì?**

- Helper function từ `@angular/fire/auth`
- Tạo Observable theo dõi Firebase auth state
- **Auto-emit** mỗi khi auth state thay đổi

#### **Khi nào emit?**

```
┌─────────────────────────────────────────┐
│  Firebase Auth State Changes            │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
App Start      Login         Logout
    │             │             │
    ▼             ▼             ▼
Check session  Update state  Clear state
    │             │             │
    ▼             ▼             ▼
user$ emit     user$ emit    user$ emit
User/null      User object      null
```

#### **Value types:**

```typescript
// User đã login
{
  uid: "abc123",
  email: "user@example.com",
  displayName: "John Doe",
  photoURL: "https://...",
  emailVerified: true,
  // ... other Firebase User properties
}

// User chưa login hoặc đã logout
null
```

#### **Tại sao public?**

```typescript
user$: Observable<User | null>; // Public, không có 'private'
```

- Cần expose ra ngoài để **AuthStore subscribe**
- AuthStore.onInit() sẽ subscribe vào `user$`
- Đây là cách AuthStore biết khi nào user login/logout

**Sử dụng trong AuthStore:**

```typescript
withHooks({
  onInit(store, authService = inject(AuthService)) {
    authService.user$.subscribe((user) => {
      store._setUser(user);
    });
  },
});
```

### **C. `private firestore = inject(Firestore)`**

**Firestore Database Instance:**

- Inject Firestore module
- Dùng để lưu user data vào database
- `private` → chỉ dùng trong service

---

## 4. Methods

### **4.1. loginWithGoogle()**

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

#### **Phân tích từng bước:**

##### **Bước 1: Tạo Google Provider**

```typescript
const provider = new GoogleAuthProvider();
```

- Tạo instance của Google OAuth provider
- Provider này sẽ handle Google authentication flow

##### **Bước 2: Set Custom Parameters**

```typescript
provider.setCustomParameters({
  prompt: 'select_account',
});
```

**`prompt: 'select_account'`** có nghĩa là:

- ✅ **Luôn hiển thị** account picker
- ✅ User có thể chọn account khác
- ❌ **Không auto-login** với account đã đăng nhập trước

**Các options khác:**

| Option             | Behavior                                      |
| ------------------ | --------------------------------------------- |
| `'select_account'` | Luôn hiển thị account picker                  |
| `'consent'`        | Luôn yêu cầu consent screen                   |
| `'none'`           | Không hiển thị UI (auto-login nếu có session) |

**Tại sao dùng `'select_account'`?**

- User có thể có nhiều Google accounts
- Cho phép user chọn đúng account muốn dùng
- Better UX cho multi-account users

##### **Bước 3: Show Popup và Authenticate**

```typescript
const cred = await signInWithPopup(this.auth, provider);
```

**`signInWithPopup()` làm gì?**

1. **Mở popup window** với Google OAuth page
2. User chọn account và authorize
3. Google redirect về app với **authorization code**
4. Firebase exchange code → **access token**
5. Firebase tạo **session** và return **UserCredential**

**UserCredential object:**

```typescript
{
  user: {
    uid: "abc123",
    email: "user@gmail.com",
    displayName: "John Doe",
    photoURL: "https://lh3.googleusercontent.com/...",
    // ...
  },
  providerId: "google.com",
  operationType: "signIn",
  // ...
}
```

**Popup Flow:**

```
User click "Sign in with Google"
         ↓
signInWithPopup() called
         ↓
Popup window opens
         ↓
User sees Google account picker
         ↓
User selects account
         ↓
Google authorization page
         ↓
User clicks "Allow"
         ↓
Popup closes
         ↓
Firebase receives auth code
         ↓
Firebase creates session
         ↓
UserCredential returned
         ↓
user$ Observable emits User object
```

##### **Bước 4: Sync to Firestore**

```typescript
await this.syncUserToFirestore(cred.user);
```

- Lưu user info vào Firestore database
- Chi tiết xem phần 4.5

##### **Bước 5: Return Credentials**

```typescript
return cred;
```

- Return UserCredential cho caller (AuthStore)
- Thường không cần dùng vì `user$` đã emit

---

### **4.2. loginWithEmail()**

```typescript
async loginWithEmail(email: string, pass: string) {
  return signInWithEmailAndPassword(this.auth, email, pass);
}
```

#### **Simple wrapper cho Firebase method**

**`signInWithEmailAndPassword()` làm gì?**

1. Gửi email/password đến Firebase
2. Firebase verify credentials
3. Nếu đúng → tạo session, return UserCredential
4. Nếu sai → throw error

**Possible Errors:**

```typescript
try {
  await authService.loginWithEmail(email, pass);
} catch (error) {
  // error.code có thể là:
  // - 'auth/user-not-found': Email không tồn tại
  // - 'auth/wrong-password': Password sai
  // - 'auth/invalid-email': Email format không hợp lệ
  // - 'auth/user-disabled': Account bị disable
  // - 'auth/too-many-requests': Quá nhiều attempts
}
```

**Flow:**

```
User nhập email/password
         ↓
loginWithEmail() called
         ↓
Firebase verify credentials
         ↓
    ┌────┴────┐
    │         │
    ▼         ▼
 Success    Error
    │         │
    ▼         ▼
Create     Throw
session    error
    │
    ▼
user$ emit User
```

---

### **4.3. registerWithEmail()**

```typescript
async registerWithEmail(email: string, pass: string, name: string) {
  const cred = await createUserWithEmailAndPassword(this.auth, email, pass);
  if (cred.user) {
    await updateProfile(cred.user, { displayName: name });
    // Reload user to get updated profile
    await cred.user.reload();
    await this.syncUserToFirestore(this.auth.currentUser || cred.user);
  }
  return cred;
}
```

#### **Phân tích từng bước:**

##### **Bước 1: Create Account**

```typescript
const cred = await createUserWithEmailAndPassword(this.auth, email, pass);
```

**`createUserWithEmailAndPassword()` làm gì?**

- Tạo account mới trong Firebase Auth
- Hash password (bcrypt)
- Tạo unique UID
- Return UserCredential

**Initial User Object:**

```typescript
{
  uid: "abc123",
  email: "user@example.com",
  displayName: null,  // ← Chưa có!
  photoURL: null,
  emailVerified: false,
  // ...
}
```

##### **Bước 2: Update Display Name**

```typescript
await updateProfile(cred.user, { displayName: name });
```

**Tại sao cần update?**

- `createUserWithEmailAndPassword()` không nhận `displayName` parameter
- Phải update riêng sau khi tạo account

**`updateProfile()` làm gì?**

- Update Firebase user profile
- Có thể update: `displayName`, `photoURL`
- **KHÔNG** update email, password (phải dùng methods khác)

##### **Bước 3: Reload User**

```typescript
await cred.user.reload();
```

**Tại sao cần reload?**

**Vấn đề:**

```typescript
await updateProfile(cred.user, { displayName: name });
console.log(cred.user.displayName); // ❌ Vẫn là null!
```

- `updateProfile()` update trên **server**
- Local `cred.user` object **chưa được refresh**
- Cần `reload()` để fetch data mới từ server

**Sau khi reload:**

```typescript
await cred.user.reload();
console.log(cred.user.displayName); // ✅ "John Doe"
```

##### **Bước 4: Sync to Firestore**

```typescript
await this.syncUserToFirestore(this.auth.currentUser || cred.user);
```

**Tại sao dùng `this.auth.currentUser`?**

- `this.auth.currentUser`: User object **sau khi reload**
- `cred.user`: User object **trước khi reload** (có thể outdated)
- Fallback to `cred.user` nếu `currentUser` là null (edge case)

**Best practice:**

```typescript
// ✅ GOOD: Dùng currentUser (đã reload)
this.auth.currentUser;

// ❌ BAD: Dùng cred.user (có thể outdated)
cred.user;
```

---

### **4.4. logout()**

```typescript
logout() {
  return signOut(this.auth);
}
```

#### **Simple wrapper cho Firebase signOut**

**`signOut()` làm gì?**

1. Clear Firebase session
2. Delete local tokens/cookies
3. Update auth state → `user$` emit `null`
4. Return Promise<void>

**Flow:**

```
User click logout
      ↓
logout() called
      ↓
signOut(this.auth)
      ↓
Firebase clear session
      ↓
Delete tokens/cookies
      ↓
user$ emit null
      ↓
AuthStore._setUser(null)
      ↓
UI updates (show login page)
```

**Multi-tab behavior:**

```
Tab 1: User logout
      ↓
Firebase clear session
      ↓
Tab 2: user$ emit null (auto!)
      ↓
Tab 2: Auto logout
```

---

### **4.5. syncUserToFirestore() - Private Method**

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

#### **Tại sao cần sync to Firestore?**

**Firebase Auth vs Firestore:**

| Firebase Auth         | Firestore       |
| --------------------- | --------------- |
| ✅ Authentication     | ✅ Database     |
| ✅ User credentials   | ✅ User data    |
| ❌ Không query được   | ✅ Query được   |
| ❌ Không có relations | ✅ Có relations |

**Use cases cần Firestore:**

1. **Query users:**

   ```typescript
   // ❌ KHÔNG THỂ với Firebase Auth
   // ✅ CÓ THỂ với Firestore
   const users = await getDocs(collection(firestore, 'users'));
   ```

2. **Get user by ID:**

   ```typescript
   // Lấy thông tin user khác (không phải current user)
   const userDoc = await getDoc(doc(firestore, 'users', userId));
   ```

3. **Display user info:**

   ```typescript
   // Hiển thị avatar/name của assignee trong task
   const assignee = await getDoc(doc(firestore, 'users', task.assigneeId));
   ```

4. **Search users:**
   ```typescript
   // Search users by name/email
   const query = query(collection(firestore, 'users'), where('displayName', '>=', searchTerm));
   ```

#### **Phân tích code:**

##### **Bước 1: Create Document Reference**

```typescript
const userDoc = doc(this.firestore, 'users', user.uid);
```

**Document path:**

```
firestore
  └── users (collection)
      └── abc123 (document, user.uid)
```

**Tại sao dùng `user.uid` làm document ID?**

- ✅ Unique (Firebase tự generate)
- ✅ Dễ lookup (biết uid → biết document path)
- ✅ Consistent với Firebase Auth

##### **Bước 2: Write Data**

```typescript
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
```

**Data structure:**

```typescript
// Document: users/abc123
{
  uid: "abc123",
  displayName: "John Doe",
  email: "john@example.com",
  photoURL: "https://..."
}
```

**`{ merge: true }` là gì?**

**Without merge:**

```typescript
// Lần 1: Tạo document
setDoc(userDoc, { name: 'John', age: 30 });
// Document: { name: "John", age: 30 }

// Lần 2: Update (OVERWRITE toàn bộ!)
setDoc(userDoc, { email: 'john@example.com' });
// Document: { email: "john@example.com" }  ← age bị mất!
```

**With merge:**

```typescript
// Lần 1: Tạo document
setDoc(userDoc, { name: 'John', age: 30 });
// Document: { name: "John", age: 30 }

// Lần 2: Update (MERGE)
setDoc(userDoc, { email: 'john@example.com' }, { merge: true });
// Document: { name: "John", age: 30, email: "john@example.com" }  ← age vẫn còn!
```

**Tại sao cần merge?**

- User có thể login nhiều lần
- Mỗi lần login gọi `syncUserToFirestore()`
- Merge → chỉ update fields có trong object, không xóa fields khác
- Tránh mất data nếu có thêm fields khác (ví dụ: `createdAt`, `role`, etc.)

---

## 5. Complete Flow Diagrams

### **5.1. Google Login Flow**

```
┌─────────────────────────────────────────────────────────────┐
│                USER CLICKS "LOGIN WITH GOOGLE"              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthStore.loginGoogle()                                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthService.loginWithGoogle()                              │
│  1. new GoogleAuthProvider()                                │
│  2. provider.setCustomParameters({ prompt: 'select_account' })│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  signInWithPopup(auth, provider)                            │
│  - Open popup window                                        │
│  - Show Google account picker                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  USER INTERACTION                                           │
│  1. Select Google account                                   │
│  2. Click "Allow"                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FIREBASE BACKEND                                           │
│  1. Receive authorization code                              │
│  2. Exchange code for access token                          │
│  3. Create/update user in Firebase Auth                     │
│  4. Create session                                          │
│  5. Return UserCredential                                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  syncUserToFirestore(cred.user)                             │
│  1. doc(firestore, 'users', user.uid)                       │
│  2. setDoc({ uid, displayName, email, photoURL }, { merge })│
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FIRESTORE DATABASE                                         │
│  users/abc123: {                                            │
│    uid: "abc123",                                           │
│    displayName: "John Doe",                                 │
│    email: "john@gmail.com",                                 │
│    photoURL: "https://..."                                  │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FIREBASE AUTH STATE UPDATED                                │
│  user$ Observable emits User object                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthStore.onInit subscription                              │
│  store._setUser(user)                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  UI AUTO-UPDATE                                             │
│  - Login component effect() detects user                    │
│  - Navigate to /projects                                    │
│  - Show user avatar in navbar                               │
└─────────────────────────────────────────────────────────────┘
```

### **5.2. Email Registration Flow**

```
┌─────────────────────────────────────────────────────────────┐
│          USER FILLS FORM AND CLICKS "REGISTER"              │
│          (name, email, password)                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthStore.register(email, password, name)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AuthService.registerWithEmail(email, pass, name)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  createUserWithEmailAndPassword(auth, email, pass)          │
│  Firebase creates new account                               │
│  Returns UserCredential with user object                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Initial User Object:                                       │
│  {                                                          │
│    uid: "abc123",                                           │
│    email: "user@example.com",                               │
│    displayName: null,  ← Not set yet!                       │
│    photoURL: null                                           │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  updateProfile(cred.user, { displayName: name })            │
│  Update displayName on Firebase server                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  cred.user.reload()                                         │
│  Fetch updated user data from server                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Updated User Object:                                       │
│  {                                                          │
│    uid: "abc123",                                           │
│    email: "user@example.com",                               │
│    displayName: "John Doe",  ← Now set!                     │
│    photoURL: null                                           │
│  }                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  syncUserToFirestore(auth.currentUser || cred.user)         │
│  Save to Firestore database                                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  user$ Observable emits User object                         │
│  AuthStore auto-updates                                     │
│  UI navigates to /projects                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Key Concepts

### **6.1. Firebase Auth vs Firestore**

```
┌─────────────────────────────────────────────────────────────┐
│                    FIREBASE AUTH                            │
│  - Authentication only                                      │
│  - User credentials (email, password)                       │
│  - Session management                                       │
│  - Cannot query users                                       │
│  - Cannot create relations                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    FIRESTORE                                │
│  - Database                                                 │
│  - User data (name, avatar, preferences)                    │
│  - Can query users                                          │
│  - Can create relations (user → projects → tasks)           │
│  - Can add custom fields                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    WHY BOTH?                                │
│  Auth: "Who is this user?" (Authentication)                 │
│  Firestore: "What is this user's data?" (Data Storage)      │
└─────────────────────────────────────────────────────────────┘
```

### **6.2. Observable Pattern**

```typescript
// AuthService exposes Observable
user$: Observable<User | null> = user(this.auth);

// AuthStore subscribes
authService.user$.subscribe((user) => {
  store._setUser(user);
});

// Benefits:
// ✅ Reactive: Auto-update when auth state changes
// ✅ Decoupled: Service doesn't know about Store
// ✅ Reusable: Multiple subscribers possible
```

### **6.3. Async/Await Pattern**

```typescript
// All methods are async
async loginWithGoogle() { ... }
async loginWithEmail() { ... }
async registerWithEmail() { ... }

// Caller uses await
await authService.loginWithGoogle();

// Or .then()
authService.loginWithGoogle().then(...);
```

### **6.4. Error Handling**

```typescript
// Service throws errors
async loginWithEmail(email: string, pass: string) {
  return signInWithEmailAndPassword(this.auth, email, pass);
  // Throws error if credentials invalid
}

// Caller catches errors
try {
  await authService.loginWithEmail(email, pass);
} catch (error) {
  console.error('Login failed:', error.code);
  // error.code: 'auth/user-not-found', 'auth/wrong-password', etc.
}
```

---

## 7. Best Practices Demonstrated

### ✅ **1. Single Responsibility**

- Service chỉ làm 1 việc: Giao tiếp với Firebase
- Không có UI logic, không có state management

### ✅ **2. Dependency Injection**

```typescript
private auth = inject(Auth);
private firestore = inject(Firestore);
```

- Dễ test (có thể mock dependencies)
- Dễ thay đổi implementation

### ✅ **3. Async/Await**

```typescript
async loginWithGoogle() {
  const cred = await signInWithPopup(...);
  await this.syncUserToFirestore(...);
}
```

- Code dễ đọc hơn callbacks
- Error handling đơn giản với try/catch

### ✅ **4. Observable for State**

```typescript
user$: Observable<User | null> = user(this.auth);
```

- Reactive programming
- Auto-update subscribers

### ✅ **5. Private Helper Methods**

```typescript
private async syncUserToFirestore(user: User) { ... }
```

- Encapsulation
- Reusable logic

### ✅ **6. Merge Strategy**

```typescript
setDoc(userDoc, data, { merge: true });
```

- Không mất data khi update
- Safe updates

---

## 8. Common Pitfalls & Solutions

### **❌ Pitfall 1: Không reload sau updateProfile**

```typescript
// ❌ BAD
await updateProfile(cred.user, { displayName: name });
await this.syncUserToFirestore(cred.user);
// displayName vẫn là null trong Firestore!

// ✅ GOOD
await updateProfile(cred.user, { displayName: name });
await cred.user.reload();
await this.syncUserToFirestore(this.auth.currentUser || cred.user);
```

### **❌ Pitfall 2: Không dùng merge**

```typescript
// ❌ BAD: Overwrite toàn bộ document
setDoc(userDoc, { email: user.email });
// Mất displayName, photoURL!

// ✅ GOOD: Merge với data cũ
setDoc(userDoc, { email: user.email }, { merge: true });
```

### **❌ Pitfall 3: Không handle errors**

```typescript
// ❌ BAD: Errors không được handle
async login(email, pass) {
  return signInWithEmailAndPassword(this.auth, email, pass);
}

// ✅ GOOD: Caller handle errors
try {
  await authService.login(email, pass);
} catch (error) {
  if (error.code === 'auth/wrong-password') {
    alert('Wrong password!');
  }
}
```

---

## 9. Testing

### **Unit Test Example:**

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let authMock: jasmine.SpyObj<Auth>;
  let firestoreMock: jasmine.SpyObj<Firestore>;

  beforeEach(() => {
    authMock = jasmine.createSpyObj('Auth', ['signInWithPopup']);
    firestoreMock = jasmine.createSpyObj('Firestore', ['doc', 'setDoc']);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth, useValue: authMock },
        { provide: Firestore, useValue: firestoreMock },
      ],
    });

    service = TestBed.inject(AuthService);
  });

  it('should login with Google', async () => {
    const mockUser = { uid: '123', email: 'test@gmail.com' };
    authMock.signInWithPopup.and.returnValue(Promise.resolve({ user: mockUser }));

    const result = await service.loginWithGoogle();

    expect(result.user.uid).toBe('123');
    expect(firestoreMock.setDoc).toHaveBeenCalled();
  });
});
```

---

## 10. Tổng kết

**AuthService** là một service đơn giản nhưng quan trọng:

### **Responsibilities:**

- ✅ Gọi Firebase Auth APIs
- ✅ Expose `user$` Observable
- ✅ Sync user data to Firestore

### **Key Features:**

- ✅ Google OAuth login
- ✅ Email/Password authentication
- ✅ User registration
- ✅ Logout
- ✅ Auto-sync to Firestore

### **Design Patterns:**

- ✅ Dependency Injection
- ✅ Observable Pattern
- ✅ Async/Await
- ✅ Single Responsibility
- ✅ Error Propagation

### **Integration:**

```
Component → AuthStore → AuthService → Firebase
                ↑                        ↓
                └────── user$ Observable ─┘
```

Đây là foundation vững chắc cho authentication system! 🚀
