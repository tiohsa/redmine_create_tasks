import { describe, expect, test } from 'vitest';
import { Connection, MindMapNode } from '../../types';
import { buildTaskRegistrationPayload } from '../taskRegistrationPayload';
import { RegistrationSettings } from '../../components/RegistrationSettingsDialog';

describe('buildTaskRegistrationPayload', () => {
  // Case 1: Root child + root issue created
  test('root child + root issue created -> parent_task_id = "root"', () => {
    const data: MindMapNode = {
      id: 'root',
      text: 'Final Deliverable',
      children: [
        { id: 'task-a', text: 'Task A', children: [] }
      ]
    };
    const connections: Connection[] = [];
    const settings: RegistrationSettings = {
      create_root_issue: true
    };

    const payload = buildTaskRegistrationPayload(data, connections, settings);
    
    // Check root issue exists in payload
    const rootTask = payload.tasks.find(t => t.id === 'root');
    expect(rootTask).toBeDefined();

    // Check child task
    const childTask = payload.tasks.find(t => t.id === 'task-a');
    expect(childTask).toBeDefined();
    expect(childTask?.parent_task_id).toBe('root');
  });

  // Case 2: Root child + existing root issue
  test('root child + existing root issue -> parent_task_id = existing_root_issue_id', () => {
    const data: MindMapNode = {
      id: 'root',
      text: 'Final Deliverable',
      children: [
        { id: 'task-a', text: 'Task A', children: [] }
      ]
    };
    const connections: Connection[] = [];
    const settings: RegistrationSettings = {
      create_root_issue: false,
      existing_root_issue_id: '12345'
    };

    const payload = buildTaskRegistrationPayload(data, connections, settings);

    // Root issue should be excluded from tasks
    const rootTask = payload.tasks.find(t => t.id === 'root');
    expect(rootTask).toBeUndefined();

    // Check child task
    const childTask = payload.tasks.find(t => t.id === 'task-a');
    expect(childTask).toBeDefined();
    expect(childTask?.parent_task_id).toBe('12345');
  });

  // Case 3: Root child + no root issue created and no existing root issue
  test('root child + no root issue created and no existing root issue -> parent_task_id = undefined', () => {
    const data: MindMapNode = {
      id: 'root',
      text: 'Final Deliverable',
      children: [
        { id: 'task-a', text: 'Task A', children: [] }
      ]
    };
    const connections: Connection[] = [];
    const settings: RegistrationSettings = {
      create_root_issue: false
    };

    const payload = buildTaskRegistrationPayload(data, connections, settings);

    // Root issue should be excluded from tasks
    const rootTask = payload.tasks.find(t => t.id === 'root');
    expect(rootTask).toBeUndefined();

    // Check child task
    const childTask = payload.tasks.find(t => t.id === 'task-a');
    expect(childTask).toBeDefined();
    expect(childTask?.parent_task_id).toBeUndefined();
  });

  // Case 4: Root successor dependency
  test('root successor dependency -> task depends on root', () => {
    const data: MindMapNode = {
      id: 'root',
      text: 'Final Deliverable',
      children: [
        { id: 'task-a', text: 'Task A', children: [] }
      ]
    };
    const connections: Connection[] = [
      { id: 'c1', fromId: 'root', toId: 'task-a', type: 'dependency' }
    ];
    const settings: RegistrationSettings = {
      create_root_issue: true
    };

    const payload = buildTaskRegistrationPayload(data, connections, settings);

    const childTask = payload.tasks.find(t => t.id === 'task-a');
    expect(childTask).toBeDefined();
    expect(childTask?.dependencies).toContain('root');
  });

  // Case 5: Root successor dependency + existing root issue
  test('root successor dependency + existing root issue -> dependency maps to existing root issue ID', () => {
    const data: MindMapNode = {
      id: 'root',
      text: 'Final Deliverable',
      children: [
        { id: 'task-a', text: 'Task A', children: [] }
      ]
    };
    const connections: Connection[] = [
      { id: 'c1', fromId: 'root', toId: 'task-a', type: 'dependency' }
    ];
    const settings: RegistrationSettings = {
      create_root_issue: false,
      existing_root_issue_id: '12345'
    };

    const payload = buildTaskRegistrationPayload(data, connections, settings);

    const childTask = payload.tasks.find(t => t.id === 'task-a');
    expect(childTask).toBeDefined();
    expect(childTask?.dependencies).toContain('12345');
    expect(childTask?.dependencies).not.toContain('root');
  });

  // Case 6: Root dependency predecessor -> parent_task_id = undefined
  test('root dependency predecessor -> parent_task_id = undefined', () => {
    const data: MindMapNode = {
      id: 'root',
      text: 'Final Deliverable',
      children: [
        { id: 'task-a', text: 'Task A', children: [] }
      ]
    };
    const connections: Connection[] = [
      { id: 'c1', fromId: 'task-a', toId: 'root', type: 'dependency' }
    ];
    const settings: RegistrationSettings = {
      create_root_issue: true
    };

    const payload = buildTaskRegistrationPayload(data, connections, settings);

    const childTask = payload.tasks.find(t => t.id === 'task-a');
    expect(childTask).toBeDefined();
    expect(childTask?.parent_task_id).toBeUndefined();
  });
});
