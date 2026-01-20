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
import { FormsModule } from '@angular/forms';
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
              @if (member.uid === store.selectedProject()?.ownerId) {
                <span class="owner-badge">(Owner)</span>
              }
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
            <input matInput [(ngModel)]="emailToAdd" placeholder="friend@example.com" />
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
          [disabled]="store.loading() || !emailToAdd"
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
        margin-bottom: -1.25em; /* Remove extra space from mat-form-field */
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
        margin-bottom: -1.25em;
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
      .owner-badge {
        font-size: 12px;
        color: #0052cc;
        margin-left: 8px;
        font-weight: 500;
      }
    `,
  ],
})
export class MembersDialog {
  store = inject(ProjectsStore);
  authStore = inject(AuthStore);
  private router = inject(Router);
  private dialogRef = inject(MatDialogRef);

  emailToAdd = '';
  selectedRole: 'admin' | 'member' | 'viewer' = 'member';
  error = '';

  get currentUser() {
    return this.authStore.user();
  }
  //dùng get để khi gọi ra ko phải ()

  get isOwner() {
    const project = this.store.selectedProject();
    return project?.ownerId === this.currentUser?.uid;
  }

  async addMember() {
    if (!this.emailToAdd) return;
    this.error = '';

    try {
      // Pass the selectedRole to the store action
      await this.store.inviteUser(this.emailToAdd, this.selectedRole);
      this.emailToAdd = '';
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
