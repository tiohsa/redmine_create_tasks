import { describe, expect, test } from 'vitest';
import { Connection, MindMapNode } from '../../types';
import { calculateCriticalPath } from '../cpm';

describe('calculateCriticalPath', () => {
  test('direction: "left" alone does not create a dependency', () => {
    const rootNode: MindMapNode = {
      id: 'root',
      text: 'Root',
      effort: 2,
      children: [
        { id: 'task-a', text: 'Task A', effort: 5, direction: 'left', children: [] }
      ]
    };
    const connections: Connection[] = [];

    const result = calculateCriticalPath(rootNode, connections);

    // If direction: "left" created a dependency, then Task A (5 days) would precede Root (2 days),
    // making the total project duration 7 days.
    // Without hierarchy dependency, the nodes are independent. The project duration is 5 days (Task A).
    // Task A will be critical, and Root will have float > 0 (since it finishes in 2 days but project duration is 5 days).
    expect(result.criticalNodeIds.has('task-a')).toBe(true);
    expect(result.criticalNodeIds.has('root')).toBe(false);
  });

  test('child relationship alone does not create a dependency', () => {
    const rootNode: MindMapNode = {
      id: 'root',
      text: 'Root',
      effort: 3,
      children: [
        { id: 'task-b', text: 'Task B', effort: 4, children: [] }
      ]
    };
    const connections: Connection[] = [];

    const result = calculateCriticalPath(rootNode, connections);

    // Without hierarchy dependency, Task B (4 days) and Root (3 days) are independent.
    // Task B is critical, Root is not.
    expect(result.criticalNodeIds.has('task-b')).toBe(true);
    expect(result.criticalNodeIds.has('root')).toBe(false);
  });

  test('only explicit connections create dependencies', () => {
    const rootNode: MindMapNode = {
      id: 'root',
      text: 'Root',
      effort: 2,
      children: [
        { id: 'task-c', text: 'Task C', effort: 4, children: [] }
      ]
    };
    // Explicit connection Task C -> Root
    const connections: Connection[] = [
      { id: 'conn-1', fromId: 'task-c', toId: 'root', type: 'dependency' }
    ];

    const result = calculateCriticalPath(rootNode, connections);

    // Now Task C must finish before Root starts.
    // Total project duration = 4 + 2 = 6.
    // Both are on the critical path.
    expect(result.criticalNodeIds.has('task-c')).toBe(true);
    expect(result.criticalNodeIds.has('root')).toBe(true);
    expect(result.criticalConnIds.has('conn-1')).toBe(true);
  });

  test('critical connection IDs are returned only for explicit dependency connections', () => {
    const rootNode: MindMapNode = {
      id: 'root',
      text: 'Root',
      effort: 2,
      children: [
        { id: 'task-d', text: 'Task D', effort: 4, children: [] }
      ]
    };
    const connections: Connection[] = [
      { id: 'conn-non-dep', fromId: 'task-d', toId: 'root', type: undefined } // default to dependency
    ];

    const result = calculateCriticalPath(rootNode, connections);

    expect(result.criticalConnIds.has('conn-non-dep')).toBe(true);
  });
});
