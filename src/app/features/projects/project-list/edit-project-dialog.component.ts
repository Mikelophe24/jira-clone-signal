import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Project } from '../project.model';

@Component({
  selector: 'app-edit-project-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit Project</h2>
    <mat-dialog-content>
      <form class="edit-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Project Name</mat-label>
          <input matInput [(ngModel)]="data.name" name="name" required />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Key</mat-label>
          <input matInput [value]="data.key" disabled />
          <mat-hint>Project key cannot be changed.</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-raised-button
        color="primary"
        [mat-dialog-close]="data.name"
        [disabled]="!data.name"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .edit-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 350px;
        padding-top: 8px;
        padding-bottom: 8px;
      }
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class EditProjectDialog {
  constructor(
    public dialogRef: MatDialogRef<EditProjectDialog>,
    @Inject(MAT_DIALOG_DATA) public data: Project,
  ) {}
}
