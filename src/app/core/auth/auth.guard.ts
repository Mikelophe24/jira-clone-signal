import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.user()) {
    return true;
  }

  // Basic check, might need to wait for loading?
  // Unlike Observables, Signals always have a value.
  // If loading is true, we might want to allow or wait.
  // For a strictly guarded route, simpler to redirect if not explicitly logged in.
  // A better approach in real app involves an effect or waiting for auth settle.

  if (!store.loading() && !store.user()) {
    router.navigateByUrl('/login');
    return false;
  }

  return true; // Or handle loading state
};
