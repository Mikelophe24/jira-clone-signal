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
      <a routerLink="/projects" class="crumb-link">Projects</a>

      @if (projectName()) {
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
        color: #5e6c84;
      }

      .crumb-link {
        text-decoration: none;
        color: #0052cc;
        font-weight: 500;

        &:hover {
          text-decoration: underline;
        }
      }

      .crumb-text {
        color: #42526e;
      }

      .separator {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #7a869a;
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
