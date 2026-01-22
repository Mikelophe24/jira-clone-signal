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
  getDoc,
} from 'firebase/firestore';
import { Issue } from './issue.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IssueService {
  private firestore = inject(Firestore);

  private injector = inject(Injector);
  private issuesCollection = collection(this.firestore, 'issues');

  async getIssue(id: string): Promise<Issue | undefined> {
    const docRef = doc(this.firestore, 'issues', id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { id: snapshot.id, ...snapshot.data() } as Issue;
    }
    return undefined;
  }

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

  // --- Comments Subcollection ---

  getComments(issueId: string): Observable<any[]> {
    const commentsRef = collection(this.firestore, `issues/${issueId}/comments`);
    // Optional: Sort by createdAt
    // const q = query(commentsRef, orderBy('createdAt', 'asc'));
    return runInInjectionContext(this.injector, () =>
      collectionData(commentsRef, { idField: 'id' }),
    ) as Observable<any[]>;
  }

  addCommentToIssue(issueId: string, comment: any) {
    const commentsRef = collection(this.firestore, `issues/${issueId}/comments`);
    const { id, ...data } = comment; // Let Firestore gen ID or use doc() if id is provided
    return addDoc(commentsRef, data);
  }

  deleteCommentFromIssue(issueId: string, commentId: string) {
    const docRef = doc(this.firestore, `issues/${issueId}/comments/${commentId}`);
    return deleteDoc(docRef);
  }

  // --- Attachments Subcollection ---

  getAttachments(issueId: string): Observable<any[]> {
    const attachmentsRef = collection(this.firestore, `issues/${issueId}/attachments`);
    return runInInjectionContext(this.injector, () =>
      collectionData(attachmentsRef, { idField: 'id' }),
    ) as Observable<any[]>;
  }

  addAttachmentToIssue(issueId: string, attachment: any) {
    const attachmentsRef = collection(this.firestore, `issues/${issueId}/attachments`);
    const { id, ...data } = attachment;
    return addDoc(attachmentsRef, data);
  }

  deleteAttachmentFromIssue(issueId: string, attachmentId: string) {
    const docRef = doc(this.firestore, `issues/${issueId}/attachments/${attachmentId}`);
    return deleteDoc(docRef);
  }

  // --- Subtasks Subcollection ---

  getSubtasks(issueId: string): Observable<any[]> {
    const subtasksRef = collection(this.firestore, `issues/${issueId}/subtasks`);
    return runInInjectionContext(this.injector, () =>
      collectionData(subtasksRef, { idField: 'id' }),
    ) as Observable<any[]>;
  }

  addSubtaskToIssue(issueId: string, subtask: any) {
    const subtasksRef = collection(this.firestore, `issues/${issueId}/subtasks`);
    const { id, ...data } = subtask;
    return addDoc(subtasksRef, data);
  }

  updateSubtask(issueId: string, subtaskId: string, data: any) {
    const docRef = doc(this.firestore, `issues/${issueId}/subtasks/${subtaskId}`);
    return updateDoc(docRef, data);
  }

  deleteSubtaskFromIssue(issueId: string, subtaskId: string) {
    const docRef = doc(this.firestore, `issues/${issueId}/subtasks/${subtaskId}`);
    return deleteDoc(docRef);
  }

  async uploadIssueAttachment(issueId: string, file: File): Promise<string> {
    // Check file size (limit to 200KB to be safe with Firestore 1MB limit per doc)
    // If you need larger files, you must use a separate collection or real Storage
    if (file.size > 200 * 1024) {
      throw new Error(
        'File size exceeds 200KB limit for database storage. Please use smaller files.',
      );
    }
    return this.fileToBase64(file);
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }
}
