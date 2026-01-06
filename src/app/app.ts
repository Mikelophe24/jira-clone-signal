import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthStore } from './core/auth/auth.store';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary">
      <span>Jira Clone</span>
      <span class="spacer"></span>
      <a mat-button routerLink="/projects">Projects</a>

      @if (authStore.user()) {
      <span class="user-name">{{ authStore.user()?.displayName }}</span>
      <button mat-icon-button (click)="authStore.logout()" title="Logout">
        <mat-icon>logout</mat-icon>
      </button>
      } @else {
      <a mat-button routerLink="/login">Login</a>
      }
    </mat-toolbar>

    <div class="app-content">
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
      }
      .app-content {
        height: calc(100vh - 64px);
      }
    `,
  ],
})
export class AppComponent {
  readonly authStore = inject(AuthStore);
}
