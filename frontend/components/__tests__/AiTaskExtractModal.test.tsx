import { render, screen } from '@testing-library/react';
import { vi, test, expect } from 'vitest';
import AiTaskExtractModal from '../AiTaskExtractModal';
import { AiTask } from '../../types';

const defaultProps = {
  open: true,
  provider: 'gemini' as const,
  prompt: 'default prompt',
  tasks: [{ subject: 'A' }, { subject: 'B' }, { subject: 'C' }] as AiTask[],
  loading: false,
  error: null,
  onProviderChange: vi.fn(),
  onPromptChange: vi.fn(),
  onConfirm: vi.fn(),
  onGenerate: vi.fn(),
  onSaveSettings: vi.fn(),
  onLoadDefaults: vi.fn(),
  onClose: vi.fn(),
};

test('renders prompt editor and tasks list', () => {
  render(<AiTaskExtractModal {...defaultProps} />);

  expect(screen.getByText('AI Provider')).toBeInTheDocument();
  expect(screen.getByDisplayValue('default prompt')).toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();
});

test('renders error message when provided', () => {
  render(
    <AiTaskExtractModal
      {...defaultProps}
      error="失敗しました"
    />
  );

  expect(screen.getByText('失敗しました')).toBeInTheDocument();
});
