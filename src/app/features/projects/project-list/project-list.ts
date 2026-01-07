import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProjectsStore } from '../projects.store';
import { ProjectsService } from '../projects.service';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="container">
      <div class="header">
        <h2>Your Projects</h2>
        @if (store.loading()) {
        <mat-spinner diameter="30"></mat-spinner>
        }
      </div>

      <div class="grid">
        <!-- Project List -->
        <mat-card class="list-card">
          <mat-card-header>
            <mat-card-title>Projects</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <mat-nav-list>
              @for (project of store.projects(); track project.id) {
              <a mat-list-item [routerLink]="['/project', project.id, 'board']">
                <mat-icon matListItemIcon>folder</mat-icon>
                <h3 matListItemTitle>{{ project.name }}</h3>
                <p matListItemLine>{{ project.key }}</p>
                <p matListItemLine class="owner-line">
                  Created by: {{ getOwnerName(project.ownerId) }}
                </p>
                @if (authStore.user()?.uid === project.ownerId) {
                <button
                  mat-icon-button
                  (click)="$event.stopPropagation(); deleteProject(project.id)"
                  matListItemMeta
                >
                  <mat-icon color="warn">delete</mat-icon>
                </button>
                }
              </a>
              } @empty {
              <p class="empty-state">No projects found. Create one!</p>
              }
            </mat-nav-list>
          </mat-card-content>
        </mat-card>

        <!-- Create Project Form -->
        <mat-card class="create-card">
          <mat-card-header>
            <mat-card-title>Create Project</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <form
              class="create-form"
              (submit)="
                $event.preventDefault();
                createProject(nameInput.value, keyInput.value);
                nameInput.value = '';
                keyInput.value = ''
              "
            >
              <mat-form-field appearance="outline">
                <mat-label>Project Name</mat-label>
                <input matInput #nameInput required />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Key (e.g. PROJ)</mat-label>
                <input matInput #keyInput required placeholder="PROJ" />
              </mat-form-field>

              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="!nameInput.value || !keyInput.value"
              >
                <mat-icon>add</mat-icon>
                Create
              </button>
            </form>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [
    `
      .container {
        padding: 32px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 24px;
        align-items: start;
      }
      .list-card,
      .create-card {
        width: 100%;
      }
      .create-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 16px;
      }
      .empty-state {
        padding: 16px;
        color: #888;
        font-style: italic;
      }
      .owner-line {
        font-size: 12px;
        color: #888;
      }
    `,
  ],
})
export class ProjectList {
  readonly store = inject(ProjectsStore);
  private projectsService = inject(ProjectsService);
  readonly authStore = inject(AuthStore);

  constructor() {
    effect(() => {
      const user = this.authStore.user();
      if (user) {
        this.store.loadProjects(user.uid);
      }
    });
  }

  getOwnerName(ownerId: string): string {
    const currentUser = this.authStore.user();
    if (currentUser?.uid === ownerId) {
      return 'Me';
    }
    const owner = this.store.projectOwners().find((u) => u.uid === ownerId);
    return owner?.displayName || 'Unknown';
  }

  createProject(name: string, key: string) {
    if (!name || !key) return;
    const currentUser = this.authStore.user();
    const ownerId = currentUser ? currentUser.uid : 'anonymous';

    this.projectsService.addProject({
      name,
      key,
      ownerId: ownerId,
      memberIds: [ownerId],
    });
  }

  deleteProject(projectId: string) {
    if (confirm('Are you sure you want to delete this project?')) {
      this.store.deleteProject(projectId);
    }
  }
}
