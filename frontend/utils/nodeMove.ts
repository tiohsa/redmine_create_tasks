import { Connection, MindMapNode } from '../types';

export type MoveNodeInvalidReason = 'missing_node' | 'circular';
export type AddDependencyInvalidReason =
  | 'same_node'
  | 'missing_node'
  | 'duplicate'
  | 'reverse'
  | 'circular'
  | 'parent_to_descendant';

export interface MoveNodeResult {
  data: MindMapNode;
  connections: Connection[];
  changed: boolean;
  invalidReason?: MoveNodeInvalidReason;
}

export interface AddDependencyResult {
  data: MindMapNode;
  connections: Connection[];
  changed: boolean;
  invalidReason?: AddDependencyInvalidReason;
}

const findNodeById = (node: MindMapNode, id: string): MindMapNode | null => {
  if (node.id === id) return node;

  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }

  return null;
};

const containsNode = (node: MindMapNode, id: string): boolean => {
  if (node.id === id) return true;

  return node.children.some((child) => containsNode(child, id));
};

const findParentId = (node: MindMapNode, childId: string): string | null => {
  if (node.children.some((child) => child.id === childId)) return node.id;

  for (const child of node.children) {
    const parentId = findParentId(child, childId);
    if (parentId) return parentId;
  }

  return null;
};

const removeNodeFromTree = (node: MindMapNode, id: string): MindMapNode => ({
  ...node,
  children: node.children
    .filter((child) => child.id !== id)
    .map((child) => removeNodeFromTree(child, id)),
});

const addChildToParent = (
  node: MindMapNode,
  parentId: string,
  childNode: MindMapNode
): MindMapNode => {
  if (node.id === parentId) {
    return {
      ...node,
      children: [...node.children, childNode],
    };
  }

  return {
    ...node,
    children: node.children.map((child) => addChildToParent(child, parentId, childNode)),
  };
};

const removeDirectDependencyBetween = (
  connections: Connection[],
  firstId: string,
  secondId: string
): Connection[] => {
  const nextConnections = connections.filter((conn) => {
    if ((conn.type ?? 'dependency') !== 'dependency') return true;

    return !(
      (conn.fromId === firstId && conn.toId === secondId) ||
      (conn.fromId === secondId && conn.toId === firstId)
    );
  });

  return nextConnections.length === connections.length ? connections : nextConnections;
};

const removeOutgoingDependencies = (connections: Connection[], sourceId: string): Connection[] => {
  const nextConnections = connections.filter((conn) => {
    if ((conn.type ?? 'dependency') !== 'dependency') return true;

    return conn.fromId !== sourceId;
  });

  return nextConnections.length === connections.length ? connections : nextConnections;
};

const hasDependencyPath = (
  connections: Connection[],
  startId: string,
  targetId: string
): boolean => {
  const graph = new Map<string, string[]>();

  connections.forEach((conn) => {
    if ((conn.type ?? 'dependency') !== 'dependency') return;

    graph.set(conn.fromId, [...(graph.get(conn.fromId) || []), conn.toId]);
  });

  const seen = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (nodeId === targetId) return true;
    if (seen.has(nodeId)) return false;

    seen.add(nodeId);
    return (graph.get(nodeId) || []).some((nextId) => visit(nextId));
  };

  return visit(startId);
};

const detachNodeToRoot = (data: MindMapNode, nodeId: string): MindMapNode => {
  const node = findNodeById(data, nodeId);
  if (!node) return data;

  return addChildToParent(removeNodeFromTree(data, nodeId), data.id, node);
};

export const moveNodeAsChild = (
  data: MindMapNode,
  connections: Connection[],
  childId: string,
  newParentId: string
): MoveNodeResult => {
  if (childId === newParentId || childId === 'root') {
    return { data, connections, changed: false, invalidReason: 'circular' };
  }

  const childNode = findNodeById(data, childId);
  const newParentNode = findNodeById(data, newParentId);

  if (!childNode || !newParentNode) {
    return { data, connections, changed: false, invalidReason: 'missing_node' };
  }

  if (containsNode(childNode, newParentId)) {
    return { data, connections, changed: false, invalidReason: 'circular' };
  }

  const dataWithoutChild = removeNodeFromTree(data, childId);
  const nextData = addChildToParent(dataWithoutChild, newParentId, childNode);
  const nextConnections = removeOutgoingDependencies(
    removeDirectDependencyBetween(connections, childId, newParentId),
    childId
  );

  return {
    data: nextData,
    connections: nextConnections,
    changed: nextData !== data || nextConnections !== connections,
  };
};

export const addDependencyConnection = (
  data: MindMapNode,
  connections: Connection[],
  fromId: string,
  toId: string,
  connectionId: string
): AddDependencyResult => {
  if (fromId === toId) {
    return { data, connections, changed: false, invalidReason: 'same_node' };
  }

  const fromNode = findNodeById(data, fromId);
  const toNode = findNodeById(data, toId);

  if (!fromNode || !toNode) {
    return { data, connections, changed: false, invalidReason: 'missing_node' };
  }

  const dependencyConnections = connections.filter((conn) => (conn.type ?? 'dependency') === 'dependency');
  const fromParentId = findParentId(data, fromId);
  const shouldDetachFromParent = fromParentId !== null && fromParentId !== data.id;

  if (dependencyConnections.some((conn) => conn.fromId === fromId && conn.toId === toId)) {
    return { data, connections, changed: false, invalidReason: 'duplicate' };
  }

  if (dependencyConnections.some((conn) => conn.fromId === toId && conn.toId === fromId)) {
    return { data, connections, changed: false, invalidReason: 'reverse' };
  }

  if (containsNode(fromNode, toId)) {
    return { data, connections, changed: false, invalidReason: 'parent_to_descendant' };
  }

  const replacementBaseConnections = removeOutgoingDependencies(connections, fromId);

  if (hasDependencyPath(replacementBaseConnections, toId, fromId)) {
    return { data, connections, changed: false, invalidReason: 'circular' };
  }

  const nextData = shouldDetachFromParent ? detachNodeToRoot(data, fromId) : data;
  const nextConnections = [
    ...replacementBaseConnections,
    {
      id: connectionId,
      fromId,
      toId,
      type: 'dependency' as const,
      sourceHandle: 'leftDependency' as const,
      targetHandle: 'leftDependency' as const,
    },
  ];

  return {
    data: nextData,
    connections: nextConnections,
    changed: true,
  };
};
