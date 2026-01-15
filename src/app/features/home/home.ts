import { Component, inject, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectsStore } from '../projects/projects.store';
import { MyTasksStore } from '../my-tasks/my-tasks.store';
import { AuthStore } from '../../core/auth/auth.store';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    RouterLink,
  ],
  template: `
    <div class="home-container">
      <div class="header">
        <h1>Dashboard</h1>
      </div>

      <!-- Stats Row -->
      <div class="stats-row">
        <!-- Total Projects -->
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-label">Total Projects</div>
            <div class="stat-value">{{ projectsStore.projects().length }}</div>
          </mat-card-content>
        </mat-card>

        <!-- Total Tasks (Using MyTasks count for now) -->
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-label">Assigned Tasks</div>
            <div class="stat-value">{{ myTasksStore.issues().length }}</div>
          </mat-card-content>
        </mat-card>

        <!-- Completed Tasks -->
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-label">Completed Tasks</div>
            <div class="stat-value">{{ completedTasksCount() }}</div>
          </mat-card-content>
        </mat-card>

        <!-- Overdue Tasks -->
        <mat-card class="stat-card">
          <mat-card-content>
            <div class="stat-label">Overdue Tasks</div>
            <div class="stat-value">{{ overdueTasksCount() }}</div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="content-grid">
        <!-- Assigned Tasks Widget -->
        <div class="widget assigned-tasks">
          <div class="widget-header">
            <h3>Assigned Tasks ({{ myTasksStore.issues().length }})</h3>
          </div>
          <div class="widget-content">
            @for (task of displayedTasks(); track task.id) {
            <mat-card class="task-card" [routerLink]="['/project', task.projectId, 'board']">
              <mat-card-content>
                <div class="task-header">
                  <mat-icon
                    [style.color]="getPriorityColor(task.priority)"
                    class="priority-icon"
                    [matTooltip]="task.priority"
                  >
                    {{ getPriorityIcon(task.priority) }}
                  </mat-icon>
                  <span class="status-badge" [ngClass]="task.statusColumnId">
                    {{ formatStatus(task.statusColumnId) }}
                  </span>
                </div>
                <div class="task-title">{{ task.title }}</div>
                <div class="task-meta">
                  <span class="project-name">{{ getProjectName(task.projectId) }}</span>
                  @if (task.dueDate) {
                  <span
                    class="due-date"
                    [class.overdue]="isOverdue(task.dueDate, task.statusColumnId)"
                  >
                    {{ getDaysRemaining(task.dueDate, task.statusColumnId) }}
                  </span>
                  }
                </div>
              </mat-card-content>
            </mat-card>
            } @empty {
            <div class="empty-state">No assigned tasks.</div>
            }
          </div>
          <div class="widget-footer">
            <button mat-button color="primary" (click)="toggleExpand()">
              {{ isExpanded() ? 'Show Less' : 'View All Tasks' }}
            </button>
          </div>
        </div>

        <!-- Projects Widget -->
        <div class="widget projects-list">
          <div class="widget-header">
            <h3>Projects ({{ projectsStore.projects().length }})</h3>
          </div>
          <div class="widget-content project-grid">
            @for (project of projectsStore.projects(); track project.id) {
            <mat-card class="project-card" [routerLink]="['/project', project.id]">
              <mat-card-content>
                <div class="project-icon">{{ project.name.charAt(0).toUpperCase() }}</div>
                <div class="project-name">{{ project.name }}</div>
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
      .home-container {
        padding: 32px;
        background-color: #f4f5f7;
        min-height: 100%;
      }

      .header {
        margin-bottom: 32px;
        h1 {
          margin: 0 0 8px 0;
          font-size: 24px;
          color: #172b4d;
        }
        .subtitle {
          margin: 0;
          color: #5e6c84;
          font-size: 14px;
        }
      }

      .stats-row {
        display: flex;
        gap: 24px;
        margin-bottom: 32px;
        flex-wrap: wrap;
      }

      .stat-card {
        flex: 1;
        min-width: 140px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

        mat-card-content {
          padding: 16px !important;
        }

        .stat-label {
          color: #5e6c84;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          margin-bottom: 8px;
          white-space: nowrap;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #172b4d;
        }
      }

      .content-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        align-items: start;
      }

      @media (max-width: 900px) {
        .content-grid {
          grid-template-columns: 1fr;
        }
      }

      .widget-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        h3 {
          margin: 0;
          font-size: 16px;
          color: #172b4d;
          font-weight: 600;
        }
      }

      .task-card {
        margin-bottom: 12px;
        cursor: pointer;
        transition: box-shadow 0.2s;
        border-radius: 4px;

        &:hover {
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
      }

      .task-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .priority-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .status-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        margin-left: auto;
      }

      .status-badge.todo {
        background: #dfe1e6;
        color: #42526e;
      }

      .status-badge.in-progress {
        background: #deebff;
        color: #0052cc;
      }

      .status-badge.done {
        background: #e3fcef;
        color: #006644;
      }

      .task-title {
        font-weight: 500;
        color: #172b4d;
        margin-bottom: 6px;
      }

      .task-meta {
        display: flex;
        gap: 8px;
        font-size: 12px;
        color: #5e6c84;
      }

      .due-date.overdue {
        color: #de350b;
        font-weight: 500;
      }

      .widget-footer {
        margin-top: 16px;
        text-align: center;

        button {
          width: 100%;
          background: rgba(9, 30, 66, 0.04);
          color: #42526e;
        }
      }

      .project-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
      }

      .project-card {
        cursor: pointer;
        transition: transform 0.1s;

        &:hover {
          transform: translateY(-2px);
        }

        mat-card-content {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }
      }

      .project-icon {
        width: 32px;
        height: 32px;
        background: #0052cc;
        color: white;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }

      .project-name {
        font-weight: 500;
        color: #172b4d;
      }

      .empty-state {
        color: #6b778c;
        font-style: italic;
        padding: 16px;
      }
    `,
  ],
})
export class Home {
  projectsStore = inject(ProjectsStore);
  myTasksStore = inject(MyTasksStore);
  authStore = inject(AuthStore);
  router = inject(Router);

  isExpanded = signal(false);

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      this.myTasksStore.loadMyIssues(user ? user.uid : null);
    });
  }

  // Stats Logic
  completedTasksCount = computed(
    () => this.myTasksStore.issues().filter((i) => i.statusColumnId === 'done').length
  );

  // inprogressTasksCount = computed(() => this.myTasksStore.issues().filter(i => i.statusColumnId === 'in-progress').length);

  // overdueTasksCount = computed(() => {
  //   const today = new Date();
  //   today.setHours(0, 0, 0, 0);
  //   return this.myTasksStore
  //     .issues()
  //     .filter((i) => i.dueDate && new Date(i.dueDate) < today && i.statusColumnId !== 'done')
  //     .length;
  // });

  overdueTasksCount = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.myTasksStore
      .issues()
      .filter((i) => i.dueDate && new Date(i.dueDate) < today && i.statusColumnId !== 'done')
      .length;
  });

  displayedTasks = computed(() => {
    const all = this.myTasksStore.issues();
    return this.isExpanded() ? all : all.slice(0, 3);
  });

  toggleExpand() {
    this.isExpanded.update((v) => !v);
  }

  getProjectName(projectId: string) {
    return this.projectsStore.projects().find((p) => p.id === projectId)?.name || 'Unknown Project';
  }

  isOverdue(dateStr: string, status: string): boolean {
    if (status === 'done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dateStr) < today;
  }

  getDaysRemaining(dateStr: string, status: string): string {
    if (status === 'done') return 'Completed';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    return diffDays + ' days left';
  }

  getPriorityIcon(priority: string): string {
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

  getPriorityColor(priority: string): string {
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

  formatStatus(statusId: string): string {
    switch (statusId) {
      case 'todo':
        return 'TODO';
      case 'in-progress':
        return 'IN PROGRESS';
      case 'done':
        return 'DONE';
      default:
        return statusId.toUpperCase();
    }
  }
}
