import { createContext } from 'react';
import type { ThemeMode } from './theme';

export interface ThemeModeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);
