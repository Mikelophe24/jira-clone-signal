import { Component, inject, OnInit, effect } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BoardStore } from '../board.store';
import { ProjectsStore } from '../../projects/projects.store';
import { AuthStore } from '../../../core/auth/auth.store';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { Issue, IssuePriority } from '../../issue/issue.model';
import { IssueService } from '../../issue/issue.service';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BoardFilter } from './board-filter';
import { IssueDialog } from '../../issue/issue-dialog/issue-dialog';

import { MembersDialog } from '../../projects/members-dialog/members-dialog';
import { SprintStore } from '../sprint.store';
import { CompleteSprintDialog } from '../backlog/complete-sprint-dialog/complete-sprint-dialog';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonModule, DatePipe } from '@angular/common';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTooltipModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    BoardFilter,
    RouterLink,
  ],

  template: `
    <div class="board-container">
      <div class="board-header">
        <div class="header-content">
          <h2>{{ projectsStore.selectedProject()?.name }} Board</h2>
          <div class="filters">
            <mat-form-field appearance="outline" class="search-input" subscriptSizing="dynamic">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput placeholder="Search issues" (input)="onSearch($event)" />
            </mat-form-field>

            <div class="quick-filters">
              <button
                mat-stroked-button
                [class.active]="store.filter().onlyMyIssues"
                (click)="toggleMyIssues()"
              >
                Only My Issues
              </button>
              <app-board-filter></app-board-filter>

              @if (sprintStore.activeSprint()) {
              <button
                mat-flat-button
                color="primary"
                class="complete-sprint-btn"
                (click)="completeSprint()"
              >
                Complete Sprint
              </button>
              }
            </div>
          </div>
        </div>

        @if (store.loading()) {
        <mat-spinner diameter="30"></mat-spinner>
        }
      </div>

      <div
        class="board-columns"
        cdkDropListGroup
        *ngIf="sprintStore.activeSprint(); else emptyState"
      >
        <!-- TO DO Column -->
        <div class="column">
          <div class="column-header">
            <h3>TO DO</h3>
            <div class="header-end">
              <span class="issue-count">{{ store.todoIssues().length }}</span>
              <button mat-icon-button (click)="openIssueDialog('todo')">
                <mat-icon style="font-size: 18px; width: 18px; height: 18px;">add</mat-icon>
              </button>
            </div>
          </div>
          <div
            cdkDropList
            [cdkDropListData]="store.todoIssues()"
            class="issue-list"
            (cdkDropListDropped)="drop($event, 'todo')"
          >
            @for (issue of store.todoIssues(); track issue.id) {
            <mat-card
              class="issue-card"
              cdkDrag
              [cdkDragData]="issue"
              (click)="openIssueDialog('todo', issue)"
            >
              <button
                mat-icon-button
                class="backlog-btn"
                (click)="$event.stopPropagation(); moveToBacklog(issue.id)"
                matTooltip="Move to Backlog"
              >
                <mat-icon>archive</mat-icon>
              </button>
              <button
                mat-icon-button
                class="delete-btn"
                color="warn"
                (click)="$event.stopPropagation(); deleteIssue(issue.id)"
              >
                <mat-icon>delete</mat-icon>
              </button>
              <mat-card-content>
                <div class="issue-title">{{ issue.title }}</div>
                <div class="issue-meta">
                  <div class="meta-left">
                    <mat-icon
                      [style.color]="getPriorityColor(issue.priority)"
                      class="priority-icon"
                      [matTooltip]="issue.priority"
                    >
                      {{ getPriorityIcon(issue.priority) }}
                    </mat-icon>
                    <span class="key">{{ issue.key }}</span>
                    @if (issue.dueDate) {
                    <span class="due-date" [class.overdue]="isOverdue(issue.dueDate)">
                      <mat-icon
                        style="font-size: 12px; width: 12px; height: 12px; margin-right: 2px; vertical-align: middle;"
                        >calendar_today</mat-icon
                      >
                      {{ issue.dueDate | date : 'd MMM' }}
                    </span>
                    } @if (getSubtaskStats(issue); as stats) {
                    <span class="subtasks-count" title="Subtasks">
                      <mat-icon
                        style="font-size: 12px; width: 12px; height: 12px; margin-right: 2px; vertical-align: middle;"
                        >check_box</mat-icon
                      >
                      {{ stats.completed }}/{{ stats.total }}
                    </span>
                    }
                  </div>
                  @if (getAssignee(issue.assigneeId); as assignee) {
                  <img
                    [src]="
                      assignee.photoURL ||
                      'https://ui-avatars.com/api/?name=' +
                        assignee.displayName +
                        '&background=random'
                    "
                    class="assignee-avatar"
                    [title]="assignee.displayName"
                  />
                  }
                </div>
              </mat-card-content>
            </mat-card>
            }
          </div>

          <div class="column-footer">
            <button mat-button class="create-btn" (click)="openIssueDialog('todo')">
              <mat-icon>add</mat-icon> Create
            </button>
          </div>
        </div>

        <!-- IN PROGRESS Column -->
        <div class="column">
          <div class="column-header">
            <h3>IN PROGRESS</h3>
            <div class="header-end">
              <span class="issue-count">{{ store.inProgressIssues().length }}</span>
              <button mat-icon-button (click)="openIssueDialog('in-progress')">
                <mat-icon style="font-size: 18px; width: 18px; height: 18px;">add</mat-icon>
              </button>
            </div>
          </div>
          <div
            cdkDropList
            [cdkDropListData]="store.inProgressIssues()"
            class="issue-list"
            (cdkDropListDropped)="drop($event, 'in-progress')"
          >
            @for (issue of store.inProgressIssues(); track issue.id) {
            <mat-card
              class="issue-card"
              cdkDrag
              [cdkDragData]="issue"
              (click)="openIssueDialog('in-progress', issue)"
            >
              <button
                mat-icon-button
                class="backlog-btn"
                (click)="$event.stopPropagation(); moveToBacklog(issue.id)"
                matTooltip="Move to Backlog"
              >
                <mat-icon>archive</mat-icon>
              </button>
              <button
                mat-icon-button
                class="delete-btn"
                color="warn"
                (click)="$event.stopPropagation(); deleteIssue(issue.id)"
              >
                <mat-icon>delete</mat-icon>
              </button>
              <mat-card-content>
                <div class="issue-title">{{ issue.title }}</div>
                <div class="issue-meta">
                  <div class="meta-left">
                    <mat-icon
                      [style.color]="getPriorityColor(issue.priority)"
                      class="priority-icon"
                      [matTooltip]="issue.priority"
                    >
                      {{ getPriorityIcon(issue.priority) }}
                    </mat-icon>
                    <span class="key">{{ issue.key }}</span>
                    @if (issue.dueDate) {
                    <span class="due-date" [class.overdue]="isOverdue(issue.dueDate)">
                      <mat-icon
                        style="font-size: 12px; width: 12px; height: 12px; margin-right: 2px; vertical-align: middle;"
                        >calendar_today</mat-icon
                      >
                      {{ issue.dueDate | date : 'd MMM' }}
                    </span>
                    } @if (getSubtaskStats(issue); as stats) {
                    <span class="subtasks-count" title="Subtasks">
                      <mat-icon
                        style="font-size: 12px; width: 12px; height: 12px; margin-right: 2px; vertical-align: middle;"
                        >check_box</mat-icon
                      >
                      {{ stats.completed }}/{{ stats.total }}
                    </span>
                    }
                  </div>
                  @if (getAssignee(issue.assigneeId); as assignee) {
                  <img
                    [src]="
                      assignee.photoURL ||
                      'https://ui-avatars.com/api/?name=' +
                        assignee.displayName +
                        '&background=random'
                    "
                    class="assignee-avatar"
                    [title]="assignee.displayName"
                  />
                  }
                </div>
              </mat-card-content>
            </mat-card>
            }
          </div>

          <div class="column-footer">
            <button mat-button class="create-btn" (click)="openIssueDialog('in-progress')">
              <mat-icon>add</mat-icon> Create
            </button>
          </div>
        </div>

        <!-- DONE Column -->
        <div class="column">
          <div class="column-header">
            <h3>DONE</h3>
            <div class="header-end">
              <span class="issue-count">{{ store.doneIssues().length }}</span>
              <button mat-icon-button (click)="openIssueDialog('done')">
                <mat-icon style="font-size: 18px; width: 18px; height: 18px;">add</mat-icon>
              </button>
            </div>
          </div>
          <div
            cdkDropList
            [cdkDropListData]="store.doneIssues()"
            class="issue-list"
            (cdkDropListDropped)="drop($event, 'done')"
          >
            @for (issue of store.doneIssues(); track issue.id) {
            <mat-card
              class="issue-card"
              cdkDrag
              [cdkDragData]="issue"
              (click)="openIssueDialog('done', issue)"
            >
              <button
                mat-icon-button
                class="backlog-btn"
                (click)="$event.stopPropagation(); moveToBacklog(issue.id)"
                matTooltip="Move to Backlog"
              >
                <mat-icon>archive</mat-icon>
              </button>
              <button
                mat-icon-button
                class="delete-btn"
                color="warn"
                (click)="$event.stopPropagation(); deleteIssue(issue.id)"
              >
                <mat-icon>delete</mat-icon>
              </button>
              <mat-card-content>
                <div class="issue-title">{{ issue.title }}</div>
                <div class="issue-meta">
                  <div class="meta-left">
                    <mat-icon
                      [style.color]="getPriorityColor(issue.priority)"
                      class="priority-icon"
                      [matTooltip]="issue.priority"
                    >
                      {{ getPriorityIcon(issue.priority) }}
                    </mat-icon>
                    <span class="key">{{ issue.key }}</span>
                    @if (issue.dueDate) {
                    <span class="due-date" [class.overdue]="isOverdue(issue.dueDate)">
                      <mat-icon
                        style="font-size: 12px; width: 12px; height: 12px; margin-right: 2px; vertical-align: middle;"
                        >calendar_today</mat-icon
                      >
                      {{ issue.dueDate | date : 'd MMM' }}
                    </span>
                    } @if (getSubtaskStats(issue); as stats) {
                    <span class="subtasks-count" title="Subtasks">
                      <mat-icon
                        style="font-size: 12px; width: 12px; height: 12px; margin-right: 2px; vertical-align: middle;"
                        >check_box</mat-icon
                      >
                      {{ stats.completed }}/{{ stats.total }}
                    </span>
                    }
                  </div>
                  @if (getAssignee(issue.assigneeId); as assignee) {
                  <img
                    [src]="
                      assignee.photoURL ||
                      'https://ui-avatars.com/api/?name=' +
                        assignee.displayName +
                        '&background=random'
                    "
                    class="assignee-avatar"
                    [title]="assignee.displayName"
                  />
                  }
                </div>
              </mat-card-content>
            </mat-card>
            }
          </div>

          <div class="column-footer">
            <button mat-button class="create-btn" (click)="openIssueDialog('done')">
              <mat-icon>add</mat-icon> Create
            </button>
          </div>
        </div>
      </div>
      <ng-template #emptyState>
        <div class="empty-state">
          <div class="empty-state-content">
            <h3>Get started in the backlog</h3>
            <p>Plan and start a sprint to see work here.</p>
            <button mat-stroked-button routerLink="../backlog">Go to Backlog</button>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .board-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 16px;
        background-color: var(--jira-surface);
      }
      .board-header {
        margin-bottom: 24px;

        .header-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
        }

        h2 {
          margin: 0;
          font-size: 24px;
          color: var(--jira-text);
        }

        .filters {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .search-input {
          width: 200px;

          mat-icon {
            font-size: 20px;
            color: var(--jira-text-secondary);
            margin-right: 8px;
          }

          input {
            font-size: 14px;
            color: var(--jira-text);
          }
        }

        .quick-filters {
          display: flex;
          gap: 12px;

          button.active {
            background-color: var(--jira-active-link-bg);
            color: var(--jira-active-link-text);
            border-color: transparent;
          }
        }
      }
      .board-columns {
        display: flex;
        gap: 24px;
        height: 100%;
        overflow-x: auto;
        padding-bottom: 12px;
      }
      .column {
        flex: 1;
        min-width: 280px;
        max-width: 350px;
        background: var(--jira-sidebar-bg); /* Use sidebar-bg as column bg */
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        padding: 8px;
        max-height: 100%;
        overflow: hidden; /* Ensure column itself doesn't scroll */
        border: 1px solid var(--jira-border);
      }
      .column-header {
        padding: 12px 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--jira-text-secondary);
          text-transform: uppercase;
        }
        .header-end {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .issue-count {
          background: rgba(127, 127, 127, 0.2); /* Semi-transparent for both modes */
          border-radius: 10px;
          border: 1px solid var(--jira-border);
          padding: 2px 8px;
          font-size: 11px;
          color: var(--jira-text);
        }
      }
      .column-footer {
        padding: 8px;
        /* create button styling */
        .create-btn {
          width: 100%;
          text-align: left;
          justify-content: flex-start;
          color: var(--jira-text-secondary);
          &:hover {
            background-color: var(--jira-surface-raised);
            color: var(--jira-text);
          }
          mat-icon {
            margin-right: 8px;
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }

        .inline-create-form {
          padding: 4px;
        }

        .inline-input {
          width: 100%;
          padding: 8px;
          border-radius: 3px;
          border: 2px solid #0052cc;
          outline: none;
          font-family: inherit;
          font-size: 14px;
        }
      }
      .issue-list {
        flex: 1;
        min-height: 100px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 4px;
        overflow-y: auto;
        overflow-x: hidden;
      }
      .issue-card {
        position: relative;
        cursor: move;
        background: var(--jira-surface-raised);
        border-radius: 3px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        transition: background 0.1s, box-shadow 0.1s;
        margin-bottom: 4px;
        border: 1px solid transparent; /* Prepare for border transition */

        &:hover {
          background-color: var(--jira-surface-sunken);
          border-color: var(--jira-border);
        }
      }

      /* Reduce padding in mat-card-content to make it compact */
      .issue-card mat-card-content {
        padding: 10px 12px !important;
      }

      .issue-title {
        font-size: 14px;
        color: var(--jira-text);
        margin-bottom: 12px;
        line-height: 1.4;
        font-weight: 500;
        word-wrap: break-word;
      }

      .issue-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 24px;
      }

      .key {
        font-size: 12px;
        color: var(--jira-text-secondary);
        font-weight: 600;
      }

      .issue-card .backlog-btn {
        position: absolute;
        top: 2px;
        right: 28px; /* Position to the left of delete button */
        width: 24px;
        height: 24px;
        line-height: 24px;
        min-height: 24px;
        padding: 0;

        opacity: 0; /* Hidden by default */
        transition: opacity 0.2s ease-in-out;

        /* Make icon smaller and centered */
        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          line-height: 16px;
          color: var(--jira-text-secondary); /* Subtle gray */
        }

        &:hover mat-icon {
          color: #0052cc; /* Blue on hover */
        }
      }

      .issue-card .delete-btn {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 24px;
        height: 24px;
        line-height: 24px;
        min-height: 24px;
        padding: 0;

        opacity: 0; /* Hidden by default */
        transition: opacity 0.2s ease-in-out;

        /* Make icon smaller and centered */
        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          line-height: 16px;
          color: var(--jira-text-secondary); /* Subtle gray */
        }

        &:hover mat-icon {
          color: #de350b; /* Red on hover */
        }
      }

      .issue-card:hover .backlog-btn,
      .issue-card:hover .delete-btn {
        opacity: 1; /* Show on card hover */
      }

      .cdk-drag-preview {
        box-sizing: border-box;
        border-radius: 4px;
        box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14),
          0 3px 14px 2px rgba(0, 0, 0, 0.12);
        background-color: var(--jira-surface-raised);
        color: var(--jira-text);
        z-index: 1000;
        overflow: hidden !important; /* Fix scrollbars during drag */
      }
      .cdk-drag-placeholder {
        opacity: 0.5;
        background: var(--jira-sidebar-bg);
        border: 1px dashed var(--jira-text-secondary);
        min-height: 80px;
      }
      .cdk-drag-animating {
        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      }
      .issue-list.cdk-drop-list-dragging .issue-card:not(.cdk-drag-placeholder) {
        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      }

      .assignee-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
        /* Add a slight border/shadow to pop out */
        box-shadow: 0 0 0 2px var(--jira-surface-raised);
      }

      .meta-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .priority-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .due-date {
        margin-left: 8px;
        font-size: 11px;
        color: var(--jira-text-secondary);
        display: flex;
        align-items: center;
        background: var(--jira-surface-sunken);
        padding: 2px 4px;
        border-radius: 3px;
      }

      .due-date.overdue {
        color: #de350b;
        background: #ffebe6;
        font-weight: 600;
      }

      .subtasks-count {
        margin-left: 8px;
        font-size: 11px;
        color: var(--jira-text-secondary);
        display: flex;
        align-items: center;
        background: var(--jira-surface-sunken);
        padding: 2px 4px;
        border-radius: 3px;
      }
      .empty-state {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        text-align: center;
        padding-top: 40px;

        .empty-state-content {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        h3 {
          margin-bottom: 8px;
          color: var(--jira-text);
          font-weight: 500;
        }

        p {
          color: var(--jira-text-secondary);
          margin-bottom: 24px;
        }
      }
    `,
  ],
})
export class Board implements OnInit {
  readonly store = inject(BoardStore);
  readonly sprintStore = inject(SprintStore); // Inject SprintStore
  readonly projectsStore = inject(ProjectsStore);
  readonly authStore = inject(AuthStore);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private issueService = inject(IssueService);

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      if (user && this.projectsStore.projects().length === 0) {
        this.projectsStore.loadProjects(user.uid);
      }
    });
  }

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const projectId = params.get('projectId');
      if (projectId) {
        this.store.loadIssues(projectId);
        this.sprintStore.loadSprints(projectId); // Load sprints to check active sprint
        this.projectsStore.selectProject(projectId);
      }
    });
  }

  onSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.store.updateFilter({ searchQuery: input.value });
  }

  toggleMyIssues() {
    const current = this.store.filter().onlyMyIssues;
    const user = this.authStore.user();
    this.store.updateFilter({
      onlyMyIssues: !current,
      userId: user ? user.uid : null,
    });
  }

  drop(event: CdkDragDrop<Issue[]>, newStatus: string) {
    this.store.moveIssue(event, newStatus);
  }

  openIssueDialog(statusColumnId: string, issue?: Issue) {
    const dialogRef = this.dialog.open(IssueDialog, {
      width: '500px',
      data: { statusColumnId, issue },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (issue) {
          // Update existing
          this.store.updateIssue(issue.id, result);
        } else {
          // Create new
          const projectId = this.projectsStore.selectedProjectId();
          const projectKey = this.projectsStore.selectedProject()?.key;

          if (projectId && projectKey) {
            this.store.addIssue({
              ...result,
              projectId,
              boardId: projectId, // Assuming 1 board per project for now
              order: 0, // Default order
              key: this.store.getNextIssueKey(projectKey),
              reporterId: this.authStore.user()?.uid,
            });
          }
        }
      }
    });
  }

  deleteIssue(issueId: string) {
    if (confirm('Are you sure you want to delete this issue?')) {
      this.store.deleteIssue(issueId);
    }
  }

  moveToBacklog(issueId: string) {
    this.issueService.moveToBacklog(issueId);
  }

  getAssignee(assigneeId: string | undefined) {
    if (!assigneeId) return null;
    return this.projectsStore.members().find((m) => m.uid === assigneeId);
  }

  getPriorityIcon(priority: IssuePriority): string {
    switch (priority) {
      case 'high':
        return 'arrow_upward';
      case 'medium':
        return 'remove'; // or 'drag_handle' for equal
      case 'low':
        return 'arrow_downward';
      default:
        return 'remove';
    }
  }

  getPriorityColor(priority: IssuePriority): string {
    switch (priority) {
      case 'high':
        return '#de350b'; // Red
      case 'medium':
        return '#ff9900'; // Orange
      case 'low':
        return '#0065ff'; // Blue
      default:
        return '#172b4d';
    }
  }

  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Ignore time for today check
    return date < today;
  }

  getSubtaskStats(issue: Issue) {
    if (!issue.subtasks || issue.subtasks.length === 0) return null;
    const completed = issue.subtasks.filter((s) => s.completed).length;
    return { completed, total: issue.subtasks.length };
  }

  // Complete Sprint Logic
  completeSprint() {
    const activeSprint = this.sprintStore.activeSprint();
    if (!activeSprint) return;

    // We can reuse the same logic/dialog from Backlog
    // First, we need to get issues for this sprint
    // The board store 'issues' contains ALL issues, filtered by 'filteredIssues'.
    // We should probably filter by sprint ID manually or use a selector if available.
    // For now, let's filter from the main list.
    const allIssues = this.store.issues();
    const sprintIssues = allIssues.filter((i) => i.sprintId === activeSprint.id);
    const futureSprints = this.sprintStore.futureSprints();

    const dialogRef = this.dialog.open(CompleteSprintDialog, {
      width: '500px',
      data: {
        sprint: activeSprint,
        issues: sprintIssues,
        futureSprints,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.sprintStore.completeSprint(activeSprint.id);

        const destinationId = result.destinationId;
        const incompleteIssues = sprintIssues.filter((i) => i.statusColumnId !== 'done');

        if (incompleteIssues.length > 0) {
          const updates = incompleteIssues.map((i) => ({
            id: i.id,
            data: {
              sprintId: destinationId,
              isInBacklog: true,
            },
          }));

          this.issueService.batchUpdateIssues(updates);
        }
      }
    });
  }
}
