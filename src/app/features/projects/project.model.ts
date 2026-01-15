export interface Project {
  id: string;
  name: string;
  key: string;
  ownerId: string;
  memberIds: string[];
  invitedMemberIds?: string[]; // IDs of users invited but not yet accepted
}