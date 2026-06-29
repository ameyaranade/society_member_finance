import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import UploadIcon from '@mui/icons-material/Upload';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import { read as xlsxRead } from 'xlsx';
import { useUnits, type UnitCreateInput } from '../receivables/useUnits';
import { parseUnitsSheet } from '../../lib/import/unitsParser';
import { formatMoney, toPaise, fromPaise } from '../../lib/money';
import FormDrawer from '../../components/FormDrawer';
import ConfirmModal from '../../components/ConfirmModal';
import type { Unit } from '../../types/config';

// ─── Unit form ────────────────────────────────────────────────────────────────

interface UnitForm {
  tower: string;
  flatNumber: string;
  areaSqft: string;
  ownerName: string;
  ownerContact: string;
  tenantName: string;
  tenantContact: string;
  billedParty: 'owner' | 'tenant';
  maintenanceRupees: string;
  commonElecRupees: string;
}

const EMPTY_FORM: UnitForm = {
  tower: '',
  flatNumber: '',
  areaSqft: '',
  ownerName: '',
  ownerContact: '',
  tenantName: '',
  tenantContact: '',
  billedParty: 'owner',
  maintenanceRupees: '',
  commonElecRupees: '',
};

function unitToForm(u: Unit): UnitForm {
  return {
    tower:              u.tower ?? '',
    flatNumber:         u.flatNumber,
    areaSqft:           u.areaSqft != null ? String(u.areaSqft) : '',
    ownerName:          u.owner?.name ?? '',
    ownerContact:       u.owner?.contact ?? '',
    tenantName:         u.tenant?.name ?? '',
    tenantContact:      u.tenant?.contact ?? '',
    billedParty:        u.billedParty,
    maintenanceRupees:  String(fromPaise(u.maintenanceAmountPaise)),
    commonElecRupees:   String(fromPaise(u.commonElectricityAmountPaise)),
  };
}

function formToInput(f: UnitForm): UnitCreateInput {
  const maintenance = parseFloat(f.maintenanceRupees);
  const commonElec  = parseFloat(f.commonElecRupees);
  const areaSqft    = parseFloat(f.areaSqft);
  const input: UnitCreateInput = {
    flatNumber:                     f.flatNumber.trim(),
    billedParty:                    f.billedParty,
    owner:                          { name: f.ownerName.trim(), ...(f.ownerContact.trim() ? { contact: f.ownerContact.trim() } : {}) },
    maintenanceAmountPaise:         isNaN(maintenance) ? 0 : toPaise(maintenance),
    commonElectricityAmountPaise:   isNaN(commonElec)  ? 0 : toPaise(commonElec),
  };
  if (f.tower.trim())     input.tower    = f.tower.trim();
  if (!isNaN(areaSqft))   input.areaSqft = areaSqft;
  if (f.tenantName.trim()) input.tenant  = { name: f.tenantName.trim(), ...(f.tenantContact.trim() ? { contact: f.tenantContact.trim() } : {}) };
  return input;
}

// ─── Import dialog ────────────────────────────────────────────────────────────

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { importUnits } = useUnits();
  const [rows,        setRows]        = useState<ReturnType<typeof parseUnitsSheet>['rows']>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [busy,        setBusy]        = useState(false);
  const [result,      setResult]      = useState<{ imported: number; errors: string[] } | null>(null);
  const [error,       setError]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]); setParseErrors([]); setResult(null); setError('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = xlsxRead(ev.target?.result as ArrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const parsed = parseUnitsSheet(ws);
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!rows.length) return;
    setBusy(true); setError('');
    try {
      const res = await importUnits(rows);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import units from Excel</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}

          {result ? (
            <Alert severity={result.errors.length > 0 ? 'warning' : 'success'}>
              Imported {result.imported} unit{result.imported !== 1 ? 's' : ''}.
              {result.errors.length > 0 && ` ${result.errors.length} row(s) skipped.`}
            </Alert>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }} onChange={handleFile} />
              <Button variant="outlined" startIcon={<UploadIcon />} size="small"
                onClick={() => fileRef.current?.click()}>
                Choose Excel file
              </Button>

              {rows.length > 0 && (
                <Alert severity="info">
                  {rows.length} units parsed.
                  {parseErrors.length > 0 && ` ${parseErrors.length} row(s) have errors.`}
                </Alert>
              )}

              {parseErrors.length > 0 && (
                <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
                  {parseErrors.map((e, i) => (
                    <Typography key={i} variant="caption" color="error" display="block">
                      Row {e.row}: {e.message}
                    </Typography>
                  ))}
                </Box>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button variant="contained" disabled={rows.length === 0 || busy} onClick={handleImport}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <UploadIcon />}>
            Import {rows.length > 0 ? `${rows.length} units` : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UnitsSettings() {
  const { units, loading, createUnit, updateUnit, deleteUnit } = useUnits();

  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState<Unit | null>(null);
  const [form,         setForm]         = useState<UnitForm>(EMPTY_FORM);
  const [submitting,   setSubmitting]   = useState(false);
  const [formError,    setFormError]    = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleting,     setDeleting]     = useState(false);
  const [importOpen,   setImportOpen]   = useState(false);

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true);
  }
  function openEdit(u: Unit) {
    setEditing(u); setForm(unitToForm(u)); setFormError(''); setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.flatNumber.trim()) { setFormError('Flat number is required.'); return; }
    if (!form.ownerName.trim())  { setFormError('Owner name is required.'); return; }
    setSubmitting(true); setFormError('');
    try {
      const input = formToInput(form);
      if (editing) await updateUnit(editing.id, input);
      else         await createUnit(input);
      setDrawerOpen(false);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUnit(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const columns: GridColDef<Unit>[] = [
    { field: 'tower',       headerName: 'Tower',        width: 80 },
    { field: 'flatNumber',  headerName: 'Flat',         width: 90 },
    { field: 'areaSqft',    headerName: 'Area (sqft)',  width: 110 },
    { field: 'ownerName',   headerName: 'Owner',        flex: 1, minWidth: 160,
      valueGetter: (_v, row) => (row as Unit).owner?.name ?? '' },
    { field: 'tenantName',  headerName: 'Tenant',       flex: 1, minWidth: 140,
      valueGetter: (_v, row) => (row as Unit).tenant?.name ?? '' },
    { field: 'billedParty', headerName: 'Billed party', width: 110,
      valueFormatter: (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1) },
    { field: 'maintenanceAmountPaise', headerName: 'Maintenance', width: 120,
      valueFormatter: (v) => formatMoney(v as number) },
    { field: 'commonElectricityAmountPaise', headerName: 'Common elec.', width: 120,
      valueFormatter: (v) => formatMoney(v as number) },
    {
      field: '_actions',
      headerName: '',
      width: 80,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Unit>) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Edit unit">
            <IconButton size="small" onClick={() => openEdit(params.row as Unit)} aria-label="Edit unit">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete unit">
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(params.row as Unit)} aria-label="Delete unit">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={2} spacing={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={500}>Units registry</Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading…' : `${units.length} unit${units.length !== 1 ? 's' : ''} registered`}
          </Typography>
        </Box>
        <Box flex={1} />
        <Button variant="outlined" startIcon={<UploadIcon />} size="small"
          onClick={() => setImportOpen(true)}>
          Import from Excel
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} size="small"
          onClick={openCreate}>
          Add unit
        </Button>
      </Stack>

      <DataGrid
        rows={units}
        columns={columns}
        loading={loading}
        autoHeight
        density="compact"
        pageSizeOptions={[50, 100, 250]}
        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        sx={{ border: 1, borderColor: 'divider' }}
        aria-label="Units registry"
      />

      {/* Add / edit drawer */}
      <FormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `Edit unit ${editing.tower ? editing.tower + '-' : ''}${editing.flatNumber}` : 'Add unit'}
        onSubmit={handleSubmit}
        submitLabel={editing ? 'Save' : 'Add unit'}
        submitting={submitting}
        width={520}
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}

          <Stack direction="row" spacing={2}>
            <TextField
              label="Tower" value={form.tower} size="small" sx={{ width: 120 }}
              onChange={e => setForm(f => ({ ...f, tower: e.target.value }))}
            />
            <TextField
              label="Flat number" value={form.flatNumber} size="small" required sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, flatNumber: e.target.value }))}
            />
            <TextField
              label="Area (sqft)" value={form.areaSqft} size="small" type="number"
              inputProps={{ min: 0 }} sx={{ width: 120 }}
              onChange={e => setForm(f => ({ ...f, areaSqft: e.target.value }))}
            />
          </Stack>

          <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ mt: 0.5 }}>
            OWNER
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Owner name" value={form.ownerName} size="small" required sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))}
            />
            <TextField
              label="Owner contact" value={form.ownerContact} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, ownerContact: e.target.value }))}
            />
          </Stack>

          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            TENANT (optional)
          </Typography>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Tenant name" value={form.tenantName} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))}
            />
            <TextField
              label="Tenant contact" value={form.tenantContact} size="small" sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, tenantContact: e.target.value }))}
            />
          </Stack>

          <TextField
            select label="Billed party" value={form.billedParty} size="small"
            onChange={e => setForm(f => ({ ...f, billedParty: e.target.value as 'owner' | 'tenant' }))}
          >
            <MenuItem value="owner">Owner</MenuItem>
            <MenuItem value="tenant">Tenant</MenuItem>
          </TextField>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Maintenance (₹)" value={form.maintenanceRupees} size="small"
              type="number" inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, maintenanceRupees: e.target.value }))}
            />
            <TextField
              label="Common electricity (₹)" value={form.commonElecRupees} size="small"
              type="number" inputProps={{ min: 0, step: 0.01 }} sx={{ flex: 1 }}
              onChange={e => setForm(f => ({ ...f, commonElecRupees: e.target.value }))}
            />
          </Stack>
        </Stack>
      </FormDrawer>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete unit"
        description={`Delete unit ${deleteTarget?.tower ? deleteTarget.tower + '-' : ''}${deleteTarget?.flatNumber}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        confirming={deleting}
        onConfirm={handleDelete}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
      />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </Box>
  );
}
