import { Injectable, inject } from '@angular/core';
import { Firestore, collectionData } from '@angular/fire/firestore';
import { collection, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { Notification } from './notification.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private notificationsCollection = collection(this.firestore, 'notifications');

  getNotifications(userId: string): Observable<Notification[]> {
    const q = query(this.notificationsCollection, where('recipientId', '==', userId));
    // Note: client-side sorting is safer to avoid Firestore index setup during development
    return collectionData(q, { idField: 'id' }) as Observable<Notification[]>;
  }

  createNotification(notification: Omit<Notification, 'id'>) {
    return addDoc(this.notificationsCollection, notification);
  }

  markAsRead(notificationId: string) {
    const docRef = doc(this.firestore, 'notifications', notificationId);
    return updateDoc(docRef, { read: true });
  }
}
