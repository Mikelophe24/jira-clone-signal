export type IssueType = 'task' | 'bug' | 'story';
export type IssuePriority = 'high' | 'medium' | 'low';

export interface Comment {
  id: string;
  userId: string;
  content: string;
  createdAt: string; // ISO string
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
  assigneeId?: string;
  order: number;
  comments?: Comment[];
  isInBacklog?: boolean;
  dueDate?: string; // ISO string
}
