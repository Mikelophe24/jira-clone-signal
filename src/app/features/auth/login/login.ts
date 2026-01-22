import { Component, inject, effect, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    FormsModule,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <mat-card-header>
          <mat-card-title class="title">Jira Clone</mat-card-title>
          <mat-card-subtitle>Sign in to continue</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content class="content">
          @if (store.loading()) {
            <div class="spinner-container">
              <mat-spinner diameter="40"></mat-spinner>
            </div>
          }

          <mat-tab-group (selectedTabChange)="store.clearError()">
            <mat-tab label="Login">
              <div class="form-container">
                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput [(ngModel)]="email" type="email" (keyup.enter)="login()" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Password</mat-label>
                  <input matInput [(ngModel)]="password" type="password" (keyup.enter)="login()" />
                </mat-form-field>

                @if (store.error()) {
                  <p
                    [class.error-message]="!store.error()?.includes('thành công')"
                    [class.success-message]="store.error()?.includes('thành công')"
                  >
                    {{ store.error() }}
                  </p>
                }

                <button
                  mat-raised-button
                  color="primary"
                  (click)="login()"
                  [disabled]="store.loading()"
                >
                  Login
                </button>
              </div>
            </mat-tab>
            <mat-tab label="Register">
              <div class="form-container">
                <mat-form-field appearance="outline">
                  <mat-label>Full Name</mat-label>
                  <input matInput [(ngModel)]="name" (keyup.enter)="register()" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Email</mat-label>
                  <input matInput [(ngModel)]="email" type="email" (keyup.enter)="register()" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Password</mat-label>
                  <input
                    matInput
                    [(ngModel)]="password"
                    type="password"
                    (keyup.enter)="register()"
                  />
                </mat-form-field>

                @if (store.error()) {
                  <p
                    [class.error-message]="
                      !store.error()?.includes('thành công') && !store.error()?.includes('xác nhận')
                    "
                    [class.success-message]="
                      store.error()?.includes('thành công') || store.error()?.includes('xác nhận')
                    "
                  >
                    {{ store.error() }}
                  </p>
                }

                <button
                  mat-raised-button
                  color="accent"
                  (click)="register()"
                  [disabled]="store.loading() || store.isWaitingForVerification()"
                >
                  Register
                </button>
              </div>
            </mat-tab>
          </mat-tab-group>

          <div class="divider">OR</div>

          <button
            mat-stroked-button
            class="google-btn"
            (click)="store.loginGoogle()"
            [disabled]="store.loading()"
          >
            <mat-icon>login</mat-icon>
            Sign in with Google
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background-color: var(--jira-surface-sunken);
        transition: background-color 0.3s ease;
      }
      .login-card {
        max-width: 400px;
        width: 100%;
        padding: 16px;
        background-color: var(--jira-surface-raised);
        color: var(--jira-text);
        border: 1px solid var(--jira-border);
      }
      .title {
        font-size: 24px;
        margin-bottom: 8px;
        color: var(--jira-text);
      }
      .content {
        padding-top: 16px;
      }
      .form-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px 0;
      }
      .spinner-container {
        display: flex;
        justify-content: center;
        margin-bottom: 16px;
      }
      .error-message {
        color: #d32f2f;
        background-color: #ffebee;
        padding: 8px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        margin-bottom: 16px;
        border: 1px solid #ffcdd2;
      }
      .success-message {
        color: #2e7d32;
        background-color: #e8f5e9;
        padding: 8px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        margin-bottom: 16px;
        border: 1px solid #c8e6c9;
      }
      .divider {
        text-align: center;
        color: var(--jira-text-secondary);
        margin: 16px 0;
        font-size: 12px;
        font-weight: 500;
      }
      .google-btn {
        width: 100%;
        color: var(--jira-text);
        border-color: var(--jira-border);
      }
    `,
  ],
})
export class Login {
  readonly store = inject(AuthStore);
  private router = inject(Router);

  email = '';
  password = '';
  name = '';

  constructor() {
    effect(() => {
      const user = this.store.user();
      if (user && user.emailVerified) {
        this.router.navigate(['/projects']);
      }
    });
  }

  login() {
    if (this.email && this.password) {
      this.store.loginEmail(this.email, this.password);
    }
  }

  register() {
    if (this.email && this.password && this.name) {
      this.store.register(this.email, this.password, this.name);
    }
  }
}
