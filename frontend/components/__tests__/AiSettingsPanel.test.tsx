import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AiSettingsPanel from '../AiSettingsPanel';

test('renders provider options and prompt field', () => {
  render(
    <AiSettingsPanel
      provider="gemini"
      prompt="default prompt"
      onProviderChange={vi.fn()}
      onPromptChange={vi.fn()}
      onSave={vi.fn()}
    />
  );

  expect(screen.getByLabelText('AI提供元')).toBeInTheDocument();
  expect(screen.getByDisplayValue('default prompt')).toBeInTheDocument();
});

test('saves settings', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();

  render(
    <AiSettingsPanel
      provider="gemini"
      prompt="default prompt"
      onProviderChange={vi.fn()}
      onPromptChange={vi.fn()}
      onSave={onSave}
    />
  );

  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(onSave).toHaveBeenCalled();
});
