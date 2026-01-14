import { TaskRegistrationResult } from '../types';

interface RegisterPayload {
  tasks: any[];
  defaults?: {
    tracker_id?: string;
    assigned_to_id?: string;
    status_id?: string;
    priority_id?: string;
    category_id?: string;
  };
}

export const registerTasks = async (projectId: string, payload: RegisterPayload): Promise<TaskRegistrationResult> => {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token || '',
  };

  const response = await fetch(`/projects/${projectId}/redmine_create_tasks/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Registration failed: ${response.status}`);
  }

  return response.json();
};

export interface IssueDetails {
  id: number;
  subject: string;
  status_id: number;
}

export const fetchIssue = async (issueId: string): Promise<IssueDetails> => {
  const response = await fetch(`/issues/${issueId}.json`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Issue not found');
    }
    throw new Error(`Failed to fetch issue: ${response.status}`);
  }
  const data = await response.json();
  return {
    id: data.issue.id,
    subject: data.issue.subject,
    // Redmine API returns status object, checking name or id might be needed, 
    // but here we just need to know if it is closed. 
    // Standard Redmine API doesn't always strictly return 'is_closed', 
    // but we can infer or we might need to rely on status name if no flag.
    // Actually, status object usually has 'is_closed' if we are lucky, or we check against known closed statuses in master data?
    // Wait, the backend logic I implemented uses `issue.closed?` which is reliable.
    // On frontend, to replicate this, we might need to check if status.id is in closed statuses list from masterData.
    // For now, let's just return raw data or minimal interface.
    // Actually, let's rely on the user to check visual feedback or just backend validation.
    // But 'Closeは不可' requirement implies frontend should probably warn too.
    // Let's assume we can get status info.
    // API response: { issue: { id: 1, subject: "foo", status: { id: 1, name: "New" } ... } }
    // We can't know if it's closed just from this unless we match with masterData.
    // So distinct is_closed might not be available directly on issue json unless added by plugin or we cross ref.
    // For now, I will return statusId.
    status_id: data.issue.status.id
  } as any;
};
