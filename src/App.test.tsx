import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeModeProvider } from './theme/ThemeContext';
import { AuthContext } from './features/auth/authContext';
import Shell from './app/Shell';
import type { AuthContextValue } from './features/auth/authContext';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(() => () => {}),
  signOut: vi.fn(),
  getAuth: vi.fn(() => ({})),
}));
vi.mock('./lib/firebase', () => ({ auth: {}, app: {}, functions: {} }));

const mockAuthValue: AuthContextValue = {
  user: { email: 'test@test.com' } as never,
  claims: { societyId: 'soc1', role: 'admin' },
  societyId: 'soc1',
  role: 'admin',
  isSuperAdmin: false,
  loading: false,
};

function renderShell(path = '/') {
  return render(
    <ThemeModeProvider>
      <AuthContext.Provider value={mockAuthValue}>
        <MemoryRouter initialEntries={[path]}>
          <Shell />
        </MemoryRouter>
      </AuthContext.Provider>
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
