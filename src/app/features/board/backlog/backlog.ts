import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectsStore } from '../../projects/projects.store';
import { BoardStore } from '../board.store';
import { SprintStore } from '../sprint.store';
import { IssueDialog } from '../../issue/issue-dialog/issue-dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { EditSprintDialog } from './edit-sprint-dialog/edit-sprint-dialog';
import { StartSprintDialog } from './start-sprint-dialog/start-sprint-dialog';
import { IssueService } from '../../issue/issue.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { Issue } from '../../issue/issue.model';
import { CompleteSprintDialog } from './complete-sprint-dialog/complete-sprint-dialog';
import { MembersDialog } from '../../projects/members-dialog/members-dialog';
import { NotificationStore } from '../../notifications/notification.store';

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    DragDropModule,
    MatMenuModule,
  ],
  template: `
    <div class="backlog-container" cdkDropListGroup>
      <div class="header-actions">
        <div class="header-title-group">
          <h2>Backlog</h2>
          <div class="members-actions">
            <button mat-stroked-button (click)="openMembersDialog()" class="members-btn">
              <mat-icon>people</mat-icon> Members
            </button>
            <div class="avatar-stack" (click)="openMembersDialog()">
              @for (member of projectsStore.members().slice(0, 5); track member.uid) {
                <img
                  [src]="
                    member.photoURL ||
                    'https://ui-avatars.com/api/?name=' + member.displayName + '&background=random'
                  "
                  class="member-avatar"
                  [matTooltip]="member.displayName"
                />
              }
              @if (projectsStore.members().length > 5) {
                <div class="more-badge">+{{ projectsStore.members().length - 5 }}</div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Sprints List -->
      @for (sprint of visibleSprints(); track sprint.id) {
        <div class="sprint-container">
          <div class="sprint-header">
            <div class="sprint-info">
              <span class="sprint-name">{{ sprint.name }}</span>
              <span class="sprint-dates" *ngIf="sprint.startDate">
                {{ sprint.startDate | date }} - {{ sprint.endDate | date }}
              </span>
              <span class="sprint-status badge" [class]="sprint.status">{{ sprint.status }}</span>
            </div>
            <div class="sprint-actions">
              @if (sprint.status === 'future') {
                <button mat-stroked-button (click)="startSprint(sprint)">Start Sprint</button>
              }
              @if (sprint.status === 'active') {
                <button mat-stroked-button color="primary" disabled>Active</button>
                <button mat-button (click)="completeSprint(sprint)">Complete Sprint</button>
              }
              <button mat-icon-button [matMenuTriggerFor]="sprintMenu">
                <mat-icon>more_horiz</mat-icon>
              </button>
              <mat-menu #sprintMenu="matMenu">
                <button mat-menu-item (click)="editSprint(sprint)">Edit sprint</button>
                <button mat-menu-item (click)="deleteSprint(sprint)">Delete sprint</button>
              </mat-menu>
            </div>
          </div>

          <div
            class="issues-list sprint-issues"
            cdkDropList
            [cdkDropListData]="getSprintIssues(sprint.id)"
            (cdkDropListDropped)="drop($event, sprint.id)"
          >
            @for (issue of getSprintIssues(sprint.id); track issue.id) {
              <div class="backlog-issue-item" cdkDrag [cdkDragData]="issue">
                <ng-container
                  *ngTemplateOutlet="issueTemplate; context: { $implicit: issue }"
                ></ng-container>
              </div>
            } @empty {
              <div class="empty-sprint-dropzone">Plan a sprint by dragging issues here</div>
            }
          </div>
        </div>
      }

      <!-- Backlog Section -->
      <div class="backlog-section">
        <div class="backlog-header-section">
          <h3>Backlog ({{ backlogIssues().length }} issues)</h3>
          <div class="backlog-actions">
            <button mat-stroked-button (click)="createSprint()">Create Sprint</button>
            <button mat-stroked-button (click)="createIssue()">Create Issue</button>
          </div>
        </div>

        <div
          class="issues-list"
          cdkDropList
          [cdkDropListData]="backlogIssues()"
          (cdkDropListDropped)="drop($event, null)"
        >
          @for (issue of backlogIssues(); track issue.id) {
            <div class="backlog-issue-item" cdkDrag [cdkDragData]="issue">
              <ng-container
                *ngTemplateOutlet="issueTemplate; context: { $implicit: issue }"
              ></ng-container>
            </div>
          } @empty {
            <div class="empty-state">No issues in the backlog.</div>
          }
        </div>
      </div>
      <!-- Issue Item Template -->
      <ng-template #issueTemplate let-issue>
        <div class="backlog-item">
          <div class="item-left">
            <mat-icon [style.color]="getPriorityColor(issue.priority)">
              {{ getPriorityIcon(issue.priority) }}
            </mat-icon>
            <div class="issue-key">{{ issue.key }}</div>
            <div class="issue-title">{{ issue.title }}</div>
          </div>

          <div class="item-right">
            <div class="status-badge" [class]="issue.statusColumnId">
              {{ issue.statusColumnId.replace('-', ' ') }}
            </div>
            <div class="assignee">
              @if (getAssignee(issue.assigneeId); as assignee) {
                <img
                  [src]="
                    assignee.photoURL ||
                    'https://ui-avatars.com/api/?name=' +
                      assignee.displayName +
                      '&background=random'
                  "
                  class="assignee-avatar"
                  [matTooltip]="assignee.displayName"
                />
              } @else {
                <span class="unassigned-text">Unassigned</span>
              }
            </div>
            <!-- Menu kÄ¨ thua -->
            <!-- For now, simplifying actions -->
            <button mat-icon-button (click)="editIssue(issue)">
              <mat-icon>edit</mat-icon>
            </button>
            <button mat-icon-button color="warn" (click)="deleteIssue(issue.id, issue.key)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .backlog-container {
        padding: 24px;
        background: var(--jira-surface);
        height: 100%;
        overflow-y: auto;
      }
      .header-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        h2 {
          margin: 0;
          color: var(--jira-text);
        }
      }
      .header-title-group {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .members-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .avatar-stack {
        display: flex;
        align-items: center;
        cursor: pointer;
        padding-left: 2px; /* Offset for first negative margin if needed, or just normal */
      }
      .member-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid #fff;
        object-fit: cover;
        margin-left: -6px; /* Overlap effect */
        transition: transform 0.2s;
        &:hover {
          transform: translateY(-2px);
          z-index: 1;
        }
        &:first-child {
          margin-left: 0;
        }
      }
      .more-badge {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #dfe1e6;
        color: #172b4d;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 500;
        border: 2px solid #fff;
        margin-left: -6px;
        z-index: 0;
      }
      .members-btn {
        height: 32px;
        line-height: normal;
        padding: 0 12px;
        font-size: 13px;
        .mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          margin-right: 4px;
          vertical-align: middle;
        }
      }
      .sprint-container {
        background: var(--jira-surface-raised);
        border: 1px solid var(--jira-border);
        border-radius: 4px;
        margin-bottom: 24px;
        padding: 16px;
      }
      .sprint-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .sprint-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .sprint-name {
        font-weight: 600;
        font-size: 16px;
      }
      .sprint-status.badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        text-transform: uppercase;
        font-weight: bold;
      }
      .sprint-status.active {
        background: #e3fcef;
        color: #006644;
      }
      .sprint-status.future {
        background: #dfe1e6;
        color: #42526e;
      }
      .sprint-status.completed {
        background: #dfe1e6;
        color: #42526e;
      }

      .backlog-section {
        margin-top: 32px;
      }
      .backlog-header-section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        h3 {
          margin: 0;
          font-size: 14px;
          color: var(--jira-text-secondary);
          font-weight: 500;
        }
        .backlog-actions {
          display: flex;
          gap: 8px;
        }
      }

      .backlog-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border: 1px solid var(--jira-border);
        background: var(--jira-surface);
        border-radius: 3px;
        margin-bottom: 2px;
        transition: background 0.1s;

        &:hover {
          background: var(--jira-surface-raised);
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
        color: var(--jira-text-secondary);
        min-width: 60px;
        font-size: 13px;
      }
      .issue-title {
        color: var(--jira-text);
        font-weight: 500;
        font-size: 14px;
      }

      .empty-sprint-dropzone {
        border: 1px dashed var(--jira-border);
        padding: 16px;
        text-align: center;
        color: var(--jira-text-secondary);
        border-radius: 3px;
        background: rgba(0, 0, 0, 0.02);
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
        color: var(--jira-text-secondary);
        font-size: 13px;
        font-style: italic;
      }
      .empty-state {
        padding: 32px;
        text-align: center;
        color: var(--jira-text-secondary);
        background: var(--jira-sidebar-bg);
        border-radius: 4px;
      }
      .status-badge {
        font-size: 11px;
        text-transform: uppercase;
        padding: 2px 6px;
        background: var(--jira-border);
        border-radius: 3px;
        font-weight: 600;
        color: #42526e;
      }

      .status-badge.todo {
        background-color: #dfe1e6;
        color: #42526e;
      }

      .status-badge.in-progress {
        background-color: #deebff;
        color: #0747a6;
      }

      .status-badge.done {
        background-color: #e3fcef;
        color: #006644;
      }
      .sprint-actions button,
      .backlog-actions button {
        height: 32px;
        line-height: 32px;
        padding: 0 12px;
        font-size: 13px;
      }
    `,
  ],
})
export class Backlog {
  projectsStore = inject(ProjectsStore);
  boardStore = inject(BoardStore);
  sprintStore = inject(SprintStore);
  issueService = inject(IssueService);
  dialog = inject(MatDialog);
  route = inject(ActivatedRoute);
  router = inject(Router);
  authStore = inject(AuthStore);
  notificationStore = inject(NotificationStore);

  // Group issues by sprint
  // Issues with no sprintId are in the backlog
  backlogIssues = computed(() => {
    return this.boardStore.issues().filter((i) => !i.sprintId && i.isInBacklog);
  });

  // Future/Active sprints issues map
  sprintIssuesMap = computed(() => {
    const issues = this.boardStore.issues();
    const map = new Map<string, any[]>();
    issues.forEach((i) => {
      if (i.sprintId) {
        if (!map.has(i.sprintId)) map.set(i.sprintId, []);
        map.get(i.sprintId)!.push(i);
      }
    });
    return map;
  });

  // Filter out completed sprints from the view
  visibleSprints = computed(() => {
    return this.sprintStore.sprints().filter((s) => s.status !== 'completed');
  });

  ngOnInit() {
    this.route.parent?.paramMap.subscribe((params) => {
      const projectId = params.get('projectId');
      if (projectId) {
        this.boardStore.loadIssues(projectId);
        this.sprintStore.loadSprints(projectId);
        this.projectsStore.selectProject(projectId);
      }
    });
  }

  drop(event: CdkDragDrop<Issue[]>, targetSprintId: string | null) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Visually move the item
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );

      const issue = event.item.data as Issue;
      const updates: Partial<Issue> = {
        sprintId: targetSprintId,
      };

      if (targetSprintId) {
        const sprint = this.sprintStore.sprints().find((s) => s.id === targetSprintId);
        // If moving to active sprint -> isInBacklog = false
        // moving to future sprint -> isInBacklog = true (still waits in backlog view)
        updates.isInBacklog = sprint?.status !== 'active';
      } else {
        updates.isInBacklog = true;
        updates.sprintId = null;
      }

      this.boardStore.updateIssue(issue.id, updates);
    }
  }

  getSprintIssues(sprintId: string) {
    return this.sprintIssuesMap().get(sprintId) || [];
  }

  createSprint() {
    const projectId = this.projectsStore.selectedProjectId();
    if (!projectId) return;

    // Auto-name sprint: Sprint <count + 1>
    const count = this.sprintStore.sprints().length;
    const name = `Sprint ${count + 1}`;

    this.sprintStore.addSprint({
      projectId,
      name,
      status: 'future',
      // default 2 weeks from now
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  startSprint(sprint: any) {
    const issues = this.getSprintIssues(sprint.id);

    // Check if there are issues
    if (issues.length === 0) {
      alert('Please add issues to the sprint before starting it.');
      return;
    }

    const dialogRef = this.dialog.open(StartSprintDialog, {
      width: '500px',
      data: {
        sprint,
        issueCount: issues.length,
      },
    });

    dialogRef.afterClosed().subscribe(async (updates) => {
      if (updates) {
        // 1. Update Sprint (status = active, dates, goal, etc)
        await this.sprintStore.updateSprint(sprint.id, updates);

        // 2. Move issues to board (isInBacklog = false)
        const updatesIssues = issues.map((i) => ({
          id: i.id,
          data: { isInBacklog: false },
        }));

        if (updatesIssues.length > 0) {
          await this.issueService.batchUpdateIssues(updatesIssues);
        }

        // Navigate to board
        this.router.navigate(['../board'], { relativeTo: this.route });
      }
    });
  }

  completeSprint(sprint: any) {
    const issues = this.getSprintIssues(sprint.id);
    const futureSprints = this.sprintStore.futureSprints();
    const activeSprints = this.sprintStore.activeSprints();

    const dialogRef = this.dialog.open(CompleteSprintDialog, {
      width: '500px',
      data: {
        sprint,
        activeSprints,
        allIssues: this.boardStore.issues(),
        futureSprints,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // result contains { destinationId: string | null }
        this.sprintStore.completeSprint(sprint.id);

        const destinationId = result.destinationId;
        const incompleteIssues = issues.filter((i) => i.statusColumnId !== 'done');
        const completedIssues = issues.filter((i) => i.statusColumnId === 'done');

        console.log('Complete Sprint - Sprint ID:', sprint.id);
        console.log('Complete Sprint - Total issues:', issues.length);
        console.log('Complete Sprint - Incomplete issues:', incompleteIssues.length);
        console.log('Complete Sprint - Completed issues:', completedIssues.length);

        let updates: any[] = [];

        // 1. Move incomplete issues to new sprint or backlog
        if (incompleteIssues.length > 0) {
          updates = updates.concat(
            incompleteIssues.map((i) => ({
              id: i.id,
              data: {
                sprintId: destinationId, // null (backlog) or sprintId (future sprint)
                isInBacklog: true, // Always true because it leaves the board
              },
            })),
          );
        }

        // 2. Archive completed issues (System Soft Delete)
        // Keep them in the completed sprint (historical data) but hide them from active views
        if (completedIssues.length > 0) {
          updates = updates.concat(
            completedIssues.map((i) => ({
              id: i.id,
              data: {
                isArchived: true,
              },
            })),
          );
        }

        console.log('Complete Sprint - Updates to send:', updates);

        if (updates.length > 0) {
          this.issueService.batchUpdateIssues(updates);
        }
      }
    });
  }

  editSprint(sprint: any) {
    const dialogRef = this.dialog.open(EditSprintDialog, {
      width: '500px',
      data: { sprint },
    });

    dialogRef.afterClosed().subscribe((updates) => {
      if (updates) {
        this.sprintStore.updateSprint(sprint.id, updates);
      }
    });
  }

  deleteSprint(sprint: any) {
    if (
      confirm(
        `Are you sure you want to delete sprint ${sprint.name}? Issues will be moved to the backlog.`,
      )
    ) {
      // 1. Move issues to backlog
      const issues = this.getSprintIssues(sprint.id);
      if (issues.length > 0) {
        const updates = issues.map((i) => ({
          id: i.id,
          data: { sprintId: null, isInBacklog: true },
        }));
        this.issueService.batchUpdateIssues(updates);
      }
      // 2. Delete sprint
      this.sprintStore.deleteSprint(sprint.id);
    }
  }

  createIssue() {
    const dialogRef = this.dialog.open(IssueDialog, {
      width: '900px',
      maxWidth: '90vw',
      data: { statusColumnId: 'todo' }, // Default column if moved
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const projectId = this.projectsStore.selectedProjectId();
        const projectKey = this.projectsStore.selectedProject()?.key;
        const currentUser = this.authStore.user();
        if (projectId && projectKey && currentUser) {
          // Extract subcollections from result
          const { comments, subtasks, attachments, ...issueData } = result;

          const newIssue: any = {
            title: result.title,
            description: result.description || '',
            type: result.type,
            priority: result.priority,
            statusColumnId: result.statusColumnId || 'todo',
            projectId: projectId,
            boardId: projectId,
            order: 0,
            key: this.boardStore.getNextIssueKey(projectKey),
            reporterId: currentUser.uid,
            assigneeId: result.assigneeId || null,
            isInBacklog: result.hasOwnProperty('isInBacklog') ? result.isInBacklog : true,
            // Main doc should NOT have subcollection arrays
          };

          if (result.dueDate) {
            newIssue.dueDate = result.dueDate;
          }

          if (result.sprintId) {
            newIssue.sprintId = result.sprintId;
          } else {
            newIssue.sprintId = null;
          }

          console.log('Creating Issue Payload:', newIssue);

          // Call Service directly
          this.issueService.addIssue(newIssue).then(async (docRef) => {
            const newId = docRef.id;

            // Add Subitems
            const promises: Promise<any>[] = [];
            if (comments && comments.length) {
              comments.forEach((c: any) =>
                promises.push(this.issueService.addCommentToIssue(newId, c)),
              );
            }
            if (subtasks && subtasks.length) {
              subtasks.forEach((s: any) =>
                promises.push(this.issueService.addSubtaskToIssue(newId, s)),
              );
            }
            if (attachments && attachments.length) {
              attachments.forEach((a: any) =>
                promises.push(this.issueService.addAttachmentToIssue(newId, a)),
              );
            }

            await Promise.all(promises);

            if (currentUser && result.assigneeId && result.assigneeId !== currentUser.uid) {
              this.notificationStore.createNotification({
                recipientId: result.assigneeId,
                senderId: currentUser.uid,
                type: 'ASSIGNMENT',
                issueId: newId,
                projectId: projectId,
                content: `${currentUser.displayName} assigned you to ${result.title}`,
                createdAt: new Date().toISOString(),
                read: false,
              });
            }
          });
        }
      }
    });
  }

  editIssue(issue: any) {
    const dialogRef = this.dialog.open(IssueDialog, {
      width: '900px',
      maxWidth: '90vw', // Responsive
      data: { issue },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Notification Logic
        const currentUser = this.authStore.user();
        const newAssigneeId = result.assigneeId;
        const oldAssigneeId = issue.assigneeId;

        if (currentUser && newAssigneeId && newAssigneeId !== oldAssigneeId) {
          if (newAssigneeId !== currentUser.uid) {
            this.notificationStore.createNotification({
              recipientId: newAssigneeId,
              senderId: currentUser.uid,
              type: 'ASSIGNMENT',
              issueId: issue.id,
              projectId: issue.projectId,
              content: `${currentUser.displayName} assigned you to ${result.title}`,
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        }

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

  openMembersDialog() {
    this.dialog.open(MembersDialog, {
      width: '600px',
      autoFocus: false,
    });
  }
}
