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
  projectOwners: AppUser[]; // Cache for owners of displayed projects
  members: AppUser[];
  pendingInvites: Project[]; // Projects where user is invited
  selectedProjectId: string | null;
  loading: boolean;
  filter: string;
};

const initialState: ProjectsState = {
  projects: [],
  projectOwners: [],
  members: [],
  pendingInvites: [],
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
        tap((projects) => patchState(store, { projects })),
        // Extract owner IDs and load them
        switchMap((projects) => {
          const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
          if (ownerIds.length === 0) return of([]);
          return projectsService.getUsers(ownerIds);
        }),
        tap((owners) => patchState(store, { projectOwners: owners, loading: false })),
        // Basic error handling for catching permissions issues if rules fail
        catchError((err) => {
          console.error('Error loading projects:', err);
          patchState(store, { loading: false });
          return of([]);
        })
      )
    ),
    loadInvites: rxMethod<string>(
      pipe(
        switchMap((userId) => projectsService.getPendingInvites(userId)),
        tap((pendingInvites) => patchState(store, { pendingInvites })),
        switchMap((invites) => {
          const ownerIds = [...new Set(invites.map((p) => p.ownerId))];
          if (ownerIds.length === 0) return of([]);
          return projectsService.getUsers(ownerIds);
        }),
        tap((newOwners) => {
          const existingOwners = store.projectOwners();
          // Simple merge distinct by UID
          const merged = [...existingOwners, ...newOwners].filter(
            (v, i, a) => a.findIndex((t) => t.uid === v.uid) === i
          );
          patchState(store, { projectOwners: merged });
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
    acceptInvite: async (project: Project, userId: string) => {
      try {
        await projectsService.acceptInvite(project, userId);
        // Optimistic / Reload
        // Remove from invites, add to projects
        patchState(store, {
          pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
          projects: [
            ...store.projects(),
            { ...project, memberIds: [...project.memberIds, userId] },
          ],
        });
      } catch (err) {
        console.error('Failed to accept invite', err);
      }
    },
    rejectInvite: async (project: Project, userId: string) => {
      try {
        await projectsService.rejectInvite(project, userId);
        patchState(store, {
          pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
        });
      } catch (err) {
        console.error('Failed to reject invite', err);
      }
    },
    inviteUser: async (email: string) => {
      patchState(store, { loading: true });
      try {
        const users = await firstValueFrom(projectsService.findUserByEmail(email));
        if (users.length === 0) throw new Error('User not found');
        const userToInvite = users[0];
        const project = store.selectedProject();

        if (project) {
          // Check if already member
          if (project.memberIds.includes(userToInvite.uid)) {
            throw new Error('User is already a member');
          }
          // Check if already invited
          if (project.invitedMemberIds?.includes(userToInvite.uid)) {
            throw new Error('User is already invited');
          }

          await projectsService.inviteUserToProject(
            project.id,
            userToInvite.uid,
            project.invitedMemberIds
          );
          // Update local state (optional, or just show success)
        }
      } catch (err: any) {
        console.error(err);
        throw err;
      } finally {
        patchState(store, { loading: false });
      }
    },
    removeMember: async (memberId: string) => {
      patchState(store, { loading: true });
      try {
        const project = store.selectedProject();
        if (project) {
          await projectsService.removeMemberFromProject(project.id, memberId, project.memberIds);

          // Update local state
          const newMemberIds = project.memberIds.filter((id) => id !== memberId);
          patchState(store, {
            members: store.members().filter((m) => m.uid !== memberId),
            projects: store
              .projects()
              .map((p) => (p.id === project.id ? { ...p, memberIds: newMemberIds } : p)),
          });
        }
      } catch (err) {
        console.error('Failed to remove member', err);
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
