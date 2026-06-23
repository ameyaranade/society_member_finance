import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Link from '@mui/material/Link';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import PaidIcon from '@mui/icons-material/Paid';
import BlockIcon from '@mui/icons-material/Block';
import ScheduleIcon from '@mui/icons-material/Schedule';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { db, functions, storage } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import { useVendors } from '../settings/useVendors';
import { formatMoney } from '../../lib/money';
import type { ExpenseRequest } from '../../types/requests';
import DisbursementDialog from './DisbursementDialog';

// ─── Callables ────────────────────────────────────────────────────────────────

const approveFn  = httpsCallable<{ requestId: string; note?: string }, { ok: true; approved: boolean }>(functions, 'recordApproval');
const withdrawFn = httpsCallable<{ requestId: string }, { ok: true }>(functions, 'withdrawExpenseRequest');
const closeFn    = httpsCallable<{ requestId: string; closingNote?: string }, { ok: true }>(functions, 'closeExpenseRequest');

// ─── Loose subcollection doc types ───────────────────────────────────────────
// Field names vary from what the TS types declare (legacy saves used different keys).

interface QuotationDoc {
  id: string; vendorId: string; amountPaise: number; scopeNotes: string;
  documentRef?: string;
}
interface ApprovalDoc {
  id: string; mcUid: string; note?: string; approvedAt: unknown;
}
interface NoteDoc {
  id: string; text: string; authorUid: string; authorDisplayName?: string | null;
  at?: unknown; createdAt?: unknown;
}
interface DisbursementDoc {
  id: string; amountPaise: number; kind: 'partial' | 'final'; paidAt: unknown;
  invoiceRef?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMillis(v: unknown): number {
  if (!v) return 0;
  if (typeof (v as { toMillis?: unknown }).toMillis === 'function')
    return (v as { toMillis: () => number }).toMillis();
  return 0;
}

function fmt(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(ms));
}

function fmtDateTime(ts: unknown): string {
  const ms = toMillis(ts);
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(ms));
}

// ─── Stage configuration ─────────────────────────────────────────────────────

const MAINT_STEPS = ['Requested', 'Approved', 'Disbursed', 'Completed'];
const SNAG_STEPS  = ['Scheduled', 'Requested', 'Approved', 'Disbursed'];

function getActiveStep(status: string, type: string): number {
  if (type === 'snag') {
    return ({ scheduled: 0, requested: 1, approved: 2, disbursed: 3, completed: 4 } as Record<string, number>)[status] ?? -1;
  }
  return ({ requested: 0, approved: 1, disbursed: 2, completed: 4 } as Record<string, number>)[status] ?? -1;
}

// ─── Status chip ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: 'default' | 'info' | 'warning' | 'success' | 'error'; icon: React.ReactNode }> = {
  scheduled: { label: 'Scheduled',        color: 'default',  icon: <ScheduleIcon fontSize="small" /> },
  requested: { label: 'Pending approval', color: 'warning',  icon: <HourglassTopIcon fontSize="small" /> },
  approved:  { label: 'Approved',         color: 'info',     icon: <CheckCircleIcon fontSize="small" /> },
  disbursed: { label: 'Disbursed',        color: 'info',     icon: <AccountBalanceWalletIcon fontSize="small" /> },
  completed: { label: 'Completed',        color: 'success',  icon: <TaskAltIcon fontSize="small" /> },
  withdrawn: { label: 'Withdrawn',        color: 'error',    icon: <BlockIcon fontSize="small" /> },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: 'default' as const, icon: null };
  return (
    <Chip
      size="small"
      label={cfg.label}
      color={cfg.color}
      icon={cfg.icon as React.ReactElement}
    />
  );
}

// ─── StorageLink — resolves a GCS path to a download URL on mount ────────────

function StorageLink({ storagePath }: { storagePath: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDownloadURL(storageRef(storage, storagePath))
      .then(u => { if (!cancelled) setUrl(u); })
      .catch(() => {/* ignore — file may have been deleted */});
    return () => { cancelled = true; };
  }, [storagePath]);

  if (!url) return null;

  const fileName = storagePath.split('/').pop() ?? 'document';
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
      <AttachFileIcon fontSize="inherit" sx={{ color: 'text.secondary', fontSize: 14 }} />
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        variant="caption"
        underline="hover"
        sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {fileName}
      </Link>
    </Stack>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  request: ExpenseRequest | null;
  onClose: () => void;
  onTakeUp?: (r: ExpenseRequest) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RequestDetailDrawer({ request, onClose, onTakeUp }: Props) {
  const { societyId, role, user } = useAuth();
  const { vendors } = useVendors();

  const requestId = request?.id ?? null;

  const [quotations,    setQuotations]    = useState<QuotationDoc[]>([]);
  const [approvals,     setApprovals]     = useState<ApprovalDoc[]>([]);
  const [notes,         setNotes]         = useState<NoteDoc[]>([]);
  const [disbursements, setDisbursements] = useState<DisbursementDoc[]>([]);

  const [noteText,    setNoteText]    = useState('');
  const [addingNote,  setAddingNote]  = useState(false);
  const [noteError,   setNoteError]   = useState('');

  const [disbTarget,      setDisbTarget]      = useState<ExpenseRequest | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmClose,    setConfirmClose]    = useState(false);
  const [actionBusy,      setActionBusy]      = useState(false);
  const [actionError,     setActionError]     = useState('');
  const [successMsg,      setSuccessMsg]      = useState('');

  const notesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to subcollections
  useEffect(() => {
    if (!societyId || !requestId) {
      setQuotations([]); setApprovals([]); setNotes([]); setDisbursements([]);
      return;
    }
    const base = `societies/${societyId}/expenseRequests/${requestId}`;
    const unsubs = [
      onSnapshot(collection(db, `${base}/quotations`), snap => {
        setQuotations(snap.docs.map(d => ({ id: d.id, ...d.data() }) as QuotationDoc));
      }),
      onSnapshot(collection(db, `${base}/approvals`), snap => {
        setApprovals(
          snap.docs.map(d => ({ id: d.id, ...d.data() }) as ApprovalDoc)
            .sort((a, b) => toMillis(a.approvedAt) - toMillis(b.approvedAt)),
        );
      }),
      onSnapshot(collection(db, `${base}/notes`), snap => {
        setNotes(
          snap.docs.map(d => ({ id: d.id, ...d.data() }) as NoteDoc)
            .sort((a, b) => toMillis(a.at ?? a.createdAt) - toMillis(b.at ?? b.createdAt)),
        );
      }),
      onSnapshot(collection(db, `${base}/disbursements`), snap => {
        setDisbursements(
          snap.docs.map(d => ({ id: d.id, ...d.data() }) as DisbursementDoc)
            .sort((a, b) => toMillis(a.paidAt) - toMillis(b.paidAt)),
        );
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [societyId, requestId]);

  // Reset transient UI state when request changes
  useEffect(() => {
    setNoteText(''); setNoteError('');
    setActionError(''); setSuccessMsg('');
    setDisbTarget(null); setConfirmWithdraw(false); setConfirmClose(false);
  }, [requestId]);

  // Auto-scroll notes list
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  async function handleAddNote() {
    if (!noteText.trim() || !societyId || !requestId) return;
    setAddingNote(true); setNoteError('');
    try {
      await addDoc(collection(db, `societies/${societyId}/expenseRequests/${requestId}/notes`), {
        text: noteText.trim(),
        authorUid: user?.uid ?? '',
        authorDisplayName: user?.displayName ?? null,
        role,
        createdAt: serverTimestamp(),
        societyId,
      });
      setNoteText('');
    } catch (e: unknown) {
      setNoteError(e instanceof Error ? e.message : 'Failed to add note.');
    } finally {
      setAddingNote(false);
    }
  }

  async function handleApprove() {
    if (!requestId) return;
    setActionBusy(true); setActionError('');
    try {
      const res = await approveFn({ requestId });
      setSuccessMsg(res.data.approved ? 'Request fully approved.' : 'Approval recorded.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Approval failed.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleWithdraw() {
    if (!requestId) return;
    setActionBusy(true); setActionError('');
    try {
      await withdrawFn({ requestId });
      setConfirmWithdraw(false);
      setSuccessMsg('Request withdrawn.');
      setTimeout(() => { setSuccessMsg(''); onClose(); }, 1800);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Withdraw failed.');
      setConfirmWithdraw(false);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleClose() {
    if (!requestId) return;
    setActionBusy(true); setActionError('');
    try {
      await closeFn({ requestId });
      setConfirmClose(false);
      setSuccessMsg('Request marked as completed.');
      setTimeout(() => { setSuccessMsg(''); onClose(); }, 1800);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Close failed.');
      setConfirmClose(false);
    } finally {
      setActionBusy(false);
    }
  }

  // Derived values
  const status          = request?.status ?? 'requested';
  const type            = request?.type ?? 'maintenance';
  const steps           = type === 'snag' ? SNAG_STEPS : MAINT_STEPS;
  const step            = request ? getActiveStep(status, type) : 0;
  const isMC            = role === 'mc';
  const isFM            = role === 'fm';
  const isAdmin         = role === 'admin';
  const alreadyApproved = request?.approvedBy?.includes(user?.uid ?? '') ?? false;
  const hasDisbursed    = disbursements.length > 0;

  const canApprove  = isMC && status === 'requested' && !alreadyApproved;
  const canDisburse = isFM && (status === 'approved' || status === 'disbursed');
  const canClose    = isFM && status === 'disbursed';
  const canTakeUp   = isFM && type === 'snag' && status === 'scheduled';
  const canWithdraw =
    (isFM && type === 'maintenance' && status === 'requested' && !hasDisbursed) ||
    (isAdmin && type === 'snag' && (status === 'scheduled' || (status === 'requested' && !hasDisbursed)));

  const hasActions = canApprove || canDisburse || canClose || canTakeUp || canWithdraw;

  const vendorName = (id: string) => vendors.find(v => v.id === id)?.name ?? id;

  return (
    <>
      <Drawer
        anchor="right"
        open={!!request}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 560 },
            display: 'flex',
            flexDirection: 'column',
            top: '64px',
            height: 'calc(100% - 64px)',
          },
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Box flex={1} minWidth={0}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5} flexWrap="wrap">
                <Chip
                  size="small"
                  label={type === 'snag' ? 'Snag' : 'Maintenance'}
                  color={type === 'snag' ? 'secondary' : 'default'}
                  variant="outlined"
                />
                <StatusChip status={status} />
              </Stack>
              <Typography variant="h6" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                {request?.title}
              </Typography>
              {request?.location && (
                <Typography variant="caption" color="text.secondary">{request.location}</Typography>
              )}
            </Box>
            <IconButton onClick={onClose} size="small" aria-label="Close detail panel">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* ── Scrollable body ─────────────────────────────────────────── */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>

          {/* Withdrawn banner */}
          {status === 'withdrawn' && (
            <Alert severity="error" icon={<BlockIcon />} sx={{ mb: 3 }}>
              This request was withdrawn.
            </Alert>
          )}

          {/* Stage stepper */}
          {status !== 'withdrawn' && (
            <Box mb={3}>
              <Stepper activeStep={step} alternativeLabel>
                {steps.map((label, i) => (
                  <Step key={label} completed={step > i}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}

          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          {successMsg  && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

          {/* ── Details ────────────────────────────────────────────────── */}
          <Box mb={3}>
            <Typography variant="overline" color="text.secondary">Details</Typography>
            <Stack spacing={1} mt={1}>
              <Row label="Category"     value={request?.category ?? '—'} capitalize />
              <Row label="Priority"     value={request?.priority ?? '—'} capitalize />
              <Row label="Fund head"    value={request?.fundHead ?? '—'} capitalize />
              {request?.plan && <Row label="Budget window" value={request.plan.label} />}
              <Row label="Estimated cost" value={request ? formatMoney(request.estCostPaise) : '—'} bold />
              {request?.approvedAmountPaise != null && (
                <Row
                  label="Approved amount"
                  value={formatMoney(request.approvedAmountPaise)}
                  bold color="success.main"
                />
              )}
              {(request?.disbursedAmountPaise ?? 0) > 0 && (
                <Row label="Disbursed so far" value={formatMoney(request!.disbursedAmountPaise!)} />
              )}
              <Row label="Created"   value={fmt(request?.createdAt)} />
              {request?.submittedAt && (
                <Row label="Submitted" value={fmt(request.submittedAt)} />
              )}
            </Stack>
          </Box>

          {/* ── Description ────────────────────────────────────────────── */}
          {request?.description && (
            <Box mb={3}>
              <Typography variant="overline" color="text.secondary">Description</Typography>
              <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
                {request.description}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* ── Quotations ─────────────────────────────────────────────── */}
          <Box mb={3}>
            <Typography variant="overline" color="text.secondary">
              Quotations ({quotations.length})
            </Typography>
            {quotations.length === 0 ? (
              <Typography variant="body2" color="text.disabled" mt={1}>No quotations.</Typography>
            ) : (
              <Stack spacing={1.5} mt={1.5}>
                {quotations.map(q => (
                  <Paper key={q.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="body2" fontWeight={500}>{vendorName(q.vendorId)}</Typography>
                      <Typography variant="body2" fontWeight={500}>{formatMoney(q.amountPaise)}</Typography>
                    </Stack>
                    {q.scopeNotes && (
                      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                        {q.scopeNotes}
                      </Typography>
                    )}
                    {q.documentRef && <StorageLink storagePath={q.documentRef} />}
                  </Paper>
                ))}
              </Stack>
            )}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* ── Approvals ──────────────────────────────────────────────── */}
          {status !== 'scheduled' && (
            <Box mb={3}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="overline" color="text.secondary">Approvals</Typography>
                <Typography
                  variant="body2"
                  color={
                    (request?.approvalCount ?? 0) >= (request?.requiredApprovers ?? 1)
                      ? 'success.main' : 'text.secondary'
                  }
                >
                  {request?.approvalCount ?? 0} / {request?.requiredApprovers ?? '?'} required
                </Typography>
              </Stack>
              {approvals.length === 0 ? (
                <Typography variant="body2" color="text.disabled" mt={1}>No approvals yet.</Typography>
              ) : (
                <Stack spacing={1.5} mt={1.5}>
                  {approvals.map(a => (
                    <Box
                      key={a.id}
                      sx={{ pl: 1.5, borderLeft: 2, borderColor: 'success.main' }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        {a.mcUid === user?.uid ? 'You' : 'MC member'} · {fmtDateTime(a.approvedAt)}
                      </Typography>
                      {a.note && (
                        <Typography variant="body2" mt={0.25}>{a.note}</Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              )}
              {alreadyApproved && status === 'requested' && (
                <Chip
                  size="small" color="success" variant="outlined"
                  icon={<CheckCircleIcon />}
                  label="You approved this request"
                  sx={{ mt: 1.5 }}
                />
              )}
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* ── Notes ──────────────────────────────────────────────────── */}
          <Box mb={3}>
            <Typography variant="overline" color="text.secondary">Notes</Typography>
            {notes.length === 0 ? (
              <Typography variant="body2" color="text.disabled" mt={1}>No notes yet.</Typography>
            ) : (
              <Stack spacing={1.5} mt={1.5}>
                {notes.map(n => (
                  <Box key={n.id}>
                    <Typography variant="caption" color="text.secondary">
                      {n.authorDisplayName || n.authorUid} · {fmtDateTime(n.at ?? n.createdAt)}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>
                      {n.text}
                    </Typography>
                  </Box>
                ))}
                <div ref={notesEndRef} />
              </Stack>
            )}
            {isMC && (
              <Box mt={2}>
                {noteError && <Alert severity="error" sx={{ mb: 1 }}>{noteError}</Alert>}
                <TextField
                  size="small" fullWidth multiline rows={2}
                  label="Add a note (Ctrl+Enter to submit)"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote(); }}
                  disabled={addingNote}
                />
                <Button
                  size="small" sx={{ mt: 1 }}
                  disabled={!noteText.trim() || addingNote}
                  onClick={handleAddNote}
                  startIcon={addingNote ? <CircularProgress size={12} color="inherit" /> : undefined}
                >
                  Add note
                </Button>
              </Box>
            )}
          </Box>

          {/* ── Disbursements ───────────────────────────────────────────── */}
          {(disbursements.length > 0 || status === 'disbursed' || status === 'completed') && (
            <>
              <Divider sx={{ my: 3 }} />
              <Box mb={2}>
                <Typography variant="overline" color="text.secondary">
                  Disbursements ({disbursements.length})
                </Typography>
                {disbursements.length === 0 ? (
                  <Typography variant="body2" color="text.disabled" mt={1}>
                    No disbursements recorded.
                  </Typography>
                ) : (
                  <Stack spacing={1} mt={1.5}>
                    {disbursements.map((d, i) => (
                      <Paper key={d.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2" fontWeight={500}>
                              #{i + 1}
                            </Typography>
                            <Chip
                              size="small"
                              label={d.kind === 'final' ? 'Final' : 'Partial'}
                              color={d.kind === 'final' ? 'success' : 'default'}
                              variant="outlined"
                            />
                          </Stack>
                          <Stack alignItems="flex-end">
                            <Typography variant="body2" fontWeight={500}>
                              {formatMoney(d.amountPaise)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {fmt(d.paidAt)}
                            </Typography>
                          </Stack>
                        </Stack>
                        {d.invoiceRef && <StorageLink storagePath={d.invoiceRef} />}
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Box>

        {/* ── Sticky action bar ────────────────────────────────────────── */}
        {hasActions && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
              {canTakeUp && (
                <Button
                  variant="outlined"
                  onClick={() => { onTakeUp?.(request!); onClose(); }}
                >
                  Take up
                </Button>
              )}
              {canWithdraw && (
                <Button
                  variant="outlined" color="error"
                  onClick={() => setConfirmWithdraw(true)}
                  disabled={actionBusy}
                >
                  Withdraw
                </Button>
              )}
              {canApprove && (
                <Button
                  variant="contained" color="success"
                  startIcon={actionBusy ? <CircularProgress size={14} color="inherit" /> : <CheckCircleIcon />}
                  onClick={handleApprove}
                  disabled={actionBusy}
                >
                  Approve
                </Button>
              )}
              {canDisburse && (
                <Button
                  variant="contained"
                  startIcon={<PaidIcon />}
                  onClick={() => setDisbTarget(request)}
                >
                  Disburse
                </Button>
              )}
              {canClose && (
                <Button
                  variant="contained" color="success"
                  startIcon={actionBusy ? <CircularProgress size={14} color="inherit" /> : <TaskAltIcon />}
                  onClick={() => setConfirmClose(true)}
                  disabled={actionBusy}
                >
                  Mark completed
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Drawer>

      {/* Disbursement dialog (portal — renders above drawer) */}
      {disbTarget && (
        <DisbursementDialog
          request={disbTarget}
          onClose={() => setDisbTarget(null)}
          onDisbursed={() => {
            setDisbTarget(null);
            setSuccessMsg('Disbursement recorded.');
            setTimeout(() => setSuccessMsg(''), 4000);
          }}
        />
      )}

      {/* Withdraw confirm */}
      <Dialog open={confirmWithdraw} onClose={() => setConfirmWithdraw(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Withdraw request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Withdraw <strong>"{request?.title}"</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmWithdraw(false)} disabled={actionBusy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleWithdraw} disabled={actionBusy}
            startIcon={actionBusy ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Withdraw
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close/complete confirm */}
      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Mark as completed?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Mark <strong>"{request?.title}"</strong> as completed? This closes the request.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClose(false)} disabled={actionBusy}>Cancel</Button>
          <Button color="success" variant="contained" onClick={handleClose} disabled={actionBusy}
            startIcon={actionBusy ? <CircularProgress size={14} color="inherit" /> : undefined}>
            Mark completed
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Small helper: key-value row ──────────────────────────────────────────────

function Row({
  label, value, bold, color, capitalize,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
  capitalize?: boolean;
}) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="baseline" gap={2}>
      <Typography variant="body2" color="text.secondary" flexShrink={0}>{label}</Typography>
      <Typography
        variant="body2"
        fontWeight={bold ? 600 : 400}
        color={color ?? 'text.primary'}
        sx={capitalize ? { textTransform: 'capitalize' } : undefined}
        textAlign="right"
      >
        {value}
      </Typography>
    </Box>
  );
}
