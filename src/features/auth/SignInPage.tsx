import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  type AuthError,
} from 'firebase/auth';
import {
  Box,
  Button,
  Divider,
  Link,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { useAuth } from './useAuth';

const googleProvider = new GoogleAuthProvider();

function getErrorMessage(err: AuthError): string {
  switch (err.code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 8 characters.';
    default:
      return err.message;
  }
}

export default function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true });
  }, [user, loading, navigate]);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(getErrorMessage(err as AuthError));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(getErrorMessage(err as AuthError));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName.trim()) {
        await updateProfile(cred.user, { displayName: displayName.trim() });
      }
      await sendEmailVerification(cred.user);
      setInfo('Account created! Please check your email and click the verification link before signing in.');
      setMode('signin');
    } catch (err) {
      setError(getErrorMessage(err as AuthError));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setInfo(t('auth.resetEmailSent'));
      setMode('signin');
    } catch (err) {
      setError(getErrorMessage(err as AuthError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      px={2}
      bgcolor="background.default"
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 400,
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
        }}
      >
        <Typography variant="h5" fontWeight={500} mb={3}>
          {mode === 'signin' ? t('auth.signIn') : mode === 'register' ? t('auth.createAccount') : t('auth.resetPassword')}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info  && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

        <Box
          component="form"
          onSubmit={mode === 'signin' ? handleEmailSignIn : mode === 'register' ? handleRegister : handleReset}
          display="flex"
          flexDirection="column"
          gap={2}
        >
          <TextField
            label={t('auth.email')}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          {mode === 'register' && (
            <TextField
              label="Full name"
              required
              autoComplete="name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
            />
          )}

          {mode !== 'reset' && (
            <TextField
              label={t('auth.password')}
              type="password"
              required
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          )}

          {mode === 'register' && (
            <TextField
              label="Confirm password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          )}

          <Button type="submit" variant="contained" disabled={busy} fullWidth>
            {mode === 'signin' ? t('auth.signIn') : mode === 'register' ? t('auth.createAccount') : t('auth.resetPassword')}
          </Button>
        </Box>

        {mode === 'signin' && (
          <>
            <Box textAlign="right" mt={1}>
              <Link
                component="button"
                variant="body2"
                onClick={() => { setMode('reset'); setError(''); }}
              >
                {t('auth.forgotPassword')}
              </Link>
            </Box>

            <Divider sx={{ my: 2 }}>or</Divider>

            <Button variant="outlined" fullWidth disabled={busy} onClick={handleGoogle}>
              {t('auth.signInWithGoogle')}
            </Button>

            <Box textAlign="center" mt={2}>
              <Typography variant="body2" color="text.secondary" component="span">
                New user?{' '}
              </Typography>
              <Link
                component="button"
                variant="body2"
                onClick={() => { setMode('register'); setError(''); }}
              >
                Create account
              </Link>
            </Box>
          </>
        )}

        {mode === 'register' && (
          <Box mt={2} textAlign="center">
            <Typography variant="body2" color="text.secondary" component="span">
              Already have an account?{' '}
            </Typography>
            <Link
              component="button"
              variant="body2"
              onClick={() => { setMode('signin'); setError(''); }}
            >
              Sign in
            </Link>
          </Box>
        )}

        {mode === 'reset' && (
          <Box mt={2} textAlign="center">
            <Link
              component="button"
              variant="body2"
              onClick={() => { setMode('signin'); setError(''); setInfo(''); }}
            >
              {t('common.back')} to sign in
            </Link>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
