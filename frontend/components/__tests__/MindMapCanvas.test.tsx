import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import MindMapCanvas from '../MindMapCanvas';
import { MindMapNode } from '../../types';

const data: MindMapNode = {
  id: 'root',
  text: 'Root',
  children: [
    { id: 'a', text: 'Task A', children: [], direction: 'right' },
    { id: 'b', text: 'Task B', children: [], direction: 'right' },
  ],
};

const renderCanvas = (overrides = {}) => {
  const props = {
    data,
    connections: [],
    selectedNodeId: null,
    editingNodeId: null,
    onSelectNode: vi.fn(),
    onUpdateNodeData: vi.fn(),
    onAddNode: vi.fn(),
    onDeleteNode: vi.fn(),
    onSetEditingId: vi.fn(),
    onAddConnection: vi.fn(),
    onMoveNode: vi.fn(),
    ...overrides,
  };

  return {
    ...render(<MindMapCanvas {...props} />),
    props,
  };
};

const getNodeTranslate = (id: string) => {
  const transform = screen.getByTestId(`mindmap-node-${id}`).getAttribute('transform') || '';
  const match = transform.match(/translate\(([-\d.]+), ([-\d.]+)\)/);
  if (!match) throw new Error(`Missing translate for ${id}`);
  return { x: Number(match[1]), y: Number(match[2]) };
};

test('renders root node text', () => {
  renderCanvas();
  expect(screen.getByText('Root')).toBeInTheDocument();
});

test('renders child nodes below their parent', () => {
  renderCanvas({
    data: {
      ...data,
      children: [
        data.children[0],
        {
          ...data.children[1],
          children: [
            { id: 'c', text: 'Task C', children: [], direction: 'right' },
          ],
        },
      ],
    },
  });

  expect(getNodeTranslate('c').y).toBeGreaterThan(getNodeTranslate('b').y);
});

test('renders dependency predecessors to the left of their target', () => {
  renderCanvas({
    data: {
      ...data,
      children: [
        { ...data.children[0], direction: 'left' },
        data.children[1],
      ],
    },
    connections: [
      { id: 'conn-a-b', fromId: 'a', toId: 'b', type: 'dependency' },
    ],
  });

  expect(getNodeTranslate('a').x).toBeLessThan(getNodeTranslate('b').x);
});

test('left plus click creates a dependency predecessor node', () => {
  const { props } = renderCanvas();

  fireEvent.click(screen.getByTestId('left-dependency-handle-b'));

  expect(props.onAddNode).toHaveBeenCalledWith('b', 'left');
});

test('root left plus click still creates a dependency predecessor node', () => {
  const { props } = renderCanvas();

  fireEvent.click(screen.getByTestId('left-dependency-handle-root'));

  expect(props.onAddNode).toHaveBeenCalledWith('root', 'left');
});

test('root bottom plus click adds a child node', () => {
  const { props } = renderCanvas();

  fireEvent.click(screen.getByTestId('bottom-child-handle-root'));

  expect(props.onAddNode).toHaveBeenCalledWith('root');
});

test('dragging a node onto the root bottom plus moves it as a root child', () => {
  const { container, props } = renderCanvas();
  const taskARect = screen.getByTestId('node-drag-a');

  fireEvent.mouseDown(taskARect, { clientX: 0, clientY: 0 });
  fireEvent.mouseEnter(screen.getByTestId('bottom-child-handle-root'));
  fireEvent.mouseUp(container.querySelector('svg') as Element);

  expect(props.onMoveNode).toHaveBeenCalledWith('a', 'root');
  expect(props.onAddConnection).not.toHaveBeenCalled();
});

test('non-root bottom plus click adds a child node', () => {
  const { props } = renderCanvas();

  fireEvent.click(screen.getByTestId('bottom-child-handle-b'));

  expect(props.onAddNode).toHaveBeenCalledWith('b');
});

test('dragging a node onto the left plus creates a dependency', () => {
  const { container, props } = renderCanvas();
  const taskARect = screen.getByTestId('node-drag-a');

  fireEvent.mouseDown(taskARect, { clientX: 0, clientY: 0 });
  fireEvent.mouseEnter(screen.getByTestId('left-dependency-handle-b'));
  fireEvent.mouseUp(container.querySelector('svg') as Element);

  expect(props.onAddConnection).toHaveBeenCalledWith('a', 'b');
  expect(props.onMoveNode).not.toHaveBeenCalled();
});

test('dragging a node onto the bottom plus moves it as a child', () => {
  const { container, props } = renderCanvas();
  const taskARect = screen.getByTestId('node-drag-a');

  fireEvent.mouseDown(taskARect, { clientX: 0, clientY: 0 });
  fireEvent.mouseEnter(screen.getByTestId('bottom-child-handle-b'));
  fireEvent.mouseUp(container.querySelector('svg') as Element);

  expect(props.onMoveNode).toHaveBeenCalledWith('a', 'b');
  expect(props.onAddConnection).not.toHaveBeenCalled();
});

test('does not render a right-side add handle', () => {
  renderCanvas();

  expect(screen.queryByTestId('right-add-handle-b')).not.toBeInTheDocument();
});

test('renders dependency arrows from the source edge to the target edge', () => {
  const { container } = renderCanvas({
    connections: [{ id: 'a-b', fromId: 'a', toId: 'b' }],
  });

  const arrow = container.querySelector('path[marker-end="url(#dependency-arrow)"]');
  expect(arrow).not.toBeNull();
  expect(arrow).not.toHaveAttribute('stroke-dasharray');
  expect(container.querySelector('path[stroke="rgba(0,0,0,0)"]')).toBeNull();
  expect(container.querySelector('path[pointer-events="stroke"]')).toBeNull();

  const marker = container.querySelector('marker#dependency-arrow');
  expect(marker).toHaveAttribute('markerWidth', '6');
  expect(marker).toHaveAttribute('markerHeight', '6');

  const path = arrow?.getAttribute('d') || '';
  const match = path.match(
    /^M ([-\d.]+) ([-\d.]+) C [-\d.]+ [-\d.]+, [-\d.]+ [-\d.]+, ([-\d.]+) ([-\d.]+)$/,
  );
  expect(match).not.toBeNull();

  const [, startXRaw, startYRaw, endXRaw, endYRaw] = match || [];
  const start = { x: Number(startXRaw), y: Number(startYRaw) };
  const end = { x: Number(endXRaw), y: Number(endYRaw) };
  const from = getNodeTranslate('a');
  const to = getNodeTranslate('b');
  const direction = from.x <= to.x ? 1 : -1;
  const edgeOffset = 100 + 8;

  expect(start).toEqual({
    x: from.x + direction * edgeOffset,
    y: from.y,
  });
  expect(end).toEqual({
    x: to.x - direction * edgeOffset,
    y: to.y,
  });
});

test('resolves collision for predecessor of a child node to avoid overlap with parent node', () => {
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        {
          id: 'a',
          text: 'Task A',
          direction: 'right',
          children: [
            { id: 'b', text: 'Task B', direction: 'right', children: [] }
          ]
        },
        {
          id: 'c',
          text: 'Task C',
          direction: 'left',
          children: []
        }
      ]
    },
    connections: [
      { id: 'conn-c-b', fromId: 'c', toId: 'b', type: 'dependency' }
    ]
  });

  const posA = getNodeTranslate('a');
  const posC = getNodeTranslate('c');

  // CはBの左(X=180)付近になり、AのX(240)と重なる範囲にある。
  // そのため、Y座標(Y=0)が衝突しないように、十分に離れて配置されていることを確認する。
  expect(Math.abs(posC.y - posA.y)).toBeGreaterThanOrEqual(170);
});

test('simple dependency chain: all nodes align on the same Y coordinate', () => {
  // C -> B -> A (dependency chain), all should be on the same Y (node.x)
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        { id: 'a', text: 'Task A', direction: 'right', children: [] },
        { id: 'b', text: 'Task B', direction: 'left', children: [] },
        { id: 'c', text: 'Task C', direction: 'left', children: [] },
      ]
    },
    connections: [
      { id: 'conn-b-a', fromId: 'b', toId: 'a', type: 'dependency' },
      { id: 'conn-c-b', fromId: 'c', toId: 'b', type: 'dependency' },
    ]
  });

  const posA = getNodeTranslate('a');
  const posB = getNodeTranslate('b');
  const posC = getNodeTranslate('c');

  // 一直線: 全ノードが同じ Y 座標（node.x → 描画上 Y）
  expect(posB.y).toBe(posA.y);
  expect(posC.y).toBe(posA.y);

  // 水平順序: C が最も左、A が最も右
  expect(posC.x).toBeLessThan(posB.x);
  expect(posB.x).toBeLessThan(posA.x);
});

test('dependency with child ticket: reserves vertical space for child', () => {
  // B has a child ticket B-child; B is a predecessor of A
  // B-child should get vertical space below B
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        { id: 'a', text: 'Task A', direction: 'right', children: [] },
        {
          id: 'b', text: 'Task B', direction: 'left',
          children: [
            { id: 'b-child', text: 'B Child', direction: 'left', children: [] }
          ]
        },
      ]
    },
    connections: [
      { id: 'conn-b-a', fromId: 'b', toId: 'a', type: 'dependency' },
    ]
  });

  const posA = getNodeTranslate('a');
  const posB = getNodeTranslate('b');
  const posBChild = getNodeTranslate('b-child');

  // B is to the left of A
  expect(posB.x).toBeLessThan(posA.x);

  // B-child is below B (node.x increases downward = y increases)
  expect(posBChild.y).toBeGreaterThan(posB.y);

  // B-child should not overlap with A
  const yDiff = Math.abs(posBChild.y - posA.y);
  const xDiff = Math.abs(posBChild.x - posA.x);
  // Either they are far enough apart vertically or horizontally
  expect(yDiff >= 170 || xDiff >= 240).toBe(true);
});

test('two-branch dependency: predecessors stack vertically with enough space', () => {
  // B1 and B2 are both predecessors of A -> they should stack vertically
  // A is placed as a child of P to be far enough from root to avoid collision interference
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        {
          id: 'p', text: 'Parent', direction: 'right',
          children: [
            { id: 'a', text: 'Task A', direction: 'right', children: [] },
          ]
        },
        { id: 'b1', text: 'Task B1', direction: 'left', children: [] },
        { id: 'b2', text: 'Task B2', direction: 'left', children: [] },
      ]
    },
    connections: [
      { id: 'conn-b1-a', fromId: 'b1', toId: 'a', type: 'dependency' },
      { id: 'conn-b2-a', fromId: 'b2', toId: 'a', type: 'dependency' },
    ]
  });

  const posA = getNodeTranslate('a');
  const posB1 = getNodeTranslate('b1');
  const posB2 = getNodeTranslate('b2');

  // Both predecessors are to the left of A
  expect(posB1.x).toBeLessThan(posA.x);
  expect(posB2.x).toBeLessThan(posA.x);

  // Both at the same horizontal depth
  expect(posB1.x).toBe(posB2.x);

  // They are vertically stacked with no overlap
  expect(Math.abs(posB1.y - posB2.y)).toBeGreaterThanOrEqual(170);
});

test('complex: two-branch dependency with child tickets reserves different space', () => {
  // B1 has a child (needs more vertical space), B2 has no children
  // Both are predecessors of A
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        { id: 'a', text: 'Task A', direction: 'right', children: [] },
        {
          id: 'b1', text: 'Task B1', direction: 'left',
          children: [
            { id: 'b1-child', text: 'B1 Child', direction: 'left', children: [] }
          ]
        },
        { id: 'b2', text: 'Task B2', direction: 'left', children: [] },
      ]
    },
    connections: [
      { id: 'conn-b1-a', fromId: 'b1', toId: 'a', type: 'dependency' },
      { id: 'conn-b2-a', fromId: 'b2', toId: 'a', type: 'dependency' },
    ]
  });

  const posB1 = getNodeTranslate('b1');
  const posB2 = getNodeTranslate('b2');
  const posB1Child = getNodeTranslate('b1-child');

  // B1 and B2 are at the same horizontal depth
  expect(posB1.x).toBe(posB2.x);

  // B1-child should not overlap with B2
  const childToB2Dist = Math.abs(posB1Child.y - posB2.y);
  expect(childToB2Dist).toBeGreaterThanOrEqual(170);

  // B1-child should be below B1
  expect(posB1Child.y).toBeGreaterThan(posB1.y);
});

test('layout: root has a bottom child and root dependency predecessor', () => {
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        { id: 'task-a', text: 'Task A', direction: 'right', children: [] },
        {
          id: 'task-b', text: 'Task B', direction: 'left',
          children: [
            { id: 'task-c', text: 'Task C', direction: 'left', children: [] }
          ]
        }
      ]
    },
    connections: [
      { id: 'conn-b-root', fromId: 'task-b', toId: 'root', type: 'dependency' }
    ]
  });

  const posRoot = getNodeTranslate('root');
  const posA = getNodeTranslate('task-a');
  const posB = getNodeTranslate('task-b');
  const posC = getNodeTranslate('task-c');

  // Root child is below root
  expect(posA.y).toBeGreaterThan(posRoot.y);

  // Root dependency predecessor is left of root
  expect(posB.x).toBeLessThan(posRoot.x);

  // Verify that C and A do not overlap:
  const yDiffAC = Math.abs(posA.y - posC.y);
  const xDiffAC = Math.abs(posA.x - posC.x);
  expect(yDiffAC >= 170 || xDiffAC >= 240).toBe(true);
});

test('layout regression: multiple predecessors of root', () => {
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        { id: 'b1', text: 'Task B1', direction: 'left', children: [] },
        { id: 'b2', text: 'Task B2', direction: 'left', children: [] },
      ]
    },
    connections: [
      { id: 'conn-b1-root', fromId: 'b1', toId: 'root', type: 'dependency' },
      { id: 'conn-b2-root', fromId: 'b2', toId: 'root', type: 'dependency' },
    ]
  });

  const posRoot = getNodeTranslate('root');
  const posB1 = getNodeTranslate('b1');
  const posB2 = getNodeTranslate('b2');

  // Both are to the left of Root
  expect(posB1.x).toBeLessThan(posRoot.x);
  expect(posB2.x).toBeLessThan(posRoot.x);

  // Stacked vertically with no overlap
  expect(Math.abs(posB1.y - posB2.y)).toBeGreaterThanOrEqual(170);
});

test('layout regression: multiple predecessors of a root child', () => {
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        {
          id: 'child-a', text: 'Child A', direction: 'right',
          children: []
        },
        { id: 'b1', text: 'Task B1', direction: 'left', children: [] },
        { id: 'b2', text: 'Task B2', direction: 'left', children: [] },
      ]
    },
    connections: [
      { id: 'conn-b1-a', fromId: 'b1', toId: 'child-a', type: 'dependency' },
      { id: 'conn-b2-a', fromId: 'b2', toId: 'child-a', type: 'dependency' },
    ]
  });

  const posA = getNodeTranslate('child-a');
  const posB1 = getNodeTranslate('b1');
  const posB2 = getNodeTranslate('b2');

  expect(posB1.x).toBeLessThan(posA.x);
  expect(posB2.x).toBeLessThan(posA.x);
  expect(Math.abs(posB1.y - posB2.y)).toBeGreaterThanOrEqual(170);
});

test('layout regression: dependency chain with children at different depths', () => {
  renderCanvas({
    data: {
      id: 'root',
      text: 'Root',
      children: [
        {
          id: 'a', text: 'Task A', direction: 'right',
          children: [
            { id: 'a-child', text: 'A Child', direction: 'right', children: [] }
          ]
        },
        {
          id: 'b', text: 'Task B', direction: 'left',
          children: [
            { id: 'b-child', text: 'B Child', direction: 'left', children: [] }
          ]
        },
      ]
    },
    connections: [
      { id: 'conn-b-a', fromId: 'b', toId: 'a', type: 'dependency' },
    ]
  });

  const posA = getNodeTranslate('a');
  const posAChild = getNodeTranslate('a-child');
  const posB = getNodeTranslate('b');
  const posBChild = getNodeTranslate('b-child');

  // Horizontally ordered
  expect(posB.x).toBeLessThan(posA.x);
  
  // Children are below their parents
  expect(posAChild.y).toBeGreaterThan(posA.y);
  expect(posBChild.y).toBeGreaterThan(posB.y);
});
