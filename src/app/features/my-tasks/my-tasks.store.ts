import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { IssueService } from '../issue/issue.service';
import { Issue } from '../issue/issue.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

type MyTasksState = {
  issues: Issue[];
  loading: boolean;
};

const initialState: MyTasksState = {
  issues: [],
  loading: false,
};

export const MyTasksStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, issueService = inject(IssueService)) => ({
    loadMyIssues: rxMethod<string | null>(
      pipe(
        tap(() => console.log('Loading my issues...')),
        tap(() => patchState(store, { loading: true })),
        switchMap((userId) => {
          if (!userId) {
            patchState(store, { issues: [], loading: false });
            return [];
          }
          console.log('Querying for userId:', userId);
          return issueService.getMyIssues(userId);
        }),
        tap((issues) => {
          console.log('Issues found:', issues);
          patchState(store, { issues, loading: false });
        })
      )
    ),
  }))
);
