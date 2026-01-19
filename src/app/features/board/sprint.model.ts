export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  startDate: string; // ISO String
  endDate: string; // ISO String
  status: 'active' | 'future' | 'completed';
}
