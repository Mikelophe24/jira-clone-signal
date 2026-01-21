import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.Login),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-list/project-list.component').then((m) => m.ProjectList),
  },
  {
    path: 'project/:projectId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-layout/project-layout.component').then(
        (m) => m.ProjectLayout,
      ),
    children: [
      {
        path: 'board',
        loadComponent: () => import('./features/board/board/board.component').then((m) => m.Board),
      },
      {
        path: 'backlog',
        loadComponent: () =>
          import('./features/board/backlog/backlog.component').then((m) => m.Backlog),
      },
      {
        path: '',
        redirectTo: 'board',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'my-tasks',
    canActivate: [authGuard],
    loadComponent: () => import('./features/my-tasks/my-tasks.component').then((m) => m.MyTasks),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home.component').then((m) => m.Home),
  },
  {
    path: '',
    redirectTo: 'projects',
    pathMatch: 'full',
  },
];
