import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Service for displaying error notifications to users
 * Uses Material Snackbar for consistent UI feedback
 */
@Injectable({ providedIn: 'root' })
export class ErrorNotificationService {
  private snackBar = inject(MatSnackBar);

  /**
   * Display an error message to the user
   * @param message Error message to display
   * @param duration Duration in milliseconds (default: 5000ms)
   */
  showError(message: string, duration: number = 5000): void {
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['error-snackbar'],
    });
  }

  /**
   * Display a success message to the user
   * @param message Success message to display
   * @param duration Duration in milliseconds (default: 3000ms)
   */
  showSuccess(message: string, duration: number = 3000): void {
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['success-snackbar'],
    });
  }

  /**
   * Display an info message to the user
   * @param message Info message to display
   * @param duration Duration in milliseconds (default: 3000ms)
   */
  showInfo(message: string, duration: number = 3000): void {
    this.snackBar.open(message, 'Close', {
      duration,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['info-snackbar'],
    });
  }
}
