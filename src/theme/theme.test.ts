import { describe, it, expect } from 'vitest';
import { getTheme } from './theme';

describe('getTheme', () => {
  it('returns a light theme', () => {
    expect(getTheme('light').palette.mode).toBe('light');
  });

  it('returns a dark theme', () => {
    expect(getTheme('dark').palette.mode).toBe('dark');
  });
});
