
export interface MindMapNode {
  id: string;
  text: string;
  startDate?: string;
  endDate?: string;
  effort?: number;
  children: MindMapNode[];
  direction?: 'left' | 'right';
  isAIExpanding?: boolean;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface TaskRegistrationTask {
  id: string;
  subject: string;
  start_date?: string;
  due_date?: string;
  man_days?: number;
  dependencies?: string[];
}

export interface TaskRegistrationPayload {
  tasks: TaskRegistrationTask[];
}

export interface TaskRegistrationFailure {
  task_id: string;
  reason: string;
}

export interface TaskRegistrationWarning {
  task_id: string;
  reason: string;
}

export interface TaskRegistrationResult {
  success_count: number;
  success_sample_ids: number[];
  failures: TaskRegistrationFailure[];
  warnings: TaskRegistrationWarning[];
}
