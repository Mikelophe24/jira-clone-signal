import { Component, Inject, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  FormsModule,
  ReactiveFormsModule,
  FormGroup,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { Issue, IssuePriority, IssueType, Comment, Subtask } from '../issue.model';
import { IssueService } from '../issue.service';

import { ProjectsStore } from '../../projects/projects.store';

export interface IssueDialogData {
  statusColumnId: string;
  issue?: Issue;
}

import { AuthStore } from '../../../core/auth/auth.store'; // Adjust path if needed
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-issue-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEditing ? 'Edit Issue' : 'Create Issue' }}</h2>
    <mat-dialog-content class="dialog-content">
      <form class="issue-form" [formGroup]="form">
        <!-- Reporter Info (Only in Edit Mode) -->
        @if (isEditing && reporterId; as rid) { @if (getUser(rid); as reporter) {
        <div class="reporter-info">
          <span class="label">Reporter:</span>
          <div class="reporter-chip">
            <img
              [src]="
                reporter.photoURL || 'https://ui-avatars.com/api/?name=' + reporter.displayName
              "
              class="reporter-avatar"
            />
            {{ reporter.displayName }}
          </div>
        </div>
        } }

        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" required cdkFocusInitial />
          @if(form.get('title')?.invalid && form.get('title')?.touched) {
          <mat-error>Title is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="task">Task</mat-option>
              <mat-option value="bug">Bug</mat-option>
              <mat-option value="story">Story</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select formControlName="priority">
              <mat-option value="low">Low</mat-option>
              <mat-option value="medium">Medium</mat-option>
              <mat-option value="high">High</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Assignee</mat-label>
            <mat-select formControlName="assigneeId">
              <mat-option [value]="null">Unassigned</mat-option>
              @for (member of projectsStore.members(); track member.uid) {
              <mat-option [value]="member.uid">
                {{ member.displayName }}
              </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Due Date</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="dueDate" />
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>
        </div>
      </form>

      <!-- Subtasks Section -->
      <div class="subtasks-section">
        <h3>Subtasks</h3>
        @if (subtasks.length > 0) {
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="calculateProgress()"></div>
        </div>
        }

        <div class="subtask-list">
          @for (s of subtasks; track s.id) {
          <div class="subtask-item">
            <mat-checkbox [checked]="s.completed" (change)="toggleSubtask(s)">
              <span [class.completed-text]="s.completed">{{ s.title }}</span>
            </mat-checkbox>
            <button
              mat-icon-button
              color="warn"
              class="delete-subtask-btn"
              (click)="deleteSubtask(s.id)"
            >
              <mat-icon style="font-size: 16px; height: 16px; width: 16px;">close</mat-icon>
            </button>
          </div>
          }
        </div>
        <div class="add-subtask">
          <input
            class="subtask-input"
            placeholder="Add a subtask..."
            [(ngModel)]="newSubtaskTitle"
            (keydown.enter)="addSubtask()"
          />
          <button mat-button (click)="addSubtask()" [disabled]="!newSubtaskTitle">Add</button>
        </div>
      </div>

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
                @if (authStore.user()?.uid === comment.userId) {
                <button
                  mat-icon-button
                  class="delete-comment-btn"
                  (click)="deleteComment(comment.id)"
                >
                  <mat-icon style="font-size: 16px; height: 16px; width: 16px; line-height: 16px;"
                    >delete</mat-icon
                  >
                </button>
                }
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
      <button mat-raised-button color="primary" [disabled]="!form.valid" (click)="save()">
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

      .reporter-info {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 13px;
        color: #5e6c84;
      }

      .reporter-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #ebecf0;
        padding: 4px 8px 4px 4px;
        border-radius: 16px;
        font-weight: 500;
        color: #172b4d;
      }

      .reporter-avatar {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        object-fit: cover;
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

      .subtasks-section {
        margin-top: 24px;
        padding: 0 4px;
      }
      .progress-bar {
        height: 4px;
        background: #ebecf0;
        border-radius: 2px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        background: #0052cc;
        transition: width 0.3s ease;
      }
      .subtask-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }
      .subtask-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        &:hover .delete-subtask-btn {
          opacity: 1;
        }
      }
      .completed-text {
        text-decoration: line-through;
        color: #5e6c84;
      }
      .delete-subtask-btn {
        width: 24px;
        height: 24px;
        line-height: 24px;
        opacity: 0;
        transition: opacity 0.2s;
        mat-icon {
          font-size: 16px;
        }
      }
      .add-subtask {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .subtask-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #dfe1e6;
        border-radius: 3px;
        outline: none;
        &:focus {
          border-color: #4c9aff;
        }
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

      /* ... rest of styles same as before ... */
      .comment-content {
        flex: 1;
      }

      .comment-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }

      .delete-comment-btn {
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
        margin-left: auto;
        width: 24px !important;
        height: 24px !important;
        line-height: 24px !important;
        padding: 0 !important;

        mat-icon {
          color: #6b778c;
        }

        &:hover mat-icon {
          color: #de350b;
        }
      }

      .comment-item:hover .delete-comment-btn {
        opacity: 1;
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
  private fb = inject(FormBuilder);
  issueService = inject(IssueService);

  form!: FormGroup; // Reactive Form

  // Auxiliary state for things not in the main form or complex UI handling
  comments: any[] = [];
  subtasks: Subtask[] = [];
  reporterId: string | undefined | null = null;
  isEditing = false;

  newCommentText = '';
  newSubtaskTitle = '';

  constructor(
    public dialogRef: MatDialogRef<IssueDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IssueDialogData
  ) {
    this.initForm();

    if (data.issue) {
      this.isEditing = true;
      // Load data specifically
      this.form.patchValue({
        title: data.issue.title,
        description: data.issue.description,
        type: data.issue.type,
        priority: data.issue.priority,
        assigneeId: data.issue.assigneeId || null,
        statusColumnId: data.issue.statusColumnId || data.statusColumnId || 'todo',
        dueDate: data.issue.dueDate ? new Date(data.issue.dueDate) : null,
      });

      this.reporterId = data.issue.reporterId || null;
      this.comments = data.issue.comments || [];
      this.subtasks = data.issue.subtasks || [];
    } else {
      // Set default status if creating new
      this.form.patchValue({
        statusColumnId: data.statusColumnId || 'todo',
      });
    }
  }

  private initForm() {
    this.form = this.fb.group({
      title: ['', [Validators.required]],
      description: [''],
      type: ['task' as IssueType, [Validators.required]],
      priority: ['medium' as IssuePriority, [Validators.required]],
      assigneeId: [null as string | null],
      statusColumnId: ['todo'],
      dueDate: [null as Date | null],
    });
  }

  getUser(userId: string) {
    return this.projectsStore.members().find((m) => m.uid === userId);
  }

  // ... Comment methods same as before ...
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

    const updatedComments = [...this.comments, newComment];

    if (this.isEditing && this.data.issue?.id) {
      this.issueService
        .updateIssue(this.data.issue.id, { comments: updatedComments })
        .then(() => {
          this.comments = updatedComments;
          this.newCommentText = '';
        })
        .catch((error) => {
          console.error('Error saving comment:', error);
        });
    } else {
      this.comments = updatedComments;
      this.newCommentText = '';
    }
  }

  deleteComment(commentId: string) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    const updatedComments = this.comments.filter((c) => c.id !== commentId);

    if (this.isEditing && this.data.issue?.id) {
      this.issueService
        .updateIssue(this.data.issue.id, { comments: updatedComments })
        .then(() => {
          this.comments = updatedComments;
        })
        .catch((error) => {
          console.error('Error deleting comment:', error);
        });
    } else {
      this.comments = updatedComments;
    }
  }

  // --- Subtask Methods ---

  addSubtask() {
    if (!this.newSubtaskTitle.trim()) return;

    const newSubtask: Subtask = {
      id: Math.random().toString(36).substr(2, 9),
      title: this.newSubtaskTitle,
      completed: false,
    };

    const updatedSubtasks = [...this.subtasks, newSubtask];

    if (this.isEditing && this.data.issue?.id) {
      this.issueService.updateIssue(this.data.issue.id, { subtasks: updatedSubtasks }).then(() => {
        this.subtasks = updatedSubtasks;
        this.newSubtaskTitle = '';
      });
    } else {
      this.subtasks = updatedSubtasks;
      this.newSubtaskTitle = '';
    }
  }

  toggleSubtask(subtask: Subtask) {
    subtask.completed = !subtask.completed;

    // Create new array trigger change detection if needed, but important for object update
    const updatedSubtasks = this.subtasks.map((s) => (s.id === subtask.id ? subtask : s));

    if (this.isEditing && this.data.issue?.id) {
      this.issueService.updateIssue(this.data.issue.id, { subtasks: updatedSubtasks });
    } else {
      this.subtasks = updatedSubtasks;
    }
  }

  deleteSubtask(subtaskId: string) {
    const updatedSubtasks = this.subtasks.filter((s) => s.id !== subtaskId);

    if (this.isEditing && this.data.issue?.id) {
      this.issueService.updateIssue(this.data.issue.id, { subtasks: updatedSubtasks }).then(() => {
        this.subtasks = updatedSubtasks;
      });
    } else {
      this.subtasks = updatedSubtasks;
    }
  }

  calculateProgress(): number {
    if (this.subtasks.length === 0) return 0;
    const completed = this.subtasks.filter((s) => s.completed).length;
    return (completed / this.subtasks.length) * 100;
  }

  save() {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();

    const result: any = {
      ...formValue,
      dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : null,
    };

    if (!this.isEditing) {
      result.comments = this.comments;
      result.subtasks = this.subtasks;
      // Set reporterId for new issues
      const currentUser = this.authStore.user();
      if (currentUser) {
        result.reporterId = currentUser.uid;
      }
    }

    this.dialogRef.close(result);
  }
}
