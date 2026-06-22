import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeModeProvider } from './theme/ThemeContext';
import App from './App';

describe('App', () => {
  it('renders the project heading', () => {
    render(
      <ThemeModeProvider>
        <App />
      </ThemeModeProvider>,
    );
    expect(screen.getByRole('heading', { name: /society finance/i })).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    render(
      <ThemeModeProvider>
        <App />
      </ThemeModeProvider>,
    );
    expect(screen.getByRole('button', { name: /switch to .* mode/i })).toBeInTheDocument();
  });
});
