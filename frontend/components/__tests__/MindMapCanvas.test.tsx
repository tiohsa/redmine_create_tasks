import { render, screen } from '@testing-library/react';
import MindMapCanvas from '../MindMapCanvas';
import { MindMapNode } from '../../types';

test('renders root node text', () => {
  const data: MindMapNode = {
    id: 'root',
    text: 'Root',
    children: [],
  };

  render(
    <MindMapCanvas
      data={data}
      connections={[]}
      selectedNodeId={null}
      editingNodeId={null}
      onSelectNode={() => undefined}
      onUpdateNodeData={() => undefined}
      onAddNode={() => undefined}
      onDeleteNode={() => undefined}
      onSetEditingId={() => undefined}
      onAddConnection={() => undefined}
      onDeleteConnection={() => undefined}
    />
  );

  expect(screen.getByText('Root')).toBeInTheDocument();
});
