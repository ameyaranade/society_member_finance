import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import PaymentsIcon from '@mui/icons-material/Payments';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useNotifications, type AppNotification } from './useNotifications';
import { formatMoney } from '../../lib/money';

function notificationIcon(type: string) {
  switch (type) {
    case 'expense_request_created':
    case 'expense_request_submitted':  return <PendingActionsIcon fontSize="small" color="info" />;
    case 'expense_request_approved':   return <AssignmentTurnedInIcon fontSize="small" color="success" />;
    case 'expense_approval_recorded':  return <CheckCircleOutlineIcon fontSize="small" color="success" />;
    case 'expense_request_withdrawn':  return <MoneyOffIcon fontSize="small" color="warning" />;
    case 'expense_request_disbursed':  return <PaymentsIcon fontSize="small" color="primary" />;
    case 'expense_request_completed':  return <TaskAltIcon fontSize="small" color="success" />;
    default:                           return <NotificationsIcon fontSize="small" />;
  }
}

function notificationText(n: AppNotification): string {
  const title = (n.payload.title as string | undefined) ?? 'request';
  switch (n.type) {
    case 'expense_request_created':
      return `New maintenance request "${title}" needs your approval`;
    case 'expense_request_submitted':
      return `Snag request "${title}" has been submitted for your approval`;
    case 'expense_request_approved':
      return `Request "${title}" has been fully approved`;
    case 'expense_approval_recorded': {
      const count    = n.payload.approvalCount as number | undefined;
      const required = n.payload.requiredApprovers as number | undefined;
      return `Request "${title}" received ${count ?? '?'} of ${required ?? '?'} approvals`;
    }
    case 'expense_request_withdrawn':
      return `Request "${title}" has been withdrawn`;
    case 'expense_request_disbursed': {
      const amt = n.payload.amountPaise as number | undefined;
      return amt
        ? `Disbursement of ${formatMoney(amt)} recorded for "${title}"`
        : `Disbursement recorded for "${title}"`;
    }
    case 'expense_request_completed':
      return `Request "${title}" has been completed`;
    default:
      return `New notification`;
  }
}

function notificationTarget(n: AppNotification): string {
  const requestType = n.payload.requestType as string | undefined;
  switch (n.type) {
    case 'expense_request_created':
    case 'expense_request_submitted':
    case 'expense_request_withdrawn':
      return '/payables?tab=queue';
    case 'expense_request_approved':
    case 'expense_approval_recorded':
    case 'expense_request_disbursed':
    case 'expense_request_completed':
      return requestType === 'snag' ? '/payables?tab=snags' : '/payables?tab=maintenance';
    default:
      return '/payables';
  }
}

function relativeTime(date: Date | null): string {
  if (!date) return '';
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  function handleOpen() { setOpen(true); }
  function handleClose() { setOpen(false); }

  async function handleMarkAll() {
    await markAllRead();
  }

  async function handleClickNotification(n: AppNotification) {
    handleClose();
    void markRead(n.id);
    navigate(notificationTarget(n));
  }

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          ref={anchorRef}
          color="inherit"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          onClick={handleOpen}
        >
          <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxHeight: 480 } } }}
      >
        {/* Header */}
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          px={2}
          py={1.5}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="subtitle2">Notifications</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={handleMarkAll} sx={{ textTransform: 'none', p: 0.5 }}>
              Mark all as read
            </Button>
          )}
        </Box>

        {/* Content */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box display="flex" flexDirection="column" alignItems="center" py={4} px={2}>
            <NotificationsIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No new notifications
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ overflow: 'auto', maxHeight: 380 }}>
            {notifications.map((n, idx) => (
              <Box key={n.id}>
                {idx > 0 && <Divider component="li" />}
                <ListItem
                  alignItems="flex-start"
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => { void handleClickNotification(n); }}
                >
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    {notificationIcon(n.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={notificationText(n)}
                    secondary={relativeTime(n.createdAt)}
                    primaryTypographyProps={{ variant: 'body2', sx: { lineHeight: 1.4 } }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}
