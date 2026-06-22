import { useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { formatMoney, toPaise } from '../../lib/money';
import type { ExpenseRequest } from '../../types/requests';

interface QuotationRow {
  vendorId: string;
  amountRupees: string;
  scopeNotes: string;
}

const submitExpenseFn = httpsCallable<
  { requestId: string; quotations: { vendorId: string; amountPaise: number; scopeNotes: string }[] },
  { ok: true }
>(functions, 'submitExpenseRequest');

interface Props {
  open: boolean;
  snag: ExpenseRequest | null;
  onClose: () => void;
  onSubmitted: () => void;
}

function emptyRow(): QuotationRow {
  return { vendorId: '', amountRupees: '', scopeNotes: '' };
}

export default function SnagTakeUpDrawer({ open, snag, onClose, onSubmitted }: Props) {
  const [rows,       setRows]       = useState<QuotationRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  function reset() {
    setRows([emptyRow()]);
    setError('');
  }

  function updateRow(idx: number, field: keyof QuotationRow, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function addRow() { setRows(prev => [...prev, emptyRow()]); }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!snag) return;
    setError('');

    const quotations: { vendorId: string; amountPaise: number; scopeNotes: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.vendorId.trim()) { setError(`Quotation ${i + 1}: vendor name is required.`); return; }
      const paise = toPaise(parseFloat(r.amountRupees));
      if (!r.amountRupees || isNaN(paise) || paise <= 0) {
        setError(`Quotation ${i + 1}: amount must be a positive number.`); return;
      }
      if (!r.scopeNotes.trim()) { setError(`Quotation ${i + 1}: scope notes are required.`); return; }
      quotations.push({ vendorId: r.vendorId.trim(), amountPaise: paise, scopeNotes: r.scopeNotes.trim() });
    }

    setSubmitting(true);
    try {
      await submitExpenseFn({ requestId: snag.id, quotations });
      reset();
      onSubmitted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!snag) return null;

  return (
    <Drawer anchor="right" open={open} onClose={() => { reset(); onClose(); }}
      PaperProps={{ sx: { width: { xs: '100%', sm: 600 }, p: 3, overflowY: 'auto' } }}>
      <Typography variant="h6" fontWeight={500} mb={1}>Take up snag</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Add vendor quotations to submit this snag for MC approval.
      </Typography>

      {/* Snag summary */}
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={600}>{snag.title}</Typography>
        {snag.location && (
          <Typography variant="caption" color="text.secondary" display="block">{snag.location}</Typography>
        )}
        <Typography variant="body2" color="text.secondary" mt={0.5}>{snag.description}</Typography>
        <Stack direction="row" spacing={3} mt={1.5}>
          <Typography variant="caption">
            Est. cost: <strong>{formatMoney(snag.estCostPaise)}</strong>
          </Typography>
          {snag.plan && (
            <Typography variant="caption">
              Window: <strong>{snag.plan.label}</strong>
            </Typography>
          )}
        </Stack>
      </Box>

      <Typography variant="subtitle2" mb={1.5}>Quotations</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={2.5}>
        {rows.map((row, idx) => (
          <Box key={idx} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">
                Quotation {idx + 1}
              </Typography>
              {rows.length > 1 && (
                <IconButton size="small" onClick={() => removeRow(idx)} aria-label="Remove quotation">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            <Stack spacing={1.5}>
              <TextField label="Vendor / contractor name" required size="small" fullWidth
                value={row.vendorId} onChange={e => updateRow(idx, 'vendorId', e.target.value)} />
              <TextField label="Quoted amount (₹)" required size="small" fullWidth
                type="number" inputProps={{ min: 1, step: 1000 }}
                value={row.amountRupees} onChange={e => updateRow(idx, 'amountRupees', e.target.value)}
                helperText={row.amountRupees && !isNaN(parseFloat(row.amountRupees))
                  ? formatMoney(toPaise(parseFloat(row.amountRupees))) : ''} />
              <TextField label="Scope notes" required size="small" fullWidth multiline minRows={2}
                value={row.scopeNotes} onChange={e => updateRow(idx, 'scopeNotes', e.target.value)} />
            </Stack>
          </Box>
        ))}

        <Button startIcon={<AddIcon />} onClick={addRow} disabled={submitting}
          sx={{ alignSelf: 'flex-start' }}>
          Add quotation
        </Button>

        <Divider />

        <Stack direction="row" spacing={1} justifyContent="flex-end" pt={1}>
          <Button onClick={() => { reset(); onClose(); }} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Submit for approval
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
