# Using withLoadingError Feature

## Overview

The `withLoadingError` feature provides centralized loading and error state management for NgRx Signal Stores.

## Features Provided

### State

- `loading: boolean` - Indicates if an async operation is in progress
- `error: string | null` - Stores error messages

### Computed Signals

- `isLoading()` - Returns true when loading
- `hasError()` - Returns true when there's an error

### Methods

- `setLoading(loading: boolean)` - Set loading state
- `setError(error: string | null)` - Set error message and stop loading
- `clearError()` - Clear error message
- `resetLoadingError()` - Reset both loading and error to initial state

## Usage Example

### Basic Store with Loading & Error

```typescript
import { signalStore, withState, withMethods } from '@ngrx/signals';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../../core/services/error-notification.service';

export const MyStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(), // Add the feature
  withState({ data: [] }),
  withMethods((store, errorService = inject(ErrorNotificationService)) => ({
    async loadData() {
      store.setLoading(true);
      store.clearError();

      try {
        const data = await fetchData();
        patchState(store, { data });
        store.setLoading(false);
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to load data';
        store.setError(errorMessage);
        errorService.showError(errorMessage);
      }
    },
  }))
);
```

### Using in Component

```typescript
@Component({
  template: `
    @if (store.isLoading()) {
    <mat-spinner></mat-spinner>
    } @if (store.hasError()) {
    <div class="error">{{ store.error() }}</div>
    } @if (!store.isLoading() && !store.hasError()) {
    <div>{{ store.data() }}</div>
    }
  `,
})
export class MyComponent {
  store = inject(MyStore);
}
```

### With RxMethod

```typescript
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError } from 'rxjs';
import { of } from 'rxjs';

export const MyStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState({ items: [] }),
  withMethods(
    (store, service = inject(MyService), errorService = inject(ErrorNotificationService)) => ({
      loadItems: rxMethod<string>(
        pipe(
          tap(() => {
            store.setLoading(true);
            store.clearError();
          }),
          switchMap((id) => service.getItems(id)),
          tap((items) => {
            patchState(store, { items });
            store.setLoading(false);
          }),
          catchError((error) => {
            const errorMessage = error?.message || 'Failed to load items';
            store.setError(errorMessage);
            errorService.showError(errorMessage);
            return of([]);
          })
        )
      ),
    })
  )
);
```

## Benefits

1. **Consistency** - All stores handle loading/error the same way
2. **Less Boilerplate** - No need to define loading/error state in each store
3. **Type Safety** - Full TypeScript support
4. **Reusability** - One feature, many stores
5. **User Feedback** - Integrated with ErrorNotificationService for visual feedback

## Error Notification Service

The `ErrorNotificationService` provides three types of notifications:

```typescript
errorService.showError('Something went wrong');
errorService.showSuccess('Operation completed');
errorService.showInfo('Here is some information');
```

All notifications use Material Snackbar with custom styling (red for errors, green for success, blue for info).
