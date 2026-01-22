export type IssueType = 'task' | 'bug' | 'story';
export type IssuePriority = 'high' | 'medium' | 'low';

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string; // ISO string
  safeContent?: any; // Sanitized HTML content
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploaderId: string;
}

export interface Issue {
  id: string;
  projectId: string;
  boardId: string;
  key: string;
  title: string;
  description: string;
  type: IssueType;
  statusColumnId: string;
  priority: IssuePriority;
  sprintId?: string | null;
  reporterId?: string;
  assigneeId?: string;
  order: number;
  comments?: Comment[];
  isInBacklog?: boolean;
  dueDate?: string; // ISO string
  subtasks?: Subtask[];
  attachments?: Attachment[];
  isArchived?: boolean;
}
