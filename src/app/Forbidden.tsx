import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function Forbidden() {
  const navigate = useNavigate();
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <Typography variant="h4">Access denied</Typography>
      <Typography color="text.secondary">
        You don't have permission to view this page.
      </Typography>
      <Button variant="outlined" onClick={() => navigate('/')}>
        Go to dashboard
      </Button>
    </Box>
  );
}
