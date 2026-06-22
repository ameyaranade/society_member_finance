import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FormDrawer from '../../components/FormDrawer';
import ConfirmModal from '../../components/ConfirmModal';
import { useFundHeads } from './useFundHeads';
import { useAuth } from '../auth/useAuth';
import type { FundHead, FundCode } from '../../types/config';

const FUND_CODES: { value: FundCode; label: string; description: string }[] = [
  { value: 'general',  label: 'General',  description: 'Day-to-day operating expenses' },
  { value: 'sinking',  label: 'Sinking',  description: 'Reserved for major replacements' },
  { value: 'corpus',   label: 'Corpus',   description: 'Permanent corpus fund' },
  { value: 'repair',   label: 'Repair',   description: 'Maintenance and repair work' },
];

const CODE_COLOR: Record<FundCode, 'default' | 'primary' | 'secondary' | 'success'> = {
  general: 'default',
  sinking: 'primary',
  corpus:  'secondary',
  repair:  'success',
};

interface FormState { name: string; code: FundCode; description: string }
const EMPTY: FormState = { name: '', code: 'general', description: '' };

export default function FundHeadsSettings() {
  const { fundHeads, loading, createFundHead, updateFundHead, deleteFundHead } = useFundHeads();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<FundHead | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FundHead | null>(null);

  function openCreate() {
    setEditing(null); setForm(EMPTY); setFormError(''); setDrawerOpen(true);
  }
  function openEdit(f: FundHead) {
    setEditing(f);
    setForm({ name: f.name, code: f.code, description: f.description ?? '' });
    setFormError(''); setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const data: { name: string; code: FundCode; description?: string } = { name: form.name.trim(), code: form.code };
      if (form.description.trim()) data.description = form.description.trim();
      if (editing) await updateFundHead(editing.id, data);
      else await createFundHead(data);
      setDrawerOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={500}>Fund heads</Typography>
        {isAdmin && (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add fund head
          </Button>
        )}
      </Stack>

      {fundHeads.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No fund heads yet.</Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Description</TableCell>
                {isAdmin && <TableCell width={80} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {fundHeads.map(f => (
                <TableRow key={f.id} hover>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>
                    <Chip label={f.code} color={CODE_COLOR[f.code]} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{f.description ?? '—'}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit(f)} aria-label="Edit fund head">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(f)} aria-label="Delete fund head" color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <FormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit fund head' : 'Add fund head'}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editing ? 'Save' : 'Add'}
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Fund head name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required autoFocus size="small"
          />
          <TextField
            select label="Category"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value as FundCode }))}
            size="small"
          >
            {FUND_CODES.map(c => (
              <MenuItem key={c.value} value={c.value}>
                <Stack>
                  <span>{c.label}</span>
                  <Typography variant="caption" color="text.secondary">{c.description}</Typography>
                </Stack>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Description (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            size="small" multiline rows={2}
          />
        </Stack>
      </FormDrawer>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete fund head"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => { await deleteFundHead(deleteTarget!.id); setDeleteTarget(null); }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
