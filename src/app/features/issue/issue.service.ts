import { Injectable, inject } from '@angular/core';
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
} from 'firebase/firestore';
import { Issue } from './issue.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IssueService {
  private firestore = inject(Firestore);
  private issuesCollection = collection(this.firestore, 'issues');

  getIssues(projectId: string): Observable<Issue[]> {
    const q = query(this.issuesCollection, where('projectId', '==', projectId));
    return collectionData(q, { idField: 'id' }) as Observable<Issue[]>;
  }

  getMyIssues(userId: string): Observable<Issue[]> {
    const q = query(this.issuesCollection, where('assigneeId', '==', userId));
    return collectionData(q, { idField: 'id' }) as Observable<Issue[]>;
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
    return this.updateIssue(issueId, { isInBacklog: true });
  }

  moveToBoard(issueId: string) {
    return this.updateIssue(issueId, { isInBacklog: false });
  }
}
