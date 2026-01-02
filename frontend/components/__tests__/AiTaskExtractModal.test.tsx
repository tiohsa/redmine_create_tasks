import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AiTaskExtractModal from '../AiTaskExtractModal';

test('renders prompt editor and tasks list', () => {
  render(
    <AiTaskExtractModal
      open
      prompt="default prompt"
      tasks={["A", "B", "C"]}
      loading={false}
      error={null}
      onPromptChange={vi.fn()}
      onConfirm={vi.fn()}
      onRetry={vi.fn()}
      onClose={vi.fn()}
    />
  );

  expect(screen.getByText('AIタスク抽出')).toBeInTheDocument();
  expect(screen.getByDisplayValue('default prompt')).toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();
});

test('allows retry on error', async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();

  render(
    <AiTaskExtractModal
      open
      prompt="default prompt"
      tasks={[]}
      loading={false}
      error="失敗しました"
      onPromptChange={vi.fn()}
      onConfirm={vi.fn()}
      onRetry={onRetry}
      onClose={vi.fn()}
    />
  );

  await user.click(screen.getByRole('button', { name: '再試行' }));
  expect(onRetry).toHaveBeenCalled();
});
