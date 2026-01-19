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
  orderBy,
} from 'firebase/firestore';
import { Sprint } from './sprint.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SprintService {
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  private sprintsCollection = collection(this.firestore, 'sprints');

  getSprints(projectId: string): Observable<Sprint[]> {
    // Sprints can be ordered by startDate or creation time usually.
    // For now, let's just query by projectId. Sorting can happen in store or here.
    const q = query(this.sprintsCollection, where('projectId', '==', projectId));
    return runInInjectionContext(
      this.injector,
      () => collectionData(q, { idField: 'id' }) as Observable<Sprint[]>
    );
  }

  addSprint(sprint: Partial<Sprint>) {
    return addDoc(this.sprintsCollection, sprint);
  }

  updateSprint(id: string, data: Partial<Sprint>) {
    const docRef = doc(this.firestore, 'sprints', id);
    return updateDoc(docRef, data);
  }

  deleteSprint(id: string) {
    const docRef = doc(this.firestore, 'sprints', id);
    return deleteDoc(docRef);
  }

  // Helper to mark sprint as active
  startSprint(id: string) {
    return this.updateSprint(id, { status: 'active' });
  }

  // Helper to mark sprint as completed
  completeSprint(id: string) {
    return this.updateSprint(id, { status: 'completed' });
  }
}
