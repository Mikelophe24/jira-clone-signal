import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { ProjectsStore } from './features/projects/projects.store';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { BreadcrumbsComponent } from './core/components/breadcrumbs/breadcrumbs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatMenuModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    BreadcrumbsComponent,
  ],
  template: `
    <div class="app-container">
      <mat-toolbar color="primary" class="main-toolbar">
        <span>Jira Clone</span>
        <span class="spacer"></span>

        @if (authStore.user()) {
        <!-- Notifications -->
        <button
          mat-icon-button
          [matMenuTriggerFor]="notificationMenu"
          [matBadge]="projectsStore.pendingInvites().length"
          matBadgeColor="warn"
          [matBadgeHidden]="projectsStore.pendingInvites().length === 0"
        >
          <mat-icon>notifications</mat-icon>
        </button>

        <mat-menu #notificationMenu="matMenu">
          @for (invite of projectsStore.pendingInvites(); track invite.id) {
          <div class="invite-item" (click)="$event.stopPropagation()">
            <span class="invite-text">
              Invitation to <strong>{{ invite.name }}</strong> by
              <strong>{{ getOwnerName(invite.ownerId) }}</strong>
            </span>
            <div class="invite-actions">
              <button mat-icon-button color="primary" (click)="accept(invite)">
                <mat-icon>check</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="reject(invite)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
          } @empty {
          <div class="no-invites">No notifications exists</div>
          }
        </mat-menu>

        <span class="user-name">{{ authStore.user()?.displayName }}</span>
        <button mat-icon-button (click)="authStore.logout()" title="Logout">
          <mat-icon>logout</mat-icon>
        </button>
        } @else {
        <a mat-button routerLink="/login">Login</a>
        }
      </mat-toolbar>

      <mat-sidenav-container class="sidenav-container">
        @if (authStore.user()) {
        <mat-sidenav mode="side" opened class="main-sidenav">
          <mat-nav-list>
            <div mat-subheader>Workspace</div>
            <a
              mat-list-item
              routerLink="/projects"
              routerLinkActive="active-link"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              <mat-icon matListItemIcon>home</mat-icon>
              <span matListItemTitle>Home</span>
            </a>
            <a mat-list-item routerLink="/my-tasks" routerLinkActive="active-link">
              <mat-icon matListItemIcon>check_circle</mat-icon>
              <span matListItemTitle>My Tasks</span>
            </a>

            <mat-divider></mat-divider>
            <div mat-subheader>Projects</div>
            @for (project of projectsStore.projects(); track project.id) {
            <a mat-list-item [routerLink]="['/project', project.id]" routerLinkActive="active-link">
              <mat-icon matListItemIcon class="project-icon">folder</mat-icon>
              <span matListItemTitle>{{ project.name }}</span>
            </a>
            } @empty {
            <div class="empty-projects">No projects</div>
            }
            <a mat-list-item routerLink="/projects" class="add-project-link">
              <mat-icon matListItemIcon>add</mat-icon>
              <span matListItemTitle>Add Project</span>
            </a>
          </mat-nav-list>
        </mat-sidenav>
        }

        <mat-sidenav-content class="main-content">
          <app-breadcrumbs></app-breadcrumbs>
          <div class="content-body">
            <router-outlet></router-outlet>
          </div>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [
    `
      .app-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }
      .main-toolbar {
        position: relative;
        z-index: 2;
      }
      .spacer {
        flex: 1 1 auto;
      }
      .user-name {
        margin-right: 8px;
        font-size: 14px;
        margin-left: 16px;
      }
      .sidenav-container {
        flex: 1;
      }
      .main-sidenav {
        width: 250px;
        background: #f4f5f7;
        border-right: 1px solid #dfe1e6;
      }
      .main-content {
        background: #fff;
        display: flex;
        flex-direction: column;
      }
      .content-body {
        flex: 1;
        overflow: auto;
      }
      .active-link {
        background-color: #ebecf0;
        color: #0052cc !important;
        mat-icon {
          color: #0052cc;
        }
      }
      .project-icon {
        color: #5e6c84;
      }
      .empty-projects {
        padding: 0 16px;
        font-size: 12px;
        color: #5e6c84;
        font-style: italic;
      }
      .invite-item {
        padding: 8px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        min-width: 250px;
        border-bottom: 1px solid #eee;
      }
      .invite-text {
        font-size: 14px;
      }
      .invite-actions {
        display: flex;
      }
      .no-invites {
        padding: 16px;
        color: #888;
        font-style: italic;
        text-align: center;
      }
    `,
  ],
})
export class AppComponent {
  readonly authStore = inject(AuthStore);
  readonly projectsStore = inject(ProjectsStore);

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      if (user) {
        this.projectsStore.loadInvites(user.uid);
        // Load projects globally so sidebar is populated
        this.projectsStore.loadProjects(user.uid);
      }
    });
  }

  accept(invite: any) {
    const user = this.authStore.user();
    if (user) {
      this.projectsStore.acceptInvite(invite, user.uid);
    }
  }

  reject(invite: any) {
    const user = this.authStore.user();
    if (user) {
      this.projectsStore.rejectInvite(invite, user.uid);
    }
  }

  getOwnerName(ownerId: string): string {
    const owner = this.projectsStore.projectOwners().find((u: any) => u.uid === ownerId);
    return owner?.displayName || 'Unknown';
  }
}
