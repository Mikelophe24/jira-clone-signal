import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { FormsModule } from '@angular/forms';
import { ProjectsStore } from '../projects.store';

import { AuthStore } from '../../../core/auth/auth.store';

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
    MatTooltipModule,
    FormsModule,
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
          <div matListItemTitle>{{ member.displayName || member.email }}</div>
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
      <div class="add-form">
        <mat-form-field appearance="outline" class="email-input">
          <mat-label>User Email</mat-label>
          <input matInput [(ngModel)]="emailToAdd" placeholder="friend@example.com" />
        </mat-form-field>
        <button
          mat-raised-button
          color="primary"
          (click)="addMember()"
          [disabled]="store.loading() || !emailToAdd"
        >
          <mat-icon>person_add</mat-icon> Add
        </button>
      </div>
      } @if (error) {
      <p class="error">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
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
      .add-form {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .email-input {
        flex: 1;
      }
      .error {
        color: #d32f2f;
        margin-top: 8px;
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
      await this.store.inviteUser(this.emailToAdd);
      this.emailToAdd = '';
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
