import { Component, Inject, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { Issue, IssuePriority, IssueType, Comment } from '../issue.model';
import { NgFor } from '@angular/common';
import { ProjectsStore } from '../../projects/projects.store';

export interface IssueDialogData {
  statusColumnId: string;
  issue?: Issue;
}

import { AuthStore } from '../../../core/auth/auth.store'; // Adjust path if needed
import { DatePipe } from '@angular/common'; // We need to import DatePipe or add it to imports

@Component({
  selector: 'app-issue-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    FormsModule,
    NgFor,
    DatePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEditing ? 'Edit Issue' : 'Create Issue' }}</h2>
    <mat-dialog-content class="dialog-content">
      <form class="issue-form">
        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput [(ngModel)]="title" name="title" required cdkFocusInitial />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput [(ngModel)]="description" name="description" rows="3"></textarea>
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select [(ngModel)]="type" name="type">
              <mat-option value="task">Task</mat-option>
              <mat-option value="bug">Bug</mat-option>
              <mat-option value="story">Story</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="priority" name="priority">
              <mat-option value="low">Low</mat-option>
              <mat-option value="medium">Medium</mat-option>
              <mat-option value="high">High</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Assignee</mat-label>
          <mat-select [(ngModel)]="assigneeId" name="assignee">
            <mat-option [value]="null">Unassigned</mat-option>
            <mat-option *ngFor="let member of projectsStore.members()" [value]="member.uid">
              {{ member.displayName }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </form>

      <!-- Comments Section (Only for existing issues) -->
      @if (isEditing) {
      <div class="comments-section">
        <h3>Comments</h3>

        <div class="comment-list">
          @for (comment of comments; track comment.id) {
          <div class="comment-item">
            @if (getUser(comment.userId); as user) {
            <img
              [src]="user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName"
              class="comment-avatar"
            />
            <div class="comment-content">
              <div class="comment-header">
                <span class="comment-author">{{ user.displayName }}</span>
                <span class="comment-date">{{ comment.createdAt | date : 'short' }}</span>
              </div>
              <div class="comment-text">{{ comment.content }}</div>
            </div>
            }
          </div>
          }
        </div>

        <div class="add-comment">
          @if (authStore.user(); as currentUser) {
          <img
            [src]="
              currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + currentUser.displayName
            "
            class="comment-avatar"
          />
          }
          <div class="comment-input-wrapper">
            <input
              class="comment-input"
              placeholder="Add a comment..."
              [(ngModel)]="newCommentText"
              (keydown.enter)="addComment()"
            />
            <button mat-button color="primary" [disabled]="!newCommentText" (click)="addComment()">
              Save
            </button>
          </div>
        </div>
      </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!title" (click)="save()">
        {{ isEditing ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      /* Container for the form content */
      .dialog-content {
        max-height: 80vh;
        overflow-y: auto;
        overflow-x: hidden; /* Prevent horizontal scroll */
      }

      .issue-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 100%; /* Use full width of dialog */
        box-sizing: border-box;
        /* Add some padding to avoid fields hitting the scrollbar edge */
        padding: 8px 24px 8px 4px;
      }

      .row {
        display: flex;
        gap: 16px;
        mat-form-field {
          flex: 1;
        }
      }

      textarea {
        resize: vertical;
        min-height: 100px;
      }

      .comments-section {
        margin-top: 32px;
        border-top: 1px solid #dfe1e6;
        padding-top: 24px;
      }

      .comment-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 16px;
      }

      .comment-item {
        display: flex;
        gap: 12px;
      }

      .comment-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
      }

      .comment-content {
        flex: 1;
      }

      .comment-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .comment-author {
        font-weight: 500;
        font-size: 13px;
        color: #172b4d;
      }

      .comment-date {
        font-size: 11px;
        color: #5e6c84;
      }

      .comment-text {
        font-size: 14px;
        color: #172b4d;
        line-height: 1.5;
      }

      .add-comment {
        display: flex;
        gap: 12px;
        margin-top: 16px;
      }

      .comment-input-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        border: 1px solid #dfe1e6;
        border-radius: 4px;
        padding: 8px;
        transition: border-color 0.2s;

        &:focus-within {
          border-color: #4c9aff;
        }
      }

      .comment-input {
        border: none;
        outline: none;
        width: 100%;
        font-size: 14px;
        padding: 4px 0;
      }
    `,
  ],
})
export class IssueDialog {
  projectsStore = inject(ProjectsStore);
  authStore = inject(AuthStore);

  title = '';
  description = '';
  type: IssueType = 'task';
  priority: IssuePriority = 'medium';
  assigneeId: string | undefined | null = null;
  comments: any[] = [];
  isEditing = false;

  newCommentText = '';

  constructor(
    public dialogRef: MatDialogRef<IssueDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IssueDialogData
  ) {
    if (data.issue) {
      this.isEditing = true;
      this.title = data.issue.title;
      this.description = data.issue.description;
      this.type = data.issue.type;
      this.priority = data.issue.priority;
      this.assigneeId = data.issue.assigneeId || null;
      this.comments = data.issue.comments || [];
    }
  }

  getUser(userId: string) {
    return this.projectsStore.members().find((m) => m.uid === userId);
  }

  addComment() {
    if (!this.newCommentText.trim()) return;

    const user = this.authStore.user();
    if (!user) return;

    const newComment = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.uid,
      content: this.newCommentText,
      createdAt: new Date().toISOString(),
    };

    this.comments = [...this.comments, newComment];
    this.newCommentText = '';
  }

  save() {
    this.dialogRef.close({
      title: this.title,
      description: this.description,
      type: this.type,
      priority: this.priority,
      assigneeId: this.assigneeId || null,
      statusColumnId: this.data.statusColumnId,
      comments: this.comments, // Return updated comments
    });
  }
}
