import { describe, expect, test } from 'vitest';
import { Connection, MindMapNode } from '../../types';
import { addDependencyConnection, moveNodeAsChild } from '../nodeMove';

const createData = (): MindMapNode => ({
  id: 'root',
  text: 'Root',
  children: [
    { id: 'c', text: 'Task C', children: [] },
    { id: 'b', text: 'Task B', children: [] },
    { id: 'a', text: 'Task A', children: [] },
    { id: 'aa', text: 'Task AA', children: [] },
    { id: 'f', text: 'Final', children: [] },
  ],
});

const createNestedData = (): MindMapNode => ({
  id: 'root',
  text: 'Root',
  children: [
    { id: 'b', text: 'Task B', children: [] },
    { id: 'a', text: 'Task A', children: [] },
    {
      id: 'aa',
      text: 'Task AA',
      children: [{ id: 'c', text: 'Task C', children: [] }],
    },
    { id: 'f', text: 'Final', children: [] },
  ],
});

const initialConnections = (): Connection[] => [
  { id: 'conn-c-b', fromId: 'c', toId: 'b', type: 'dependency' },
  { id: 'conn-b-a', fromId: 'b', toId: 'a', type: 'dependency' },
  { id: 'conn-a-f', fromId: 'a', toId: 'f', type: 'dependency' },
  { id: 'conn-aa-a', fromId: 'aa', toId: 'a', type: 'dependency' },
];

const findNode = (node: MindMapNode, id: string): MindMapNode | null => {
  if (node.id === id) return node;

  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }

  return null;
};

const connectionPairs = (connections: Connection[]) =>
  connections.map((connection) => `${connection.fromId}->${connection.toId}`);

describe('moveNodeAsChild', () => {
  test('moves a root node under another node and removes dragged node dependencies', () => {
    const data = createData();
    const connections = initialConnections();

    const result = moveNodeAsChild(data, connections, 'c', 'aa');

    expect(result.changed).toBe(true);
    expect(findNode(result.data, 'aa')?.children.map((child) => child.id)).toEqual(['c']);
    expect(result.data.children.map((child) => child.id)).toEqual(['b', 'a', 'aa', 'f']);
    expect(connectionPairs(result.connections)).toEqual(['b->a', 'a->f', 'aa->a']);
  });

  test('rejects moving a node under its descendant', () => {
    const data = createNestedData();
    const connections: Connection[] = [];

    const result = moveNodeAsChild(data, connections, 'aa', 'c');

    expect(result.changed).toBe(false);
    expect(result.invalidReason).toBe('circular');
    expect(result.data).toBe(data);
    expect(result.connections).toBe(connections);
  });
});

describe('addDependencyConnection', () => {
  test('replaces dragged node dependency when dropping onto a left edge', () => {
    const data = createData();
    const connections = initialConnections();

    const result = addDependencyConnection(data, connections, 'c', 'aa', 'conn-c-aa');

    expect(result.changed).toBe(true);
    expect(result.data).toBe(data);
    expect(connectionPairs(result.connections)).toEqual(['b->a', 'a->f', 'aa->a', 'c->aa']);
    expect(result.connections.at(-1)).toMatchObject({
      id: 'conn-c-aa',
      fromId: 'c',
      toId: 'aa',
      sourceHandle: 'leftDependency',
      targetHandle: 'leftDependency',
    });
  });

  test('replaces the dragged node dependency again when dropped onto another left edge', () => {
    const data = createData();
    const connections: Connection[] = [
      { id: 'conn-b-a', fromId: 'b', toId: 'a', type: 'dependency' },
      { id: 'conn-a-f', fromId: 'a', toId: 'f', type: 'dependency' },
      { id: 'conn-aa-a', fromId: 'aa', toId: 'a', type: 'dependency' },
      { id: 'conn-c-aa', fromId: 'c', toId: 'aa', type: 'dependency' },
    ];

    const result = addDependencyConnection(data, connections, 'c', 'b', 'conn-c-b');

    expect(result.changed).toBe(true);
    expect(connectionPairs(result.connections)).toEqual(['b->a', 'a->f', 'aa->a', 'c->b']);
  });

  test('detaches a child node to root when converting it back to a dependency', () => {
    const data = createNestedData();
    const connections: Connection[] = [
      { id: 'conn-b-a', fromId: 'b', toId: 'a', type: 'dependency' },
      { id: 'conn-a-f', fromId: 'a', toId: 'f', type: 'dependency' },
      { id: 'conn-aa-a', fromId: 'aa', toId: 'a', type: 'dependency' },
    ];

    const result = addDependencyConnection(data, connections, 'c', 'b', 'conn-c-b');

    expect(result.changed).toBe(true);
    expect(findNode(result.data, 'aa')?.children).toEqual([]);
    expect(result.data.children.map((child) => child.id)).toEqual(['b', 'a', 'aa', 'f', 'c']);
    expect(connectionPairs(result.connections)).toEqual(['b->a', 'a->f', 'aa->a', 'c->b']);
  });

  test('keeps incoming dependencies to the dragged node while replacing its outgoing dependency', () => {
    const data = createData();
    const connections: Connection[] = [
      { id: 'conn-b-c', fromId: 'b', toId: 'c', type: 'dependency' },
      { id: 'conn-c-a', fromId: 'c', toId: 'a', type: 'dependency' },
    ];

    const result = addDependencyConnection(data, connections, 'c', 'aa', 'conn-c-aa');

    expect(result.changed).toBe(true);
    expect(connectionPairs(result.connections)).toEqual(['b->c', 'c->aa']);
  });

  test('rejects duplicate dependency connections', () => {
    const data = createData();
    const connections: Connection[] = [{ id: 'conn-c-aa', fromId: 'c', toId: 'aa', type: 'dependency' }];

    const result = addDependencyConnection(data, connections, 'c', 'aa', 'conn-duplicate');

    expect(result.changed).toBe(false);
    expect(result.invalidReason).toBe('duplicate');
    expect(result.connections).toBe(connections);
  });

  test('rejects a direct reverse dependency', () => {
    const data = createData();
    const connections: Connection[] = [{ id: 'conn-aa-c', fromId: 'aa', toId: 'c', type: 'dependency' }];

    const result = addDependencyConnection(data, connections, 'c', 'aa', 'conn-c-aa');

    expect(result.changed).toBe(false);
    expect(result.invalidReason).toBe('reverse');
    expect(result.connections).toBe(connections);
  });

  test('rejects dependency cycles after outgoing replacement is applied', () => {
    const data = createData();
    const connections: Connection[] = [
      { id: 'conn-c-b', fromId: 'c', toId: 'b', type: 'dependency' },
      { id: 'conn-aa-b', fromId: 'aa', toId: 'b', type: 'dependency' },
      { id: 'conn-b-c', fromId: 'b', toId: 'c', type: 'dependency' },
    ];

    const result = addDependencyConnection(data, connections, 'c', 'aa', 'conn-c-aa');

    expect(result.changed).toBe(false);
    expect(result.invalidReason).toBe('circular');
    expect(result.connections).toBe(connections);
  });

  test('rejects parent to descendant dependency connections', () => {
    const data = createNestedData();
    const connections: Connection[] = [];

    const result = addDependencyConnection(data, connections, 'aa', 'c', 'conn-aa-c');

    expect(result.changed).toBe(false);
    expect(result.invalidReason).toBe('parent_to_descendant');
    expect(result.connections).toBe(connections);
  });

  test('rejects self dependency connections', () => {
    const data = createData();
    const connections: Connection[] = [];

    const result = addDependencyConnection(data, connections, 'c', 'c', 'conn-c-c');

    expect(result.changed).toBe(false);
    expect(result.invalidReason).toBe('same_node');
    expect(result.connections).toBe(connections);
  });

  test('rejects dependencies with missing nodes', () => {
    const data = createData();
    const connections: Connection[] = [];

    const result = addDependencyConnection(data, connections, 'missing', 'c', 'conn-missing-c');

    expect(result.changed).toBe(false);
    expect(result.invalidReason).toBe('missing_node');
    expect(result.connections).toBe(connections);
  });
});
