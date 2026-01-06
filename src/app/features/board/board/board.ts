import { Component, inject, OnInit, effect } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BoardStore } from '../board.store';
import { ProjectsStore } from '../../projects/projects.store';
import { AuthStore } from '../../../core/auth/auth.store'; // Correct path
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Issue, IssuePriority } from '../../issue/issue.model';
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
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
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
    IssueDialog,
    MembersDialog,
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
              <button mat-stroked-button (click)="openMembersDialog()">
                <mat-icon>people</mat-icon> Members
              </button>
            </div>
          </div>
        </div>

        @if (store.loading()) {
        <mat-spinner diameter="30"></mat-spinner>
        }
      </div>

      <div class="board-columns" cdkDropListGroup>
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
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .board-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 16px;
        background-color: #f4f5f7;
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
          color: #172b4d;
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
            color: #5e6c84;
            margin-right: 8px;
          }

          input {
            font-size: 14px;
          }
        }

        .quick-filters {
          display: flex;
          gap: 12px;

          button.active {
            background-color: #deebff;
            color: #0052cc;
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
        background: #ebecf0;
        border-radius: 6px;
        display: flex;
        flex-direction: column;
        padding: 8px;
        max-height: 100%;
        overflow: hidden; /* Ensure column itself doesn't scroll */
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
          color: #5e6c84;
          text-transform: uppercase;
        }
        .header-end {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .issue-count {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
          padding: 2px 8px;
          font-size: 11px;
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
      }
      .issue-card {
        position: relative;
        cursor: move;
        background: #fff;
        border-radius: 3px;
        box-shadow: 0 1px 2px rgba(9, 30, 66, 0.25);
        transition: background 0.1s, box-shadow 0.1s;
        margin-bottom: 4px;

        &:hover {
          background-color: #ebecf0;
        }
      }

      /* Reduce padding in mat-card-content to make it compact */
      .issue-card mat-card-content {
        padding: 10px 12px !important;
      }

      .issue-title {
        font-size: 14px;
        color: #172b4d;
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
        color: #5e6c84;
        font-weight: 600;
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
          color: #6b778c; /* Subtle gray */
        }

        &:hover mat-icon {
          color: #de350b; /* Red on hover */
        }
      }

      .issue-card:hover .delete-btn {
        opacity: 1; /* Show on card hover */
      }

      .cdk-drag-preview {
        box-sizing: border-box;
        border-radius: 4px;
        box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14),
          0 3px 14px 2px rgba(0, 0, 0, 0.12);
        background-color: white;
        z-index: 1000;
        overflow: hidden !important; /* Fix scrollbars during drag */
      }
      .cdk-drag-placeholder {
        opacity: 0.5;
        background: #e0e0e0;
        border: 1px dashed #999;
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
        box-shadow: 0 0 0 2px #fff;
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
    `,
  ],
})
export class Board implements OnInit {
  readonly store = inject(BoardStore);
  readonly projectsStore = inject(ProjectsStore);
  readonly authStore = inject(AuthStore);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      if (user && this.projectsStore.projects().length === 0) {
        this.projectsStore.loadProjects(user.uid);
      }
    });
  }

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const projectId = params.get('projectId');
      if (projectId) {
        this.store.loadIssues(projectId);
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
          if (projectId) {
            this.store.addIssue({
              ...result,
              projectId,
              boardId: projectId, // Assuming 1 board per project for now
              order: 0, // Default order
              key: `${this.projectsStore.selectedProject()?.key}-${Math.floor(
                Math.random() * 1000
              )}`,
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

  getAssignee(assigneeId: string | undefined) {
    if (!assigneeId) return null;
    return this.projectsStore.members().find((m) => m.uid === assigneeId);
  }

  openMembersDialog() {
    this.dialog.open(MembersDialog, {
      width: '500px',
    });
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
}
