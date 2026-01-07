import { Component, inject, effect } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { ProjectsStore } from './features/projects/projects.store';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { NgFor } from '@angular/common';
import { BreadcrumbsComponent } from './core/components/breadcrumbs/breadcrumbs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatMenuModule,
    BreadcrumbsComponent,
  ],
  template: `
    <mat-toolbar color="primary">
      <span>Jira Clone</span>
      <span class="spacer"></span>
      <a mat-button routerLink="/projects">Projects</a>

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

    <div class="app-content">
      <app-breadcrumbs></app-breadcrumbs>
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [
    `
      .spacer {
        flex: 1 1 auto;
      }
      .user-name {
        margin-right: 8px;
        font-size: 14px;
        margin-left: 16px;
      }
      .app-content {
        height: calc(100vh - 64px);
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
