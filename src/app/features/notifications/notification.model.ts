export type NotificationType = 'ASSIGNMENT' | 'COMMENT';

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  type: NotificationType;
  issueId: string;
  projectId: string; // To help navigation
  content: string;
  createdAt: string; // ISO string
  read: boolean;
}
