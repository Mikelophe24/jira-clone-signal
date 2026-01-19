import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { Sprint } from '../../sprint.model';

@Component({
  selector: 'app-edit-sprint-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatNativeDateModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit Sprint: {{ data.sprint.name }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="edit-sprint-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Sprint Name</mat-label>
          <input matInput formControlName="name" required />
          <mat-error *ngIf="form.get('name')?.hasError('required')">
            Sprint name is required
          </mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Start Date</mat-label>
          <input matInput [matDatepicker]="startPicker" formControlName="startDate" />
          <mat-datepicker-toggle matIconSuffix [for]="startPicker"></mat-datepicker-toggle>
          <mat-datepicker #startPicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>End Date</mat-label>
          <input matInput [matDatepicker]="endPicker" formControlName="endDate" />
          <mat-datepicker-toggle matIconSuffix [for]="endPicker"></mat-datepicker-toggle>
          <mat-datepicker #endPicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Sprint Goal</mat-label>
          <textarea matInput formControlName="goal" rows="4"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">
        Update
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .edit-sprint-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 8px;
      }
      .full-width {
        width: 100%;
      }
      textarea {
        resize: vertical;
      }
    `,
  ],
})
export class EditSprintDialog {
  private fb = inject(FormBuilder);
  form: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<EditSprintDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { sprint: Sprint }
  ) {
    this.form = this.fb.group({
      name: [data.sprint.name, Validators.required],
      startDate: [data.sprint.startDate ? new Date(data.sprint.startDate) : null],
      endDate: [data.sprint.endDate ? new Date(data.sprint.endDate) : null],
      goal: [data.sprint.goal || ''],
    });
  }

  save() {
    if (this.form.valid) {
      const formValue = this.form.value;
      const updates = {
        name: formValue.name,
        startDate: formValue.startDate ? formValue.startDate.toISOString() : null,
        endDate: formValue.endDate ? formValue.endDate.toISOString() : null,
        goal: formValue.goal,
      };
      this.dialogRef.close(updates);
    }
  }
}
