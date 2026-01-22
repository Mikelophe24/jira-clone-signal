import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withHooks,
  withComputed,
} from '@ngrx/signals';
import { inject, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';
import { User } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../services/error-notification.service';

import { Subject, interval, from, of, EMPTY } from 'rxjs';
import { take, takeUntil, switchMap, map, filter, catchError, tap, finalize } from 'rxjs/operators';

type AuthState = {
  user: User | null;
  isWaitingForVerification: boolean;
};

const initialState: AuthState = {
  user: null,
  isWaitingForVerification: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(({ user }) => ({
    isAuthorized: computed(() => !!user() && !!user()?.emailVerified),
  })),
  withMethods(
    (
      store,
      authService = inject(AuthService),
      router = inject(Router),
      errorService = inject(ErrorNotificationService),
      destroyRef = inject(DestroyRef),
    ) => {
      // ✅ Control polling lifecycle (cancel when leaving Register page, etc.)
      const cancelVerification$ = new Subject<void>();

      return {
        loginGoogle: async () => {
          store.setLoading(true);
          store.clearError();

          try {
            await authService.loginWithGoogle();
            console.log('Login successful');
            errorService.showSuccess('Welcome! Login successful');
            // router.navigate(['/projects']); // bật nếu muốn điều hướng ngay
          } catch (error: any) {
            if (
              error?.code === 'auth/popup-closed-by-user' ||
              error?.code === 'auth/cancelled-popup-request'
            ) {
              console.log('Popup closed by user');
              return;
            }

            const errorMessage = error?.message || 'Login failed';
            console.error('Login failed', error);
            store.setError(errorMessage);
            errorService.showError(errorMessage);
          } finally {
            store.setLoading(false);
          }
        },

        loginEmail: async (email: string, pass: string) => {
          store.setLoading(true);
          store.clearError();

          try {
            const cred = await authService.loginWithEmail(email, pass);

            if (!cred.user.emailVerified) {
              const msg =
                'Vui lòng xác thực email của bạn trước khi đăng nhập. Kiểm tra hộp thư đến!';
              store.setError(msg);
              errorService.showInfo(msg);
              await authService.logout();
              return;
            }

            errorService.showSuccess('Welcome back!');
            router.navigate(['/projects']);
          } catch (error: any) {
            let errorMessage = 'Sai mật khẩu hoặc email';

            if (
              error?.code === 'auth/user-not-found' ||
              error?.code === 'auth/wrong-password' ||
              error?.code === 'auth/invalid-credential'
            ) {
              errorMessage = 'Email hoặc mật khẩu không chính xác';
            } else if (error?.code === 'auth/invalid-email') {
              errorMessage = 'Định dạng email không hợp lệ';
            } else if (error?.code === 'auth/user-disabled') {
              errorMessage = 'Tài khoản này đã bị khoá';
            } else if (error?.code === 'auth/too-many-requests') {
              errorMessage = 'Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau';
            }

            store.setError(errorMessage);
            errorService.showError(errorMessage);
          } finally {
            store.setLoading(false);
          }
        },

        // ✅ Call this from Register component ngOnDestroy() or when navigating away
        cancelVerificationPolling: () => {
          cancelVerification$.next();
          patchState(store, { isWaitingForVerification: false });
        },

        register: async (email: string, pass: string, name: string) => {
          // Cancel any previous polling before starting a new one
          cancelVerification$.next();

          store.setLoading(true);
          store.clearError();

          try {
            await authService.registerWithEmail(email, pass, name);

            // ✅ overwrite old error (to avoid stale error UI)
            const infoMsg =
              'Một email xác thực đã được gửi tới ' + email + '. Vui lòng kiểm tra hộp thư.';
            store.setError(infoMsg);
            errorService.showInfo(infoMsg);

            store.setLoading(false);
            patchState(store, { isWaitingForVerification: true });

            // ✅ Polling: max 5 minutes, stops on destroy OR cancel OR verified
            interval(3000)
              .pipe(
                takeUntilDestroyed(destroyRef),
                takeUntil(cancelVerification$),
                take(100), // ✅ 100 * 3s = 300s = 5 minutes

                switchMap(() => {
                  const currentUser = authService.getCurrentUser();
                  if (!currentUser) return of(false);

                  return from(currentUser.reload()).pipe(
                    map(() => !!currentUser.emailVerified),
                    catchError((err) => {
                      // reload fail -> treat as not verified and keep polling
                      console.error('Verification reload error', err);
                      return of(false);
                    }),
                  );
                }),

                filter((verified) => verified === true),

                // ✅ async side effects belong to switchMap, not tap
                switchMap(() =>
                  from(authService.logout()).pipe(
                    catchError((err) => {
                      // logout fail still shouldn't block UX
                      console.error('Logout after verify failed', err);
                      return EMPTY;
                    }),
                  ),
                ),

                tap(() => {
                  patchState(store, { isWaitingForVerification: false });

                  const successMsg = 'Xác thực thành công! Vui lòng đăng nhập để tiếp tục.';
                  store.setError(successMsg); // nếu UI đang hiển thị từ error slot
                  errorService.showSuccess(successMsg);

                  router.navigate(['/login']);
                }),

                finalize(() => {
                  // ✅ ensure waiting flag is never stuck
                  patchState(store, { isWaitingForVerification: false });
                }),
              )
              .subscribe({
                complete: () => {
                  // completes on take(100) timeout or cancel/destroy (if not verified)
                  // Optional: show timeout message only if still waiting
                  if (store.isWaitingForVerification?.()) {
                    const msg =
                      'Hết thời gian chờ xác thực (5 phút). Bạn có thể thử gửi lại email xác thực hoặc đăng ký lại.';
                    store.setError(msg);
                    errorService.showInfo(msg);
                  }
                },
              });
          } catch (error: any) {
            let errorMessage = 'Đăng ký không thành công';

            if (error?.code === 'auth/email-already-in-use') {
              errorMessage = 'Email này đã được sử dụng';
            } else if (error?.code === 'auth/invalid-email') {
              errorMessage = 'Định dạng email không hợp lệ';
            } else if (error?.code === 'auth/weak-password') {
              errorMessage = 'Mật khẩu quá yếu (tối thiểu 6 ký tự)';
            }

            store.setError(errorMessage);
            errorService.showError(errorMessage);
            store.setLoading(false);
          }
        },

        logout: async () => {
          try {
            await authService.logout();
            patchState(store, { user: null });
            errorService.showInfo('You have been logged out');
            router.navigate(['/login']);
          } catch (error: any) {
            const errorMessage = error?.message || 'Logout failed';
            store.setError(errorMessage);
            errorService.showError(errorMessage);
          }
        },

        _setUser: (user: User | null) => {
          // Internal use
          patchState(store, { user });
          store.setLoading(false);
        },
      };
    },
  ),
  withHooks({
    onInit(store, authService = inject(AuthService), destroyRef = inject(DestroyRef)) {
      authService.user$.pipe(takeUntilDestroyed(destroyRef)).subscribe((user) => {
        store._setUser(user);
      });
    },
  }),
);
