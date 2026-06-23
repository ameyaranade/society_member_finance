import { useRef, useState } from 'react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import { storage } from '../../lib/firebase';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

interface Props {
  /**
   * Full GCS path prefix (no filename). The component appends `/{file.name}`.
   * Example: `societies/abc/expense-requests/staging/uuid123`
   */
  storagePathPrefix: string;
  onUploaded: (fullPath: string) => void;
  onRemoved?: () => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
}

export default function FileUploadButton({
  storagePathPrefix,
  onUploaded,
  onRemoved,
  accept = '.pdf,.jpg,.jpeg,.png,.webp',
  label = 'Attach document',
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  type UploadState = 'idle' | 'uploading' | 'done' | 'error';
  const [state,       setState]       = useState<UploadState>('idle');
  const [progress,    setProgress]    = useState(0);
  const [fileName,    setFileName]    = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [errorMsg,    setErrorMsg]    = useState('');

  function reset() {
    setState('idle');
    setProgress(0);
    setFileName('');
    setDownloadUrl('');
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleRemove() {
    reset();
    onRemoved?.();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setErrorMsg('File too large (max 10 MB).');
      setState('error');
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMsg('Only PDF and image files (JPG, PNG, WebP) are supported.');
      setState('error');
      return;
    }

    const fullPath = `${storagePathPrefix}/${file.name}`;
    setState('uploading');
    setProgress(0);
    setFileName(file.name);
    setErrorMsg('');

    const fileRef = storageRef(storage, fullPath);
    const task = uploadBytesResumable(fileRef, file, { contentType: file.type });

    task.on(
      'state_changed',
      snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err  => { setState('error'); setErrorMsg(err.message); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setDownloadUrl(url);
        setState('done');
        onUploaded(fullPath);
      },
    );
  }

  if (state === 'done') {
    return (
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <AttachFileIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Link
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          underline="hover"
          sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {fileName}
        </Link>
        <IconButton size="small" onClick={handleRemove} aria-label="Remove attachment">
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Stack>
    );
  }

  if (state === 'uploading') {
    return (
      <Stack spacing={0.5} sx={{ width: '100%' }}>
        <Typography variant="caption" color="text.secondary">Uploading {fileName}…</Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1 }} />
      </Stack>
    );
  }

  if (state === 'error') {
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="caption" color="error.main">{errorMsg}</Typography>
        <Button size="small" onClick={reset}>Retry</Button>
      </Stack>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={handleChange}
        aria-label={label}
      />
      <Button
        size="small"
        variant="outlined"
        startIcon={<AttachFileIcon />}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        sx={{ alignSelf: 'flex-start' }}
      >
        {label}
      </Button>
    </>
  );
}
