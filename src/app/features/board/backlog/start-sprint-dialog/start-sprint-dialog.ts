import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { Sprint } from '../../sprint.model';

@Component({
  selector: 'app-start-sprint-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatSelectModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>Start Sprint</h2>
    <mat-dialog-content>
      <div class="sprint-info-text">
        <strong>{{ data.issueCount }}</strong> work items will be included in this sprint.
      </div>

      <form [formGroup]="form" class="start-sprint-form">
        <p class="instruction-text">
          Required fields are marked with an asterisk <span class="required">*</span>
        </p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Sprint name</mat-label>
          <input matInput formControlName="name" required />
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            Sprint name is required
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Duration</mat-label>
          <mat-select formControlName="duration" (selectionChange)="onDurationChange()">
            <mat-option value="1">1 week</mat-option>
            <mat-option value="2">2 weeks</mat-option>
            <mat-option value="3">3 weeks</mat-option>
            <mat-option value="4">4 weeks</mat-option>
            <mat-option value="custom">Custom</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Start date</mat-label>
          <input
            matInput
            [matDatepicker]="startPicker"
            formControlName="startDate"
            (dateChange)="onStartDateChange()"
          />
          <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
          <mat-datepicker #startPicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>End date</mat-label>
          <input matInput [matDatepicker]="endPicker" formControlName="endDate" />
          <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
          <mat-datepicker #endPicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Sprint goal</mat-label>
          <textarea matInput formControlName="goal" rows="4"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Start
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .start-sprint-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 8px;
      }
      .sprint-info-text {
        font-size: 14px;
        color: var(--jira-text);
        margin-bottom: 16px;
      }
      .instruction-text {
        font-size: 12px;
        color: var(--jira-text-secondary);
        margin-top: 0;
        margin-bottom: 8px;
      }
      .required {
        color: #de350b;
      }
      .full-width {
        width: 100%;
      }
      mat-form-field {
        width: 100%;
      }
      textarea {
        resize: vertical;
      }
    `,
  ],
})
export class StartSprintDialog {
  private fb = inject(FormBuilder);
  form: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<StartSprintDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { sprint: Sprint; issueCount: number }
  ) {
    // Default duration: 2 weeks
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);

    this.form = this.fb.group({
      name: [data.sprint.name, Validators.required],
      duration: ['2', Validators.required],
      startDate: [startDate, Validators.required],
      endDate: [endDate, Validators.required],
      goal: [data.sprint.goal || ''],
    });
  }

  onDurationChange() {
    const duration = this.form.get('duration')?.value;
    if (duration === 'custom') return;

    const weeks = parseInt(duration, 10);
    const startDate = this.form.get('startDate')?.value;

    if (startDate) {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + weeks * 7);
      this.form.patchValue({ endDate });
    }
  }

  onStartDateChange() {
    this.onDurationChange(); // Recalculate end date based on duration
  }

  save() {
    if (this.form.valid) {
      const formValue = this.form.value;
      const updates = {
        name: formValue.name,
        startDate: formValue.startDate ? formValue.startDate.toISOString() : null,
        endDate: formValue.endDate ? formValue.endDate.toISOString() : null,
        goal: formValue.goal,
        status: 'active',
      };
      this.dialogRef.close(updates); // Return updates to be applied
    }
  }
}
