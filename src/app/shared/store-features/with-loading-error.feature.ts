import { computed } from '@angular/core';
import {
  signalStoreFeature,
  withState,
  withComputed,
  withMethods,
  patchState,
  SignalStoreFeature,
  type,
} from '@ngrx/signals';

/**
 * State shape for loading and error handling
 */
export type LoadingErrorState = {
  loading: boolean;
  error: string | null;
};

/**
 * Initial state for loading and error
 */
const initialLoadingErrorState: LoadingErrorState = {
  loading: false,
  error: null,
};

/**
 * Reusable Signal Store Feature for Loading & Error State Management
 *
 * Usage:
 * ```typescript
 * export const MyStore = signalStore(
 *   { providedIn: 'root' },
 *   withLoadingError(),
 *   withState({ myData: [] }),
 *   withMethods((store) => ({
 *     async loadData() {
 *       store.setLoading(true);
 *       try {
 *         const data = await fetchData();
 *         store.clearError();
 *       } catch (error) {
 *         store.setError(error.message);
 *       } finally {
 *         store.setLoading(false);
 *       }
 *     }
 *   }))
 * );
 * ```
 */
export function withLoadingError() {
  return signalStoreFeature(
    withState(initialLoadingErrorState),
    withComputed((state) => ({
      /**
       * Computed signal indicating if the store is currently in a loading state
       */
      isLoading: computed(() => state.loading()),
      /**
       * Computed signal indicating if there's an error
       */
      hasError: computed(() => state.error() !== null),
    })),
    withMethods((store) => ({
      /**
       * Set loading state to true
       */
      setLoading: (loading: boolean) => {
        patchState(store, { loading });
      },
      /**
       * Set error message
       */
      setError: (error: string | null) => {
        patchState(store, { error, loading: false });
      },
      /**
       * Clear error message
       */
      clearError: () => {
        patchState(store, { error: null });
      },
      /**
       * Reset both loading and error to initial state
       */
      resetLoadingError: () => {
        patchState(store, initialLoadingErrorState);
      },
    }))
  );
}
