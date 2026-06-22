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
import { useAccounts } from './useAccounts';
import { useAuth } from '../auth/useAuth';
import { formatMoney, toPaise, fromPaise } from '../../lib/money';
import type { Account, AccountType } from '../../types/config';

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'bank',    label: 'Bank account' },
  { value: 'cash',    label: 'Petty cash' },
  { value: 'sinking', label: 'Sinking fund' },
  { value: 'petty',   label: 'Petty fund' },
];

const TYPE_COLORS: Record<AccountType, 'primary' | 'secondary' | 'success' | 'warning'> = {
  bank:    'primary',
  cash:    'success',
  sinking: 'secondary',
  petty:   'warning',
};

interface FormState {
  name: string;
  type: AccountType;
  openingBalanceRupees: string;
}

const EMPTY_FORM: FormState = { name: '', type: 'bank', openingBalanceRupees: '0' };

export default function AccountsSettings() {
  const { accounts, loading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDrawerOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({
      name: a.name,
      type: a.type,
      openingBalanceRupees: String(fromPaise(a.openingBalancePaise)),
    });
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    const rupees = parseFloat(form.openingBalanceRupees);
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (isNaN(rupees) || rupees < 0) { setFormError('Enter a valid opening balance.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const openingBalancePaise = toPaise(rupees);
      if (editing) {
        await updateAccount(editing.id, { name: form.name.trim(), type: form.type, openingBalancePaise });
      } else {
        await createAccount({ name: form.name.trim(), type: form.type, openingBalancePaise });
      }
      setDrawerOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteAccount(deleteTarget.id);
    setDeleteTarget(null);
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={500}>Cash accounts</Typography>
        {isAdmin && (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add account
          </Button>
        )}
      </Stack>

      {accounts.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No accounts yet. Add a bank account to get started.</Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Opening balance</TableCell>
                <TableCell align="right">Current balance</TableCell>
                {isAdmin && <TableCell width={80} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={ACCOUNT_TYPES.find(t => t.value === a.type)?.label ?? a.type}
                      color={TYPE_COLORS[a.type]}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">{formatMoney(a.openingBalancePaise)}</TableCell>
                  <TableCell align="right">{formatMoney(a.currentBalancePaise)}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <IconButton size="small" onClick={() => openEdit(a)} aria-label="Edit account">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => setDeleteTarget(a)} aria-label="Delete account" color="error">
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
        title={editing ? 'Edit account' : 'Add account'}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editing ? 'Save' : 'Add'}
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Account name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            autoFocus
            size="small"
          />
          <TextField
            select
            label="Account type"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
            size="small"
          >
            {ACCOUNT_TYPES.map(t => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Opening balance (₹)"
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            value={form.openingBalanceRupees}
            onChange={e => setForm(f => ({ ...f, openingBalanceRupees: e.target.value }))}
            size="small"
            helperText="Amount in rupees"
          />
        </Stack>
      </FormDrawer>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete account"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
