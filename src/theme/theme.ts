import { createTheme, type Theme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

// Placeholder theme. Full semantic tokens (DESIGN_LANGUAGE.md) land in S1.1.
export function getTheme(mode: ThemeMode): Theme {
  return createTheme({
    palette: { mode },
    typography: {
      fontFamily: ['Inter', 'Noto Sans', 'system-ui', 'sans-serif'].join(','),
    },
  });
}
