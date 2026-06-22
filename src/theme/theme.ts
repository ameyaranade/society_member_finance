import { createTheme, type Theme } from '@mui/material/styles';

export type ThemeMode = 'light' | 'dark';

const fontFamily = [
  '"Inter"',
  '"Noto Sans"',
  '"Noto Sans Devanagari"',
  '"Noto Sans Telugu"',
  '"Noto Sans Tamil"',
  'system-ui',
  'sans-serif',
].join(', ');

// Semantic palette tokens per DESIGN_LANGUAGE.md §4
const tokens = {
  light: {
    primary:    { main: '#185FA5', contrastText: '#FFFFFF' },
    background: { default: '#FFFFFF', paper: '#F7F6F2' },
    text:       { primary: '#1F1F1D', secondary: '#5F5E5A' },
    divider:    '#D3D1C7',
    appBar:     '#185FA5',
    focus:      '#185FA5',
    success:    { main: '#085041', light: '#E1F5EE', dark: '#064033', contrastText: '#FFFFFF' },
    warning:    { main: '#633806', light: '#FAEEDA', dark: '#4A2904', contrastText: '#FFFFFF' },
    error:      { main: '#791F1F', light: '#FCEBEB', dark: '#5A1717', contrastText: '#FFFFFF' },
    info:       { main: '#0C447C', light: '#E6F1FB', dark: '#083362', contrastText: '#FFFFFF' },
  },
  dark: {
    primary:    { main: '#85B7EB', contrastText: '#042C53' },
    background: { default: '#1E1F1C', paper: '#26271F' },
    text:       { primary: '#ECEAE3', secondary: '#B4B2A9' },
    divider:    '#444441',
    appBar:     '#0C447C',
    focus:      '#85B7EB',
    success:    { main: '#5DCAA5', light: '#0F3A2E', dark: '#3EA882', contrastText: '#042C53' },
    warning:    { main: '#FAC775', light: '#3A2F12', dark: '#D9A552', contrastText: '#042C53' },
    error:      { main: '#F09595', light: '#3A1414', dark: '#CC6F6F', contrastText: '#042C53' },
    info:       { main: '#85B7EB', light: '#0C2A45', dark: '#5E93C9', contrastText: '#042C53' },
  },
} as const;

export function getTheme(mode: ThemeMode): Theme {
  const t = tokens[mode];

  return createTheme({
    palette: {
      mode,
      primary:    t.primary,
      background: t.background,
      text:       t.text,
      divider:    t.divider,
      success:    t.success,
      warning:    t.warning,
      error:      t.error,
      info:       t.info,
    },

    typography: {
      fontFamily,
      fontWeightRegular: 400,
      fontWeightMedium:  500,
      fontWeightBold:    500,
      // Display / page title
      h4: { fontSize: '1.5rem',   fontWeight: 500, lineHeight: 1.3 },
      // Section title
      h5: { fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.4 },
      // Subtitle
      h6: { fontSize: '1rem',     fontWeight: 500, lineHeight: 1.5 },
      // Body (default)
      body1: { fontSize: '1rem',     fontWeight: 400, lineHeight: 1.6 },
      // Secondary / label
      body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
      // Caption (min 13px)
      caption: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.4 },
      // Buttons — no uppercase, sentence case
      button: { fontSize: '0.875rem', fontWeight: 500, textTransform: 'none' },
    },

    shape: { borderRadius: 8 },
    spacing: 8,

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*, *::before, *::after': { boxSizing: 'border-box' },
          ':focus-visible': {
            outline: `2px solid ${t.focus}`,
            outlineOffset: '2px',
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundColor: t.appBar, color: '#FFFFFF' },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            minHeight: 44,
            paddingInline: 20,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { minWidth: 44, minHeight: 44 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0, variant: 'outlined' },
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: { borderRadius: 12 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { fontSize: '0.875rem' },
        },
      },
    },
  });
}
