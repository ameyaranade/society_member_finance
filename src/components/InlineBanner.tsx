import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';

interface InlineBannerProps {
  severity?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message: string;
}

export default function InlineBanner({ severity = 'info', title, message }: InlineBannerProps) {
  return (
    <Alert severity={severity} variant="outlined" sx={{ borderRadius: 2 }}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {message}
    </Alert>
  );
}
