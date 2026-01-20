import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import { Firestore, collectionData } from '@angular/fire/firestore';
import {
  collection,
  query,
  where,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { Issue } from './issue.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IssueService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private issuesCollection = collection(this.firestore, 'issues');

  getIssues(projectId: string): Observable<Issue[]> {
    const q = query(this.issuesCollection, where('projectId', '==', projectId));
    return runInInjectionContext(
      this.injector,
      () => collectionData(q, { idField: 'id' }) as Observable<Issue[]>,
    );
  }

  getMyIssues(userId: string): Observable<Issue[]> {
    const q = query(this.issuesCollection, where('assigneeId', '==', userId));
    return runInInjectionContext(
      this.injector,
      () => collectionData(q, { idField: 'id' }) as Observable<Issue[]>,
    );
  }

  addIssue(issue: Partial<Issue>) {
    return addDoc(this.issuesCollection, issue);
  }

  updateIssue(id: string, data: Partial<Issue>) {
    const docRef = doc(this.firestore, 'issues', id);
    return updateDoc(docRef, data);
  }

  deleteIssue(id: string) {
    const docRef = doc(this.firestore, 'issues', id);
    return deleteDoc(docRef);
  }

  async batchUpdateIssues(updates: { id: string; data: Partial<Issue> }[]) {
    const batch = writeBatch(this.firestore);
    updates.forEach(({ id, data }) => {
      const docRef = doc(this.firestore, 'issues', id);
      batch.update(docRef, data);
    });
    return batch.commit();
  }

  moveToBacklog(issueId: string) {
    return this.updateIssue(issueId, { isInBacklog: true, sprintId: null });
  }

  moveToBoard(issueId: string) {
    return this.updateIssue(issueId, { isInBacklog: false });
  }

  async deleteIssuesByProjectId(projectId: string) {
    const q = query(this.issuesCollection, where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(this.firestore);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    return batch.commit();
  }

  async unassignUserFromProjectIssues(projectId: string, userId: string) {
    const q = query(
      this.issuesCollection,
      where('projectId', '==', projectId),
      where('assigneeId', '==', userId),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const updates = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: { assigneeId: null as any },
    }));
    return this.batchUpdateIssues(updates);
  }
}
