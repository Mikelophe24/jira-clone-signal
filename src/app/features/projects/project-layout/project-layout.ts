import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { ProjectsStore } from '../projects.store';

@Component({
  selector: 'app-project-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
  ],
  template: `
    <div class="project-container">
      <mat-sidenav-container class="sidenav-container">
        <mat-sidenav mode="side" opened class="sidenav">
          <div class="sidenav-header">
            @if(store.selectedProject(); as project) {
            <h3>{{ project.name }}</h3>
            <p class="project-key">{{ project.key }} software project</p>
            }
          </div>

          <mat-nav-list>
            <a mat-list-item routerLink="./backlog" routerLinkActive="active-link">
              <mat-icon matListItemIcon>list_alt</mat-icon>
              <div matListItemTitle>Backlog</div>
            </a>
            <a mat-list-item routerLink="./board" routerLinkActive="active-link">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <div matListItemTitle>Board</div>
            </a>
          </mat-nav-list>

          <div class="divider"></div>

          <!-- Quick Filter Section could go here -->
        </mat-sidenav>

        <mat-sidenav-content>
          <div class="content-wrapper">
            <router-outlet></router-outlet>
          </div>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [
    `
      .project-container {
        height: 100%;
      }
      .sidenav-container {
        height: 100%;
        background-color: transparent;
      }
      .sidenav {
        width: 240px;
        background: var(--jira-sidebar-bg);
        border-right: 1px solid var(--jira-border);
      }
      .sidenav-header {
        padding: 24px 16px;

        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--jira-text);
        }

        .project-key {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--jira-text-secondary);
        }
      }
      .active-link {
        background: var(--jira-active-link-bg);
        color: var(--jira-active-link-text) !important;

        mat-icon {
          color: var(--jira-active-link-text);
        }
      }
      .divider {
        margin: 8px 0;
        border-top: 1px solid var(--jira-border);
      }
      .content-wrapper {
        padding: 0;
        height: 100%;
        display: flex;
        flex-direction: column;
        background-color: var(--jira-surface);
      }
    `,
  ],
})
export class ProjectLayout {
  store = inject(ProjectsStore);
}
