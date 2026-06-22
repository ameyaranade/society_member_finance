import React from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';

interface FormDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  children: React.ReactNode;
  width?: number | string;
}

export default function FormDrawer({
  open,
  onClose,
  title,
  onSubmit,
  submitLabel = 'Save',
  submitting = false,
  children,
  width = 480,
}: FormDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width, maxWidth: '100vw' } }}
    >
      <Stack sx={{ height: '100%' }}>
        {/* Header */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 3, py: 2 }}
        >
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} aria-label="Close drawer" size="small">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider />

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
          {children}
        </Box>

        {/* Footer */}
        {onSubmit && (
          <>
            <Divider />
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ px: 3, py: 2 }}>
              <Button variant="outlined" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={onSubmit}
                disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {submitLabel}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Drawer>
  );
}
