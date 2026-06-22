import {
  Box, Button, Chip, Stack, Typography, Card, CardContent, Divider,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const STATUS_CHIPS = [
  { label: 'Approved',  icon: <CheckCircleIcon fontSize="small" />,     color: 'success' },
  { label: 'Pending',   icon: <AccessTimeIcon fontSize="small" />,      color: 'warning' },
  { label: 'Overdue',   icon: <WarningAmberIcon fontSize="small" />,    color: 'error'   },
  { label: 'Draft',     icon: <FiberManualRecordIcon fontSize="small" />, color: 'default' },
  { label: 'Info',      icon: <InfoOutlinedIcon fontSize="small" />,    color: 'info'    },
] as const;

export default function Gallery() {
  return (
    <Box sx={{ p: 4, maxWidth: 720, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>Token Gallery</Typography>

      {/* Typography scale */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Typography</Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack spacing={1}>
            <Typography variant="h4">h4 — Page title (1.5rem/500)</Typography>
            <Typography variant="h5">h5 — Section title (1.125rem/500)</Typography>
            <Typography variant="h6">h6 — Subtitle (1rem/500)</Typography>
            <Typography variant="body1">body1 — Body text (1rem/400)</Typography>
            <Typography variant="body2" color="text.secondary">body2 — Secondary label (0.875rem/400)</Typography>
            <Typography variant="caption" display="block">caption — Min size (0.8125rem/400)</Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Colour tokens */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Colour tokens</Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {([
              ['primary.main',       'primary.main'],
              ['background.default', 'bg default'],
              ['background.paper',   'bg surface'],
              ['text.primary',       'text primary'],
              ['text.secondary',     'text secondary'],
              ['divider',            'divider'],
            ] as const).map(([token, label]) => (
              <Stack key={token} spacing={0.5} alignItems="center" sx={{ minWidth: 80 }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: 1,
                  bgcolor: token,
                  border: '1px solid', borderColor: 'divider',
                }} />
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  {label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Status chips — icon + label always */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Status chips (icon + label)</Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {STATUS_CHIPS.map(({ label, icon, color }) => (
              <Chip key={label} icon={icon} label={label} color={color} size="small" />
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Buttons */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Buttons</Typography>
          <Divider sx={{ mb: 2 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained">Primary</Button>
            <Button variant="outlined">Secondary</Button>
            <Button variant="text">Ghost</Button>
            <Button variant="outlined" color="error">Danger</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Amounts */}
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>Amount display</Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h4" color="primary">₹1,23,456</Typography>
          <Typography variant="body2" color="text.secondary">Balance (formatted from integer paise)</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
