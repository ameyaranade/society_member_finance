import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTranslation } from 'react-i18next';
import { callables } from '../../lib/callables';
import { useAuth } from '../auth/useAuth';
import { useMemberships } from './useMemberships';
import type { Role } from '../../types/auth';

const { inviteUser: inviteUserFn, updateMembership: updateMembershipFn } = callables;

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'mc',    label: 'MC Member' },
  { value: 'fm',    label: 'FM Team' },
  { value: 'resident', label: 'Resident' },
];

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  active:      'success',
  invited:     'warning',
  deactivated: 'default',
};

function InviteDialog({
  open,
  societyId,
  onClose,
  onDone,
}: {
  open: boolean;
  societyId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [email, setEmail]   = useState('');
  const [role, setRole]     = useState<Role>('mc');
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState('');

  async function handleInvite() {
    setError('');
    setBusy(true);
    try {
      await inviteUserFn({ email: email.trim(), role, societyId });
      onDone();
      setEmail('');
      setRole('mc');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Invite member</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <TextField
            label="Email address"
            type="email"
            required
            fullWidth
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Select
            value={role}
            onChange={e => setRole(e.target.value as Role)}
            fullWidth
          >
            {ROLES.map(r => (
              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
            ))}
          </Select>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={handleInvite} variant="contained" disabled={busy || !email}>
          Send invite
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MembersPage() {
  const { t } = useTranslation();
  const { societyId, role: callerRole } = useAuth();
  const { memberships, loading, error, refetch } = useMemberships(societyId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionError, setActionError] = useState('');

  const isAdmin = callerRole === 'admin';

  if (!isAdmin) return <Navigate to="/forbidden" replace />;

  async function toggleStatus(membershipId: string, currentStatus: string) {
    setActionError('');
    try {
      await updateMembershipFn({
        membershipId,
        status: currentStatus === 'active' ? 'deactivated' : 'active',
      });
      refetch();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function changeRole(membershipId: string, newRole: Role) {
    setActionError('');
    try {
      await updateMembershipFn({ membershipId, role: newRole });
      refetch();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4">{t('society.members')}</Typography>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setInviteOpen(true)}
          >
            Invite member
          </Button>
        )}
      </Box>

      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      {error       && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Typography color="text.secondary">Loading…</Typography>
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
              {/* Avatar placeholder */}
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                {(m.displayName || m.email || '?')[0].toUpperCase()}
              </Box>

              {/* Email + name */}
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

              {/* Status chip */}
              <Chip
                label={m.status}
                color={STATUS_COLOR[m.status] ?? 'default'}
                size="small"
                sx={{ textTransform: 'capitalize' }}
              />

              {/* Role selector (admin only) */}
              {isAdmin ? (
                <Select
                  value={m.role}
                  size="small"
                  onChange={e => changeRole(m.id, e.target.value as Role)}
                  sx={{ minWidth: { xs: 90, sm: 120 } }}
                >
                  {ROLES.map(r => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: { xs: 80, sm: 100 }, flexShrink: 0 }}>
                  {ROLES.find(r => r.value === m.role)?.label ?? m.role}
                </Typography>
              )}

              {/* Activate/deactivate (admin only) */}
              {isAdmin && (
                <Tooltip
                  title={m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                >
                  <IconButton
                    size="small"
                    onClick={() => toggleStatus(m.id, m.status)}
                    aria-label={m.status === 'active' ? 'Deactivate member' : 'Reactivate member'}
                  >
                    {m.status === 'active'
                      ? <BlockIcon fontSize="small" />
                      : <CheckCircleOutlineIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}

          {memberships.length === 0 && (
            <Box px={2} py={3} textAlign="center">
              <Typography color="text.secondary">No members yet.</Typography>
            </Box>
          )}
        </Paper>
      )}

      {isAdmin && societyId && (
        <InviteDialog
          open={inviteOpen}
          societyId={societyId}
          onClose={() => setInviteOpen(false)}
          onDone={() => { setInviteOpen(false); refetch(); }}
        />
      )}
    </Box>
  );
}
