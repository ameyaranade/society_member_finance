import { useState, useEffect } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { useSettings } from './useSettings';
import { useAuth } from '../auth/useAuth';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function GeneralSettings() {
  const { config, loading, updateConfig } = useSettings();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [fyStartMonth, setFyStartMonth] = useState(4);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (config) setFyStartMonth(config.fyStartMonth ?? 4);
  }, [config]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await updateConfig({ fyStartMonth });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <Stack spacing={3} maxWidth={480}>
      <TextField
        label="Currency"
        value={config?.currency ?? 'INR'}
        disabled
        helperText="Currency is fixed to INR for v1"
        size="small"
      />

      <TextField
        select
        label="Financial year start month"
        value={fyStartMonth}
        onChange={e => setFyStartMonth(Number(e.target.value))}
        disabled={!isAdmin}
        size="small"
        helperText="e.g. April → FY runs Apr–Mar"
      >
        {MONTHS.map(m => (
          <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
        ))}
      </TextField>

      {error && <Alert severity="error">{error}</Alert>}
      {saved && <Alert severity="success">Saved.</Alert>}

      {isAdmin && (
        <Stack direction="row">
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Save
          </Button>
        </Stack>
      )}

      {!isAdmin && (
        <Typography variant="body2" color="text.secondary">
          Only admins can change society settings.
        </Typography>
      )}
    </Stack>
  );
}
