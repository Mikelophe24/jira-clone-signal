import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withComputed,
  withHooks,
} from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { SprintService } from './sprint.service';
import { Sprint } from './sprint.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError } from 'rxjs';
import { of } from 'rxjs';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../../core/services/error-notification.service';

type SprintState = {
  sprints: Sprint[];
};

const initialState: SprintState = {
  sprints: [],
};

export const SprintStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(({ sprints }) => ({
    activeSprint: computed(() => sprints().find((s) => s.status === 'active')),
    activeSprints: computed(() => sprints().filter((s) => s.status === 'active')),
    futureSprints: computed(() => sprints().filter((s) => s.status === 'future')),
    completedSprints: computed(() => sprints().filter((s) => s.status === 'completed')),
  })),
  withMethods(
    (
      store,
      sprintService: SprintService = inject(SprintService),
      errorService: ErrorNotificationService = inject(ErrorNotificationService),
    ) => ({
      loadSprints: rxMethod<string | null>(
        pipe(
          tap(() => store.setLoading(true)),
          switchMap((projectId) => {
            if (!projectId) {
              patchState(store, { sprints: [] });
              store.setLoading(false);
              return of([]);
            }
            return sprintService.getSprints(projectId).pipe(
              tap((sprints) => {
                patchState(store, { sprints });
                store.setLoading(false);
              }),
              catchError((error) => {
                const errorMessage = error?.message || 'Failed to load sprints';
                errorService.showError(errorMessage);
                store.setLoading(false);
                return of([]);
              }),
            );
          }),
        ),
      ),
      addSprint: async (sprint: Partial<Sprint>) => {
        try {
          // Default status if not provided
          if (!sprint.status) {
            sprint.status = 'future';
          }
          return await sprintService.addSprint(sprint);
        } catch (err: any) {
          errorService.showError(err?.message || 'Failed to create sprint');
          return undefined;
        }
      },
      updateSprint: async (id: string, updates: Partial<Sprint>) => {
        try {
          await sprintService.updateSprint(id, updates);
        } catch (err: any) {
          errorService.showError(err?.message || 'Failed to update sprint');
        }
      },
      deleteSprint: async (id: string) => {
        try {
          await sprintService.deleteSprint(id);
        } catch (err: any) {
          errorService.showError(err?.message || 'Failed to delete sprint');
        }
      },
      startSprint: async (id: string) => {
        try {
          await sprintService.startSprint(id);
        } catch (err: any) {
          errorService.showError(err?.message || 'Failed to start sprint');
        }
      },
      completeSprint: async (id: string) => {
        try {
          await sprintService.completeSprint(id);
        } catch (err: any) {
          errorService.showError(err?.message || 'Failed to complete sprint');
        }
      },
    }),
  ),
);
