import { Box, Typography, Button } from '@mui/material';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';

export default function NoSociety() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate('/sign-in', { replace: true });
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
      px={2}
      textAlign="center"
    >
      <Typography variant="h5">No society assigned</Typography>
      <Typography color="text.secondary" maxWidth={400}>
        Your account hasn't been linked to a society yet. Contact your society
        administrator or the platform super-admin.
      </Typography>
      <Button variant="outlined" onClick={handleSignOut}>
        Sign out
      </Button>
    </Box>
  );
}
