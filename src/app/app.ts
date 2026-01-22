import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { ProjectsStore } from './features/projects/projects.store';
import { ThemeStore } from './core/theme/theme.store';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { BreadcrumbsComponent } from './core/components/breadcrumbs/breadcrumbs';
import { DatePipe } from '@angular/common';
import { NotificationStore } from './features/notifications/notification.store';
import { Notification } from './features/notifications/notification.model';
import { Router } from '@angular/router';

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
    DatePipe,
  ],
  template: `
    <div class="app-container">
      <mat-toolbar class="main-toolbar">
        @if (authStore.user()) {
          <button mat-icon-button (click)="toggleSidebar()" title="Toggle Sidebar">
            <mat-icon>menu</mat-icon>
          </button>
        }
        <span class="logo-text">Jira Clone</span>

        <span class="spacer"></span>

        <!-- Theme Toggle -->
        <button mat-icon-button (click)="themeStore.toggleTheme()" class="theme-toggle">
          <mat-icon>{{ themeStore.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

        @if (authStore.user()) {
          <!-- Notifications -->
          <!-- Notifications -->
          <button
            mat-icon-button
            [matMenuTriggerFor]="notificationMenu"
            [matBadge]="projectsStore.pendingInvites().length + notificationStore.unreadCount()"
            matBadgeColor="warn"
            [matBadgeHidden]="
              projectsStore.pendingInvites().length === 0 && notificationStore.unreadCount() === 0
            "
          >
            <mat-icon [class.has-updates]="notificationStore.unreadCount() > 0"
              >notifications</mat-icon
            >
          </button>

          <mat-menu #notificationMenu="matMenu" (closed)="resetNotifications()">
            @for (invite of projectsStore.pendingInvites(); track invite.id) {
              <div class="invite-item" (click)="$event.stopPropagation()">
                <span class="invite-text">
                  Invitation to <strong>{{ invite.name }}</strong> as a
                  <strong>{{ getInviteRole(invite) }}</strong> by
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
              @if (notificationStore.notifications().length === 0) {
                <div class="no-invites">No notifications</div>
              }
            }

            @if (
              projectsStore.pendingInvites().length > 0 &&
              notificationStore.notifications().length > 0
            ) {
              <mat-divider></mat-divider>
            }

            @for (notification of visibleNotifications(); track notification.id) {
              <div
                class="notification-item"
                [class.unread]="!notification.read"
                (click)="handleNotificationClick(notification)"
              >
                <div class="notification-content">
                  <div class="notification-text">{{ notification.content }}</div>
                  <div class="notification-date">{{ notification.createdAt | date: 'short' }}</div>
                </div>
                @if (!notification.read) {
                  <div class="unread-dot"></div>
                }
              </div>
            }

            @if (!showAllNotifications() && notificationStore.notifications().length > 5) {
              <button mat-button class="show-more-btn" (click)="toggleShowAll($event)">
                Show more ({{ notificationStore.notifications().length - 5 }} hidden)
              </button>
            } @else if (showAllNotifications()) {
              <button mat-button class="show-more-btn" (click)="toggleShowAll($event)">
                Show less
              </button>
            }
          </mat-menu>

          @if (authStore.user(); as user) {
            <img
              [src]="
                user.photoURL ||
                'https://ui-avatars.com/api/?name=' + user.displayName + '&background=random'
              "
              class="user-avatar"
              [title]="user.displayName"
            />
          }

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
          <mat-sidenav mode="side" [opened]="sidebarOpened()" class="main-sidenav">
            <mat-nav-list>
              <a
                mat-list-item
                routerLink="/home"
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
                <a
                  mat-list-item
                  [routerLink]="['/project', project.id]"
                  routerLinkActive="active-link"
                >
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
        background-color: var(--jira-surface);
      }
      .main-toolbar {
        position: relative;
        z-index: 2;
        background-color: var(--jira-header-bg);
        color: var(--jira-text);
        border-bottom: 1px solid var(--jira-border);
      }
      .logo-text {
        margin-left: 8px;
        font-weight: 500;
        color: var(--jira-text);
      }
      .spacer {
        flex: 1 1 auto;
      }
      .theme-toggle {
        margin-right: 8px;
        color: var(--jira-text-secondary);
      }
      .spacer {
        flex: 1 1 auto;
      }
      .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        margin-left: 16px;
        object-fit: cover;
        box-shadow: 0 0 0 2px #fff;
      }
      .user-name {
        margin-right: 8px;
        font-size: 14px;
        margin-left: 8px;
        font-weight: 500;
      }
      .sidenav-container {
        flex: 1;
      }
      .main-sidenav {
        width: 250px;
        background: var(--jira-sidebar-bg);
        border-right: 1px solid var(--jira-border);
        color: var(--jira-text);
      }
      .main-content {
        background: var(--jira-surface);
        display: flex;
        flex-direction: column;
      }
      .content-body {
        flex: 1;
        overflow: auto;
      }
      .active-link {
        background-color: var(--jira-active-link-bg);
        color: var(--jira-active-link-text) !important;

        span,
        mat-icon {
          color: var(--jira-active-link-text) !important;
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
        font-size: 13px;
      }

      .notification-item {
        padding: 12px 16px;
        border-bottom: 1px solid #eee;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: background-color 0.2s;
        gap: 12px;
        max-width: 300px;
      }

      .notification-item:hover {
        background-color: #f4f5f7;
      }

      .notification-item.unread {
        background-color: #e6f7ff; /* Light blue for unread */
      }
      .notification-item.unread:hover {
        background-color: #bae7ff;
      }

      .notification-content {
        flex: 1;
      }

      .notification-text {
        font-size: 13px;
        color: #172b4d;
        line-height: 1.4;
        margin-bottom: 4px;
      }

      .notification-date {
        font-size: 11px;
        color: #6b778c;
      }

      .unread-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #0052cc;
        flex-shrink: 0;
      }

      .has-updates {
        /* animation: swing 1s ease; */
      }

      .show-more-btn {
        width: 100%;
        color: #0052cc;
        font-size: 13px;
        font-weight: 500;
        padding: 8px;
        text-align: center;
        border-top: 1px solid #eee;
        border-radius: 0;
      }
      .show-more-btn:hover {
        background-color: #f4f5f7;
      }
    `,
  ],
})
export class AppComponent {
  readonly authStore = inject(AuthStore);
  readonly projectsStore = inject(ProjectsStore);
  readonly notificationStore = inject(NotificationStore);
  readonly themeStore = inject(ThemeStore);
  private router = inject(Router);

  // Sidebar state
  readonly sidebarOpened = signal<boolean>(true);

  // Notifications display state
  readonly showAllNotifications = signal<boolean>(false);

  readonly visibleNotifications = computed(() => {
    const notifications = this.notificationStore.notifications();
    if (this.showAllNotifications()) {
      return notifications;
    }
    return notifications.slice(0, 5);
  });

  toggleShowAll(event: Event) {
    event.stopPropagation();
    this.showAllNotifications.set(!this.showAllNotifications());
  }

  resetNotifications() {
    this.showAllNotifications.set(false);
  }

  toggleSidebar() {
    this.sidebarOpened.set(!this.sidebarOpened());
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

  getInviteRole(project: any): string {
    const userId = this.authStore.user()?.uid;
    if (!userId || !project.roles) return 'Member';
    const role = project.roles[userId];
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Member';
  }

  handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      this.notificationStore.markAsRead(notification.id);
    }
    // Navigate to the issue
    // We assume the route is /project/:projectId/board?issueId=:issueId or similar
    // Or just /project/:projectId and open the issue dialog via query param or local state?
    // Current app seems to use URLs like /project/:id.
    // Let's assume navigating to the project board is a good start.
    // If the app supports deep linking to issue issues, we'd use that.
    // Based on previous conversations, clicking an issue usually opens a dialog.
    // We might not have deep linking set up for dialogs yet.
    // For now, just go to the project.
    // Navigate to the project board with issueId query param
    this.router.navigate(['/project', notification.projectId, 'board'], {
      queryParams: { issueId: notification.issueId },
    });
  }
}
