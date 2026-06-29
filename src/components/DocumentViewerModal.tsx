import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  fileName: string;
}

function isImage(name: string) {
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

export default function DocumentViewerModal({ open, onClose, url, fileName }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{ flex: 1, minWidth: 0 }}
            title={fileName}
          >
            {fileName}
          </Typography>
          <Link
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in new tab"
            sx={{ display: 'flex', color: 'text.secondary', flexShrink: 0 }}
          >
            <OpenInNewIcon fontSize="small" />
          </Link>
        </Stack>
        <IconButton
          aria-label="Close document viewer"
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, bgcolor: 'grey.900' }}>
        {isImage(fileName) ? (
          <Box
            component="img"
            src={url}
            alt={fileName}
            sx={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '80vh',
              mx: 'auto',
              objectFit: 'contain',
            }}
          />
        ) : (
          <Box
            component="iframe"
            src={url}
            title={fileName}
            sx={{ display: 'block', width: '100%', height: '80vh', border: 'none' }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
