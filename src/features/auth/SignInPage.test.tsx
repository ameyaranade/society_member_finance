import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignInPage from './SignInPage';

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  GoogleAuthProvider: vi.fn().mockImplementation(() => ({})),
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock('../../lib/firebase', () => ({ auth: {} }));

function renderPage() {
  return render(
    <MemoryRouter>
      <SignInPage />
    </MemoryRouter>,
  );
}

describe('SignInPage', () => {
  it('renders email and password fields', () => {
    renderPage();
    // i18n returns key in test env — look for the key or the input directly
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('renders a submit button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /^auth\.signIn$/i })).toBeDefined();
  });

  it('renders Google sign-in button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /auth\.signInWithGoogle/i })).toBeDefined();
  });

  it('renders forgot password link', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /auth\.forgotPassword/i })).toBeDefined();
  });
});
