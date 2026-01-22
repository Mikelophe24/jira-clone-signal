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
import { NotificationStore } from '../../notifications/notification.store';

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
                <button mat-stroked-button class="complete-sprint-btn" (click)="completeSprint()">
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
                          {{ issue.dueDate | date: 'd MMM' }}
                        </span>
                      }
                      @if (getSubtaskStats(issue); as stats) {
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
                          {{ issue.dueDate | date: 'd MMM' }}
                        </span>
                      }
                      @if (getSubtaskStats(issue); as stats) {
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
                          {{ issue.dueDate | date: 'd MMM' }}
                        </span>
                      }
                      @if (getSubtaskStats(issue); as stats) {
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
  styleUrl: './board.scss',
})
export class Board implements OnInit {
  readonly store = inject(BoardStore);
  readonly sprintStore = inject(SprintStore); // Inject SprintStore
  readonly projectsStore = inject(ProjectsStore);
  readonly authStore = inject(AuthStore);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private issueService = inject(IssueService);
  private notificationStore = inject(NotificationStore);

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

    // Handle deep linking to issue
    this.route.queryParams.subscribe(async (params) => {
      const issueId = params['issueId'];
      if (issueId) {
        try {
          const issue = await this.issueService.getIssue(issueId);
          if (issue) {
            // Check if dialog is already open to avoid duplicates
            if (this.dialog.openDialogs.length === 0) {
              // Use statusColumnId if available, or default to 'todo' or deduce it
              const status = issue.statusColumnId || 'todo';
              this.openIssueDialog(status, issue);
            }
          }
        } catch (e) {
          console.error('Failed to load linked issue', e);
        }
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
    const activeSprint = this.sprintStore.activeSprint();
    const dialogRef = this.dialog.open(IssueDialog, {
      width: '900px',
      maxWidth: '90vw',
      data: {
        statusColumnId,
        issue,
        sprintId: activeSprint?.id, // Pass active sprint ID
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // Notification Logic
        const currentUser = this.authStore.user();
        const newAssigneeId = result.assigneeId;
        const oldAssigneeId = issue?.assigneeId;

        if (currentUser && newAssigneeId && newAssigneeId !== oldAssigneeId) {
          // Avoid notifying self if self-assigned? Jira usually does anyway, but let's notify.
          // But definitely don't notify if user is assigning themselves?
          // Actually, if I assign myself, I probably don't need a notification.
          if (newAssigneeId !== currentUser.uid) {
            this.notificationStore.createNotification({
              recipientId: newAssigneeId,
              senderId: currentUser.uid,
              type: 'ASSIGNMENT',
              issueId: issue ? issue.id : 'pending', // ID might be tricky for new issues
              // For new issues, we don't have ID yet here before addIssue is called?
              // Actually store.addIssue -> issueService.addIssue which returns ref.
              // But store.addIssue is void/async but we don't await result here in this version.
              // IMPORTANT: NotificationStore.createNotification is async but fire-and-forget here.
              // If we don't have issueId, we can't link effectively.
              // But for existing issue we have ID.
              projectId: this.projectsStore.selectedProjectId()!,
              content: `${currentUser.displayName} assigned you to ${result.title}`,
              createdAt: new Date().toISOString(),
              read: false,
            });
          }
        }

        if (issue) {
          // Update existing
          // Dialog returns updated data but doesn't handle update? Wait, IssueDialog DOES handle update now (returns undefined).
          // If result is undefined, we do nothing.
          // BUT IssueDialog.save() returns undefined if isEditing.
          // So if (result) is false, this block is skipped.
          // Correct.
        } else {
          // Create new
          const projectId = this.projectsStore.selectedProjectId();
          const projectKey = this.projectsStore.selectedProject()?.key;

          if (projectId && projectKey) {
            const activeSprint = this.sprintStore.activeSprint();
            const selectedSprintId = result.sprintId;

            const isAssignedToActiveSprint = activeSprint && selectedSprintId === activeSprint.id;

            // Extract subcollections
            const { comments, subtasks, attachments, ...issueData } = result;

            const newIssue = {
              ...issueData,
              projectId,
              boardId: projectId,
              order: 0,
              key: this.store.getNextIssueKey(projectKey),
              reporterId: this.authStore.user()?.uid,
              sprintId: selectedSprintId || null,
              isInBacklog: !isAssignedToActiveSprint,
            };

            // Call Service directly to get Ref ID
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

              // Notification with Real ID
              if (currentUser && newAssigneeId && newAssigneeId !== currentUser.uid) {
                this.notificationStore.createNotification({
                  recipientId: newAssigneeId,
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
  async completeSprint() {
    const activeSprint = this.sprintStore.activeSprint(); // Default one
    const activeSprints = this.sprintStore.activeSprints(); // All active
    if (!activeSprint) return;

    const allIssues = this.store.issues();
    const futureSprints = this.sprintStore.futureSprints();

    const dialogRef = this.dialog.open(CompleteSprintDialog, {
      width: '500px',
      data: {
        sprint: activeSprint,
        activeSprints: activeSprints,
        allIssues: allIssues,
        futureSprints,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const completedSprintId = result.completedSprintId;

        // Complete the selected sprint
        await this.sprintStore.completeSprint(completedSprintId);

        let destinationId = result.destinationId;

        // Handle 'new-sprint' creation
        if (destinationId === 'new-sprint') {
          const newSprintName = `Sprint ${
            futureSprints.length + this.sprintStore.completedSprints().length + 2
          }`;
          const newSprint = {
            name: newSprintName,
            projectId: activeSprint.projectId,
            status: 'future' as const,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks
          };

          const newDocRef = await this.sprintStore.addSprint(newSprint);
          if (newDocRef) {
            destinationId = newDocRef.id;
          }
        }

        // Re-filter issues for the specific sprint that was completed
        const sprintIssues = allIssues.filter((i) => i.sprintId === completedSprintId);
        const incompleteIssues = sprintIssues.filter((i) => i.statusColumnId !== 'done');

        if (incompleteIssues.length > 0) {
          if (destinationId) {
            // Move to future/new sprint
            // These should be in backlog (waiting) until that sprint starts
            const updates = incompleteIssues.map((i) => ({
              id: i.id,
              data: {
                sprintId: destinationId,
                isInBacklog: true,
              },
            }));
            await this.issueService.batchUpdateIssues(updates);
          } else {
            // Move to Backlog
            const updates = incompleteIssues.map((i) => ({
              id: i.id,
              data: {
                sprintId: null,
                isInBacklog: true,
              },
            }));
            await this.issueService.batchUpdateIssues(updates);
          }
        }
      }
    });
  }
}
