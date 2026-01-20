import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ProjectsStore } from '../projects.store';
import { MembersDialog } from '../members-dialog/members-dialog';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-project-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatTooltipModule,
    FormsModule,
  ],
  template: `
    <div class="project-layout">
      <!-- Immersive Header -->
      <div class="project-header">
        <div class="header-content">
          <!-- Breadcrumb / Label -->
          <div class="spaces-label">Projects</div>

          <!-- Project Title & Info -->
          <div class="project-info-row">
            @if (store.selectedProject(); as project) {
              <div class="project-identity">
                <div class="rocket-icon-wrapper">
                  <mat-icon>rocket_launch</mat-icon>
                </div>

                @if (isEditingName()) {
                  <input
                    type="text"
                    class="project-name-input"
                    [(ngModel)]="editedName"
                    (blur)="saveName()"
                    (keydown.enter)="saveName()"
                    (keydown.escape)="cancelEdit()"
                    #nameInput
                  />
                } @else {
                  <h1 (click)="startEdit(project.name)" title="Click to edit">
                    {{ project.name }}
                  </h1>
                }
              </div>
            }
          </div>

          <!-- Navigation Tabs -->
          <nav class="project-nav">
            <a routerLink="./backlog" routerLinkActive="active" class="nav-item">
              <mat-icon>list_alt</mat-icon> Backlog
            </a>
            <a routerLink="./board" routerLinkActive="active" class="nav-item">
              <mat-icon>dashboard</mat-icon> Board
            </a>
          </nav>
        </div>
      </div>

      <!-- Main Content -->
      <div class="project-content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [
    `
      .project-layout {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: var(--jira-surface);
      }

      .project-header {
        background-color: var(--jira-surface);
        color: var(--jira-text);
        padding: 24px 32px 0 32px;
        position: relative;
        min-height: auto; /* Let content define height */
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        border-bottom: 1px solid var(--jira-border);
      }

      .header-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .spaces-label {
        display: flex;
        align-items: center;
        font-size: 13px;
        color: var(--jira-text-secondary);
        gap: 4px;

        mat-icon {
          font-size: 16px;
          height: 16px;
          width: 16px;
        }

        .separator {
          font-size: 16px;
          height: 16px;
          width: 16px;
          opacity: 0.7;
        }

        .current-space {
          font-weight: 500;
          color: var(--jira-text);
        }
      }

      .project-info-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-bottom: 24px;
      }

      .project-identity {
        display: flex;
        align-items: center;
        gap: 12px;

        h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          line-height: 1.2;
          color: var(--jira-text);
          cursor: pointer;
          border: 1px solid transparent; /* Prevent size jump on border add */
          padding: 2px 8px;
          border-radius: 4px;
          margin-left: -8px; /* Offset padding */
          transition: background-color 0.2s;
        }

        h1:hover {
          background-color: var(--jira-surface-hover);
        }

        .rocket-icon-wrapper {
          background-color: #0052cc;
          border-radius: 4px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 20px;
            height: 20px;
            width: 20px;
            color: white;
          }
        }
      }

      .project-name-input {
        font-size: 24px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--jira-text);
        background: var(--jira-surface);
        border: 2px solid #0052cc;
        border-radius: 4px;
        padding: 2px 8px;
        width: 300px; /* Or auto/min-content if possible, but fixed min-width is safer */
        outline: none;
        margin-left: -8px; /* Match h1 offset */
        font-family: inherit;
      }

      /* Navigation Tabs */
      .project-nav {
        display: flex;
        gap: 24px;
        /* border-bottom removed from here as it's handled by parent container or just visual preference */
      }

      .nav-item {
        color: var(--jira-text-secondary);
        text-decoration: none;
        padding: 0 4px 12px 4px;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
        margin-bottom: -1px; /* To sit on the border line */

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        &:hover {
          color: var(--jira-text);
          background-color: var(--jira-sidebar-bg);
          border-radius: 4px 4px 0 0;
        }

        &.active {
          color: #0052cc;
          border-bottom-color: #0052cc;
          background-color: transparent;
        }

        &.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }
      }

      .project-content {
        flex: 1;
        overflow: auto;
        padding: 0; /* Let children handle padding */
        background-color: var(--jira-surface);
      }
    `,
  ],
})
export class ProjectLayout {
  store = inject(ProjectsStore);
  dialog = inject(MatDialog);

  isEditingName = signal(false);
  editedName = '';

  openMembersDialog() {
    this.dialog.open(MembersDialog, {
      width: '600px',
      autoFocus: false,
    });
  }

  startEdit(currentName: string) {
    this.editedName = currentName;
    this.isEditingName.set(true);
    // Focus logic could be added here via viewChild but simple autofocus attribute or timeout works too
    setTimeout(() => {
      const input = document.querySelector('.project-name-input') as HTMLInputElement;
      if (input) input.focus();
    });
  }

  saveName() {
    if (!this.isEditingName()) return; // Already saved or cancelled

    const project = this.store.selectedProject();
    if (project && this.editedName.trim() && this.editedName !== project.name) {
      this.store.updateProject(project.id, { name: this.editedName });
    }
    this.isEditingName.set(false);
  }

  cancelEdit() {
    this.isEditingName.set(false);
  }
}
