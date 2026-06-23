import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import PaidIcon from '@mui/icons-material/Paid';
import AddIcon from '@mui/icons-material/Add';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useRecurringInstances, useProjectedInstances } from './useRecurringInstances';
import { useExpenseRequests } from './useExpenseRequests';
import { useRequestedQueue } from './useRequestedQueue';
import { useAccounts } from '../settings/useAccounts';
import { useAuth } from '../auth/useAuth';
import { formatMoney } from '../../lib/money';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import type { RecurringInstance, RecurringInstanceStatus } from '../../types/ledger';
import type { PaymentMode } from '../../types/ledger';
import type { ExpenseRequest, ExpenseRequestStatus } from '../../types/requests';
import MaintenanceCreateDrawer from './MaintenanceCreateDrawer';
import SnagScheduleDrawer from './SnagScheduleDrawer';
import SnagTakeUpDrawer from './SnagTakeUpDrawer';
import RequestNotesDialog from './RequestNotesDialog';
import DisbursementDialog from './DisbursementDialog';
import RequestDetailDrawer from './RequestDetailDrawer';

const withdrawFn   = httpsCallable<{ requestId: string }, { ok: true }>(functions, 'withdrawExpenseRequest');
const approveFn    = httpsCallable<{ requestId: string; note?: string }, { ok: true; approved: boolean }>(functions, 'recordApproval');
const closeFn      = httpsCallable<{ requestId: string; closingNote?: string }, { ok: true }>(functions, 'closeExpenseRequest');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

function formatDueDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function formatDate(ts: unknown): string {
  if (!ts) return '—';
  const millis = (ts as { toMillis?: () => number }).toMillis?.();
  if (!millis) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(millis));
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tsMillis(ts: unknown): number {
  return (ts as { toMillis?: () => number })?.toMillis?.() ?? 0;
}

// ─── Recurring: Status chip ───────────────────────────────────────────────────

const RECURRING_STATUS_CONFIG: Record<
  RecurringInstanceStatus | 'projected',
  { label: string; color: 'warning' | 'success' | 'default'; icon: React.ReactNode }
> = {
  pending:   { label: 'Pending',   color: 'warning', icon: <ScheduleIcon fontSize="small" /> },
  paid:      { label: 'Paid',      color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  skipped:   { label: 'Skipped',   color: 'default', icon: <RemoveCircleOutlineIcon fontSize="small" /> },
  projected: { label: 'Projected', color: 'default', icon: <HorizontalRuleIcon fontSize="small" /> },
};

function RecurringStatusChip({ status }: { status: RecurringInstanceStatus | 'projected' }) {
  const cfg = RECURRING_STATUS_CONFIG[status];
  return (
    <Chip label={cfg.label} color={cfg.color} size="small"
      icon={cfg.icon as React.ReactElement}
      variant={status === 'projected' ? 'outlined' : 'filled'} />
  );
}

// ─── Expense-request status chip ─────────────────────────────────────────────

const REQ_STATUS: Record<ExpenseRequestStatus, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  scheduled: { label: 'Scheduled',        color: 'default'  },
  requested: { label: 'Pending approval', color: 'warning'  },
  approved:  { label: 'Approved',         color: 'info'     },
  disbursed: { label: 'Disbursed',        color: 'info'     },
  completed: { label: 'Completed',        color: 'success'  },
  withdrawn: { label: 'Withdrawn',        color: 'error'    },
};

function RequestStatusChip({ status }: { status: ExpenseRequestStatus }) {
  const cfg = REQ_STATUS[status] ?? { label: status, color: 'default' };
  return <Chip label={cfg.label} color={cfg.color} size="small" />;
}

// ─── Pay dialog (recurring) ───────────────────────────────────────────────────

const MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash',   label: 'Cash' },
  { value: 'upi',    label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank',   label: 'Bank transfer' },
];

function PayDialog({ instance, onClose, onPaid }: {
  instance: RecurringInstance | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [mode,        setMode]        = useState<PaymentMode>('cash');
  const [date,        setDate]        = useState(todayISO());
  const [referenceNo, setReferenceNo] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  if (!instance) return null;

  async function handlePay() {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { setError('Invalid date.'); return; }
    setSubmitting(true); setError('');
    try {
      const { auth } = await import('../../lib/firebase');
      const idToken = await auth.currentUser?.getIdToken();
      const body: Record<string, unknown> = { instanceId: instance!.id, occurredAt: date, mode };
      if (referenceNo.trim()) body.referenceNo = referenceNo.trim();

      const resp = await fetch(
        'https://asia-south1-society-expense-management.cloudfunctions.net/markInstancePaid',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({ data: body }),
        },
      );
      const result = await resp.json();
      if (!resp.ok || result.error) throw new Error(result.error?.message ?? 'Failed to mark paid');
      onPaid();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to mark paid');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Mark as paid — {instance.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Amount: <strong>{formatMoney(instance.amountPaise)}</strong> · Due: {formatDueDate(instance.dueDate)}
          </Typography>
          <TextField label="Payment date" type="date" size="small" required
            value={date} onChange={e => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }} />
          <TextField select label="Payment mode" size="small" required
            value={mode} onChange={e => setMode(e.target.value as PaymentMode)}>
            {MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>
          <TextField label="Reference no. (optional)" size="small"
            value={referenceNo} onChange={e => setReferenceNo(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handlePay} disabled={submitting}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <PaidIcon />}>
          Confirm payment
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Recurring month view ─────────────────────────────────────────────────────

function RecurringMonthView({ period, isFuture, canPay }: {
  period: string;
  isFuture: boolean;
  canPay: boolean;
}) {
  const { instances, loading: instLoading } = useRecurringInstances(period);
  const { projected, loading: projLoading } = useProjectedInstances(period);
  const { accounts } = useAccounts();
  const [payTarget, setPayTarget] = useState<RecurringInstance | null>(null);

  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? '—';

  if (instLoading || projLoading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  if (isFuture) {
    if (projected.length === 0)
      return <Typography variant="body2" color="text.secondary">No active templates for this period.</Typography>;
    return (
      <>
        <Alert severity="info" sx={{ mb: 2 }}>
          Projected — instances will be generated automatically on the 1st of the month.
        </Alert>
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell><TableCell>Due</TableCell>
                <TableCell align="right">Amount</TableCell><TableCell>Account</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projected.map(t => {
                const [y, m] = period.split('-').map(Number);
                const maxDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
                const dueDay = Math.min(t.dueDay, maxDay);
                const dueDate = `${period}-${String(dueDay).padStart(2, '0')}`;
                return (
                  <TableRow key={t.id} hover>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{formatDueDate(dueDate)}</TableCell>
                    <TableCell align="right">{formatMoney(t.amountPaise)}</TableCell>
                    <TableCell>{accountName(t.accountId)}</TableCell>
                    <TableCell><RecurringStatusChip status="projected" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </>
    );
  }

  if (instances.length === 0)
    return (
      <Alert severity="warning">
        No instances for this period. An admin can generate them via Settings → Recurring.
      </Alert>
    );

  const totalPending = instances.filter(i => i.status === 'pending').reduce((s, i) => s + i.amountPaise, 0);
  const totalPaid    = instances.filter(i => i.status === 'paid').reduce((s, i) => s + i.amountPaise, 0);

  return (
    <>
      <Stack direction="row" spacing={2} mb={2}>
        <Chip label={`Pending: ${formatMoney(totalPending)}`} color="warning" variant="outlined" />
        <Chip label={`Paid: ${formatMoney(totalPaid)}`}    color="success" variant="outlined" />
      </Stack>
      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell><TableCell>Due</TableCell>
              <TableCell align="right">Amount</TableCell><TableCell>Account</TableCell>
              <TableCell>Status</TableCell>
              {canPay && <TableCell width={80} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {instances.map(inst => (
              <TableRow key={inst.id} hover>
                <TableCell><Typography variant="body2" fontWeight={500}>{inst.name}</Typography></TableCell>
                <TableCell>{formatDueDate(inst.dueDate)}</TableCell>
                <TableCell align="right">{formatMoney(inst.amountPaise)}</TableCell>
                <TableCell>{accountName(inst.accountId)}</TableCell>
                <TableCell><RecurringStatusChip status={inst.status} /></TableCell>
                {canPay && (
                  <TableCell>
                    {inst.status === 'pending' && (
                      <Button size="small" variant="outlined" startIcon={<PaidIcon />}
                        onClick={() => setPayTarget(inst)}>
                        Pay
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <PayDialog instance={payTarget} onClose={() => setPayTarget(null)} onPaid={() => setPayTarget(null)} />
    </>
  );
}

// ─── Maintenance list view ────────────────────────────────────────────────────

const MAINT_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All statuses'     },
  { value: 'requested', label: 'Pending approval' },
  { value: 'approved',  label: 'Approved'         },
  { value: 'disbursed', label: 'Disbursed'        },
  { value: 'completed', label: 'Completed'        },
  { value: 'withdrawn', label: 'Withdrawn'        },
];

function MaintenanceView({
  canCreate, isFM, onRowClick,
}: {
  canCreate: boolean;
  isFM: boolean;
  onRowClick: (r: ExpenseRequest) => void;
}) {
  const { requests, loading } = useExpenseRequests('maintenance');
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [disbTarget,   setDisbTarget]   = useState<ExpenseRequest | null>(null);
  const [closeTarget,  setCloseTarget]  = useState<ExpenseRequest | null>(null);
  const [closing,      setClosing]      = useState(false);
  const [closeError,   setCloseError]   = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');

  // Filters (S3.26)
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const filtersActive = statusFilter !== 'all' || !!dateFrom || !!dateTo;

  function clearFilters() { setStatusFilter('all'); setDateFrom(''); setDateTo(''); }

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (dateFrom || dateTo) {
      const ms = tsMillis(r.createdAt);
      if (dateFrom && ms < new Date(dateFrom).getTime()) return false;
      if (dateTo   && ms > new Date(dateTo + 'T23:59:59').getTime()) return false;
    }
    return true;
  });

  function handleCreated() {
    setDrawerOpen(false);
    setSuccessMsg('Maintenance request submitted successfully.');
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  async function confirmClose() {
    if (!closeTarget) return;
    setClosing(true); setCloseError('');
    try {
      await closeFn({ requestId: closeTarget.id });
      setSuccessMsg(`"${closeTarget.title}" marked as completed.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setCloseTarget(null);
    } catch (e: unknown) {
      setCloseError(e instanceof Error ? e.message : 'Close failed.');
      setCloseTarget(null);
    } finally {
      setClosing(false);
    }
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={500}>Maintenance requests</Typography>
        {canCreate && (
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => setDrawerOpen(true)}>
            New request
          </Button>
        )}
      </Stack>

      {/* Filter bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2} flexWrap="wrap">
        <FilterListIcon fontSize="small" color="action" />
        <TextField
          select size="small" label="Status" sx={{ minWidth: 170 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        >
          {MAINT_STATUS_OPTIONS.map(o => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          type="date" size="small" label="Created from"
          InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
          value={dateFrom} onChange={e => setDateFrom(e.target.value)}
        />
        <TextField
          type="date" size="small" label="Created to"
          InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
          value={dateTo} onChange={e => setDateTo(e.target.value)}
        />
        {filtersActive && (
          <Button size="small" onClick={clearFilters}>Clear</Button>
        )}
        {filtersActive && (
          <Typography variant="caption" color="text.secondary">
            {filtered.length} of {requests.length}
          </Typography>
        )}
      </Stack>

      {successMsg  && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      {closeError  && <Alert severity="error"   sx={{ mb: 2 }}>{closeError}</Alert>}

      {filtered.length === 0 ? (
        <Alert severity="info">
          {requests.length === 0
            ? `No maintenance requests yet.${canCreate ? ' Use "New request" to create one.' : ''}`
            : 'No requests match the current filters.'}
        </Alert>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Est. cost</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                {isFM && <TableCell width={120} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(r => (
                <TableRow
                  key={r.id} hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onRowClick(r)}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{r.title}</Typography>
                    {r.location && (
                      <Typography variant="caption" color="text.secondary">{r.location}</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>{r.category}</TableCell>
                  <TableCell align="right">{formatMoney(r.estCostPaise)}</TableCell>
                  <TableCell><RequestStatusChip status={r.status} /></TableCell>
                  <TableCell>{formatDate(r.createdAt)}</TableCell>
                  {isFM && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Stack direction="row" spacing={1}>
                        {(r.status === 'approved' || r.status === 'disbursed') && (
                          <Button size="small" variant="outlined" color="primary"
                            onClick={() => setDisbTarget(r)}>
                            Disburse
                          </Button>
                        )}
                        {r.status === 'disbursed' && (
                          <Button size="small" variant="outlined" color="success"
                            onClick={() => setCloseTarget(r)}>
                            Close
                          </Button>
                        )}
                      </Stack>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {disbTarget && (
        <DisbursementDialog
          request={disbTarget}
          onClose={() => setDisbTarget(null)}
          onDisbursed={() => {
            setDisbTarget(null);
            setSuccessMsg(`Disbursement recorded for "${disbTarget.title}".`);
            setTimeout(() => setSuccessMsg(''), 5000);
          }}
        />
      )}

      <Dialog open={!!closeTarget} onClose={() => setCloseTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark as completed?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Mark <strong>"{closeTarget?.title}"</strong> as completed? This closes the request.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseTarget(null)} disabled={closing}>Cancel</Button>
          <Button color="success" variant="contained" onClick={confirmClose} disabled={closing}
            startIcon={closing ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Mark completed
          </Button>
        </DialogActions>
      </Dialog>

      <MaintenanceCreateDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}

// ─── Snag view ───────────────────────────────────────────────────────────────

const SNAG_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All statuses'     },
  { value: 'scheduled', label: 'Scheduled'        },
  { value: 'requested', label: 'Pending approval' },
  { value: 'approved',  label: 'Approved'         },
  { value: 'disbursed', label: 'Disbursed'        },
  { value: 'completed', label: 'Completed'        },
  { value: 'withdrawn', label: 'Withdrawn'        },
];

function SnagView({
  canSchedule, isAdmin, isFM, onRowClick,
}: {
  canSchedule: boolean;
  isAdmin: boolean;
  isFM: boolean;
  onRowClick: (r: ExpenseRequest) => void;
}) {
  const { requests, loading } = useExpenseRequests('snag');
  const [scheduleOpen,   setScheduleOpen]   = useState(false);
  const [takeUpTarget,   setTakeUpTarget]   = useState<ExpenseRequest | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ExpenseRequest | null>(null);
  const [disbTarget,     setDisbTarget]     = useState<ExpenseRequest | null>(null);
  const [successMsg,     setSuccessMsg]     = useState('');
  const [withdrawing,    setWithdrawing]    = useState(false);
  const [withdrawError,  setWithdrawError]  = useState('');

  // Filters (S3.27)
  const [statusFilter, setStatusFilter] = useState('all');
  const [windowFilter, setWindowFilter] = useState('all');

  // Derive unique window labels from loaded data
  const windowLabels = [...new Set(
    requests.map(r => r.plan?.label).filter(Boolean) as string[],
  )].sort();

  const filtersActive = statusFilter !== 'all' || windowFilter !== 'all';

  function clearFilters() { setStatusFilter('all'); setWindowFilter('all'); }

  const filtered = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (windowFilter !== 'all' && (r.plan?.label ?? '') !== windowFilter) return false;
    return true;
  });

  // Separate withdrawn from active for grouping
  const active    = filtered.filter(r => r.status !== 'withdrawn');
  const withdrawn = filtered.filter(r => r.status === 'withdrawn');

  // Group active by window label
  const groups = new Map<string, ExpenseRequest[]>();
  for (const r of active) {
    const key = r.plan?.label ?? 'No window';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const showActionsCol = isAdmin || isFM;

  function handleCreated() {
    setScheduleOpen(false);
    setSuccessMsg('Snag scheduled successfully.');
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  function handleTakeUpSubmitted() {
    setTakeUpTarget(null);
    setSuccessMsg('Snag submitted for approval.');
    setTimeout(() => setSuccessMsg(''), 4000);
  }

  async function confirmWithdraw() {
    if (!withdrawTarget) return;
    setWithdrawing(true); setWithdrawError('');
    try {
      await withdrawFn({ requestId: withdrawTarget.id });
      setWithdrawTarget(null);
    } catch (e: unknown) {
      setWithdrawError(e instanceof Error ? e.message : 'Withdraw failed.');
      setWithdrawTarget(null);
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={500}>Scheduled snags</Typography>
        {canSchedule && (
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            onClick={() => setScheduleOpen(true)}>
            Schedule snag
          </Button>
        )}
      </Stack>

      {/* Filter bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" mb={2} flexWrap="wrap">
        <FilterListIcon fontSize="small" color="action" />
        <TextField
          select size="small" label="Status" sx={{ minWidth: 170 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        >
          {SNAG_STATUS_OPTIONS.map(o => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </TextField>
        {windowLabels.length > 0 && (
          <TextField
            select size="small" label="Budget window" sx={{ minWidth: 170 }}
            value={windowFilter} onChange={e => setWindowFilter(e.target.value)}
          >
            <MenuItem value="all">All windows</MenuItem>
            {windowLabels.map(lbl => (
              <MenuItem key={lbl} value={lbl}>{lbl}</MenuItem>
            ))}
          </TextField>
        )}
        {filtersActive && (
          <Button size="small" onClick={clearFilters}>Clear</Button>
        )}
        {filtersActive && (
          <Typography variant="caption" color="text.secondary">
            {filtered.length} of {requests.length}
          </Typography>
        )}
      </Stack>

      {successMsg   && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      {withdrawError && <Alert severity="error"  sx={{ mb: 2 }}>{withdrawError}</Alert>}

      {active.length === 0 && withdrawn.length === 0 && (
        <Alert severity="info">
          {requests.length === 0
            ? `No snags yet.${canSchedule ? ' Use "Schedule snag" to create one.' : ''}`
            : 'No snags match the current filters.'}
        </Alert>
      )}

      {/* Grouped by budget window */}
      {[...groups.entries()].map(([windowLabel, items]) => (
        <Box key={windowLabel} mb={3}>
          <Typography variant="overline" color="text.secondary" display="block" mb={1}>
            {windowLabel}
          </Typography>
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Est. cost</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  {showActionsCol && <TableCell width={120} />}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map(r => (
                  <TableRow
                    key={r.id} hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onRowClick(r)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{r.title}</Typography>
                      {r.location && (
                        <Typography variant="caption" color="text.secondary">{r.location}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{r.category}</TableCell>
                    <TableCell align="right">{formatMoney(r.estCostPaise)}</TableCell>
                    <TableCell><RequestStatusChip status={r.status} /></TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                    {showActionsCol && (
                      <TableCell onClick={e => e.stopPropagation()}>
                        {isFM && r.status === 'scheduled' && (
                          <Button size="small" variant="outlined"
                            onClick={() => setTakeUpTarget(r)}>
                            Take up
                          </Button>
                        )}
                        {isFM && (r.status === 'approved' || r.status === 'disbursed') && (
                          <Button size="small" variant="outlined" color="primary"
                            onClick={() => setDisbTarget(r)}>
                            Disburse
                          </Button>
                        )}
                        {isAdmin && r.status === 'scheduled' && (
                          <Button size="small" color="error" variant="outlined"
                            onClick={() => setWithdrawTarget(r)}>
                            Withdraw
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      ))}

      {/* Withdrawn section */}
      {withdrawn.length > 0 && (
        <Box mt={2}>
          <Typography variant="overline" color="text.disabled" display="block" mb={1}>
            Withdrawn ({withdrawn.length})
          </Typography>
          <Paper variant="outlined" sx={{ opacity: 0.6 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Window</TableCell>
                  <TableCell align="right">Est. cost</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {withdrawn.map(r => (
                  <TableRow
                    key={r.id} hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onRowClick(r)}
                  >
                    <TableCell>{r.title}</TableCell>
                    <TableCell>{r.plan?.label ?? '—'}</TableCell>
                    <TableCell align="right">{formatMoney(r.estCostPaise)}</TableCell>
                    <TableCell><RequestStatusChip status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {/* Withdraw confirm dialog */}
      <Dialog open={!!withdrawTarget} onClose={() => setWithdrawTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Withdraw snag?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Withdraw <strong>"{withdrawTarget?.title}"</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawTarget(null)} disabled={withdrawing}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmWithdraw} disabled={withdrawing}
            startIcon={withdrawing ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Withdraw
          </Button>
        </DialogActions>
      </Dialog>

      {disbTarget && (
        <DisbursementDialog
          request={disbTarget}
          onClose={() => setDisbTarget(null)}
          onDisbursed={() => {
            setSuccessMsg(`Disbursement recorded for "${disbTarget.title}".`);
            setDisbTarget(null);
            setTimeout(() => setSuccessMsg(''), 5000);
          }}
        />
      )}

      <SnagScheduleDrawer
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onCreated={handleCreated}
      />

      <SnagTakeUpDrawer
        open={!!takeUpTarget}
        snag={takeUpTarget}
        onClose={() => setTakeUpTarget(null)}
        onSubmitted={handleTakeUpSubmitted}
      />
    </>
  );
}

// ─── Requested queue view ─────────────────────────────────────────────────────

function RequestedQueueView({
  isMC, isFM, isAdmin, onRowClick,
}: {
  isMC: boolean;
  isFM: boolean;
  isAdmin: boolean;
  onRowClick: (r: ExpenseRequest) => void;
}) {
  const { requests, loading } = useRequestedQueue();
  const { user } = useAuth();
  const [approving,      setApproving]      = useState<string | null>(null);
  const [approveError,   setApproveError]   = useState('');
  const [successMsg,     setSuccessMsg]     = useState('');
  const [notesTarget,    setNotesTarget]    = useState<ExpenseRequest | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ExpenseRequest | null>(null);
  const [withdrawing,    setWithdrawing]    = useState(false);
  const [withdrawError,  setWithdrawError]  = useState('');

  async function handleApprove(r: ExpenseRequest) {
    setApproving(r.id); setApproveError('');
    try {
      const result = await approveFn({ requestId: r.id });
      setSuccessMsg(result.data.approved
        ? `"${r.title}" fully approved.`
        : `Approval recorded for "${r.title}".`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setApproveError(e instanceof Error ? e.message : 'Approval failed.');
    } finally {
      setApproving(null);
    }
  }

  async function confirmWithdraw() {
    if (!withdrawTarget) return;
    setWithdrawing(true); setWithdrawError('');
    try {
      await withdrawFn({ requestId: withdrawTarget.id });
      setSuccessMsg(`"${withdrawTarget.title}" withdrawn.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setWithdrawTarget(null);
    } catch (e: unknown) {
      setWithdrawError(e instanceof Error ? e.message : 'Withdraw failed.');
      setWithdrawTarget(null);
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={500}>Requested queue</Typography>
        <Typography variant="caption" color="text.secondary">Oldest first</Typography>
      </Stack>

      {successMsg    && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}
      {approveError  && <Alert severity="error"   sx={{ mb: 2 }}>{approveError}</Alert>}
      {withdrawError && <Alert severity="error"   sx={{ mb: 2 }}>{withdrawError}</Alert>}

      <Dialog open={!!withdrawTarget} onClose={() => setWithdrawTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Withdraw request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Withdraw <strong>"{withdrawTarget?.title}"</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawTarget(null)} disabled={withdrawing}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmWithdraw} disabled={withdrawing}
            startIcon={withdrawing ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Withdraw
          </Button>
        </DialogActions>
      </Dialog>

      {notesTarget && (
        <RequestNotesDialog
          requestId={notesTarget.id}
          title={notesTarget.title}
          isMC={isMC}
          onClose={() => setNotesTarget(null)}
        />
      )}

      {requests.length === 0 ? (
        <Alert severity="info">No pending requests in the approval queue.</Alert>
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Est. cost</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Approvals</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map(r => {
                const alreadyApproved = r.approvedBy?.includes(user?.uid ?? '') ?? false;
                const approvalCount   = r.approvalCount ?? 0;
                const required        = r.requiredApprovers ?? 1;
                return (
                  <TableRow
                    key={r.id} hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => onRowClick(r)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{r.title}</Typography>
                      {r.location && (
                        <Typography variant="caption" color="text.secondary">{r.location}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.type === 'maintenance' ? 'Maintenance' : 'Snag'}
                        size="small"
                        color={r.type === 'snag' ? 'secondary' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{r.category}</TableCell>
                    <TableCell align="right">{formatMoney(r.estCostPaise)}</TableCell>
                    <TableCell>{formatDate(r.submittedAt)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color={approvalCount >= required ? 'success.main' : 'text.primary'}>
                        {approvalCount} / {required}
                      </Typography>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" variant="outlined"
                          startIcon={<StickyNote2Icon fontSize="small" />}
                          onClick={() => setNotesTarget(r)}>
                          Notes
                        </Button>
                        {(isFM && r.type === 'maintenance') || (isAdmin && r.type === 'snag') ? (
                          <Button size="small" variant="outlined" color="error"
                            onClick={() => setWithdrawTarget(r)}>
                            Withdraw
                          </Button>
                        ) : null}
                        {isMC && (
                          alreadyApproved ? (
                            <Typography variant="caption" color="success.main" sx={{ alignSelf: 'center' }}>
                              Approved ✓
                            </Typography>
                          ) : (
                            <Button size="small" variant="outlined" color="success"
                              disabled={approving === r.id}
                              onClick={() => handleApprove(r)}
                              startIcon={approving === r.id
                                ? <CircularProgress size={12} color="inherit" />
                                : undefined}>
                              Approve
                            </Button>
                          )
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PayablesPage() {
  const current = todayPeriod();
  const [period, setPeriod] = useState(current);
  const [tab, setTab]       = useState(0);
  const { role } = useAuth();
  const [searchParams] = useSearchParams();

  // Detail drawer state (S3.28)
  const [selectedRequest,   setSelectedRequest]   = useState<ExpenseRequest | null>(null);
  const [detailTakeUpTarget, setDetailTakeUpTarget] = useState<ExpenseRequest | null>(null);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (!t) return;
    const idx = t === 'maintenance' ? 1 : t === 'snags' ? 2 : t === 'queue' ? 3 : 0;
    setTab(idx);
  }, [searchParams]);

  const canPay    = role === 'admin' || role === 'fm';
  const canCreate = role === 'admin' || role === 'fm';
  const isFuture  = period > current;

  function openDetail(r: ExpenseRequest) { setSelectedRequest(r); }

  return (
    <Box>
      <Typography variant="h5" fontWeight={500} mb={3}>Payables</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        variant="scrollable" scrollButtons="auto">
        <Tab label="Recurring"   id="payables-tab-0" aria-controls="payables-panel-0" />
        <Tab label="Maintenance" id="payables-tab-1" aria-controls="payables-panel-1" />
        <Tab label="Snags"       id="payables-tab-2" aria-controls="payables-panel-2" />
        <Tab label="Queue"       id="payables-tab-3" aria-controls="payables-panel-3" />
      </Tabs>

      {/* Recurring tab */}
      <Box role="tabpanel" id="payables-panel-0" aria-labelledby="payables-tab-0" hidden={tab !== 0}>
        {tab === 0 && (
          <>
            <Stack direction="row" alignItems="center" spacing={1} mb={3}>
              <IconButton onClick={() => setPeriod(p => addMonths(p, -1))} aria-label="Previous month">
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="h6" fontWeight={500} minWidth={180} textAlign="center">
                {formatPeriod(period)}
              </Typography>
              <IconButton onClick={() => setPeriod(p => addMonths(p, 1))} aria-label="Next month">
                <ChevronRightIcon />
              </IconButton>
            </Stack>
            <Typography variant="subtitle1" fontWeight={500} mb={2}>Recurring payments</Typography>
            <RecurringMonthView period={period} isFuture={isFuture} canPay={canPay} />
          </>
        )}
      </Box>

      {/* Maintenance tab */}
      <Box role="tabpanel" id="payables-panel-1" aria-labelledby="payables-tab-1" hidden={tab !== 1}>
        {tab === 1 && (
          <MaintenanceView
            canCreate={canCreate}
            isFM={role === 'fm'}
            onRowClick={openDetail}
          />
        )}
      </Box>

      {/* Snags tab */}
      <Box role="tabpanel" id="payables-panel-2" aria-labelledby="payables-tab-2" hidden={tab !== 2}>
        {tab === 2 && (
          <SnagView
            canSchedule={role === 'admin'}
            isAdmin={role === 'admin'}
            isFM={role === 'fm'}
            onRowClick={openDetail}
          />
        )}
      </Box>

      {/* Queue tab */}
      <Box role="tabpanel" id="payables-panel-3" aria-labelledby="payables-tab-3" hidden={tab !== 3}>
        {tab === 3 && (
          <RequestedQueueView
            isMC={role === 'mc'}
            isFM={role === 'fm'}
            isAdmin={role === 'admin'}
            onRowClick={openDetail}
          />
        )}
      </Box>

      {/* Detail drawer (S3.28) */}
      <RequestDetailDrawer
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onTakeUp={r => {
          setSelectedRequest(null);
          setDetailTakeUpTarget(r);
        }}
      />

      {/* Take-up drawer triggered from the detail drawer */}
      <SnagTakeUpDrawer
        open={!!detailTakeUpTarget}
        snag={detailTakeUpTarget}
        onClose={() => setDetailTakeUpTarget(null)}
        onSubmitted={() => setDetailTakeUpTarget(null)}
      />
    </Box>
  );
}
