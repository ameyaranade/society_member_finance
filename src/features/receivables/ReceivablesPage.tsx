import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { DataGrid, type GridColDef, type GridRowSelectionModel, type GridRenderCellParams } from '@mui/x-data-grid';
import { utils as xlsxUtils, read as xlsxRead, writeFile as xlsxWriteFile } from 'xlsx';
import { useAuth } from '../auth/useAuth';
import { useCollectionEntries, useCollectionPeriods } from './useCollections';
import { useVendorIncome } from './useVendorIncome';
import { useAccounts } from '../settings/useAccounts';
import { useFundHeads } from '../settings/useFundHeads';
import { useVendors, useVendorRelations } from '../settings/useVendors';
import { parseCollectionsSheet } from '../../lib/import/collectionsParser';
import { callables } from '../../lib/callables';
import { formatMoney } from '../../lib/money';
import type { CollectionEntry } from '../../types/receivables';
import type { FundCode } from '../../types/config';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  paid:    <CheckCircleOutlineIcon fontSize="small" color="success" />,
  pending: <PendingOutlinedIcon fontSize="small" color="warning" />,
  overdue: <ErrorOutlineIcon fontSize="small" color="error" />,
};

// ─── Import dialog ────────────────────────────────────────────────────────────

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  accounts: { id: string; name: string }[];
  fundHeads: { id: string; code: string; name: string }[];
}

function ImportDialog({ open, onClose, onImported, accounts, fundHeads }: ImportDialogProps) {
  const [period,    setPeriod]    = useState(currentPeriod());
  const [dueDate,   setDueDate]   = useState('');
  const [accountId, setAccountId] = useState('');
  const [fundHead,  setFundHead]  = useState<FundCode>('general');
  const [rows,      setRows]      = useState<ReturnType<typeof parseCollectionsSheet>['rows']>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [busy,      setBusy]      = useState(false);
  const [result,    setResult]    = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null);
  const [error,     setError]     = useState('');
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
      const parsed = parseCollectionsSheet(ws);
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!rows.length || !accountId || !period || !dueDate) return;
    setBusy(true); setError('');
    try {
      const res = await callables.importCollections({ period, dueDate, accountId, fundHead, rows });
      setResult(res.data);
      onImported();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  const canImport = rows.length > 0 && accountId && period && dueDate && !busy;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import collections from Excel</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}

          {result ? (
            <Alert severity={result.errors.length > 0 ? 'warning' : 'success'}>
              Imported {result.imported} entries.
              {result.errors.length > 0 && ` ${result.errors.length} row(s) skipped.`}
            </Alert>
          ) : (
            <>
              <Stack direction="row" spacing={2}>
                <TextField label="Period" type="month" size="small" sx={{ flex: 1 }}
                  InputLabelProps={{ shrink: true }}
                  value={period} onChange={e => setPeriod(e.target.value)} />
                <TextField label="Due date" type="date" size="small" sx={{ flex: 1 }}
                  InputLabelProps={{ shrink: true }}
                  value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </Stack>

              <Stack direction="row" spacing={2}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Account</InputLabel>
                  <Select label="Account" value={accountId}
                    onChange={e => setAccountId(e.target.value)}>
                    {accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Fund head</InputLabel>
                  <Select label="Fund head" value={fundHead}
                    onChange={e => setFundHead(e.target.value as FundCode)}>
                    {fundHeads.map(f => <MenuItem key={f.id} value={f.code}>{f.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>

              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }} onChange={handleFile} />
              <Button variant="outlined" startIcon={<UploadIcon />} size="small"
                onClick={() => fileRef.current?.click()}>
                Choose Excel file
              </Button>

              {rows.length > 0 && (
                <Alert severity="info">
                  {rows.length} rows parsed.
                  {parseErrors.length > 0 && ` ${parseErrors.length} parse error(s).`}
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
        <Button onClick={() => { reset(); onClose(); }}>
          {result ? 'Close' : 'Cancel'}
        </Button>
        {!result && (
          <Button variant="contained" disabled={!canImport} onClick={handleImport}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <UploadIcon />}>
            Import {rows.length > 0 ? `${rows.length} rows` : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Add single collection entry dialog ──────────────────────────────────────

interface AddEntryDialogProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  period: string;
  accounts: { id: string; name: string }[];
  fundHeads: { id: string; code: string; name: string }[];
}

function AddCollectionEntryDialog({ open, onClose, onAdded, period: parentPeriod, accounts, fundHeads }: AddEntryDialogProps) {
  const [flatNumber, setFlatNumber] = useState('');
  const [tower,      setTower]      = useState('');
  const [period,     setPeriod]     = useState(parentPeriod);
  const [dueDate,    setDueDate]    = useState('');
  const [accountId,  setAccountId]  = useState('');
  const [fundHead,   setFundHead]   = useState<FundCode>('general');
  const [status,     setStatus]     = useState<'pending' | 'paid' | 'overdue'>('pending');
  const [amtRupees,  setAmtRupees]  = useState('');
  const [payDate,    setPayDate]    = useState('');
  const [refNo,      setRefNo]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => { if (open) setPeriod(parentPeriod); }, [open, parentPeriod]);

  function handleClose() {
    setFlatNumber(''); setTower(''); setDueDate(''); setAccountId('');
    setFundHead('general'); setStatus('pending'); setAmtRupees(''); setPayDate(''); setRefNo(''); setError('');
    onClose();
  }

  async function handleAdd() {
    if (!flatNumber.trim() || !accountId || !dueDate) return;
    const amountReceivedPaise = status === 'paid' ? Math.round(parseFloat(amtRupees) * 100) : 0;
    if (status === 'paid' && amountReceivedPaise <= 0) { setError('Enter a valid amount received.'); return; }
    setBusy(true); setError('');
    try {
      await callables.importCollections({
        period, dueDate, accountId, fundHead,
        rows: [{
          flatNumber: flatNumber.trim(),
          tower:               tower.trim() || undefined,
          status,
          amountReceivedPaise,
          paymentDate: status === 'paid' ? (payDate || undefined) : undefined,
          referenceNo: refNo.trim() || undefined,
        }],
      });
      onAdded();
      handleClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add entry.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add collection entry</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}

          <Stack direction="row" spacing={2}>
            <TextField label="Flat number" size="small" required sx={{ flex: 1 }}
              value={flatNumber} onChange={e => setFlatNumber(e.target.value)} />
            <TextField label="Tower" size="small" sx={{ width: 90 }}
              value={tower} onChange={e => setTower(e.target.value)} />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField label="Period" type="month" size="small" sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
              value={period} onChange={e => setPeriod(e.target.value)} />
            <TextField label="Due date" type="date" size="small" sx={{ flex: 1 }}
              InputLabelProps={{ shrink: true }}
              value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </Stack>

          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Account</InputLabel>
              <Select label="Account" value={accountId} onChange={e => setAccountId(e.target.value)}>
                {accounts.map(a => <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Fund head</InputLabel>
              <Select label="Fund head" value={fundHead} onChange={e => setFundHead(e.target.value as FundCode)}>
                {fundHeads.map(f => <MenuItem key={f.id} value={f.code}>{f.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <FormControl size="small" fullWidth>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={e => setStatus(e.target.value as typeof status)}>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
            </Select>
          </FormControl>

          {status === 'paid' && (
            <>
              <TextField label="Amount received (₹)" size="small" required fullWidth
                value={amtRupees} onChange={e => setAmtRupees(e.target.value)} />
              <Stack direction="row" spacing={2}>
                <TextField label="Payment date" type="date" size="small" sx={{ flex: 1 }}
                  InputLabelProps={{ shrink: true }}
                  value={payDate} onChange={e => setPayDate(e.target.value)} />
                <TextField label="Reference no" size="small" sx={{ flex: 1 }}
                  value={refNo} onChange={e => setRefNo(e.target.value)} />
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd}
          disabled={!flatNumber.trim() || !accountId || !dueDate || busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}>
          Add entry
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Collections tab ──────────────────────────────────────────────────────────

function CollectionsTab() {
  const { role, societyId } = useAuth();
  const { loading: periodsLoading } = useCollectionPeriods();
  const { accounts } = useAccounts();
  const { fundHeads } = useFundHeads();

  const [period,       setPeriod]       = useState(currentPeriod());
  const [towerFilter,  setTowerFilter]  = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search,       setSearch]       = useState('');
  const [selection,    setSelection]    = useState<GridRowSelectionModel>([]);
  const [importOpen,   setImportOpen]   = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);

  const { entries, loading } = useCollectionEntries(period);

  const canWrite = role === 'admin' || role === 'fm';

  const towers = useMemo(
    () => [...new Set(entries.map(e => e.tower ?? '').filter(Boolean))].sort(),
    [entries],
  );

  const filtered = useMemo(() => entries.filter(e => {
    if (towerFilter  && e.tower !== towerFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.flatNumber.toLowerCase().includes(q) &&
          !(e.ownerName ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [entries, towerFilter, statusFilter, search]);

  const stats = useMemo(() => ({
    paid:    entries.filter(e => e.status === 'paid').length,
    pending: entries.filter(e => e.status === 'pending').length,
    overdue: entries.filter(e => e.status === 'overdue').length,
    expectedPaise: entries.reduce((s, e) => s + (e.billedPaise ?? 0), 0),
    receivedPaise: entries.filter(e => e.status === 'paid')
      .reduce((s, e) => s + (e.billedPaise ?? 0), 0),
  }), [entries]);

  function exportSelected() {
    const selSet = new Set(selection.map(String));
    const toExport = filtered.filter(e => selSet.has(e.id));
    const ws = xlsxUtils.json_to_sheet(toExport.map(e => ({
      'Flat No':    e.flatNumber,
      'Tower':      e.tower ?? '',
      'Owner':      e.ownerName ?? '',
      'Billed (₹)': ((e.billedPaise ?? 0) / 100).toFixed(2),
      'Status':     e.status,
      'Due Date':   e.dueDate ?? '',
    })));
    const wb = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(wb, ws, 'Collections');
    xlsxWriteFile(wb, `collections-${period}.xlsx`);
  }

  const columns: GridColDef<CollectionEntry>[] = [
    { field: 'flatNumber',  headerName: 'Flat',    width: 80 },
    { field: 'tower',       headerName: 'Tower',   width: 70 },
    { field: 'ownerName',   headerName: 'Owner',   flex: 1, minWidth: 140 },
    {
      field: 'billedPaise', headerName: 'Billed',  width: 100,
      valueFormatter: (v) => formatMoney(v as number),
    },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {STATUS_ICON[value as string]}
          <span style={{ textTransform: 'capitalize' }}>{value as string}</span>
        </Stack>
      ),
    },
    { field: 'paidAt',      headerName: 'Paid on', width: 100 },
    { field: 'referenceNo', headerName: 'Ref No',  width: 110 },
    { field: 'dueDate',     headerName: 'Due',     width: 95 },
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap">
        <TextField label="Month" type="month" size="small"
          InputLabelProps={{ shrink: true }}
          value={period} onChange={e => setPeriod(e.target.value)} sx={{ width: 160 }} />

        {entries.length > 0 && (
          <>
            <Chip icon={<CheckCircleOutlineIcon />} label={`Paid ${stats.paid}`}
              color="success" size="small" variant="outlined" />
            <Chip icon={<PendingOutlinedIcon />} label={`Pending ${stats.pending}`}
              color="warning" size="small" variant="outlined" />
            {stats.overdue > 0 && (
              <Chip icon={<ErrorOutlineIcon />} label={`Overdue ${stats.overdue}`}
                color="error" size="small" variant="outlined" />
            )}
            <Typography variant="body2" color="text.secondary">
              {formatMoney(stats.receivedPaise)} / {formatMoney(stats.expectedPaise)}
            </Typography>
          </>
        )}

        <Box flex={1} />

        {canWrite && (
          <>
            <Button size="small" startIcon={<UploadIcon />} variant="outlined"
              onClick={() => setImportOpen(true)}>
              Import Excel
            </Button>
            <Button size="small" variant="outlined" onClick={() => setAddEntryOpen(true)}>
              Add entry
            </Button>
          </>
        )}
        {selection.length > 0 && (
          <Button size="small" startIcon={<DownloadIcon />} variant="outlined"
            onClick={exportSelected}>
            Export ({selection.length})
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1.5} mb={1.5} flexWrap="wrap">
        <TextField size="small" placeholder="Search flat / owner" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ width: 200 }} />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Tower</InputLabel>
          <Select label="Tower" value={towerFilter}
            onChange={e => setTowerFilter(e.target.value)}>
            <MenuItem value="">All towers</MenuItem>
            {towers.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="overdue">Overdue</MenuItem>
          </Select>
        </FormControl>
        {(towerFilter || statusFilter || search) && (
          <Button size="small"
            onClick={() => { setTowerFilter(''); setStatusFilter(''); setSearch(''); }}>
            Clear filters
          </Button>
        )}
      </Stack>

      <DataGrid
        rows={filtered}
        columns={columns}
        loading={loading || periodsLoading}
        autoHeight
        checkboxSelection={canWrite}
        onRowSelectionModelChange={setSelection}
        rowSelectionModel={selection}
        density="compact"
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
        sx={{ border: 1, borderColor: 'divider' }}
        aria-label="Collections grid"
      />

      {societyId && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={() => setImportOpen(false)}
          accounts={accounts}
          fundHeads={fundHeads}
        />
      )}
      {societyId && (
        <AddCollectionEntryDialog
          open={addEntryOpen}
          onClose={() => setAddEntryOpen(false)}
          onAdded={() => setAddEntryOpen(false)}
          period={period}
          accounts={accounts}
          fundHeads={fundHeads}
        />
      )}
    </Box>
  );
}

// ─── Vendor income tab ────────────────────────────────────────────────────────

function VendorIncomeTab() {
  const { role } = useAuth();
  const { vendors } = useVendors();
  const [period, setPeriod] = useState(currentPeriod());
  const { records, loading, createRecord, recordReceipt } = useVendorIncome(period);
  const [addOpen,     setAddOpen]     = useState(false);
  const [receiptOpen, setReceiptOpen] = useState<string | null>(null);
  const [error,       setError]       = useState('');
  const [busy,        setBusy]        = useState(false);

  const [vendorId,      setVendorId]      = useState('');
  const [vendorRelId,   setVendorRelId]   = useState('');
  const { relations }  = useVendorRelations(vendorId || null);
  const incomeRelations = relations.filter(r => r.kind === 'income');

  const [expectedRupees, setExpectedRupees] = useState('');
  const [dueDay,         setDueDay]         = useState('5');
  const [remarks,        setRemarks]        = useState('');
  const [receivedRupees, setReceivedRupees] = useState('');
  const [receiptRemarks, setReceiptRemarks] = useState('');

  const canWrite = role === 'admin' || role === 'fm';

  async function handleAdd() {
    const expectedPaise = Math.round(parseFloat(expectedRupees) * 100);
    if (!vendorId || !vendorRelId || isNaN(expectedPaise) || expectedPaise <= 0) return;
    const dueDateISO = `${period}-${String(dueDay).padStart(2, '0')}`;
    setBusy(true); setError('');
    try {
      await createRecord({
        vendorId, vendorRelationId: vendorRelId, period, expectedPaise,
        dueDate: dueDateISO, remarks: remarks || undefined,
      });
      setAddOpen(false);
      setVendorId(''); setVendorRelId(''); setExpectedRupees(''); setRemarks('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleReceipt() {
    if (!receiptOpen) return;
    const receivedPaise = Math.round(parseFloat(receivedRupees) * 100);
    if (isNaN(receivedPaise) || receivedPaise <= 0) return;
    setBusy(true); setError('');
    try {
      await recordReceipt(receiptOpen, { receivedPaise, remarks: receiptRemarks || undefined });
      setReceiptOpen(null); setReceivedRupees(''); setReceiptRemarks('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  const columns: GridColDef[] = [
    {
      field: 'vendorId', headerName: 'Vendor', flex: 1, minWidth: 140,
      valueGetter: (v) => vendors.find(vd => vd.id === v)?.name ?? (v as string),
    },
    { field: 'expectedPaise', headerName: 'Expected', width: 110,
      valueFormatter: (v) => formatMoney(v as number) },
    { field: 'receivedPaise', headerName: 'Received', width: 110,
      valueFormatter: (v) => formatMoney(v as number) },
    {
      field: 'status', headerName: 'Status', width: 100,
      renderCell: ({ value }: GridRenderCellParams) => (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {STATUS_ICON[value as string] ?? STATUS_ICON['pending']}
          <span style={{ textTransform: 'capitalize' }}>{value as string}</span>
        </Stack>
      ),
    },
    { field: 'dueDate',  headerName: 'Due',     width: 100 },
    { field: 'remarks',  headerName: 'Remarks', flex: 1 },
    ...(canWrite ? [{
      field: '_actions', headerName: '', width: 130, sortable: false,
      renderCell: (params: GridRenderCellParams) =>
        (params.row as { status: string }).status !== 'paid' ? (
          <Button size="small" variant="outlined"
            onClick={() => { setReceiptOpen(params.id as string); setReceivedRupees(''); }}>
            Record receipt
          </Button>
        ) : null,
    } satisfies GridColDef] : []),
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={2}>
        <TextField label="Month" type="month" size="small"
          InputLabelProps={{ shrink: true }}
          value={period} onChange={e => setPeriod(e.target.value)} sx={{ width: 160 }} />
        <Box flex={1} />
        {canWrite && (
          <Button size="small" variant="outlined" onClick={() => setAddOpen(true)}>
            Add vendor income
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <DataGrid
        rows={records} columns={columns} loading={loading} autoHeight
        density="compact" pageSizeOptions={[25, 50]}
        aria-label="Vendor income grid"
        sx={{ border: 1, borderColor: 'divider' }}
      />

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add vendor income record</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Vendor</InputLabel>
              <Select label="Vendor" value={vendorId}
                onChange={e => { setVendorId(e.target.value); setVendorRelId(''); }}>
                {vendors.map(v => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}
              </Select>
            </FormControl>
            {vendorId && (
              <FormControl size="small" fullWidth>
                <InputLabel>Income relation</InputLabel>
                <Select label="Income relation" value={vendorRelId}
                  onChange={e => setVendorRelId(e.target.value)}>
                  {incomeRelations.map(r => (
                    <MenuItem key={r.id} value={r.id}>{r.description}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Stack direction="row" spacing={2}>
              <TextField label="Expected (₹)" size="small" sx={{ flex: 1 }}
                value={expectedRupees} onChange={e => setExpectedRupees(e.target.value)} />
              <TextField label="Due day" size="small" sx={{ width: 90 }} type="number"
                inputProps={{ min: 1, max: 28 }}
                value={dueDay} onChange={e => setDueDay(e.target.value)} />
            </Stack>
            <TextField label="Remarks (optional)" size="small" fullWidth
              value={remarks} onChange={e => setRemarks(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd}
            disabled={busy || !vendorId || !vendorRelId || !expectedRupees}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!receiptOpen} onClose={() => setReceiptOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Record receipt</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Amount received (₹)" size="small" fullWidth autoFocus
              value={receivedRupees} onChange={e => setReceivedRupees(e.target.value)} />
            <TextField label="Remarks (optional)" size="small" fullWidth
              value={receiptRemarks} onChange={e => setReceiptRemarks(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptOpen(null)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={handleReceipt}
            disabled={busy || !receivedRupees}>
            Record
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReceivablesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const TAB_KEYS = ['collections', 'income'] as const;
  type ReceivablesTabKey = typeof TAB_KEYS[number];
  const tabKey = (searchParams.get('tab') ?? 'collections') as ReceivablesTabKey;
  const tab = Math.max(0, TAB_KEYS.indexOf(tabKey));
  function setTab(idx: number) { setSearchParams({ tab: TAB_KEYS[idx] }, { replace: true }); }

  return (
    <Box>
      <Typography variant="h4" mb={2}>Receivables</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v as number)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Collections" />
        <Tab label="Vendor Income" />
      </Tabs>
      {tab === 0 && <CollectionsTab />}
      {tab === 1 && <VendorIncomeTab />}
    </Box>
  );
}
