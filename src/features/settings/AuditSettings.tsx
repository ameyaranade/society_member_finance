import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import DownloadIcon from '@mui/icons-material/Download';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { utils as xlsxUtils, writeFile as xlsxWriteFile } from 'xlsx';
import { useAuditLogs, type AuditLogEntry } from './useAuditLogs';

const ACTION_LABELS: Record<string, string> = {
  society_created:            'Society created',
  user_invited:               'User invited',
  user_activated:             'User activated',
  role_changed:               'Role changed',
  user_deactivated:           'User deactivated',
  user_reactivated:           'User reactivated',
  user_removed:               'User removed from society',
  expense_request_created:    'Expense request created',
  expense_request_submitted:  'Expense request submitted',
  expense_request_approved:   'Expense request approved',
  expense_approval_recorded:  'Approval recorded',
  expense_request_withdrawn:  'Expense request withdrawn',
  expense_request_disbursed:  'Payment recorded',
  expense_request_completed:  'Expense request completed',
  snag_scheduled:             'Snag scheduled',
};

function formatAt(entry: AuditLogEntry): string {
  if (!entry.at) return '—';
  const d = entry.at.toDate();
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

function formatChanges(obj?: Record<string, unknown>): string {
  if (!obj) return '';
  return Object.entries(obj)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');
}

const columns: GridColDef<AuditLogEntry>[] = [
  {
    field: 'at', headerName: 'Date / time', width: 170,
    valueGetter: (_v, row) => row.at?.toDate?.() ?? null,
    valueFormatter: (_v, row) => formatAt(row as AuditLogEntry),
    sortComparator: (a, b) => (b?.getTime?.() ?? 0) - (a?.getTime?.() ?? 0),
  },
  {
    field: 'action', headerName: 'Action', flex: 1, minWidth: 200,
    valueFormatter: (v) => ACTION_LABELS[v as string] ?? String(v),
  },
  { field: 'actorRole',  headerName: 'Actor role',   width: 110 },
  { field: 'actorUid',   headerName: 'Actor UID',    width: 200 },
  { field: 'targetType', headerName: 'Target',       width: 120 },
  { field: 'targetId',   headerName: 'Target ID',    width: 220 },
  {
    field: 'after', headerName: 'After', flex: 1, minWidth: 160,
    valueFormatter: (_v, row) => formatChanges((row as AuditLogEntry).after),
  },
  {
    field: 'before', headerName: 'Before', flex: 1, minWidth: 160,
    valueFormatter: (_v, row) => formatChanges((row as AuditLogEntry).before),
  },
];

function exportToExcel(logs: AuditLogEntry[]) {
  const rows = logs.map(l => ({
    'Date / time': formatAt(l),
    'Action':      ACTION_LABELS[l.action] ?? l.action,
    'Actor role':  l.actorRole ?? '',
    'Actor UID':   l.actorUid,
    'Target type': l.targetType,
    'Target ID':   l.targetId,
    'After':       formatChanges(l.after),
    'Before':      formatChanges(l.before),
  }));
  const ws = xlsxUtils.json_to_sheet(rows);
  const wb = xlsxUtils.book_new();
  xlsxUtils.book_append_sheet(wb, ws, 'Audit log');
  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.xlsx`;
  xlsxWriteFile(wb, filename);
}

export default function AuditSettings() {
  const { logs, loading, error } = useAuditLogs();

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={2} spacing={2}>
        <Box>
          <Typography variant="subtitle1" fontWeight={500}>Audit log</Typography>
          <Typography variant="body2" color="text.secondary">
            {loading ? 'Loading…' : `${logs.length} recent entries (latest 500)`}
          </Typography>
        </Box>
        <Box flex={1} />
        <Tooltip title="Download as Excel">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              disabled={loading || logs.length === 0}
              onClick={() => exportToExcel(logs)}
            >
              Export
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataGrid
        rows={logs}
        columns={columns}
        loading={loading}
        autoHeight
        density="compact"
        pageSizeOptions={[50, 100, 250, 500]}
        initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
        sx={{ border: 1, borderColor: 'divider' }}
        aria-label="Audit log"
      />
    </Box>
  );
}
