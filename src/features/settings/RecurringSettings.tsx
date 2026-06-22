import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
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
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FormDrawer from '../../components/FormDrawer';
import ConfirmModal from '../../components/ConfirmModal';
import { useRecurringPayments } from './useRecurringPayments';
import { useAccounts } from './useAccounts';
import { useVendors } from './useVendors';
import { useAuth } from '../auth/useAuth';
import { formatMoney, toPaise, fromPaise } from '../../lib/money';
import type { RecurringPayment, RecurringCategory } from '../../types/ledger';
import type { FundCode } from '../../types/config';

const CATEGORIES: { value: RecurringCategory; label: string }[] = [
  { value: 'maintenance',  label: 'Maintenance' },
  { value: 'utility',      label: 'Utility' },
  { value: 'staff',        label: 'Staff' },
  { value: 'security',     label: 'Security' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'other',        label: 'Other' },
];

const FUND_CODES: { value: FundCode; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'sinking', label: 'Sinking' },
  { value: 'corpus',  label: 'Corpus' },
  { value: 'repair',  label: 'Repair' },
];

interface FormState {
  name: string;
  category: RecurringCategory;
  vendorId: string;
  amountRupees: string;
  dueDay: string;
  fundHead: FundCode;
  accountId: string;
  active: boolean;
  startYearMonth: string;
  endYearMonth: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category: 'maintenance',
  vendorId: '',
  amountRupees: '',
  dueDay: '1',
  fundHead: 'general',
  accountId: '',
  active: true,
  startYearMonth: '',
  endYearMonth: '',
  description: '',
};

function toFormState(r: RecurringPayment): FormState {
  return {
    name: r.name,
    category: r.category,
    vendorId: r.vendorId ?? '',
    amountRupees: String(fromPaise(r.amountPaise)),
    dueDay: String(r.dueDay),
    fundHead: r.fundHead,
    accountId: r.accountId,
    active: r.active,
    startYearMonth: r.startYearMonth,
    endYearMonth: r.endYearMonth ?? '',
    description: r.description ?? '',
  };
}

export default function RecurringSettings() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const { recurringPayments, loading, createRecurringPayment, updateRecurringPayment, toggleActive, deleteRecurringPayment } =
    useRecurringPayments();
  const { accounts } = useAccounts();
  const { vendors } = useVendors();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringPayment | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<RecurringPayment | null>(null);

  function set(patch: Partial<FormState>) {
    setForm(f => ({ ...f, ...patch }));
  }

  function openCreate() {
    const now = new Date();
    const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setEditing(null);
    setForm({ ...EMPTY_FORM, startYearMonth: defaultStart, accountId: accounts[0]?.id ?? '' });
    setFormError('');
    setDrawerOpen(true);
  }

  function openEdit(r: RecurringPayment) {
    setEditing(r);
    setForm(toFormState(r));
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    const rupees = parseFloat(form.amountRupees);
    const dueDay = parseInt(form.dueDay, 10);

    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    if (isNaN(rupees) || rupees <= 0) { setFormError('Amount must be a positive number.'); return; }
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 28) { setFormError('Due day must be 1–28.'); return; }
    if (!form.accountId) { setFormError('Account is required.'); return; }
    if (!form.startYearMonth.match(/^\d{4}-\d{2}$/)) { setFormError('Start month must be YYYY-MM.'); return; }
    if (form.endYearMonth && !form.endYearMonth.match(/^\d{4}-\d{2}$/)) {
      setFormError('End month must be YYYY-MM.'); return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const data = {
        name: form.name.trim(),
        category: form.category,
        amountPaise: toPaise(rupees),
        dueDay,
        fundHead: form.fundHead,
        accountId: form.accountId,
        active: form.active,
        startYearMonth: form.startYearMonth,
        ...(form.vendorId ? { vendorId: form.vendorId } : {}),
        ...(form.endYearMonth ? { endYearMonth: form.endYearMonth } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      };
      if (editing) await updateRecurringPayment(editing.id, data);
      else await createRecurringPayment(data);
      setDrawerOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? '—';
  const vendorName  = (id: string) => vendors.find(v => v.id === id)?.name ?? '—';

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <div>
          <Typography variant="subtitle1" fontWeight={500}>Recurring payments</Typography>
          <Typography variant="body2" color="text.secondary">
            Monthly templates that generate payment instances. Managed by Admin.
          </Typography>
        </div>
        {isAdmin && (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add template
          </Button>
        )}
      </Stack>

      {recurringPayments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No recurring payment templates yet.</Typography>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Due</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Active</TableCell>
                {isAdmin && <TableCell width={80} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {recurringPayments.map(r => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Stack>
                      <Typography variant="body2" fontWeight={500}>{r.name}</Typography>
                      {r.vendorId && (
                        <Typography variant="caption" color="text.secondary">{vendorName(r.vendorId)}</Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}
                      size="small" variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatMoney(r.amountPaise)}</TableCell>
                  <TableCell>Day {r.dueDay}</TableCell>
                  <TableCell>{accountName(r.accountId)}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch
                        size="small"
                        checked={r.active}
                        onChange={e => toggleActive(r.id, e.target.checked)}
                        inputProps={{ 'aria-label': r.active ? 'Active' : 'Inactive' }}
                      />
                    ) : (
                      <Chip label={r.active ? 'Active' : 'Inactive'} size="small"
                        color={r.active ? 'success' : 'default'} />
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(r)} aria-label="Edit template">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteTarget(r)} aria-label="Delete template">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
        title={editing ? 'Edit template' : 'Add recurring payment'}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editing ? 'Save' : 'Add'}
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <TextField
            label="Name" required autoFocus size="small"
            value={form.name} onChange={e => set({ name: e.target.value })}
          />

          <Stack direction="row" spacing={1}>
            <TextField
              select label="Category" size="small" sx={{ flex: 1 }}
              value={form.category} onChange={e => set({ category: e.target.value as RecurringCategory })}
            >
              {CATEGORIES.map(c => (
                <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select label="Vendor (optional)" size="small" sx={{ flex: 1 }}
              value={form.vendorId} onChange={e => set({ vendorId: e.target.value })}
            >
              <MenuItem value=""><em>None</em></MenuItem>
              {vendors.map(v => (
                <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Amount (₹)" type="number" required size="small" sx={{ flex: 1 }}
              inputProps={{ min: 0.01, step: 0.01 }}
              value={form.amountRupees} onChange={e => set({ amountRupees: e.target.value })}
            />
            <TextField
              label="Due day" type="number" required size="small" sx={{ width: 110 }}
              inputProps={{ min: 1, max: 28 }}
              value={form.dueDay} onChange={e => set({ dueDay: e.target.value })}
              helperText="1–28"
            />
          </Stack>

          <Stack direction="row" spacing={1}>
            <TextField
              select label="Fund head" size="small" sx={{ flex: 1 }}
              value={form.fundHead} onChange={e => set({ fundHead: e.target.value as FundCode })}
            >
              {FUND_CODES.map(f => (
                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select label="Account" required size="small" sx={{ flex: 1 }}
              value={form.accountId} onChange={e => set({ accountId: e.target.value })}
            >
              {accounts.map(a => (
                <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction="row" spacing={1}>
            <TextField
              label="Start month" required size="small" placeholder="YYYY-MM" sx={{ flex: 1 }}
              value={form.startYearMonth} onChange={e => set({ startYearMonth: e.target.value })}
            />
            <TextField
              label="End month (optional)" size="small" placeholder="YYYY-MM" sx={{ flex: 1 }}
              value={form.endYearMonth} onChange={e => set({ endYearMonth: e.target.value })}
            />
          </Stack>

          <TextField
            label="Description (optional)" size="small" multiline rows={2}
            value={form.description} onChange={e => set({ description: e.target.value })}
          />

          <FormControlLabel
            control={
              <Switch checked={form.active} onChange={e => set({ active: e.target.checked })} />
            }
            label="Active (generate instances)"
          />
        </Stack>
      </FormDrawer>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete template"
        description={`Delete "${deleteTarget?.name}"? Future instances will no longer be generated.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => { await deleteRecurringPayment(deleteTarget!.id); setDeleteTarget(null); }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
