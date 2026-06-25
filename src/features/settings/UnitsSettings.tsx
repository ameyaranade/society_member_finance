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
import UploadIcon from '@mui/icons-material/Upload';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { read as xlsxRead } from 'xlsx';
import { useUnits } from '../receivables/useUnits';
import { parseUnitsSheet } from '../../lib/import/unitsParser';
import { formatMoney } from '../../lib/money';
import type { Unit } from '../../types/config';

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

  function handleClose() {
    reset();
    onClose();
  }

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
        <Button onClick={handleClose}>
          {result ? 'Close' : 'Cancel'}
        </Button>
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

const columns: GridColDef<Unit>[] = [
  { field: 'tower',       headerName: 'Tower',  width: 80 },
  { field: 'flatNumber',  headerName: 'Flat',   width: 90 },
  { field: 'areaSqft',    headerName: 'Area (sqft)', width: 110 },
  { field: 'ownerName',   headerName: 'Owner',  flex: 1, minWidth: 160,
    valueGetter: (_v, row) => (row as Unit).owner?.name ?? '' },
  { field: 'tenantName',  headerName: 'Tenant', flex: 1, minWidth: 140,
    valueGetter: (_v, row) => (row as Unit).tenant?.name ?? '' },
  { field: 'billedParty', headerName: 'Billed party', width: 110,
    valueFormatter: (v) => String(v).charAt(0).toUpperCase() + String(v).slice(1) },
  { field: 'maintenanceAmountPaise', headerName: 'Maintenance', width: 120,
    valueFormatter: (v) => formatMoney(v as number) },
  { field: 'commonElectricityAmountPaise', headerName: 'Common elec.', width: 120,
    valueFormatter: (v) => formatMoney(v as number) },
];

export default function UnitsSettings() {
  const { units, loading } = useUnits();
  const [importOpen, setImportOpen] = useState(false);

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

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </Box>
  );
}
