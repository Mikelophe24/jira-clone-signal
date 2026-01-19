import { Component, Inject, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { Issue } from '../../../issue/issue.model';
import { Sprint } from '../../sprint.model';

export interface CompleteSprintDialogData {
  sprint: Sprint;
  issues: Issue[];
  futureSprints: Sprint[];
}

@Component({
  selector: 'app-complete-sprint-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Complete Sprint: {{ data.sprint.name }}</h2>

    <mat-dialog-content>
      <div class="summary">
        <p>This sprint contains:</p>
        <ul>
          <li>
            <strong>{{ completedIssuesCount }}</strong> completed issues
          </li>
          <li>
            <strong>{{ incompleteIssuesCount }}</strong> incomplete issues
          </li>
        </ul>
      </div>

      @if (incompleteIssuesCount > 0) {
      <div class="move-issues-section">
        <p class="description">
          Select where to move the <strong>{{ incompleteIssuesCount }}</strong> incomplete issues:
        </p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Move to</mat-label>
          <mat-select [(ngModel)]="selectedDestinationId">
            <mat-option [value]="null">Backlog</mat-option>
            @for (sprint of data.futureSprints; track sprint.id) {
            <mat-option [value]="sprint.id"> {{ sprint.name }} (Future Sprint) </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
      } @else {
      <p class="success-message">All issues are completed! Great job!</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="complete()">Complete Sprint</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .summary {
        margin-bottom: 24px;
      }
      .move-issues-section {
        margin-top: 16px;
      }
      .full-width {
        width: 100%;
      }
      .description {
        margin-bottom: 8px;
      }
      .success-message {
        color: #006644;
        font-weight: 500;
      }
      ul {
        padding-left: 20px;
      }
      li {
        margin-bottom: 4px;
      }
    `,
  ],
})
export class CompleteSprintDialog {
  completedIssuesCount = 0;
  incompleteIssuesCount = 0;
  selectedDestinationId: string | null = null; // null means Backlog

  constructor(
    public dialogRef: MatDialogRef<CompleteSprintDialog>,
    @Inject(MAT_DIALOG_DATA) public data: CompleteSprintDialogData
  ) {
    this.completedIssuesCount = data.issues.filter((i) => i.statusColumnId === 'done').length;
    this.incompleteIssuesCount = data.issues.length - this.completedIssuesCount;

    // Default to next sprint if available, otherwise backlog
    if (this.incompleteIssuesCount > 0 && data.futureSprints.length > 0) {
      this.selectedDestinationId = data.futureSprints[0].id;
    }
  }

  complete() {
    this.dialogRef.close({
      destinationId: this.selectedDestinationId,
    });
  }
}
