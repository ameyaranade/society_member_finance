import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeModeProvider } from '../theme/ThemeContext';
import StatusChip from './StatusChip';

function wrap(ui: React.ReactElement) {
  return render(<ThemeModeProvider>{ui}</ThemeModeProvider>);
}

describe('StatusChip', () => {
  it('renders label and icon for approved', () => {
    wrap(<StatusChip status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders label for every status variant', () => {
    const cases: [Parameters<typeof StatusChip>[0]['status'], string][] = [
      ['approved', 'Approved'],
      ['requested', 'Requested'],
      ['scheduled', 'Scheduled'],
      ['disbursed', 'In progress'],
      ['completed', 'Completed'],
      ['withdrawn', 'Withdrawn'],
    ];
    for (const [status, label] of cases) {
      const { unmount } = wrap(<StatusChip status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });
});
