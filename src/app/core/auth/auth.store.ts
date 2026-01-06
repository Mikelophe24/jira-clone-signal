import { signalStore, withState, withMethods, patchState, withHooks } from '@ngrx/signals';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from '@angular/fire/auth';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap } from 'rxjs';

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, authService = inject(AuthService)) => ({
    login: async () => {
      patchState(store, { loading: true, error: null });
      try {
        console.log('Attempting to login with Google...');
        await authService.loginWithGoogle();
        console.log('Login successful');
      } catch (error: any) {
        console.error('Login failed', error);
        patchState(store, { error: error.message || 'Login failed' });
      } finally {
        patchState(store, { loading: false });
      }
    },
    loginEmail: async (email: string, pass: string) => {
      patchState(store, { loading: true, error: null });
      try {
        await authService.loginWithEmail(email, pass);
      } catch (error: any) {
        patchState(store, { error: error.message || 'Login failed' });
      } finally {
        patchState(store, { loading: false });
      }
    },
    register: async (email: string, pass: string, name: string) => {
      patchState(store, { loading: true, error: null });
      try {
        await authService.registerWithEmail(email, pass, name);
      } catch (error: any) {
        patchState(store, { error: error.message || 'Registration failed' });
      } finally {
        patchState(store, { loading: false });
      }
    },
    logout: async () => {
      await authService.logout();
      patchState(store, { user: null });
    },
    _setUser: (user: User | null) => {
      // Internal use
      patchState(store, { user, loading: false });
    },
  })),
  withHooks({
    onInit(store, authService = inject(AuthService)) {
      // Subscribe to user changes
      authService.user$.subscribe((user) => {
        store._setUser(user);
      });
    },
  })
);
