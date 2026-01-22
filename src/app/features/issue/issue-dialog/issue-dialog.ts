import {
  Component,
  Inject,
  inject,
  ChangeDetectionStrategy,
  computed,
  ChangeDetectorRef,
  DestroyRef,
  SecurityContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  FormControl,
} from '@angular/forms';
import { QuillEditorComponent } from 'ngx-quill';
import { Issue, IssuePriority, IssueType, Comment, Subtask, Attachment } from '../issue.model';
import { IssueService } from '../issue.service';

import { ProjectsStore } from '../../projects/projects.store';
import { SprintStore } from '../../board/sprint.store';
import { AuthStore } from '../../../core/auth/auth.store'; // Adjust path if needed
import { NotificationStore } from '../../notifications/notification.store';
import { DatePipe } from '@angular/common';
import DOMPurify from 'dompurify';

export interface IssueDialogData {
  statusColumnId: string;
  issue?: Issue;
  sprintId?: string;
}

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
    QuillEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <h2 mat-dialog-title style="margin:0; font-size:20px; font-weight:500;">
          {{ isEditing ? 'Edit Issue' : 'Create Issue' }}
        </h2>
        <div class="header-actions">
          <!-- Potential for more actions -->
        </div>
      </div>

      <mat-dialog-content class="dialog-content-layout">
        <div class="main-column">
          <form [formGroup]="form" class="main-form">
            <mat-form-field appearance="outline" class="title-field">
              <mat-label>Title</mat-label>
              <input
                matInput
                formControlName="title"
                required
                cdkFocusInitial
                style="font-size: 18px; font-weight: 500;"
              />
              @if (form.get('title')?.invalid && form.get('title')?.touched) {
                <mat-error>Title is required</mat-error>
              }
            </mat-form-field>

            <div class="field-container description-container">
              <label class="field-label">Description</label>
              <textarea
                matInput
                formControlName="description"
                class="description-textarea"
                placeholder="Add a description..."
                cdkTextareaAutosize
                #autosize="cdkTextareaAutosize"
                cdkAutosizeMinRows="3"
                cdkAutosizeMaxRows="10"
              ></textarea>
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
                [formControl]="newSubtaskControl"
                (keydown.enter)="addSubtask()"
              />
              <button
                mat-button
                (click)="addSubtask()"
                [disabled]="newSubtaskControl.invalid || !newSubtaskControl.value"
              >
                Add
              </button>
            </div>
          </div>

          <!-- Attachments Section (Only for existing issues) -->
          @if (isEditing) {
            <div class="attachments-section">
              <h3>Attachments</h3>

              <div class="attachment-list">
                @for (att of attachments; track att.id) {
                  <div class="attachment-item">
                    <a
                      href="javascript:void(0)"
                      (click)="openAttachment(att)"
                      class="attachment-link"
                    >
                      <mat-icon style="font-size: 20px; height: 20px; width: 20px; color: #5e6c84;"
                        >description</mat-icon
                      >
                      {{ att.name }}
                    </a>
                    <button
                      mat-icon-button
                      color="warn"
                      (click)="deleteAttachment(att.id)"
                      style="width: 24px; height: 24px; line-height: 24px;"
                    >
                      <mat-icon style="font-size: 16px; height: 16px; width: 16px;">close</mat-icon>
                    </button>
                  </div>
                }
              </div>

              <div class="add-attachment">
                <button mat-stroked-button (click)="fileInput.click()">
                  <mat-icon>attach_file</mat-icon> Attach
                </button>
                <input
                  #fileInput
                  type="file"
                  style="display:none"
                  (change)="onFileSelected($event)"
                />
              </div>
            </div>
          }

          <!-- Comments Section (Only for existing issues) -->
          @if (isEditing) {
            <div class="comments-section">
              <h3>Comments</h3>

              <div class="add-comment">
                @if (authStore.user(); as currentUser) {
                  <img
                    [src]="
                      currentUser.photoURL ||
                      'https://ui-avatars.com/api/?name=' + currentUser.displayName
                    "
                    class="comment-avatar"
                  />
                }
                <div class="comment-input-wrapper">
                  <quill-editor
                    class="comment-editor"
                    [formControl]="newCommentControl"
                    [modules]="commentModules"
                    placeholder="Add a comment..."
                    theme="snow"
                  ></quill-editor>
                  <button
                    mat-raised-button
                    color="primary"
                    [disabled]="newCommentControl.invalid || !newCommentControl.value"
                    (click)="addComment()"
                    style="margin-top: 8px;"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div class="comment-list">
                @for (comment of comments; track comment.id) {
                  <div class="comment-item">
                    @if (getUser(comment.userId); as user) {
                      <img
                        [src]="
                          user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName
                        "
                        class="comment-avatar"
                      />
                      <div class="comment-content">
                        <div class="comment-header">
                          <span class="comment-author">{{ user.displayName }}</span>
                          <span class="comment-date">{{ comment.createdAt | date: 'short' }}</span>
                          @if (authStore.user()?.uid === comment.userId) {
                            <button
                              mat-icon-button
                              class="delete-comment-btn"
                              (click)="deleteComment(comment.id)"
                            >
                              <mat-icon
                                style="font-size: 16px; height: 16px; width: 16px; line-height: 16px;"
                                >delete</mat-icon
                              >
                            </button>
                          }
                        </div>
                        <div class="comment-text" [innerHTML]="comment.safeContent"></div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div class="sidebar-column">
          <form [formGroup]="form" class="sidebar-form">
            <div class="meta-section">
              <label class="sidebar-label">Status</label>
              <mat-form-field appearance="outline" class="sidebar-field" subscriptSizing="dynamic">
                <mat-select formControlName="statusColumnId">
                  <mat-option value="todo">To Do</mat-option>
                  <mat-option value="in-progress">In Progress</mat-option>
                  <mat-option value="done">Done</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="meta-section">
              <label class="sidebar-label">Assignee</label>
              <mat-form-field appearance="outline" class="sidebar-field" subscriptSizing="dynamic">
                <mat-select formControlName="assigneeId">
                  <mat-option [value]="null">Unassigned</mat-option>
                  @for (member of projectsStore.members(); track member.uid) {
                    <mat-option [value]="member.uid">
                      {{ member.displayName }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <div class="meta-section">
              <label class="sidebar-label">Reporter</label>
              <div class="read-only-value">
                @if (reporterId && getUser(reporterId); as reporter) {
                  <div class="reporter-chip">
                    <img
                      [src]="
                        reporter.photoURL ||
                        'https://ui-avatars.com/api/?name=' + reporter.displayName
                      "
                      class="reporter-avatar"
                    />
                    {{ reporter.displayName }}
                  </div>
                } @else {
                  <span style="color: #6b778c; font-style: italic;">Wait for save...</span>
                }
              </div>
            </div>

            <div class="meta-section">
              <label class="sidebar-label">Priority</label>
              <mat-form-field appearance="outline" class="sidebar-field" subscriptSizing="dynamic">
                <mat-select formControlName="priority">
                  <mat-option value="low">
                    <mat-icon
                      style="font-size:16px; width:16px; height:16px; vertical-align:middle; color:#0065ff; margin-right:4px"
                      >arrow_downward</mat-icon
                    >
                    Low
                  </mat-option>
                  <mat-option value="medium">
                    <mat-icon
                      style="font-size:16px; width:16px; height:16px; vertical-align:middle; color:#ff9900; margin-right:4px"
                      >remove</mat-icon
                    >
                    Medium
                  </mat-option>
                  <mat-option value="high">
                    <mat-icon
                      style="font-size:16px; width:16px; height:16px; vertical-align:middle; color:#de350b; margin-right:4px"
                      >arrow_upward</mat-icon
                    >
                    High
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="meta-section">
              <label class="sidebar-label">Type</label>
              <mat-form-field appearance="outline" class="sidebar-field" subscriptSizing="dynamic">
                <mat-select formControlName="type">
                  <mat-option value="task">Task</mat-option>
                  <mat-option value="bug">Bug</mat-option>
                  <mat-option value="story">Story</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="meta-section">
              <label class="sidebar-label">Sprint</label>
              <mat-form-field appearance="outline" class="sidebar-field" subscriptSizing="dynamic">
                <mat-select formControlName="sprintId">
                  <mat-option value="backlog">Backlog</mat-option>
                  @for (sprint of selectableSprints(); track sprint.id) {
                    <mat-option [value]="sprint.id">
                      {{ sprint.name }}
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>

            <div class="meta-section">
              <label class="sidebar-label">Due Date</label>
              <mat-form-field appearance="outline" class="sidebar-field" subscriptSizing="dynamic">
                <input matInput [matDatepicker]="picker" formControlName="dueDate" />
                <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
              </mat-form-field>
            </div>
          </form>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-footer">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!form.valid" (click)="save()">
          {{ isEditing ? 'Save' : 'Create' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .dialog-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 90vh; /* Ensure it fits */
        overflow: hidden;
      }
      .dialog-header {
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #dfe1e6;
        background: #fff;
        flex-shrink: 0;
      }
      .dialog-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
        color: #172b4d;
      }

      .dialog-content-layout {
        display: flex;
        flex: 1;
        overflow: hidden; /* Hide main scroll bar, inner cols will scroll */
        padding: 0 !important; /* Remove default mat padding */
        gap: 0;
      }

      /* Main Column (Left) */
      .main-column {
        flex: 1;
        padding: 24px;
        overflow-y: auto;
        min-width: 0; /* Prevent flex overflow */
      }

      /* Sidebar Column (Right) */
      .sidebar-column {
        width: 320px;
        padding: 24px;
        background-color: #f4f5f7; /* Very light gray for sidebar */
        border-left: 1px solid #dfe1e6;
        overflow-y: auto;
        flex-shrink: 0;
      }

      .title-field {
        width: 100%;
        margin-bottom: 24px;
      }
      /* Material Override for Title to look bigger */
      ::ng-deep .title-field .mat-mdc-form-field-infix {
        padding-top: 8px;
        padding-bottom: 8px;
        min-height: auto;
      }

      .description-container {
        margin-bottom: 32px;
      }

      .description-textarea {
        width: 100%;
        min-height: 40px;
        padding: 8px 12px;
        border: 1px solid #dfe1e6;
        border-radius: 3px;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        box-sizing: border-box;
      }
      .description-textarea:focus {
        outline: none;
        border-color: #4c9aff;
        background-color: #fff;
        box-shadow: 0 0 0 1px #4c9aff;
      }

      .field-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #172b4d;
        margin-bottom: 8px;
      }

      .sidebar-label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: #5e6c84;
        margin-bottom: 4px;
        text-transform: uppercase;
      }

      .meta-section {
        margin-bottom: 20px;
      }

      .sidebar-field {
        width: 100%;
        font-size: 14px;
      }

      /* Tighten up sidebar form fields */
      ::ng-deep .sidebar-field .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      .reporter-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        color: #172b4d;
        font-size: 14px;
      }
      .reporter-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
      }

      /* Subtasks & Comments */
      .subtasks-section,
      .comments-section {
        margin-top: 32px;
      }
      h3 {
        font-size: 16px;
        font-weight: 600;
        color: #172b4d;
        margin: 0 0 16px 0;
      }

      /* Comments */
      .add-comment {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }
      .comment-input-wrapper {
        flex: 1;
      }
      .comment-editor {
        background: #fff;
        border: 1px solid #dfe1e6; /* Ensure border visible */
        border-radius: 4px;
      }

      .comment-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
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
        font-weight: 600;
        color: #42526e;
        font-size: 14px;
      }
      .comment-date {
        font-size: 12px;
        color: #6b778c;
      }
      .comment-text {
        font-size: 14px;
        line-height: 1.5;
        color: #172b4d;
      }

      .dialog-footer {
        padding: 16px 24px;
        border-top: 1px solid #dfe1e6;
        background: #f4f5f7; /* Match sidebar or be white */
        background: #fff;
        flex-shrink: 0;
      }

      /* Progress bar */
      .progress-bar {
        height: 6px;
        background: #ebecf0;
        border-radius: 3px;
        margin-bottom: 12px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        background: #0052cc;
        transition: width 0.3s ease;
      }

      .subtask-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #f4f5f7;
      }
      .subtask-item:hover {
        background: #fafbfc;
      }
      .add-subtask {
        margin-top: 12px;
        display: flex;
        gap: 8px;
      }
      .subtask-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #dfe1e6;
        border-radius: 3px;
      }

      /* Quill Overrides for new layout */
      :host ::ng-deep .ql-toolbar.ql-snow {
        border-color: #dfe1e6;
        background: #f4f5f7;
      }
      :host ::ng-deep .ql-container.ql-snow {
        border-color: #dfe1e6;
        background: #fff;
      }
      :host ::ng-deep .comment-editor .ql-container {
        min-height: 80px;
      }

      /* Attachments */
      .attachments-section {
        margin-top: 32px;
      }
      .attachment-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }
      .attachment-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #fff;
        border: 1px solid #dfe1e6;
        border-radius: 3px;
      }
      .attachment-link {
        display: flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: #172b4d;
        font-weight: 500;
        font-size: 14px;
      }
      .attachment-link:hover {
        color: #0052cc;
        text-decoration: underline;
      }
    `,
  ],
})
export class IssueDialog {
  projectsStore = inject(ProjectsStore);
  authStore = inject(AuthStore);
  sprintStore = inject(SprintStore);
  notificationStore = inject(NotificationStore);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  issueService = inject(IssueService);

  selectableSprints = computed(() =>
    this.sprintStore.sprints().filter((s) => s.status !== 'completed'),
  );

  editorModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }],
      ['link'],
      ['clean'],
    ],
  };

  commentModules = {
    toolbar: [
      ['bold', 'italic', 'strike'],
      ['code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
    ],
  };

  form!: FormGroup; // Reactive Form

  // Auxiliary state for things not in the main form or complex UI handling
  comments: any[] = [];
  subtasks: Subtask[] = [];
  attachments: Attachment[] = [];
  reporterId: string | undefined | null = null;
  isEditing = false;

  newCommentControl = new FormControl('', [Validators.required]);
  newSubtaskControl = new FormControl('', [Validators.required]);

  // File upload state
  uploadingFiles: File[] = [];
  isDragOver = false;

  constructor(
    public dialogRef: MatDialogRef<IssueDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IssueDialogData,
  ) {
    this.initForm();

    if (data.issue) {
      this.isEditing = true;
      this.form.patchValue({
        title: data.issue.title,
        description: data.issue.description,
        type: data.issue.type,
        priority: data.issue.priority,
        assigneeId: data.issue.assigneeId,
        statusColumnId: data.issue.statusColumnId,
        sprintId: data.issue.sprintId,
        dueDate: data.issue.dueDate ? new Date(data.issue.dueDate) : null,
      });

      this.reporterId = data.issue.reporterId || null;

      // Load subcollections
      const issueId = data.issue.id;

      this.issueService
        .getComments(issueId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((comments) => {
          this.comments = comments.map((c) => ({
            ...c,
            safeContent: this.sanitizeHtml(c.content),
          }));
          this.cdr.markForCheck();
        });

      this.issueService
        .getSubtasks(issueId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((subtasks) => {
          this.subtasks = subtasks;
          this.cdr.markForCheck();
        });

      this.issueService
        .getAttachments(issueId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((attachments) => {
          this.attachments = attachments;
          this.cdr.markForCheck();
        });
    } else {
      // Set default status if creating new
      this.form.patchValue({
        statusColumnId: data.statusColumnId || 'todo',
        sprintId: data.sprintId || 'backlog',
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
      sprintId: ['backlog' as string | null],
      dueDate: [null as Date | null],
    });
  }

  getUser(userId: string) {
    return this.projectsStore.members().find((m) => m.uid === userId);
  }

  getSprint(sprintId: string) {
    return this.sprintStore.sprints().find((s) => s.id === sprintId);
  }

  // --- Helper Methods ---

  sanitizeHtml(html: string): any {
    // Whitelist only what Quill uses
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        's',
        'blockquote',
        'pre',
        'ol',
        'ul',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'span',
        'a',
      ],
      ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'color'],
    });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }

  // --- Comment Methods ---

  private isQuillEmpty(html: string): boolean {
    if (!html) return true;
    const normalized = html
      .replace(/<p><br><\/p>/g, '')
      .replace(/<(.|\n)*?>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return !normalized;
  }

  addComment() {
    const content = this.newCommentControl.value || '';
    if (this.isQuillEmpty(content)) return;

    const user = this.authStore.user();
    if (!user) return;

    const newComment = {
      userId: user.uid,
      content: content,
      createdAt: new Date().toISOString(),
    };

    if (this.isEditing && this.data.issue?.id) {
      this.issueService
        .addCommentToIssue(this.data.issue.id, newComment)
        .then(() => {
          this.newCommentControl.reset();

          // Notifications
          const issue = this.data.issue!;
          const recipients = new Set<string>();
          if (issue.assigneeId) recipients.add(issue.assigneeId);
          if (issue.reporterId) recipients.add(issue.reporterId);
          recipients.delete(user.uid);
          recipients.forEach((recipientId) => {
            this.notificationStore.createNotification({
              recipientId,
              senderId: user.uid,
              type: 'COMMENT',
              issueId: issue.id,
              projectId: issue.projectId,
              content: `${user.displayName} commented on ${issue.title}`,
              createdAt: new Date().toISOString(),
              read: false,
            });
          });
        })
        .catch((err) => {
          console.error('Error adding comment', err);
          alert('Failed to add comment');
        });
    } else {
      const tempComment = { ...newComment, id: crypto.randomUUID() };
      this.comments = [...this.comments, tempComment];
      this.newCommentControl.reset();
    }
  }

  deleteComment(commentId: string) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    if (this.isEditing && this.data.issue?.id) {
      this.issueService.deleteCommentFromIssue(this.data.issue.id, commentId).catch((err) => {
        console.error('Error deleting comment', err);
        alert('Failed to delete comment');
      });
    } else {
      // Local delete
      this.comments = this.comments.filter((c) => c.id !== commentId);
    }
  }

  // --- Subtask Methods ---

  addSubtask() {
    if (!this.newSubtaskControl.value || !this.newSubtaskControl.value.trim()) return;

    const title = this.newSubtaskControl.value;
    const newSubtask = {
      title: title,
      completed: false,
    };

    if (this.isEditing && this.data.issue?.id) {
      this.issueService
        .addSubtaskToIssue(this.data.issue.id, newSubtask)
        .then(() => {
          this.newSubtaskControl.reset();
        })
        .catch((err) => console.error(err));
    } else {
      const tempTask = { ...newSubtask, id: crypto.randomUUID() };
      this.subtasks = [...this.subtasks, tempTask];
      this.newSubtaskControl.reset();
    }
  }

  toggleSubtask(subtask: Subtask) {
    if (this.isEditing && this.data.issue?.id) {
      this.issueService.updateSubtask(this.data.issue.id, subtask.id, {
        completed: !subtask.completed,
      });
    } else {
      const updatedSubtasks = this.subtasks.map((s) =>
        s.id === subtask.id ? { ...s, completed: !s.completed } : s,
      );
      this.subtasks = updatedSubtasks;
    }
  }

  deleteSubtask(subtaskId: string) {
    if (this.isEditing && this.data.issue?.id) {
      this.issueService.deleteSubtaskFromIssue(this.data.issue.id, subtaskId);
    } else {
      this.subtasks = this.subtasks.filter((s) => s.id !== subtaskId);
    }
  }

  // --- Attachment Methods ---

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    input.value = '';

    if (this.isEditing && this.data.issue?.id) {
      try {
        const base64 = await this.issueService.uploadIssueAttachment(this.data.issue.id, file); // Still use helper, but it just does base64
        const newAttachment = {
          name: file.name,
          url: base64, // Storing base64 in subcollection doc
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploaderId: this.authStore.user()?.uid || 'unknown',
        };
        await this.issueService.addAttachmentToIssue(this.data.issue.id, newAttachment);
      } catch (err) {
        console.error('Upload failed', err);
        alert('Upload failed');
      }
    } else {
      try {
        // just base64 conv
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const newAtt: Attachment = {
            id: crypto.randomUUID(),
            name: file.name,
            url: reader.result as string,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            uploaderId: (this.authStore.user()?.uid || 'unknown') as string,
          };
          this.attachments = [...this.attachments, newAtt];
        };
      } catch (e) {}
    }
  }

  deleteAttachment(attachmentId: string) {
    if (!confirm('Are you sure you want to remove this attachment?')) return;

    if (this.isEditing && this.data.issue?.id) {
      this.issueService
        .deleteAttachmentFromIssue(this.data.issue.id, attachmentId)
        .catch((error) => {
          console.error('Error removing attachment:', error);
          this.cdr.markForCheck();
          alert('Failed to remove attachment.');
        });
    }
  }

  openAttachment(att: Attachment) {
    const win = window.open();
    if (win) {
      const isImage = att.type.startsWith('image/');
      const content = isImage
        ? `<img src="${att.url}" style="max-width:100%">`
        : `<iframe src="${att.url}" style="width:100%;height:100%;border:none;"></iframe>`;

      win.document.write(`
        <html>
          <head><title>${att.name}</title></head>
          <body style="margin:0; display:flex; justify-content:center; align-items:center; background:#0b0f19;">
            ${content}
          </body>
        </html>
      `);
      win.document.close();
    }
  }

  calculateProgress(): number {
    if (this.subtasks.length === 0) return 0;
    const completed = this.subtasks.filter((s) => s.completed).length;
    return (completed / this.subtasks.length) * 100;
  }

  async save() {
    if (this.form.invalid) return;

    const formValue = this.form.getRawValue();

    const basicData: any = {
      ...formValue,
      dueDate: formValue.dueDate ? formValue.dueDate.toISOString() : null,
      // Default to currentUser as reporter if creating
      reporterId: this.isEditing
        ? this.data.issue?.reporterId || this.authStore.user()?.uid
        : this.authStore.user()?.uid,
    };

    // Convert 'backlog' string to null for sprintId
    if (basicData.sprintId === 'backlog') {
      basicData.sprintId = null;
    }

    // Auto-set isInBacklog based on sprint
    if (basicData.sprintId) {
      const sprint = this.sprintStore.sprints().find((s) => s.id === basicData.sprintId);
      if (sprint && sprint.status === 'active') {
        basicData.isInBacklog = false;
      } else {
        basicData.isInBacklog = true;
      }
    } else {
      basicData.isInBacklog = true;
    }

    // ProjectId needed for new issue
    if (!this.isEditing) {
      const projectId = this.projectsStore.selectedProjectId();
      if (projectId) {
        basicData.projectId = projectId;
      }
      basicData.boardId = projectId;
    }

    try {
      if (this.isEditing && this.data.issue?.id) {
        // UPDATE
        await this.issueService.updateIssue(this.data.issue.id, basicData);

        // Check Assignment Notification
        const currentUser = this.authStore.user();
        const newAssigneeId = basicData.assigneeId;
        const oldAssigneeId = this.data.issue.assigneeId;

        if (
          currentUser &&
          newAssigneeId &&
          newAssigneeId !== oldAssigneeId &&
          newAssigneeId !== currentUser.uid
        ) {
          this.notificationStore.createNotification({
            recipientId: newAssigneeId,
            senderId: currentUser.uid,
            type: 'ASSIGNMENT',
            issueId: this.data.issue.id,
            projectId: this.data.issue.projectId,
            content: `${currentUser.displayName} assigned you to ${basicData.title}`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        }

        this.dialogRef.close(); // No result needed, relying on stream updates
      } else {
        this.dialogRef.close({
          ...basicData,
          __isNew: true,
          comments: this.comments,
          subtasks: this.subtasks,
          attachments: this.attachments,
        });
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save issue');
    }
  }
}
