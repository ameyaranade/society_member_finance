import { useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { formatMoney, toPaise } from '../../lib/money';
import type { ExpenseCategory, ExpensePriority } from '../../types/requests';
import type { FundCode } from '../../types/config';
import type { BudgetWindowMode } from '../../types/requests';

interface BudgetWindowInput {
  mode: BudgetWindowMode;
  startDate: string;
  endDate: string;
  label: string;
}

const PRIORITIES: { value: ExpensePriority; label: string }[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
];
const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'electrical', label: 'Electrical' }, { value: 'plumbing', label: 'Plumbing' },
  { value: 'civil', label: 'Civil works' }, { value: 'mechanical', label: 'Mechanical' },
  { value: 'landscaping', label: 'Landscaping' }, { value: 'security', label: 'Security' },
  { value: 'housekeeping', label: 'Housekeeping' }, { value: 'other', label: 'Other' },
];
const FUND_HEADS: { value: FundCode; label: string }[] = [
  { value: 'general', label: 'General fund' }, { value: 'sinking', label: 'Sinking fund' },
  { value: 'corpus', label: 'Corpus fund' }, { value: 'repair', label: 'Repair & maintenance' },
];
const PLAN_MODES: { value: BudgetWindowMode; label: string }[] = [
  { value: 'month',   label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year',    label: 'Year (Apr–Mar)' },
  { value: 'custom',  label: 'Custom range' },
  { value: 'by_date', label: 'By target date' },
];

const scheduleSnagFn = httpsCallable<unknown, { requestId: string }>(functions, 'scheduleSnag');

/** Build a BudgetWindow from mode + raw date inputs. */
function computeWindow(mode: BudgetWindowMode, rawStart: string, rawEnd: string, rawLabel: string): BudgetWindowInput | null {
  if (mode === 'by_date') {
    if (!rawStart) return null;
    return { mode, startDate: rawStart, endDate: rawStart, label: rawLabel || rawStart };
  }
  if (!rawStart || !rawEnd) return null;
  return { mode, startDate: rawStart, endDate: rawEnd, label: rawLabel || `${rawStart} – ${rawEnd}` };
}

/** Auto-fill start/end/label when mode changes or month/year input changes. */
function deriveWindow(mode: BudgetWindowMode, monthYear: string): { start: string; end: string; label: string } | null {
  if (mode === 'month' && monthYear.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = monthYear.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const start = `${monthYear}-01`;
    const end   = `${monthYear}-${String(lastDay).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
      new Date(Date.UTC(y, m - 1, 1)),
    );
    return { start, end, label };
  }
  if (mode === 'year' && monthYear.match(/^\d{4}$/)) {
    const fy = parseInt(monthYear, 10);
    return {
      start: `${fy}-04-01`,
      end:   `${fy + 1}-03-31`,
      label: `FY ${fy}–${String(fy + 1).slice(-2)}`,
    };
  }
  return null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (requestId: string) => void;
}

export default function SnagScheduleDrawer({ open, onClose, onCreated }: Props) {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [location,    setLocation]    = useState('');
  const [priority,    setPriority]    = useState<ExpensePriority>('medium');
  const [category,    setCategory]    = useState<ExpenseCategory>('civil');
  const [fundHead,    setFundHead]    = useState<FundCode>('sinking');
  const [estRupees,   setEstRupees]   = useState('');
  const [planMode,    setPlanMode]    = useState<BudgetWindowMode>('month');
  const [monthYear,   setMonthYear]   = useState('');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [planLabel,   setPlanLabel]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  function reset() {
    setTitle(''); setDescription(''); setLocation('');
    setPriority('medium'); setCategory('civil'); setFundHead('sinking');
    setEstRupees(''); setPlanMode('month'); setMonthYear('');
    setStartDate(''); setEndDate(''); setPlanLabel(''); setError('');
  }

  function handleModeChange(m: BudgetWindowMode) {
    setPlanMode(m);
    setMonthYear(''); setStartDate(''); setEndDate(''); setPlanLabel('');
  }

  function handleMonthYearChange(v: string) {
    setMonthYear(v);
    const derived = deriveWindow(planMode, v);
    if (derived) { setStartDate(derived.start); setEndDate(derived.end); setPlanLabel(derived.label); }
  }

  function buildPlan(): BudgetWindowInput | null {
    if (planMode === 'month' || planMode === 'year') {
      return computeWindow(planMode, startDate, endDate, planLabel);
    }
    if (planMode === 'by_date') {
      return computeWindow(planMode, startDate, startDate, planLabel);
    }
    return computeWindow(planMode, startDate, endDate, planLabel);
  }

  async function handleSubmit() {
    setError('');
    const estCostPaise = toPaise(parseFloat(estRupees));
    if (!title.trim())       { setError('Title is required.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }
    if (!estRupees || isNaN(estCostPaise) || estCostPaise <= 0) {
      setError('Estimated cost must be a positive amount.'); return;
    }
    if (estCostPaise < 10000000) {
      setError('Snag requests must be ≥ ₹1,00,000 (100000). Use Maintenance for smaller requests.'); return;
    }
    const plan = buildPlan();
    if (!plan) { setError('Budget window is incomplete.'); return; }

    setSubmitting(true);
    try {
      const result = await scheduleSnagFn({
        title: title.trim(),
        description: description.trim(),
        ...(location.trim() && { location: location.trim() }),
        priority, category, fundHead,
        estCostPaise,
        plan,
      });
      reset();
      onCreated(result.data.requestId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to schedule snag.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer anchor="right" open={open} onClose={() => { reset(); onClose(); }}
      PaperProps={{ sx: { width: { xs: '100%', sm: 560 }, p: 3, overflowY: 'auto' } }}>
      <Typography variant="h6" fontWeight={500} mb={3}>Schedule snag</Typography>

      <Stack spacing={2.5}>
        {error && <Alert severity="error">{error}</Alert>}

        <TextField label="Title" required size="small" fullWidth
          value={title} onChange={e => setTitle(e.target.value)} />
        <TextField label="Description" required size="small" fullWidth multiline minRows={2}
          value={description} onChange={e => setDescription(e.target.value)} />
        <TextField label="Location (optional)" size="small" fullWidth
          value={location} onChange={e => setLocation(e.target.value)} />

        <Stack direction="row" spacing={2}>
          <TextField select label="Priority" size="small" sx={{ flex: 1 }}
            value={priority} onChange={e => setPriority(e.target.value as ExpensePriority)}>
            {PRIORITIES.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </TextField>
          <TextField select label="Category" size="small" sx={{ flex: 1 }}
            value={category} onChange={e => setCategory(e.target.value as ExpenseCategory)}>
            {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
          </TextField>
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField select label="Fund head" size="small" sx={{ flex: 1 }}
            value={fundHead} onChange={e => setFundHead(e.target.value as FundCode)}>
            {FUND_HEADS.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
          </TextField>
          <TextField label="Estimated cost (₹)" size="small" sx={{ flex: 1 }}
            type="number" inputProps={{ min: 100000, step: 10000 }}
            value={estRupees} onChange={e => setEstRupees(e.target.value)}
            helperText={estRupees && !isNaN(parseFloat(estRupees))
              ? formatMoney(toPaise(parseFloat(estRupees))) : 'Min ₹1,00,000'} />
        </Stack>

        <Divider />

        <Box>
          <Typography variant="subtitle2" mb={1.5}>Budget window</Typography>
          <Stack spacing={1.5}>
            <TextField select label="Window type" size="small" fullWidth
              value={planMode} onChange={e => handleModeChange(e.target.value as BudgetWindowMode)}>
              {PLAN_MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>

            {planMode === 'month' && (
              <TextField label="Month" size="small" type="month" fullWidth
                InputLabelProps={{ shrink: true }}
                value={monthYear} onChange={e => handleMonthYearChange(e.target.value)} />
            )}

            {planMode === 'year' && (
              <TextField label="FY start year (e.g. 2026)" size="small" fullWidth
                type="number" inputProps={{ min: 2024, max: 2030, step: 1 }}
                value={monthYear} onChange={e => handleMonthYearChange(e.target.value)} />
            )}

            {(planMode === 'custom' || planMode === 'quarter') && (
              <Stack direction="row" spacing={1.5}>
                <TextField label="Start date" size="small" type="date" sx={{ flex: 1 }}
                  InputLabelProps={{ shrink: true }}
                  value={startDate} onChange={e => setStartDate(e.target.value)} />
                <TextField label="End date" size="small" type="date" sx={{ flex: 1 }}
                  InputLabelProps={{ shrink: true }}
                  value={endDate} onChange={e => setEndDate(e.target.value)} />
              </Stack>
            )}

            {planMode === 'by_date' && (
              <TextField label="Target date" size="small" type="date" fullWidth
                InputLabelProps={{ shrink: true }}
                value={startDate} onChange={e => setStartDate(e.target.value)} />
            )}

            <TextField label="Window label" size="small" fullWidth required
              value={planLabel} onChange={e => setPlanLabel(e.target.value)}
              helperText="e.g. Jul 2026, Q2 FY26, FY 2026–27" />
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end" pt={1}>
          <Button onClick={() => { reset(); onClose(); }} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Schedule snag
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
