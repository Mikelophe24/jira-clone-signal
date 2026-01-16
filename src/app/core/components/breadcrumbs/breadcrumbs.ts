import { Component, inject, computed } from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjectsStore } from '../../../features/projects/projects.store';
import { filter } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <nav class="breadcrumbs">
      @if (isHomePage()) {
      <span class="crumb-text">Home</span>
      } @else if (isMyTasksPage()) {
      <span class="crumb-text">My Tasks</span>
      } @else if (isProjectsListPage()) {
      <span class="crumb-text">Projects</span>
      } @else if (projectName()) {
      <a routerLink="/projects" class="crumb-link">Projects</a>
      <mat-icon class="separator">chevron_right</mat-icon>
      <span class="crumb-text">{{ projectName() }}</span>
      @if (viewName()) {
      <mat-icon class="separator">chevron_right</mat-icon>
      <span class="crumb-text">{{ viewName() }}</span>
      } }
    </nav>
  `,
  styles: [
    `
      .breadcrumbs {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        gap: 4px;
        font-size: 14px;
        color: var(--jira-text-secondary);
      }

      .crumb-link {
        text-decoration: none;
        color: var(--jira-active-link-text);
        font-weight: 500;

        &:hover {
          text-decoration: underline;
        }
      }

      .crumb-text {
        color: var(--jira-text);
      }

      .separator {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: var(--jira-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class BreadcrumbsComponent {
  private router = inject(Router);
  private projectsStore = inject(ProjectsStore);

  // Subscribe to router events to trigger updates if needed,
  // though accessing store signals is reactive enough usually.
  // We mainly need to know if we are on a "project" route.

  currentUrl = toSignal(this.router.events.pipe(filter((event) => event instanceof NavigationEnd)));

  isHomePage = computed(() => {
    this.currentUrl(); // Trigger dependency
    return this.router.url === '/home' || this.router.url === '/';
  });

  isMyTasksPage = computed(() => {
    this.currentUrl(); // Trigger dependency
    return this.router.url === '/my-tasks';
  });

  isProjectsListPage = computed(() => {
    this.currentUrl(); // Trigger dependency
    return this.router.url === '/projects';
  });

  projectName = computed(() => {
    // Check if current route involves a project
    // We can rely on the store's selectedProject which is set by the Board component
    // Trigger dependency on router change
    this.currentUrl();

    const project = this.projectsStore.selectedProject();
    if (project && this.router.url.includes(`/project/${project.id}`)) {
      return project.name;
    }
    return null;
  });

  viewName = computed(() => {
    // Trigger dependency on router change
    this.currentUrl();

    const url = this.router.url;
    if (url.includes('/board')) return 'Board';
    if (url.includes('/backlog')) return 'Backlog';
    return null;
  });
}
