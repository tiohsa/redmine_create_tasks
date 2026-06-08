
export interface MindMapNode {
  id: string;
  text: string;
  startDate?: string;
  endDate?: string;
  effort?: number;
  children: MindMapNode[];
  direction?: 'left' | 'right';
  isAIExpanding?: boolean;
  isRoot?: boolean;
  x?: number;
  y?: number;
  isFixed?: boolean;
}

declare global {
  interface Window {
    RedmineCreateTasks: {
      rootUrl: string;
      projectIdentifier: string;
      apiKey?: string;
    };
    createTasksI18n: any;
    createTasksI18nFallback: any;
  }
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  type?: 'dependency';
  sourceHandle?: 'leftDependency';
  targetHandle?: 'leftDependency';
}

export interface Page {
  id: string;
  title: string;
  data: MindMapNode;
  connections: Connection[];
}

export interface Point {
  x: number;
  y: number;
}

export interface AiTask {
  subject: string;
  start_date?: string;
  due_date?: string;
}

export interface TaskRegistrationTask {
  id: string;
  subject: string;
  start_date?: string;
  due_date?: string;
  man_days?: number;
  dependencies?: string[];
  parent_task_id?: string;
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
  id_mapping?: Record<string, string>;
}
