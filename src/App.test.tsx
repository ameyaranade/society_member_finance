import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeModeProvider } from './theme/ThemeContext';
import Shell from './app/Shell';

function renderShell(path = '/') {
  return render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Shell />
      </MemoryRouter>
    </ThemeModeProvider>,
  );
}

describe('Shell', () => {
  it('renders the app bar heading', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: /society finance/i })).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /switch to .* mode/i })).toBeInTheDocument();
  });

  it('renders nav links', () => {
    renderShell();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Payables')).toBeInTheDocument();
  });
});
