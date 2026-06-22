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
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormDrawer from '../../components/FormDrawer';
import ConfirmModal from '../../components/ConfirmModal';
import { useVendors, useVendorRelations } from './useVendors';
import { useAuth } from '../auth/useAuth';
import { formatMoney, toPaise } from '../../lib/money';
import type { Vendor, VendorRelationKind } from '../../types/config';

// ── Vendor relations sub-panel ─────────────────────────────────────────────

function RelationsPanel({ vendor }: { vendor: Vendor }) {
  const { role } = useAuth();
  const isAdminOrFM = role === 'admin' || role === 'fm';
  const { relations, loading, createRelation, deleteRelation } = useVendorRelations(vendor.id);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ kind: 'expense' as VendorRelationKind, description: '', agreementRupees: '', periodicity: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function handleAdd() {
    if (!form.description.trim()) { setFormError('Description is required.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const rupees = parseFloat(form.agreementRupees);
      const relData: { kind: VendorRelationKind; description: string; agreementAmountPaise?: number; periodicity?: string } = {
        kind: form.kind,
        description: form.description.trim(),
      };
      if (!isNaN(rupees) && form.agreementRupees !== '') relData.agreementAmountPaise = toPaise(rupees);
      if (form.periodicity.trim()) relData.periodicity = form.periodicity.trim();
      await createRelation(relData);
      setAdding(false);
      setForm({ kind: 'expense', description: '', agreementRupees: '', periodicity: '' });
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <CircularProgress size={16} sx={{ m: 1 }} />;

  return (
    <Box sx={{ pl: 2, pr: 1, pb: 1 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
          Relations
        </Typography>
        {isAdminOrFM && !adding && (
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
            Add relation
          </Button>
        )}
      </Stack>

      {relations.length === 0 && !adding && (
        <Typography variant="body2" color="text.secondary">No relations. A vendor can have income and/or expense relations.</Typography>
      )}

      <Stack spacing={1}>
        {relations.map(r => (
          <Stack key={r.id} direction="row" alignItems="center" spacing={1}>
            <Chip
              label={r.kind === 'income' ? 'Income' : 'Expense'}
              color={r.kind === 'income' ? 'success' : 'warning'}
              size="small"
            />
            <Typography variant="body2" flex={1}>{r.description}</Typography>
            {r.agreementAmountPaise !== undefined && (
              <Typography variant="body2" color="text.secondary">{formatMoney(r.agreementAmountPaise)}</Typography>
            )}
            {r.periodicity && (
              <Typography variant="body2" color="text.secondary">{r.periodicity}</Typography>
            )}
            {isAdminOrFM && (
              <IconButton size="small" color="error" onClick={() => deleteRelation(r.id)} aria-label="Delete relation">
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        ))}
      </Stack>

      {adding && (
        <Paper variant="outlined" sx={{ p: 1.5, mt: 1 }}>
          <Stack spacing={1.5}>
            {formError && <Alert severity="error" sx={{ py: 0 }}>{formError}</Alert>}
            <Stack direction="row" spacing={1}>
              <TextField
                select label="Kind" value={form.kind}
                onChange={e => setForm(f => ({ ...f, kind: e.target.value as VendorRelationKind }))}
                size="small" sx={{ width: 140 }}
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </TextField>
              <TextField
                label="Description" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                size="small" required autoFocus sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Agreement amount (₹)" type="number" inputProps={{ min: 0 }}
                value={form.agreementRupees}
                onChange={e => setForm(f => ({ ...f, agreementRupees: e.target.value }))}
                size="small" sx={{ width: 180 }}
              />
              <TextField
                label="Periodicity" placeholder="e.g. Monthly"
                value={form.periodicity}
                onChange={e => setForm(f => ({ ...f, periodicity: e.target.value }))}
                size="small" sx={{ flex: 1 }}
              />
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" onClick={() => setAdding(false)} disabled={submitting}>Cancel</Button>
              <Button size="small" variant="contained" onClick={handleAdd} disabled={submitting}>
                {submitting ? <CircularProgress size={14} color="inherit" /> : 'Add'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}

// ── Main vendors list ──────────────────────────────────────────────────────

interface VendorForm { name: string; contact: string; notes: string }
const EMPTY_VENDOR: VendorForm = { name: '', contact: '', notes: '' };

export default function VendorsSettings() {
  const { vendors, loading, createVendor, updateVendor, deleteVendor } = useVendors();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isAdminOrFM = role === 'admin' || role === 'fm';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorForm>(EMPTY_VENDOR);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function openCreate() {
    setEditing(null); setForm(EMPTY_VENDOR); setFormError(''); setDrawerOpen(true);
  }
  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({ name: v.name, contact: v.contact ?? '', notes: v.notes ?? '' });
    setFormError(''); setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setFormError('Vendor name is required.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const data: { name: string; contact?: string; notes?: string } = { name: form.name.trim() };
      if (form.contact.trim()) data.contact = form.contact.trim();
      if (form.notes.trim()) data.notes = form.notes.trim();
      if (editing) await updateVendor(editing.id, data);
      else await createVendor(data);
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
        <Typography variant="subtitle1" fontWeight={500}>Vendors</Typography>
        {isAdminOrFM && (
          <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add vendor
          </Button>
        )}
      </Stack>

      {vendors.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No vendors yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {vendors.map(v => (
            <Paper key={v.id} variant="outlined">
              <Stack direction="row" alignItems="center" px={2} py={1} spacing={1}>
                <Box flex={1}>
                  <Typography variant="body2" fontWeight={500}>{v.name}</Typography>
                  {v.contact && <Typography variant="caption" color="text.secondary">{v.contact}</Typography>}
                </Box>
                {isAdminOrFM && (
                  <IconButton size="small" onClick={() => openEdit(v)} aria-label="Edit vendor">
                    <EditIcon fontSize="small" />
                  </IconButton>
                )}
                {isAdmin && (
                  <IconButton size="small" color="error" onClick={() => setDeleteTarget(v)} aria-label="Delete vendor">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                  aria-label={expanded === v.id ? 'Collapse' : 'Expand'}
                >
                  {expanded === v.id ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </IconButton>
              </Stack>
              <Collapse in={expanded === v.id}>
                <Divider />
                <RelationsPanel vendor={v} />
              </Collapse>
            </Paper>
          ))}
        </Stack>
      )}

      <FormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit vendor' : 'Add vendor'}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editing ? 'Save' : 'Add'}
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField label="Vendor name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required autoFocus size="small" />
          <TextField label="Contact / phone" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} size="small" />
          <TextField label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} size="small" multiline rows={2} />
        </Stack>
      </FormDrawer>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete vendor"
        description={`Delete "${deleteTarget?.name}"? All relations will also be removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => { await deleteVendor(deleteTarget!.id); setDeleteTarget(null); }}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
