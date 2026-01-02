import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Header from '../Header';

test('renders title and allows edit', async () => {
  const user = userEvent.setup();
  const onUpdateTitle = vi.fn();

  render(<Header title="Initial" onUpdateTitle={onUpdateTitle} />);

  expect(screen.getByText('Initial')).toBeInTheDocument();

  await user.dblClick(screen.getByText('Initial'));
  const input = screen.getByRole('textbox');
  await user.clear(input);
  await user.type(input, 'Updated{enter}');

  expect(onUpdateTitle).toHaveBeenCalledWith('Updated');
});
