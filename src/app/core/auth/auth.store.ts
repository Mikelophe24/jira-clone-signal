import { signalStore, withState, withMethods, patchState, withHooks } from '@ngrx/signals';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from '@angular/fire/auth';
import { Router } from '@angular/router';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../services/error-notification.service';

type AuthState = {
  user: User | null;
};

const initialState: AuthState = {
  user: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withMethods(
    (
      store,
      authService = inject(AuthService),
      router = inject(Router),
      errorService = inject(ErrorNotificationService)
    ) => ({
      login: async () => {
        store.setLoading(true);
        store.clearError();

        const onFocus = () => {
          store.setLoading(false);
        };
        window.addEventListener('focus', onFocus);

        try {
          console.log('Attempting to login with Google...');
          await authService.loginWithGoogle();
          console.log('Login successful');
          errorService.showSuccess('Welcome! Login successful');
        } catch (error: any) {
          if (
            error.code === 'auth/popup-closed-by-user' ||
            error.code === 'auth/cancelled-popup-request'
          ) {
            console.log('Popup closed by user');
          } else {
            const errorMessage = error?.message || 'Login failed';
            console.error('Login failed', error);
            // store.setError(errorMessage);
            errorService.showError(errorMessage);
          }
        } finally {
          window.removeEventListener('focus', onFocus);
          store.setLoading(false);
        }
      },
      loginEmail: async (email: string, pass: string) => {
        store.setLoading(true);
        store.clearError();
        try {
          await authService.loginWithEmail(email, pass);
          errorService.showSuccess('Welcome back!');
          store.setLoading(false);
        } catch (error: any) {
          const errorMessage = error?.message || 'Login failed';
          // store.setError(errorMessage);
          errorService.showError(errorMessage);
        }
      },
      register: async (email: string, pass: string, name: string) => {
        store.setLoading(true);
        store.clearError();
        try {
          await authService.registerWithEmail(email, pass, name);
          errorService.showSuccess('Account created successfully! Welcome!');
          store.setLoading(false);
        } catch (error: any) {
          const errorMessage = error?.message || 'Registration failed';
          // store.setError(errorMessage);
          errorService.showError(errorMessage);
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
          // store.setError(errorMessage);
          errorService.showError(errorMessage);
        }
      },
      _setUser: (user: User | null) => {
        // Internal use - called by auth state subscription
        patchState(store, { user });
        store.setLoading(false);
      },
    })
  ),
  withHooks({
    onInit(store, authService = inject(AuthService)) {
      // Subscribe to Firebase auth state changes
      authService.user$.subscribe((user) => {
        store._setUser(user);
      });
    },
  })
);
