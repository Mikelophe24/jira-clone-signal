import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectsStore } from '../../projects/projects.store';
import { BoardStore } from '../board.store';
import { IssueDialog } from '../../issue/issue-dialog/issue-dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { IssueService } from '../../issue/issue.service';
import { ActivatedRoute } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  template: `
    <div class="backlog-container">
      <div class="backlog-header">
        <h2>Backlog</h2>
        <button mat-raised-button color="primary" (click)="createIssue()">Create Issue</button>
      </div>

      <div class="issues-list">
        @for (issue of backlogIssues(); track issue.id) {
        <div class="backlog-item">
          <div class="item-left">
            <mat-icon [style.color]="getPriorityColor(issue.priority)">
              {{ getPriorityIcon(issue.priority) }}
            </mat-icon>
            <div class="issue-key">{{ issue.key }}</div>
            <div class="issue-title">{{ issue.title }}</div>
          </div>

          <div class="item-right">
            <div class="assignee">
              @if (getAssignee(issue.assigneeId); as assignee) {
              <img
                [src]="
                  assignee.photoURL ||
                  'https://ui-avatars.com/api/?name=' + assignee.displayName + '&background=random'
                "
                class="assignee-avatar"
                [matTooltip]="assignee.displayName"
              />
              } @else {
              <span class="unassigned-text">Unassigned</span>
              }
            </div>
            <button mat-stroked-button color="primary" (click)="moveToBoard(issue.id)">
              Move to Board
            </button>
            <button mat-icon-button (click)="editIssue(issue)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="warn" (click)="deleteIssue(issue.id, issue.key)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
        } @empty {
        <div class="empty-state">No issues in the backlog.</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .backlog-container {
        padding: 24px;
        background: #fff;
        height: 100%;
        overflow-y: auto;
      }
      .backlog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;

        h2 {
          margin: 0;
          color: #172b4d;
        }
      }
      .backlog-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border: 1px solid #dfe1e6;
        border-radius: 3px;
        margin-bottom: 4px;
        transition: background 0.1s;

        &:hover {
          background: #f4f5f7;
        }
      }
      .item-left {
        display: flex;
        align-items: center;
        gap: 16px;
        flex: 1;
      }
      .item-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .issue-key {
        font-weight: 500;
        color: #6b778c;
        min-width: 60px;
      }
      .issue-title {
        color: #172b4d;
        font-weight: 500;
      }
      .assignee {
        display: flex;
        align-items: center;
      }
      .assignee-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
        cursor: pointer;
      }
      .unassigned-text {
        color: #5e6c84;
        font-size: 13px;
        font-style: italic;
      }
      .empty-state {
        padding: 32px;
        text-align: center;
        color: #6b778c;
        background: #f4f5f7;
        border-radius: 4px;
      }
    `,
  ],
})
export class Backlog {
  projectsStore = inject(ProjectsStore);
  boardStore = inject(BoardStore);
  issueService = inject(IssueService);
  dialog = inject(MatDialog);
  route = inject(ActivatedRoute);
  authStore = inject(AuthStore);

  backlogIssues = computed(() => {
    return this.boardStore.issues().filter((i) => i.isInBacklog);
  });

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const projectId = params.get('projectId');
      if (projectId) {
        this.boardStore.loadIssues(projectId);
        this.projectsStore.selectProject(projectId);
      }
    });
  }

  moveToBoard(issueId: string) {
    this.issueService.moveToBoard(issueId);
  }

  createIssue() {
    const dialogRef = this.dialog.open(IssueDialog, {
      width: '600px',
      data: { statusColumnId: 'todo' }, // Default column if moved
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const projectId = this.projectsStore.selectedProjectId();
        const projectKey = this.projectsStore.selectedProject()?.key;
        const currentUser = this.authStore.user();
        if (projectId && projectKey && currentUser) {
          this.boardStore.addIssue({
            ...result,
            projectId,
            boardId: projectId,
            order: 0,
            key: this.boardStore.getNextIssueKey(projectKey),
            reporterId: currentUser.uid,
            isInBacklog: true,
          });
        }
      }
    });
  }

  editIssue(issue: any) {
    const dialogRef = this.dialog.open(IssueDialog, {
      width: '600px',
      data: { issue },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.boardStore.updateIssue(issue.id, result);
      }
    });
  }

  deleteIssue(issueId: string, issueKey: string) {
    if (confirm(`Are you sure you want to delete issue ${issueKey}?`)) {
      this.boardStore.deleteIssue(issueId);
    }
  }

  getPriorityIcon(priority: string) {
    switch (priority) {
      case 'high':
        return 'arrow_upward';
      case 'medium':
        return 'remove';
      case 'low':
        return 'arrow_downward';
      default:
        return 'remove';
    }
  }

  getPriorityColor(priority: string) {
    switch (priority) {
      case 'high':
        return '#de350b';
      case 'medium':
        return '#ff9900';
      case 'low':
        return '#0065ff';
      default:
        return '#172b4d';
    }
  }

  getAssignee(userId?: string) {
    if (!userId) return undefined;
    return this.projectsStore.members().find((m) => m.uid === userId);
  }
}
