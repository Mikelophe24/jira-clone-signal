import { computed } from '@angular/core';
import {
  signalStoreFeature,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';

export type LoadingErrorState = {
  loading: boolean;
  error: string | null;
};

const initialLoadingErrorState: LoadingErrorState = {
  loading: false,
  error: null,
};

export function withLoadingError() {
  return signalStoreFeature(
    withState(initialLoadingErrorState),
    withComputed((state) => ({
      isLoading: computed(() => state.loading()),

      hasError: computed(() => state.error() !== null),
    })),
    withMethods((store) => ({
      setLoading: (loading: boolean) => {
        patchState(store, { loading });
      },
      setError: (error: string | null) => {
        patchState(store, { error, loading: false });
      },

      clearError: () => {
        patchState(store, { error: null });
      },

      resetLoadingError: () => {
        patchState(store, initialLoadingErrorState);
      },
    }))
  );
}
