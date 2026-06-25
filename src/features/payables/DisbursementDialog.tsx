import { useMemo, useState } from 'react';
import { callables } from '../../lib/callables';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import { useAccounts } from '../settings/useAccounts';
import { formatMoney } from '../../lib/money';
import type { ExpenseRequest } from '../../types/requests';
import FileUploadButton from './FileUploadButton';

type PaymentMode = 'cash' | 'upi' | 'cheque' | 'bank';
type DisbKind    = 'partial' | 'final';

const MODES: { value: PaymentMode; label: string }[] = [
  { value: 'cash',   label: 'Cash' },
  { value: 'upi',    label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank',   label: 'Bank transfer' },
];

const { recordDisbursement: disbFn } = callables;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DisbursementDialogProps {
  request: ExpenseRequest;
  onClose: () => void;
  onDisbursed: () => void;
}

export default function DisbursementDialog({ request, onClose, onDisbursed }: DisbursementDialogProps) {
  const { accounts } = useAccounts();

  const approvedPaise   = request.approvedAmountPaise ?? 0;
  const disbursedSoFar  = request.disbursedAmountPaise ?? 0;
  const remainingPaise  = approvedPaise - disbursedSoFar;

  const [amountRupees, setAmountRupees] = useState('');
  const [accountId,    setAccountId]    = useState('');
  const [kind,         setKind]         = useState<DisbKind>('partial');
  const [mode,         setMode]         = useState<PaymentMode>('bank');
  const [referenceNo,  setReferenceNo]  = useState('');
  const [paidAt,       setPaidAt]       = useState(todayISO());
  const [notes,        setNotes]        = useState('');
  const [invoiceSlots, setInvoiceSlots] = useState<{ slotKey: string; ref: string | null }[]>(
    [{ slotKey: crypto.randomUUID(), ref: null }],
  );
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  const disbPathBase = useMemo(
    () => `societies/${request.societyId}/expense-requests/${request.id}/disbursements`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const amountPaise = Math.round(parseFloat(amountRupees || '0') * 100);
  const amountValid = Number.isFinite(amountPaise) && amountPaise > 0 && amountPaise <= remainingPaise;
  const canSubmit   = amountValid && accountId && paidAt.match(/^\d{4}-\d{2}-\d{2}$/) && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await disbFn({
        requestId: request.id,
        amountPaise,
        accountId,
        kind,
        paymentMode: mode,
        paidAt,
        ...(referenceNo.trim() ? { referenceNo: referenceNo.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(invoiceSlots.some(s => s.ref)
        ? { invoiceRefs: invoiceSlots.map(s => s.ref).filter((r): r is string => r !== null) }
        : {}),
      });
      onDisbursed();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Disbursement failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record disbursement — {request.title}</DialogTitle>

      <DialogContent>
        <Stack spacing={0.5} mb={2} mt={1}>
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Approved amount</Typography>
            <Typography variant="body2" fontWeight={500}>{formatMoney(approvedPaise)}</Typography>
          </Box>
          {disbursedSoFar > 0 && (
            <Box display="flex" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Already disbursed</Typography>
              <Typography variant="body2">{formatMoney(disbursedSoFar)}</Typography>
            </Box>
          )}
          <Box display="flex" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">Remaining</Typography>
            <Typography variant="body2" color="success.main" fontWeight={500}>
              {formatMoney(remainingPaise)}
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={2}>
          <TextField
            label="Amount (₹)" size="small" required
            value={amountRupees}
            onChange={e => setAmountRupees(e.target.value)}
            helperText={
              amountPaise > 0 && !amountValid
                ? `Exceeds remaining ${formatMoney(remainingPaise)}`
                : amountPaise > 0 ? `= ${formatMoney(amountPaise)}` : ' '
            }
            error={amountPaise > 0 && !amountValid}
          />

          <TextField select label="Account" size="small" required value={accountId}
            onChange={e => setAccountId(e.target.value)}>
            {accounts.map(a => (
              <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
            ))}
          </TextField>

          <TextField select label="Kind" size="small" required value={kind}
            onChange={e => setKind(e.target.value as DisbKind)}>
            <MenuItem value="partial">Partial disbursement</MenuItem>
            <MenuItem value="final">Final disbursement</MenuItem>
          </TextField>

          <TextField select label="Payment mode" size="small" required value={mode}
            onChange={e => setMode(e.target.value as PaymentMode)}>
            {MODES.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
          </TextField>

          <TextField label="Reference no. (optional)" size="small"
            value={referenceNo} onChange={e => setReferenceNo(e.target.value)} />

          <TextField label="Paid date" type="date" size="small" required
            value={paidAt} onChange={e => setPaidAt(e.target.value)}
            InputLabelProps={{ shrink: true }} />

          <TextField label="Internal notes (optional)" size="small" multiline rows={2}
            value={notes} onChange={e => setNotes(e.target.value)} />

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
              Invoice / payment proof (optional)
            </Typography>
            <Stack spacing={0.75}>
              {invoiceSlots.map(slot => (
                <FileUploadButton
                  key={slot.slotKey}
                  storagePathPrefix={`${disbPathBase}/${slot.slotKey}`}
                  label="Attach invoice or receipt"
                  disabled={submitting}
                  onUploaded={path => setInvoiceSlots(s => s.map(d => d.slotKey === slot.slotKey ? { ...d, ref: path } : d))}
                  onRemoved={() => setInvoiceSlots(s => s.map(d => d.slotKey === slot.slotKey ? { ...d, ref: null } : d))}
                />
              ))}
              {invoiceSlots.every(s => s.ref !== null) && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  disabled={submitting}
                  onClick={() => setInvoiceSlots(s => [...s, { slotKey: crypto.randomUUID(), ref: null }])}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Add another invoice
                </Button>
              )}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" disabled={!canSubmit} onClick={handleSubmit}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}>
          Record disbursement
        </Button>
      </DialogActions>
    </Dialog>
  );
}
