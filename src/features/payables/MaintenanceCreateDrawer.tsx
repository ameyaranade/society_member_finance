import { useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import { callables } from '../../lib/callables';
import { useAuth } from '../auth/useAuth';
import { useVendors } from '../settings/useVendors';
import { formatMoney, toPaise } from '../../lib/money';
import type { ExpenseCategory, ExpensePriority } from '../../types/requests';
import type { FundCode } from '../../types/config';
import FileUploadButton from './FileUploadButton';

interface DocSlot { slotKey: string; ref: string | null; }

interface QuotationRow {
  vendorId: string;
  amountRupees: string;
  scopeNotes: string;
  docSlots: DocSlot[];
}

const PRIORITIES: { value: ExpensePriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'electrical',  label: 'Electrical' },
  { value: 'plumbing',    label: 'Plumbing' },
  { value: 'civil',       label: 'Civil works' },
  { value: 'mechanical',  label: 'Mechanical' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'security',    label: 'Security' },
  { value: 'housekeeping',label: 'Housekeeping' },
  { value: 'other',       label: 'Other' },
];

const FUND_HEADS: { value: FundCode; label: string }[] = [
  { value: 'general', label: 'General fund' },
  { value: 'sinking', label: 'Sinking fund' },
  { value: 'corpus',  label: 'Corpus fund' },
  { value: 'repair',  label: 'Repair & maintenance' },
];

function emptyQuote(): QuotationRow {
  return { vendorId: '', amountRupees: '', scopeNotes: '', docSlots: [{ slotKey: crypto.randomUUID(), ref: null }] };
}

const { createMaintenanceRequest: createMaintenanceRequestFn } = callables;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (requestId: string) => void;
}

export default function MaintenanceCreateDrawer({ open, onClose, onCreated }: Props) {
  const { vendors } = useVendors();
  const { societyId } = useAuth();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [location,    setLocation]    = useState('');
  const [priority,    setPriority]    = useState<ExpensePriority>('medium');
  const [category,    setCategory]    = useState<ExpenseCategory>('electrical');
  const [fundHead,    setFundHead]    = useState<FundCode>('general');
  const [estRupees,   setEstRupees]   = useState('');
  const [quotations,  setQuotations]  = useState<QuotationRow[]>([emptyQuote()]);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  function reset() {
    setTitle(''); setDescription(''); setLocation('');
    setPriority('medium'); setCategory('electrical'); setFundHead('general');
    setEstRupees(''); setQuotations([emptyQuote()]); setError('');
  }

  function handleClose() { reset(); onClose(); }

  function updateQuote(i: number, patch: Partial<QuotationRow>) {
    setQuotations(qs => qs.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  }

  async function handleSubmit() {
    setError('');
    const estCostPaise = toPaise(parseFloat(estRupees));
    if (!title.trim())            { setError('Title is required.'); return; }
    if (!description.trim())      { setError('Description is required.'); return; }
    if (!estRupees || isNaN(estCostPaise) || estCostPaise <= 0) {
      setError('Estimated cost must be a positive amount.'); return;
    }
    for (const q of quotations) {
      if (!q.vendorId)       { setError('Select a vendor for each quotation.'); return; }
      if (!q.amountRupees || isNaN(toPaise(parseFloat(q.amountRupees))) || toPaise(parseFloat(q.amountRupees)) <= 0) {
        setError('Each quotation must have a valid amount.'); return;
      }
      if (!q.scopeNotes.trim()) { setError('Scope notes are required for each quotation.'); return; }
    }

    setSubmitting(true);
    try {
      const result = await createMaintenanceRequestFn({
        title:        title.trim(),
        description:  description.trim(),
        ...(location.trim() && { location: location.trim() }),
        priority, category, fundHead,
        estCostPaise,
        quotations: quotations.map(q => {
          const refs = q.docSlots.map(s => s.ref).filter((r): r is string => r !== null);
          return {
            vendorId:    q.vendorId,
            amountPaise: toPaise(parseFloat(q.amountRupees)),
            scopeNotes:  q.scopeNotes.trim(),
            ...(refs.length > 0 ? { documentRefs: refs } : {}),
          };
        }),
      });
      reset();
      onCreated(result.data.requestId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer anchor="right" open={open} onClose={handleClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, p: 3 } }}>
      <Typography variant="h6" fontWeight={500} mb={3}>New maintenance request</Typography>

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
            type="number" inputProps={{ min: 0, step: 100 }}
            value={estRupees} onChange={e => setEstRupees(e.target.value)}
            helperText={estRupees && !isNaN(parseFloat(estRupees))
              ? formatMoney(toPaise(parseFloat(estRupees))) : undefined} />
        </Stack>

        <Divider />

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="subtitle2">Quotations</Typography>
            <Button size="small" startIcon={<AddIcon />}
              onClick={() => setQuotations(qs => [...qs, emptyQuote()])}>
              Add quotation
            </Button>
          </Stack>

          <Stack spacing={2}>
            {quotations.map((q, i) => (
              <Box key={i} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="text.secondary">Quotation {i + 1}</Typography>
                  {quotations.length > 1 && (
                    <IconButton size="small" color="error"
                      onClick={() => setQuotations(qs => qs.filter((_, idx) => idx !== i))}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
                <Stack spacing={1.5}>
                  <TextField select label="Vendor" size="small" fullWidth required
                    value={q.vendorId} onChange={e => updateQuote(i, { vendorId: e.target.value })}>
                    {vendors.map(v => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
                  </TextField>
                  <TextField label="Amount (₹)" size="small" fullWidth required
                    type="number" inputProps={{ min: 0, step: 100 }}
                    value={q.amountRupees} onChange={e => updateQuote(i, { amountRupees: e.target.value })}
                    helperText={q.amountRupees && !isNaN(parseFloat(q.amountRupees))
                      ? formatMoney(toPaise(parseFloat(q.amountRupees))) : undefined} />
                  <TextField label="Scope notes" size="small" fullWidth required multiline minRows={2}
                    value={q.scopeNotes} onChange={e => updateQuote(i, { scopeNotes: e.target.value })} />
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      <AttachFileOutlinedIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                      Quotation documents (optional)
                    </Typography>
                    <Stack spacing={0.75}>
                      {q.docSlots.map(slot => (
                        <FileUploadButton
                          key={slot.slotKey}
                          storagePathPrefix={`societies/${societyId}/expense-requests/staging/${slot.slotKey}`}
                          label="Attach document (PDF/image)"
                          disabled={submitting || !societyId}
                          onUploaded={path => updateQuote(i, {
                            docSlots: q.docSlots.map(s => s.slotKey === slot.slotKey ? { ...s, ref: path } : s),
                          })}
                          onRemoved={() => updateQuote(i, {
                            docSlots: q.docSlots.map(s => s.slotKey === slot.slotKey ? { ...s, ref: null } : s),
                          })}
                        />
                      ))}
                      {q.docSlots.every(s => s.ref !== null) && (
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          disabled={submitting}
                          onClick={() => updateQuote(i, {
                            docSlots: [...q.docSlots, { slotKey: crypto.randomUUID(), ref: null }],
                          })}
                          sx={{ alignSelf: 'flex-start' }}
                        >
                          Add another document
                        </Button>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end" pt={1}>
          <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Submit request
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
