import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withComputed,
  withHooks,
} from '@ngrx/signals';
import { inject, computed, effect } from '@angular/core';
import { ProjectsService } from './projects.service';
import { Project } from './project.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of, firstValueFrom } from 'rxjs';

import { AppUser } from '../../core/models/app-user.model';

type ProjectsState = {
  projects: Project[];
  members: AppUser[];
  selectedProjectId: string | null;
  loading: boolean;
  filter: string;
};

const initialState: ProjectsState = {
  projects: [],
  members: [],
  selectedProjectId: null, // Could be loaded from local storage
  loading: false,
  filter: '',
};

export const ProjectsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ projects, selectedProjectId }) => ({
    selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId())),
  })),
  withMethods((store, projectsService = inject(ProjectsService)) => ({
    loadProjects: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((userId) => projectsService.getProjects(userId)),
        tap((projects) => patchState(store, { projects, loading: false })),
        // Basic error handling for catching permissions issues if rules fail
        catchError((err) => {
          console.error('Error loading projects:', err);
          patchState(store, { loading: false });
          return of([]);
        })
      )
    ),
    selectProject: (projectId: string) => {
      patchState(store, { selectedProjectId: projectId });
    },
    loadMembers: rxMethod<string[]>(
      pipe(
        switchMap((ids) => projectsService.getUsers(ids)),
        tap((members) => patchState(store, { members }))
      )
    ),
    deleteProject: async (projectId: string) => {
      try {
        await projectsService.deleteProject(projectId);
        // Optimistic update: Remove from list locally
        patchState(store, {
          projects: store.projects().filter((p) => p.id !== projectId),
        });
      } catch (err) {
        console.error('Failed to delete project', err);
      }
    },
  })),
  withMethods((store, projectsService = inject(ProjectsService)) => ({
    addMember: async (email: string) => {
      patchState(store, { loading: true });
      try {
        // 1. Find user by email
        const users = await firstValueFrom(projectsService.findUserByEmail(email));
        if (users.length === 0) {
          throw new Error('User not found');
        }
        const newUser = users[0];
        const project = store.selectedProject();

        if (project) {
          // 2. Add to project
          await projectsService.addMemberToProject(project.id, newUser.uid, project.memberIds);

          // 3. Reload members
          store.loadMembers([...project.memberIds, newUser.uid]);

          // 4. Update local project state
          patchState(store, {
            projects: store
              .projects()
              .map((p) =>
                p.id === project.id ? { ...p, memberIds: [...p.memberIds, newUser.uid] } : p
              ),
          });
        }
      } catch (err: any) {
        console.error(err);
        throw err;
      } finally {
        patchState(store, { loading: false });
      }
    },
  })),
  withHooks({
    onInit(store) {
      effect(() => {
        const project = store.selectedProject();
        if (project && project.memberIds.length > 0) {
          store.loadMembers(project.memberIds);
        } else {
          patchState(store, { members: [] });
        }
      });
    },
  })
);
