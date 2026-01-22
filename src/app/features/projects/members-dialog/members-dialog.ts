import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { ProjectsStore } from '../projects.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-members-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSelectModule,
    MatTooltipModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
  ],
  template: `
    <h2 mat-dialog-title>Manage Members</h2>
    <mat-dialog-content>
      <!-- List Existing Members -->
      <mat-list>
        <h3 mat-subheader>Current Members</h3>
        @for (member of store.members(); track member.uid) {
          <mat-list-item>
            <mat-icon matListItemIcon>person</mat-icon>
            <div matListItemTitle>
              {{ member.displayName || member.email }}
              <span class="role-badge" [ngClass]="getRole(member.uid)">
                {{ getRoleLabel(member.uid) }}
              </span>
            </div>
            <div matListItemLine>{{ member.email }}</div>

            <!-- Actions -->
            <div matListItemMeta>
              <!-- Owner removes other members -->
              @if (isOwner && member.uid !== currentUser?.uid) {
                <button
                  mat-icon-button
                  (click)="removeMember(member.uid)"
                  color="warn"
                  matTooltip="Remove member"
                >
                  <mat-icon>remove_circle_outline</mat-icon>
                </button>
              }
              <!-- Member leaves project -->
              @if (!isOwner && member.uid === currentUser?.uid) {
                <button mat-button color="warn" (click)="leaveProject(member.uid)">Leave</button>
              }
            </div>
          </mat-list-item>
        }
      </mat-list>

      <div class="divider"></div>

      <!-- Add New Member (Only Owner) -->
      @if (isOwner) {
        <h3>Add Member</h3>
        <div class="add-form-container">
          <mat-form-field appearance="outline" class="email-input">
            <mat-label>User Email</mat-label>
            <input matInput [formControl]="emailControl" placeholder="friend@example.com" />
            @if (emailControl.invalid && (emailControl.dirty || emailControl.touched)) {
              <mat-error>Please enter a valid email address</mat-error>
            }
          </mat-form-field>

          <div class="role-selector-row">
            <mat-form-field appearance="outline" class="role-input">
              <mat-label>Role</mat-label>
              <mat-select [(ngModel)]="selectedRole">
                <mat-select-trigger>
                  {{ selectedRole | titlecase }}
                </mat-select-trigger>

                <mat-option value="admin">
                  <div class="role-option">
                    <span class="role-title">Administrator</span>
                    <span class="role-desc"
                      >Admins can do most things, like update settings and add other admins.</span
                    >
                  </div>
                </mat-option>
                <mat-option value="member">
                  <div class="role-option">
                    <span class="role-title">Member</span>
                    <span class="role-desc"
                      >Members are part of the team, and can add, edit, and collaborate on all
                      work.</span
                    >
                  </div>
                </mat-option>
                <mat-option value="viewer">
                  <div class="role-option">
                    <span class="role-title">Viewer</span>
                    <span class="role-desc"
                      >Viewers can search through, view, and comment, but not much else.</span
                    >
                  </div>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>
      }
      @if (error) {
        <p class="error">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (isOwner) {
        <button
          mat-raised-button
          color="primary"
          (click)="addMember()"
          [disabled]="store.loading() || emailControl.invalid"
        >
          <mat-icon>person_add</mat-icon> Invite
        </button>
      }
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .divider {
        height: 1px;
        background: #eee;
        margin: 16px 0;
      }
      .add-form-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .add-form {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .email-input {
        flex: 1;
        width: 100%;
        /* margin-bottom: -1.25em; Remove this to fix overlap with error message */
      }
      .add-btn {
        height: 56px;
      }
      .role-selector-row {
        display: flex;
        gap: 8px;
        align-items: center;
        width: 100%;
      }
      .role-input {
        flex: 1; /* Take remaining space */
        width: auto; /* Allow flex to control width */
        /* margin-bottom: -1.25em; Remove this as well */
      }
      .role-option {
        display: flex;
        flex-direction: column;
        padding: 4px 0;
      }
      .role-title {
        font-weight: 500;
        font-size: 14px;
        line-height: 20px;
      }
      .role-desc {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        line-height: 16px;
        white-space: normal;
      }
      .error {
        color: #d32f2f;
        margin-top: 16px;
      }
      .role-badge {
        font-size: 12px;
        margin-left: 8px;
        font-weight: 500;
        color: #5e6c84;
      }
      /* Specific colors for ROLES */
      .role-badge.owner {
        color: #0052cc;
      }
      .role-badge.admin {
        color: #0065ff;
      }
      .role-badge.member {
        color: #42526e;
      }
      .role-badge.viewer {
        color: #6b778c;
        font-style: italic;
      }
    `,
  ],
})
export class MembersDialog {
  store = inject(ProjectsStore);
  authStore = inject(AuthStore);
  private router = inject(Router);
  private dialogRef = inject(MatDialogRef);

  emailControl = new FormControl('', [Validators.required, Validators.email]);
  selectedRole: 'admin' | 'member' | 'viewer' = 'member';
  error = '';

  get currentUser() {
    return this.authStore.user();
  }

  get isOwner() {
    const project = this.store.selectedProject();
    return project?.ownerId === this.currentUser?.uid;
  }

  getRole(uid: string): string {
    const project = this.store.selectedProject();
    if (!project) return '';
    if (project.ownerId === uid) return 'owner';
    return project.roles?.[uid] || 'member';
  }

  getRoleLabel(uid: string): string {
    const role = this.getRole(uid);
    switch (role) {
      case 'owner':
        return '(Owner)';
      case 'admin':
        return '(Admin)';
      case 'viewer':
        return '(Viewer)';
      default:
        return '(Member)';
    }
  }

  async addMember() {
    if (this.emailControl.invalid) return;
    const email = this.emailControl.value;
    if (!email) return;

    this.error = '';

    try {
      // Pass the selectedRole to the store action
      await this.store.inviteUser(email, this.selectedRole);
      this.emailControl.reset();
      // Reset to default
      this.selectedRole = 'member';
      alert('Invitation sent!');
    } catch (err: any) {
      this.error = err.message || 'Failed to invite member';
    }
  }

  async removeMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      await this.store.removeMember(memberId);
    } catch (err: any) {
      this.error = err.message || 'Failed to remove member';
    }
  }

  async leaveProject(memberId: string) {
    if (!confirm('Are you sure you want to leave this project?')) return;
    try {
      await this.store.removeMember(memberId);
      this.dialogRef.close();
      this.router.navigate(['/projects']);
    } catch (err: any) {
      this.error = err.message || 'Failed to leave project';
    }
  }
}
