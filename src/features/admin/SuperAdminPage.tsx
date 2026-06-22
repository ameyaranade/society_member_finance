import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import RequireRole from '../auth/RequireRole';

interface CreateSocietyInput {
  societyId: string;
  name: string;
  address?: string;
  registrationNo?: string;
  totalUnits: number;
  adminEmail: string;
}

const createSocietyFn = httpsCallable<CreateSocietyInput, { societyId: string }>(
  functions,
  'createSociety',
);

function CreateSocietyForm() {
  const [form, setForm] = useState({
    societyId: '',
    name: '',
    address: '',
    registrationNo: '',
    totalUnits: '',
    adminEmail: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const result = await createSocietyFn({
        societyId: form.societyId.trim(),
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        registrationNo: form.registrationNo.trim() || undefined,
        totalUnits: Number(form.totalUnits),
        adminEmail: form.adminEmail.trim(),
      });
      setSuccess(
        `Society "${result.data.societyId}" created. ` +
        `Invite sent to ${form.adminEmail} — they can sign in with that email.`,
      );
      setForm({ societyId: '', name: '', address: '', registrationNo: '', totalUnits: '', adminEmail: '' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
      {error   && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <TextField
        label="Society ID"
        helperText="Lowercase letters, numbers, hyphens. E.g. nbh-bangalore"
        required
        value={form.societyId}
        onChange={update('societyId')}
        inputProps={{ pattern: '[a-z0-9-]{3,40}' }}
      />
      <TextField label="Society name" required value={form.name} onChange={update('name')} />
      <TextField label="Address" multiline rows={2} value={form.address} onChange={update('address')} />
      <TextField label="Registration number" value={form.registrationNo} onChange={update('registrationNo')} />
      <TextField
        label="Total units"
        type="number"
        required
        inputProps={{ min: 1 }}
        value={form.totalUnits}
        onChange={update('totalUnits')}
      />
      <TextField
        label="First admin email"
        type="email"
        required
        helperText="This person will receive admin access when they first sign in."
        value={form.adminEmail}
        onChange={update('adminEmail')}
      />
      <Button type="submit" variant="contained" disabled={busy}>
        Create society
      </Button>
    </Box>
  );
}

export default function SuperAdminPage() {
  const { isSuperAdmin } = useAuth();

  if (!isSuperAdmin) {
    return (
      <RequireRole roles={[]}>
        <></>
      </RequireRole>
    );
  }

  return (
    <Box maxWidth={520}>
      <Typography variant="h4" gutterBottom>
        Platform administration
      </Typography>
      <Typography color="text.secondary" mb={3}>
        Create new societies and onboard their first admin.
      </Typography>

      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="h5" mb={2}>
          New society
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <CreateSocietyForm />
      </Paper>
    </Box>
  );
}
