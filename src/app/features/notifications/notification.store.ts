import {
  signalStore,
  withState,
  withMethods,
  patchState,
  withHooks,
  withComputed,
} from '@ngrx/signals';
import { inject, effect, computed } from '@angular/core';
import { NotificationService } from './notification.service';
import { Notification } from './notification.model';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, tap, switchMap, catchError, of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';

type NotificationState = {
  notifications: Notification[];
  loading: boolean;
};

const initialState: NotificationState = {
  notifications: [],
  loading: false,
};

export const NotificationStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ notifications }) => ({
    unreadCount: computed(() => notifications().filter((n) => !n.read).length),
  })),
  withMethods((store, notificationService = inject(NotificationService)) => ({
    loadNotifications: rxMethod<string | null>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((userId) => {
          if (!userId) {
            patchState(store, { notifications: [] });
            patchState(store, { loading: false });
            return of([]);
          }
          return notificationService.getNotifications(userId).pipe(
            tap((notifications) => {
              const sorted = notifications.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              patchState(store, { notifications: sorted, loading: false });
            }),
            catchError((err) => {
              console.error(err);
              patchState(store, { loading: false });
              return of([]);
            }),
          );
        }),
      ),
    ),
    markAsRead: async (id: string) => {
      // Optimistic update
      const currentNotifications = store.notifications();
      const updated = currentNotifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      patchState(store, { notifications: updated });

      try {
        await notificationService.markAsRead(id);
      } catch (err) {
        console.error('Failed to mark as read', err);
      }
    },
    createNotification: async (notification: Omit<Notification, 'id'>) => {
      try {
        await notificationService.createNotification(notification);
      } catch (err) {
        console.error('Failed to create notification', err);
      }
    },
  })),
  withHooks({
    onInit(store) {
      const authStore = inject(AuthStore);
      effect(() => {
        const user = authStore.user();
        store.loadNotifications(user ? user.uid : null);
      });
    },
  }),
);
