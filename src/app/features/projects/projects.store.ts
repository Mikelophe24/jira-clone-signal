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
import { IssueService } from '../issue/issue.service';
import { Project } from './project.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Router } from '@angular/router';
import { pipe, tap, switchMap, catchError, of, firstValueFrom } from 'rxjs';
import { AppUser } from '../../core/models/app-user.model';
import { withLoadingError } from '../../shared/store-features/with-loading-error.feature';
import { ErrorNotificationService } from '../../core/services/error-notification.service';
import { AuthStore } from '../../core/auth/auth.store';

type ProjectsState = {
  projects: Project[];
  projectOwners: AppUser[]; // Cache for owners of displayed projects
  members: AppUser[];
  pendingInvites: Project[]; // Projects where user is invited
  selectedProjectId: string | null;
};

const initialState: ProjectsState = {
  projects: [],
  projectOwners: [],
  members: [],
  pendingInvites: [],
  selectedProjectId: null, // Could be loaded from local storage
};

export const ProjectsStore = signalStore(
  { providedIn: 'root' },
  withLoadingError(),
  withState(initialState),
  withComputed(({ projects, selectedProjectId }) => ({
    selectedProject: computed(() => projects().find((p) => p.id === selectedProjectId())),
  })),
  withMethods(
    (
      store,
      projectsService = inject(ProjectsService),
      issueService = inject(IssueService),
      errorService = inject(ErrorNotificationService)
    ) => ({
      loadProjects: rxMethod<string | null>(
        pipe(
          tap(() => store.setLoading(true)),
          switchMap((userId) => {
            if (!userId) {
              patchState(store, { projects: [], projectOwners: [], selectedProjectId: null });
              store.setLoading(false);
              return of([]);
            }
            return projectsService.getProjects(userId).pipe(
              tap((projects) => patchState(store, { projects })),
              // Extract owner IDs and load them
              switchMap((projects) => {
                const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
                if (ownerIds.length === 0) return of([]);
                return projectsService.getUsers(ownerIds);
              }),
              tap((owners) => {
                patchState(store, { projectOwners: owners });
                store.setLoading(false);
              }),
              catchError((err) => {
                const errorMessage = err?.message || 'Failed to load projects';
                console.error('Error loading projects:', err);
                errorService.showError(errorMessage);
                return of([]);
              })
            );
          })
        )
      ),
      loadInvites: rxMethod<string | null>(
        pipe(
          switchMap((userId) => {
            if (!userId) {
              patchState(store, { pendingInvites: [] });
              return of([]);
            }
            return projectsService.getPendingInvites(userId).pipe(
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
            );
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
          errorService.showSuccess('Project deleted successfully');
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to delete project';
          console.error('Failed to delete project', err);
          errorService.showError(errorMessage);
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
          errorService.showSuccess(`Joined project "${project.name}"`);
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to accept invite';
          console.error('Failed to accept invite', err);
          errorService.showError(errorMessage);
        }
      },
      rejectInvite: async (project: Project, userId: string) => {
        try {
          await projectsService.rejectInvite(project, userId);
          patchState(store, {
            pendingInvites: store.pendingInvites().filter((p) => p.id !== project.id),
          });
          errorService.showInfo('Invitation declined');
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to reject invite';
          console.error('Failed to reject invite', err);
          errorService.showError(errorMessage);
        }
      },
      inviteUser: async (email: string) => {
        store.setLoading(true);
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
            errorService.showSuccess(`Invitation sent to ${email}`);
          }
          store.setLoading(false);
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to invite user';
          console.error(err);
          errorService.showError(errorMessage);
          throw err;
        }
      },
      removeMember: async (memberId: string) => {
        store.setLoading(true);
        try {
          const project = store.selectedProject();
          if (project) {
            // Unassign issues from this member in this project
            await issueService.unassignUserFromProjectIssues(project.id, memberId);

            await projectsService.removeMemberFromProject(project.id, memberId, project.memberIds);

            // Update local state
            const newMemberIds = project.memberIds.filter((id) => id !== memberId);
            patchState(store, {
              members: store.members().filter((m) => m.uid !== memberId),
              projects: store
                .projects()
                .map((p) => (p.id === project.id ? { ...p, memberIds: newMemberIds } : p)),
            });
            errorService.showSuccess('Member removed successfully');
          }
          store.setLoading(false);
        } catch (err: any) {
          const errorMessage = err?.message || 'Failed to remove member';
          console.error('Failed to remove member', err);
          errorService.showError(errorMessage);
          throw err;
        }
      },
    })
  ),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);
      const router = inject(Router);

      effect(() => {
        const user = authStore.user();
        store.loadProjects(user ? user.uid : null);
        store.loadInvites(user ? user.uid : null);
      });

      effect(() => {
        const project = store.selectedProject();
        if (project && project.memberIds.length > 0) {
          store.loadMembers(project.memberIds);
        } else {
          patchState(store, { members: [] });
        }
      });

      // Security/Real-time check:
      // If the user has a selectedProject (is viewing one), but that project disappears from their list
      // (kicked or deleted), alert them and redirect to project list.
      effect(() => {
        const projects = store.projects();
        const selectedId = store.selectedProjectId();
        const isLoading = store.loading();

        if (!isLoading && selectedId) {
          // Check if project exists in user's access list
          const stillHasAccess = projects.some((p) => p.id === selectedId);

          if (!stillHasAccess) {
            // Access lost (kicked or project deleted)
            // Use setTimeout to avoid 'ExpressionChangedAfterItHasBeenCheckedError'
            // and allow UI to stabilize if this is a transient state
            setTimeout(() => {
              const currentProjects = store.projects();
              // Re-verify condition
              if (!currentProjects.some((p) => p.id === selectedId)) {
                alert('Project does not exist anymore ');
                patchState(store, { selectedProjectId: null });
                router.navigate(['/projects']);
              }
            }, 200);
          }
        }
      });
    },
  })
);
