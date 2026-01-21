import { Component, inject } from '@angular/core';
import { BoardStore } from '../board.store';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { ProjectsStore } from '../../projects/projects.store';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-board-filter',
  standalone: true,
  imports: [
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    FormsModule,
  ],
  template: `
    <button mat-stroked-button [matMenuTriggerFor]="filterMenu">
      <mat-icon>filter_list</mat-icon> Filters
    </button>
    <mat-menu #filterMenu="matMenu" class="filter-menu">
      <div class="filter-section" (click)="$event.stopPropagation()">
        <h4>Assignee</h4>
        @for (member of $any(projectsStore.members()); track member.uid) {
        <mat-checkbox
          [checked]="isSelected('assignee', member.uid)"
          (change)="toggleFilter('assignee', member.uid)"
        >
          {{ member.displayName }}
        </mat-checkbox>
        }
      </div>

      <mat-divider></mat-divider>

      <div class="filter-section" (click)="$event.stopPropagation()">
        <h4>Status</h4>
        <mat-checkbox
          [checked]="isSelected('status', 'todo')"
          (change)="toggleFilter('status', 'todo')"
        >
          TO DO
        </mat-checkbox>
        <mat-checkbox
          [checked]="isSelected('status', 'in-progress')"
          (change)="toggleFilter('status', 'in-progress')"
        >
          IN PROGRESS
        </mat-checkbox>
        <mat-checkbox
          [checked]="isSelected('status', 'done')"
          (change)="toggleFilter('status', 'done')"
        >
          DONE
        </mat-checkbox>
      </div>

      <mat-divider></mat-divider>

      <div class="filter-section" (click)="$event.stopPropagation()">
        <h4>Priority</h4>
        <mat-checkbox
          [checked]="isSelected('priority', 'high')"
          (change)="toggleFilter('priority', 'high')"
        >
          High
        </mat-checkbox>
        <mat-checkbox
          [checked]="isSelected('priority', 'medium')"
          (change)="toggleFilter('priority', 'medium')"
        >
          Medium
        </mat-checkbox>
        <mat-checkbox
          [checked]="isSelected('priority', 'low')"
          (change)="toggleFilter('priority', 'low')"
        >
          Low
        </mat-checkbox>
      </div>

      <div class="filter-actions" (click)="$event.stopPropagation()">
        <button mat-button color="warn" (click)="clearFilters()">Clear all</button>
      </div>
    </mat-menu>
  `,
  styles: [
    `
      .filter-menu {
        min-width: 250px;
      }
      .filter-section {
        padding: 8px 16px;
        display: flex;
        flex-direction: column;

        h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          text-transform: uppercase;
          color: #5e6c84;
          font-weight: 600;
        }

        mat-checkbox {
          margin-bottom: 4px;
          font-size: 14px;
        }
      }
      .filter-actions {
        padding: 8px;
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class BoardFilter {
  store = inject(BoardStore);
  projectsStore = inject(ProjectsStore);

  isSelected(type: 'assignee' | 'status' | 'priority', value: string): boolean {
    const filter = this.store.filter() as any;
    return (filter[type] as string[])?.includes(value) ?? false;
  }

  toggleFilter(type: 'assignee' | 'status' | 'priority', value: string) {
    const currentFilters = this.store.filter() as any;
    const currentValues = (currentFilters[type] as string[]) || [];

    let newValues: string[];
    if (currentValues.includes(value)) {
      newValues = currentValues.filter((v) => v !== value);
    } else {
      newValues = [...currentValues, value];
    }

    this.store.updateFilter({ [type]: newValues } as any);
  }

  clearFilters() {
    this.store.updateFilter({
      assignee: [],
      status: [],
      priority: [],
    } as any);
  }
}
