import { useState, useEffect } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useSettings } from './useSettings';
import { useAuth } from '../auth/useAuth';
import { useMemberships } from '../admin/useMemberships';
import { validateTiers } from '../../lib/approvalTiers';
import { formatMoney, toPaise, fromPaise } from '../../lib/money';
import type { ApprovalTier } from '../../types/config';

interface TierRow {
  minRupees: string;
  maxRupees: string; // '' = open-ended
  requiredApprovers: string;
}

function toTierRow(t: ApprovalTier): TierRow {
  return {
    minRupees: String(fromPaise(t.minPaise)),
    maxRupees: t.maxPaise === null ? '' : String(fromPaise(t.maxPaise)),
    requiredApprovers: String(t.requiredApprovers),
  };
}

function fromTierRow(r: TierRow): ApprovalTier {
  return {
    minPaise: toPaise(parseFloat(r.minRupees) || 0),
    maxPaise: r.maxRupees === '' ? null : toPaise(parseFloat(r.maxRupees) || 0),
    requiredApprovers: parseInt(r.requiredApprovers, 10) || 1,
  };
}

export default function ApprovalTiersSettings() {
  const { config, loading, updateConfig } = useSettings();
  const { role, societyId } = useAuth();
  const isAdmin = role === 'admin';
  // Only admin can query all memberships; non-admin shows "—" for the MC count
  const { memberships } = useMemberships(isAdmin ? societyId : null);

  const activeMCCount = memberships.filter(m => m.role === 'mc' && m.status === 'active').length;

  const [rows, setRows] = useState<TierRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setRows((config.approvalTiers ?? []).map(toTierRow));
  }, [config]);

  function addTier() {
    setRows(prev => {
      const lastMax = prev.length > 0 ? prev[prev.length - 1].maxRupees : '0';
      const newMin = lastMax || '25000';
      return [
        ...prev.slice(0, -1),
        ...(prev.length > 0 ? [{ ...prev[prev.length - 1], maxRupees: newMin }] : []),
        { minRupees: newMin, maxRupees: '', requiredApprovers: '1' },
      ];
    });
  }

  function removeTier(i: number) {
    setRows(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      // Ensure last tier is open-ended
      if (next.length > 0) next[next.length - 1] = { ...next[next.length - 1], maxRupees: '' };
      return next;
    });
  }

  function updateRow(i: number, field: keyof TierRow, value: string) {
    setRows(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      // Keep contiguous: update next row's min when this row's max changes
      if (field === 'maxRupees' && i < next.length - 1) {
        next[i + 1] = { ...next[i + 1], minRupees: value };
      }
      return next;
    });
  }

  async function handleSave() {
    const tiers = rows.map(fromTierRow);
    const err = validateTiers(tiers, activeMCCount);
    if (err) { setSaveError(err); return; }
    setSaving(true); setSaveError('');
    try {
      await updateConfig({ approvalTiers: tiers });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <CircularProgress size={24} sx={{ m: 2 }} />;

  return (
    <Stack spacing={2} maxWidth={680}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <div>
          <Typography variant="subtitle1" fontWeight={500}>Approval tiers</Typography>
          <Typography variant="body2" color="text.secondary">
            Applies to maintenance + snag expense requests only. Active MC members: {isAdmin ? activeMCCount : '—'}.
          </Typography>
        </div>
        {isAdmin && (
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addTier}>
            Add tier
          </Button>
        )}
      </Stack>

      {rows.length === 0 ? (
        <Alert severity="warning">No approval tiers configured. Expense requests cannot be submitted until at least one tier is added.</Alert>
      ) : (
        <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 420 }}>
            <TableHead>
              <TableRow>
                <TableCell>From (₹)</TableCell>
                <TableCell>Up to (₹)</TableCell>
                <TableCell>Approvers required</TableCell>
                {isAdmin && <TableCell width={48} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {isAdmin ? (
                      <TextField
                        size="small" type="number" inputProps={{ min: 0 }}
                        value={r.minRupees}
                        onChange={e => updateRow(i, 'minRupees', e.target.value)}
                        sx={{ width: 130 }}
                      />
                    ) : formatMoney(toPaise(parseFloat(r.minRupees) || 0))}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      i < rows.length - 1 ? (
                        <TextField
                          size="small" type="number" inputProps={{ min: 1 }}
                          value={r.maxRupees}
                          onChange={e => updateRow(i, 'maxRupees', e.target.value)}
                          sx={{ width: 130 }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary" pl={1}>No limit</Typography>
                      )
                    ) : (r.maxRupees ? formatMoney(toPaise(parseFloat(r.maxRupees))) : 'No limit')}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <TextField
                        size="small" type="number" inputProps={{ min: 1, max: activeMCCount || 99 }}
                        value={r.requiredApprovers}
                        onChange={e => updateRow(i, 'requiredApprovers', e.target.value)}
                        sx={{ width: 100 }}
                      />
                    ) : r.requiredApprovers}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Tooltip title="Remove tier">
                        <IconButton size="small" color="error" onClick={() => removeTier(i)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {saveError && <Alert severity="error">{saveError}</Alert>}
      {saved && <Alert severity="success">Approval tiers saved.</Alert>}

      {isAdmin && rows.length > 0 && (
        <Stack direction="row">
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            Save tiers
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
