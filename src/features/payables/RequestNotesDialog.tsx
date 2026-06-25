import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp } from 'firebase/firestore';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { db } from '../../lib/firebase';
import { useAuth } from '../auth/useAuth';
import { tsMillis } from '../../lib/date';

interface Note {
  id: string;
  text: string;
  authorUid: string;
  authorDisplayName?: string | null;
  createdAt: unknown;
  societyId: string;
}

function formatNoteDate(ts: unknown): string {
  const millis = tsMillis(ts);
  if (!millis) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(millis));
}

interface RequestNotesDialogProps {
  requestId: string;
  title: string;
  isMC: boolean;
  onClose: () => void;
}

export default function RequestNotesDialog({ requestId, title, isMC, onClose }: RequestNotesDialogProps) {
  const { societyId, user } = useAuth();
  const [notes, setNotes]       = useState<Note[]>([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const bottomRef               = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!societyId) { setLoading(false); return; }
    const col = collection(db, `societies/${societyId}/expenseRequests/${requestId}/notes`);
    const q = query(col);
    return onSnapshot(q, snap => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Note))
        .sort((a, b) => tsMillis(a.createdAt) - tsMillis(b.createdAt));
      setNotes(docs);
      setLoading(false);
    }, () => setLoading(false));
  }, [societyId, requestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  async function handleAdd() {
    if (!text.trim() || !societyId) return;
    setSubmitting(true);
    setError('');
    try {
      await addDoc(
        collection(db, `societies/${societyId}/expenseRequests/${requestId}/notes`),
        {
          text: text.trim(),
          authorUid: user?.uid ?? '',
          authorDisplayName: user?.displayName ?? null,
          createdAt: serverTimestamp(),
          societyId,
        },
      );
      setText('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add note.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd();
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Notes — {title}</DialogTitle>

      <DialogContent dividers sx={{ minHeight: 160, maxHeight: 400 }}>
        {loading ? (
          <CircularProgress size={24} />
        ) : notes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No notes yet.</Typography>
        ) : (
          <Stack spacing={1.5}>
            {notes.map((n, i) => (
              <Box key={n.id}>
                {i > 0 && <Divider sx={{ mb: 1.5 }} />}
                <Typography variant="caption" color="text.secondary">
                  {n.authorDisplayName || n.authorUid} · {formatNoteDate(n.createdAt)}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.25 }}>
                  {n.text}
                </Typography>
              </Box>
            ))}
            <div ref={bottomRef} />
          </Stack>
        )}
      </DialogContent>

      {isMC && (
        <Box px={3} pt={2} pb={1}>
          {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
          <TextField
            multiline rows={2} fullWidth size="small"
            label="Add a note (Ctrl+Enter to submit)"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
          />
        </Box>
      )}

      <DialogActions>
        {isMC && (
          <Button
            variant="contained" size="small"
            disabled={!text.trim() || submitting}
            onClick={handleAdd}
            startIcon={submitting ? <CircularProgress size={12} color="inherit" /> : undefined}
          >
            Add note
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
