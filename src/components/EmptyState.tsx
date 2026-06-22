import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';

interface EmptyStateProps {
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ message = 'No data', action }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 6 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {message}
      </Typography>
      {action && (
        <Button variant="outlined" size="small" onClick={action.onClick} sx={{ mt: 1 }}>
          {action.label}
        </Button>
      )}
    </Box>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <Stack spacing={1} sx={{ px: 2, py: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
      ))}
    </Stack>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Something went wrong', onRetry }: ErrorStateProps) {
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="error" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}
