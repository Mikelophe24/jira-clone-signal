import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.user()) {
    return true;
  }

  if (!store.loading() && !store.user()) {
    router.navigateByUrl('/login');
    return false;
  }

  return true;
};
