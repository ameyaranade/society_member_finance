import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditIcon from '@mui/icons-material/Edit';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import UploadIcon from '@mui/icons-material/Upload';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import { read as xlsxRead } from 'xlsx';
import { parseMembersSheet } from '../../lib/import/membersParser';
import { useTranslation } from 'react-i18next';
import { callables } from '../../lib/callables';
import { useAuth } from '../auth/useAuth';
import { useMemberships } from './useMemberships';
import FormDrawer from '../../components/FormDrawer';
import ConfirmModal from '../../components/ConfirmModal';
import StatusChip from '../../components/StatusChip';
import type { Role } from '../../types/auth';
import type { StatusVariant } from '../../components/StatusChip';

const { inviteUser: inviteUserFn, updateMembership: updateMembershipFn, removeMembership: removeMembershipFn, inviteUsersBulk: inviteUsersBulkFn } = callables;

// ─── Bulk import dialog ───────────────────────────────────────────────────────

function BulkImportDialog({ open, societyId, onClose, onDone }: {
  open: boolean;
  societyId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows,        setRows]        = useState<ReturnType<typeof parseMembersSheet>['rows']>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [busy,        setBusy]        = useState(false);
  const [result,      setResult]      = useState<{ invited: number; errors: { email: string; message: string }[] } | null>(null);
  const [error,       setError]       = useState('');

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
      const parsed = parseMembersSheet(ws);
      setRows(parsed.rows);
      setParseErrors(parsed.errors);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!rows.length) return;
    setBusy(true); setError('');
    try {
      const res = await inviteUsersBulkFn({ societyId, rows });
      setResult(res.data);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() { reset(); onClose(); }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import members from CSV / Excel</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <Typography variant="body2" color="text.secondary">
            Spreadsheet must have columns: <strong>email</strong> and optionally <strong>role</strong> (admin / mc / fm / resident; defaults to resident).
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          {result ? (
            <>
              <Alert severity={result.errors.length > 0 ? 'warning' : 'success'}>
                Invited {result.invited} member{result.invited !== 1 ? 's' : ''}.
                {result.errors.length > 0 && ` ${result.errors.length} row(s) skipped.`}
              </Alert>
              {result.errors.length > 0 && (
                <Box sx={{ maxHeight: 160, overflow: 'auto' }}>
                  {result.errors.map((e, i) => (
                    <Typography key={i} variant="caption" color="error" display="block">
                      {e.email}: {e.message}
                    </Typography>
                  ))}
                </Box>
              )}
            </>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }} onChange={handleFile} />
              <Button variant="outlined" startIcon={<UploadIcon />} size="small"
                onClick={() => fileRef.current?.click()}>
                Choose file
              </Button>

              {rows.length > 0 && (
                <Alert severity="info">
                  {rows.length} member{rows.length !== 1 ? 's' : ''} parsed.
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
            Invite {rows.length > 0 ? `${rows.length} members` : ''}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin',    label: 'Admin' },
  { value: 'mc',       label: 'MC Member' },
  { value: 'fm',       label: 'FM Team' },
  { value: 'resident', label: 'Resident' },
];

function roleLabel(r: Role) {
  return ROLES.find(x => x.value === r)?.label ?? r;
}

export default function MembersPage() {
  const { t } = useTranslation();
  const { societyId, role: callerRole } = useAuth();
  const { memberships, loading, error, refetch } = useMemberships(societyId);

  // ── Bulk import ────────────────────────────────────────────────────────────
  const [bulkOpen, setBulkOpen] = useState(false);

  // ── Invite drawer ──────────────────────────────────────────────────────────
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState<Role>('mc');
  const [inviting,    setInviting]    = useState(false);
  const [inviteError, setInviteError] = useState('');

  // ── Edit-role drawer ───────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<{ id: string; displayName: string; email: string; role: Role } | null>(null);
  const [editRole,   setEditRole]   = useState<Role>('mc');
  const [saving,     setSaving]     = useState(false);
  const [editError,  setEditError]  = useState('');

  // ── Deactivate confirm ─────────────────────────────────────────────────────
  const [confirmDeactivate, setConfirmDeactivate] = useState<{ id: string; name: string } | null>(null);
  const [toggling,          setToggling]          = useState(false);

  // ── Remove from society ────────────────────────────────────────────────────
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);
  const [removing,      setRemoving]      = useState(false);

  // ── Shared error ───────────────────────────────────────────────────────────
  const [actionError, setActionError] = useState('');

  const isAdmin = callerRole === 'admin';
  if (!isAdmin) return <Navigate to="/forbidden" replace />;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openInvite() {
    setInviteEmail(''); setInviteRole('mc'); setInviteError(''); setInviteOpen(true);
  }

  async function handleInvite() {
    if (!societyId) return;
    setInviteError(''); setInviting(true);
    try {
      await inviteUserFn({ email: inviteEmail.trim(), role: inviteRole, societyId });
      setInviteOpen(false);
      refetch();
    } catch (err) {
      setInviteError((err as Error).message);
    } finally {
      setInviting(false);
    }
  }

  function openEdit(m: { id: string; displayName?: string; email: string; role: Role }) {
    setEditTarget({ id: m.id, displayName: m.displayName ?? m.email, email: m.email, role: m.role });
    setEditRole(m.role);
    setEditError('');
  }

  async function handleEditSave() {
    if (!editTarget) return;
    setSaving(true); setEditError('');
    try {
      await updateMembershipFn({ membershipId: editTarget.id, role: editRole });
      setEditTarget(null);
      refetch();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirmRemove) return;
    setActionError(''); setRemoving(true);
    try {
      await removeMembershipFn({ membershipId: confirmRemove.id });
      setConfirmRemove(null);
      refetch();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  async function toggleStatus(membershipId: string, newStatus: 'active' | 'deactivated') {
    setActionError(''); setToggling(true);
    try {
      await updateMembershipFn({ membershipId, status: newStatus });
      refetch();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setToggling(false);
      setConfirmDeactivate(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4">{t('society.members')}</Typography>
        <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => setBulkOpen(true)}>
          Import members
        </Button>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={openInvite}>
          Invite member
        </Button>
      </Box>

      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      {error       && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <CircularProgress size={24} sx={{ m: 2 }} />
      ) : (
        <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          {memberships.map((m, idx) => (
            <Box
              key={m.id}
              display="flex"
              alignItems="center"
              gap={{ xs: 1, sm: 2 }}
              px={2}
              py={1.5}
              sx={{
                borderTop: idx > 0 ? 1 : 0,
                borderColor: 'divider',
                opacity: m.status === 'deactivated' ? 0.5 : 1,
              }}
            >
              {/* Avatar */}
              <Box sx={{
                width: 36, height: 36, borderRadius: '50%',
                bgcolor: 'primary.main', color: 'primary.contrastText',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.875rem', fontWeight: 500, flexShrink: 0,
              }}>
                {(m.displayName || m.email || '?')[0].toUpperCase()}
              </Box>

              {/* Name + email */}
              <Box flexGrow={1} minWidth={0}>
                <Typography variant="body2" noWrap fontWeight={500}>
                  {m.displayName || m.email}
                </Typography>
                {m.displayName && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {m.email}
                  </Typography>
                )}
              </Box>

              {/* Status — icon + label via StatusChip */}
              <StatusChip status={m.status as StatusVariant} />

              {/* Role label */}
              <Typography variant="body2" color="text.secondary"
                sx={{ minWidth: { xs: 80, sm: 100 }, flexShrink: 0 }}>
                {roleLabel(m.role)}
              </Typography>

              {/* Actions */}
              <Stack direction="row" spacing={0.5} flexShrink={0}>
                <Tooltip title="Edit role">
                  <IconButton size="small" onClick={() => openEdit(m)} aria-label="Edit member role">
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>

                <Tooltip title={m.status === 'active' ? 'Deactivate' : 'Reactivate'}>
                  <IconButton
                    size="small"
                    aria-label={m.status === 'active' ? 'Deactivate member' : 'Reactivate member'}
                    onClick={() => {
                      if (m.status === 'active') {
                        setConfirmDeactivate({ id: m.id, name: m.displayName || m.email });
                      } else {
                        void toggleStatus(m.id, 'active');
                      }
                    }}
                  >
                    {m.status === 'active'
                      ? <BlockIcon fontSize="small" />
                      : <CheckCircleOutlineIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>

                <Tooltip title="Remove from society">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Remove member from society"
                    onClick={() => setConfirmRemove({ id: m.id, name: m.displayName || m.email })}
                  >
                    <PersonRemoveIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}

          {memberships.length === 0 && (
            <Box px={2} py={3} textAlign="center">
              <Typography color="text.secondary">No members yet.</Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Invite drawer */}
      <FormDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite member"
        onSubmit={handleInvite}
        submitLabel="Send invite"
        submitting={inviting}
      >
        <Stack spacing={2}>
          {inviteError && <Alert severity="error">{inviteError}</Alert>}
          <TextField
            label="Email address" type="email" required fullWidth size="small"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
          />
          <TextField
            select label="Role" value={inviteRole} size="small" fullWidth
            onChange={e => setInviteRole(e.target.value as Role)}
          >
            {ROLES.map(r => (
              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </FormDrawer>

      {/* Edit-role drawer */}
      <FormDrawer
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={`Edit member — ${editTarget?.displayName ?? ''}`}
        onSubmit={handleEditSave}
        submitLabel="Save"
        submitting={saving}
      >
        <Stack spacing={2}>
          {editError && <Alert severity="error">{editError}</Alert>}
          <TextField label="Email" value={editTarget?.email ?? ''} size="small" fullWidth disabled />
          <TextField
            select label="Role" value={editRole} size="small" fullWidth
            onChange={e => setEditRole(e.target.value as Role)}
          >
            {ROLES.map(r => (
              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </FormDrawer>

      {/* Deactivate confirm */}
      <ConfirmModal
        open={!!confirmDeactivate}
        title="Deactivate member?"
        description={`Deactivate ${confirmDeactivate?.name}? They will lose access immediately.`}
        confirmLabel="Deactivate"
        danger
        confirming={toggling}
        onConfirm={() => confirmDeactivate && void toggleStatus(confirmDeactivate.id, 'deactivated')}
        onClose={() => { if (!toggling) setConfirmDeactivate(null); }}
      />

      {/* Remove from society confirm */}
      <ConfirmModal
        open={!!confirmRemove}
        title="Remove from society?"
        description={`Remove ${confirmRemove?.name} from this society? Their membership will be permanently deleted and they will lose all access. This cannot be undone.`}
        confirmLabel="Remove from society"
        danger
        confirming={removing}
        onConfirm={() => void handleRemove()}
        onClose={() => { if (!removing) setConfirmRemove(null); }}
      />

      {/* Bulk import */}
      {societyId && (
        <BulkImportDialog
          open={bulkOpen}
          societyId={societyId}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); refetch(); }}
        />
      )}
    </Box>
  );
}
