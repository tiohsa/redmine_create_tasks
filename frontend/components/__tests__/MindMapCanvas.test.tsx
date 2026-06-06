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
    onDeleteConnection: vi.fn(),
    onDetachNode: vi.fn(),
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
