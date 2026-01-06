import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { FormsModule } from '@angular/forms';
import { ProjectsStore } from '../projects.store';
import { NgFor } from '@angular/common';

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
    FormsModule,
    NgFor,
  ],
  template: `
    <h2 mat-dialog-title>Manage Members</h2>
    <mat-dialog-content>
      <!-- List Existing Members -->
      <mat-list>
        <h3 mat-subheader>Current Members</h3>
        <mat-list-item *ngFor="let member of store.members()">
          <mat-icon matListItemIcon>person</mat-icon>
          <div matListItemTitle>{{ member.displayName || member.email }}</div>
          <div matListItemLine>{{ member.email }}</div>
        </mat-list-item>
      </mat-list>

      <div class="divider"></div>

      <!-- Add New Member -->
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
      @if (error) {
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
  emailToAdd = '';
  error = '';

  async addMember() {
    if (!this.emailToAdd) return;
    this.error = '';

    try {
      await this.store.addMember(this.emailToAdd);
      this.emailToAdd = '';
    } catch (err: any) {
      this.error = err.message || 'Failed to add member';
    }
  }
}
