import { Injectable, inject } from '@angular/core';
import { Firestore, collectionData } from '@angular/fire/firestore';
import { collection, doc, addDoc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { Project } from './project.model';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private firestore = inject(Firestore);
  private projectsCollection = collection(this.firestore, 'projects');

  getProjects(userId: string): Observable<Project[]> {
    const q = query(this.projectsCollection, where('memberIds', 'array-contains', userId));
    return collectionData(q, { idField: 'id' }) as Observable<Project[]>;
  }

  addProject(project: Partial<Project>) {
    return addDoc(this.projectsCollection, project);
  }

  deleteProject(projectId: string) {
    const docRef = doc(this.firestore, 'projects', projectId);
    return deleteDoc(docRef);
  }

  getUsers(userIds: string[]): Observable<any[]> {
    if (!userIds || userIds.length === 0) return of([]);
    // Firestore 'in' query supports max 10 values.
    // For MVP, we assume small teams. For production, we'd need to chunk this.
    const usersCollection = collection(this.firestore, 'users');
    const q = query(usersCollection, where('uid', 'in', userIds.slice(0, 10)));
    return collectionData(q);
  }

  findUserByEmail(email: string): Observable<any[]> {
    const usersCollection = collection(this.firestore, 'users');
    const q = query(usersCollection, where('email', '==', email));
    return collectionData(q);
  }

  addMemberToProject(projectId: string, newMemberId: string, currentMemberIds: string[]) {
    // Deprecated in favor of inviteUserToProject but keeping for immediate adds if needed
    const docRef = doc(this.firestore, 'projects', projectId);
    if (currentMemberIds.includes(newMemberId)) return Promise.resolve();
    const newMemberIds = [...currentMemberIds, newMemberId];
    return updateDoc(docRef, { memberIds: newMemberIds });
  }

  inviteUserToProject(projectId: string, userId: string, currentInvitedIds: string[] = []) {
    const docRef = doc(this.firestore, 'projects', projectId);
    if (currentInvitedIds.includes(userId)) return Promise.resolve();
    const newInvitedIds = [...currentInvitedIds, userId];
    return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
  }

  getPendingInvites(userId: string): Observable<Project[]> {
    const q = query(this.projectsCollection, where('invitedMemberIds', 'array-contains', userId));
    return collectionData(q, { idField: 'id' }) as Observable<Project[]>;
  }

  async acceptInvite(project: Project, userId: string) {
    const docRef = doc(this.firestore, 'projects', project.id);

    // Remove from invited
    const newInvitedIds = (project.invitedMemberIds || []).filter((id) => id !== userId);
    // Add to members
    const newMemberIds = [...project.memberIds, userId];

    return updateDoc(docRef, {
      invitedMemberIds: newInvitedIds,
      memberIds: newMemberIds,
    });
  }

  rejectInvite(project: Project, userId: string) {
    const docRef = doc(this.firestore, 'projects', project.id);
    const newInvitedIds = (project.invitedMemberIds || []).filter((id) => id !== userId);
    return updateDoc(docRef, { invitedMemberIds: newInvitedIds });
  }

  removeMemberFromProject(projectId: string, memberIdToRemove: string, currentMemberIds: string[]) {
    const docRef = doc(this.firestore, 'projects', projectId);
    const newMemberIds = currentMemberIds.filter((id) => id !== memberIdToRemove);
    return updateDoc(docRef, { memberIds: newMemberIds });
  }
}
