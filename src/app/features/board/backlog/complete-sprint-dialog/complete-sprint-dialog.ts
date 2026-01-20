import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Issue } from '../../../issue/issue.model';
import { Sprint } from '../../sprint.model';

export interface CompleteSprintDialogData {
  sprint: Sprint;
  activeSprints: Sprint[];
  allIssues: Issue[];
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
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-header-image">
      <div class="trophy-container">
        <mat-icon class="trophy-icon" aria-hidden="false" aria-label="Trophy"
          >emoji_events</mat-icon
        >
      </div>
    </div>

    <div class="dialog-container">
      <h2 mat-dialog-title>Complete sprint</h2>

      <mat-dialog-content class="custom-content">
        <div class="form-section">
          <label class="field-label">Select a sprint</label>
          <mat-form-field
            appearance="outline"
            class="full-width compact-form-field"
            subscriptSizing="dynamic"
          >
            <mat-select [(ngModel)]="selectedSprintId" (selectionChange)="onSprintChange()">
              @for (sprint of data.activeSprints; track sprint.id) {
                <mat-option [value]="sprint.id">{{ sprint.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <div class="summary-section">
          <p>
            This sprint contains
            <strong>{{ completedIssuesCount }} completed work items</strong> and
            <strong
              >{{ incompleteIssuesCount }} open work item{{
                incompleteIssuesCount !== 1 ? 's' : ''
              }}</strong
            >.
          </p>

          <ul class="info-list">
            <li>Completed work items includes everything in the last column on the board, Done.</li>
            <li>
              Open work items includes everything from any other column on the board. Move these to
              a new sprint or the backlog.
            </li>
          </ul>
        </div>

        @if (incompleteIssuesCount > 0) {
          <div class="form-section">
            <label class="field-label">Move open work items to</label>
            <mat-form-field
              appearance="outline"
              class="full-width compact-form-field"
              subscriptSizing="dynamic"
            >
              <mat-select [(ngModel)]="selectedDestinationId">
                @if (data.futureSprints.length > 0) {
                  <mat-option value="new-sprint">New sprint</mat-option>
                  @for (sprint of data.futureSprints; track sprint.id) {
                    <mat-option [value]="sprint.id">{{ sprint.name }}</mat-option>
                  }
                }
                <mat-option value="backlog">Backlog</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="custom-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" (click)="complete()">Complete sprint</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        /* Remove negative margin that might cause overflow issues */
        /* margin: -24px; */
        overflow: hidden;
      }

      .dialog-header-image {
        height: 100px;
        background:
          url('https://jira-clone-assets.web.app/assets/sprint-complete-header.svg') center/cover
            no-repeat,
          linear-gradient(180deg, #0052cc 0%, #0747a6 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        /* Fallback if image fails */
        background-color: #0052cc;

        /* Negative margins to pull image to edges of mat-dialog-content if padding exists */
        margin: -24px -24px 0 -24px;
      }

      /* Use a simpler trophy styling if the icon isn't perfect, but let's stick to the icon */
      .trophy-container {
        width: 60px;
        height: 60px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
      }

      .trophy-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: #ffab00;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .dialog-container {
        padding: 0 32px 24px 32px;
        background-color: var(--jira-surface);
        color: var(--jira-text);
      }

      h2[mat-dialog-title] {
        margin: 24px 0 20px 0;
        font-size: 20px;
        line-height: 24px;
        font-weight: 500;
        color: var(--jira-text);
      }

      .custom-content {
        margin: 0;
        padding: 0 !important;
        overflow: visible;
      }

      .form-section {
        margin-bottom: 24px;
      }

      .field-label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        color: var(--jira-text-secondary);
        margin-bottom: 6px;
        text-transform: uppercase; /* Jira often uppercase labels slightly */
      }

      /* Reset uppercase if it looks too intense, screenshot shows Sentence case "Select a sprint" */
      .field-label {
        text-transform: none;
      }

      .full-width {
        width: 100%;
      }

      /* Creating a more 'dense' look for form fields to match screenshot */
      .compact-form-field ::ng-deep .mat-mdc-form-field-flex {
        padding-bottom: 0;
      }
      .compact-form-field ::ng-deep .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
      }

      .summary-section {
        margin-bottom: 24px;
        font-size: 14px;
        line-height: 1.6;
      }

      .summary-section p {
        margin-top: 0;
        margin-bottom: 12px;
      }

      .info-list {
        padding-left: 18px;
        margin: 0;
        color: var(--jira-text); /* Use main text color for readability */

        li {
          margin-bottom: 8px;
        }

        li::marker {
          color: var(--jira-text-secondary);
        }
      }

      .custom-actions {
        padding: 0;
        margin: 0;
        gap: 8px;
      }

      button[mat-flat-button] {
        background-color: #0052cc;
      }
    `,
  ],
})
export class CompleteSprintDialog {
  completedIssuesCount = 0;
  incompleteIssuesCount = 0;
  selectedDestinationId: string = 'new-sprint';
  selectedSprintId: string;

  constructor(
    public dialogRef: MatDialogRef<CompleteSprintDialog>,
    @Inject(MAT_DIALOG_DATA) public data: CompleteSprintDialogData,
  ) {
    this.selectedSprintId = data.sprint.id;
    this.updateCounts();

    // Default logic: New Sprint if available, otherwise backlog
    if (this.data.futureSprints && this.data.futureSprints.length > 0) {
      this.selectedDestinationId = 'new-sprint';
    } else {
      this.selectedDestinationId = 'backlog';
    }
  }

  onSprintChange() {
    this.updateCounts();
  }

  updateCounts() {
    const sprintIssues = this.data.allIssues.filter((i) => i.sprintId === this.selectedSprintId);
    this.completedIssuesCount = sprintIssues.filter((i) => i.statusColumnId === 'done').length;
    this.incompleteIssuesCount = sprintIssues.length - this.completedIssuesCount;
  }

  complete() {
    const destinationId =
      this.selectedDestinationId === 'backlog' ? null : this.selectedDestinationId;
    this.dialogRef.close({
      destinationId: destinationId,
      completedSprintId: this.selectedSprintId,
    });
  }
}
