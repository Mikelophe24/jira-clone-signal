import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MyTasksStore } from './my-tasks.store';
import { AuthStore } from '../../core/auth/auth.store';
import { ProjectsStore } from '../projects/projects.store';
import { Issue } from '../issue/issue.model';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatOptionModule,
    MatIconModule,
    MatButtonModule,
    FormsModule,
    DatePipe,
  ],
  template: `
    <div class="my-tasks-container">
      <div class="header">
        <h2>My Tasks</h2>
        <div class="filters">
          <mat-form-field appearance="outline" class="search-input" subscriptSizing="dynamic">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput placeholder="Search tasks" [(ngModel)]="searchQuery" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter-select" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="statusFilter">
              <mat-option value="all">All</mat-option>
              <mat-option value="todo">TODO</mat-option>
              <mat-option value="in-progress">In Progress</mat-option>
              <mat-option value="done">Done</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter-select" subscriptSizing="dynamic">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="priorityFilter">
              <mat-option value="all">All</mat-option>
              <mat-option value="high">High</mat-option>
              <mat-option value="medium">Medium</mat-option>
              <mat-option value="low">Low</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </div>

      <table mat-table [dataSource]="filteredIssues()" class="tasks-table">
        <!-- Status Column -->
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let issue">
            <span class="status-badge" [ngClass]="issue.statusColumnId">
              {{ formatStatus(issue.statusColumnId) }}
            </span>
          </td>
        </ng-container>

        <!-- Priority Column -->
        <ng-container matColumnDef="priority">
          <th mat-header-cell *matHeaderCellDef>Priority</th>
          <td mat-cell *matCellDef="let issue">
            <div class="priority-cell">
              <mat-icon [style.color]="getPriorityColor(issue.priority)" class="priority-icon">
                {{ getPriorityIcon(issue.priority) }}
              </mat-icon>
              {{ issue.priority | titlecase }}
            </div>
          </td>
        </ng-container>

        <!-- Title Column -->
        <ng-container matColumnDef="title">
          <th mat-header-cell *matHeaderCellDef>Task Name</th>
          <td mat-cell *matCellDef="let issue">
            <span class="issue-title">{{ issue.title }}</span>
          </td>
        </ng-container>

        <!-- Project Column -->
        <ng-container matColumnDef="projectId">
          <th mat-header-cell *matHeaderCellDef>Project</th>
          <td mat-cell *matCellDef="let issue">
            {{ getProjectName(issue.projectId) }}
          </td>
        </ng-container>

        <!-- Due Date Column -->
        <ng-container matColumnDef="dueDate">
          <th mat-header-cell *matHeaderCellDef>Due Date</th>
          <td mat-cell *matCellDef="let issue">
            {{ issue.dueDate ? (issue.dueDate | date : 'mediumDate') : '-' }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>

        <tr class="mat-row" *matNoDataRow>
          <td class="mat-cell" colspan="5" style="text-align:center; padding: 24px;">
            No tasks found assigned to you.
          </td>
        </tr>
      </table>
    </div>
  `,
  styles: [
    `
      .my-tasks-container {
        padding: 24px;
        background: var(--jira-surface);
        height: 100%;
        overflow: auto;
      }
      .header {
        margin-bottom: 24px;

        h2 {
          margin: 0 0 16px 0;
          color: var(--jira-text);
          font-size: 24px;
        }

        .filters {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }

        .search-input {
          width: 250px;

          mat-icon {
            font-size: 20px;
            color: var(--jira-text-secondary);
          }

          input {
            font-size: 14px;
          }
        }

        .filter-select {
          width: 150px;
        }
      }
      .tasks-table {
        width: 100%;
        box-shadow: none;
        border: 1px solid var(--jira-border);
        border-radius: 4px;
        background: var(--jira-surface-raised);
      }

      /* Status Badges */
      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
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

      .priority-cell {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .priority-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .issue-title {
        font-weight: 500;
        color: var(--jira-text);
      }
    `,
  ],
})
export class MyTasks {
  store = inject(MyTasksStore);
  authStore = inject(AuthStore);
  projectsStore = inject(ProjectsStore);

  displayedColumns: string[] = ['projectId', 'title', 'priority', 'status', 'dueDate'];

  // Filter state
  searchQuery = signal('');
  statusFilter = signal('all');
  priorityFilter = signal('all');

  // Computed filtered issues
  filteredIssues = computed(() => {
    let issues = this.store.issues();
    const search = this.searchQuery().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();

    // Apply search filter
    if (search) {
      issues = issues.filter(
        (issue) =>
          issue.title.toLowerCase().includes(search) ||
          issue.key?.toLowerCase().includes(search) ||
          this.getProjectName(issue.projectId).toLowerCase().includes(search)
      );
    }

    // Apply status filter
    if (status !== 'all') {
      issues = issues.filter((issue) => issue.statusColumnId === status);
    }

    // Apply priority filter
    if (priority !== 'all') {
      issues = issues.filter((issue) => issue.priority === priority);
    }

    return issues;
  });

  getProjectName(projectId: string): string {
    const project = this.projectsStore.projects().find((p) => p.id === projectId);
    return project ? project.name : 'Unknown Project';
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
