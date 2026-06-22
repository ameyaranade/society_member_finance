import { Box, Button, Container, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { firebaseReady } from './lib/firebase';
import { useThemeMode } from './theme/useThemeMode';

export default function App() {
  const { mode, toggleMode } = useThemeMode();

  return (
    <Container maxWidth="sm">
      <Stack spacing={2} sx={{ py: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h4">Society Finance</Typography>
          <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton onClick={toggleMode} color="inherit">
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        <Typography color="text.secondary">
          Scaffold online. Project: {firebaseReady.projectId}.
        </Typography>
        <Box>
          <Button variant="contained">Primary action</Button>
        </Box>
      </Stack>
    </Container>
  );
}
