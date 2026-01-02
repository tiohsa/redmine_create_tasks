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

  const response = await fetch(`/projects/${projectId}/create_tasks/issues`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Registration failed: ${response.status}`);
  }

  return response.json();
};
