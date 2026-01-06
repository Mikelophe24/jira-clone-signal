import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-list/project-list').then((m) => m.ProjectList),
  },
  {
    path: 'project/:projectId/board',
    canActivate: [authGuard],
    loadComponent: () => import('./features/board/board/board').then((m) => m.Board),
  },
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full',
  },
];
