import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import BlockIcon from '@mui/icons-material/Block';

export type StatusVariant =
  | 'approved'
  | 'requested'
  | 'scheduled'
  | 'disbursed'
  | 'completed'
  | 'withdrawn'
  | 'overdue'
  | 'info'
  | 'draft'
  // membership statuses
  | 'active'
  | 'invited'
  | 'deactivated';

const CONFIG: Record<StatusVariant, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default'; icon: React.ReactElement }> = {
  approved:    { label: 'Approved',    color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  completed:   { label: 'Completed',   color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  disbursed:   { label: 'In progress', color: 'info',    icon: <InfoOutlinedIcon fontSize="small" /> },
  requested:   { label: 'Requested',   color: 'warning', icon: <AccessTimeIcon fontSize="small" /> },
  scheduled:   { label: 'Scheduled',   color: 'default', icon: <FiberManualRecordIcon fontSize="small" /> },
  withdrawn:   { label: 'Withdrawn',   color: 'default', icon: <BlockIcon fontSize="small" /> },
  overdue:     { label: 'Overdue',     color: 'error',   icon: <WarningAmberIcon fontSize="small" /> },
  info:        { label: 'Info',        color: 'info',    icon: <InfoOutlinedIcon fontSize="small" /> },
  draft:       { label: 'Draft',       color: 'default', icon: <FiberManualRecordIcon fontSize="small" /> },
  // membership
  active:      { label: 'Active',      color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
  invited:     { label: 'Invited',     color: 'warning', icon: <AccessTimeIcon fontSize="small" /> },
  deactivated: { label: 'Deactivated', color: 'default', icon: <BlockIcon fontSize="small" /> },
};

interface StatusChipProps {
  status: StatusVariant;
  size?: 'small' | 'medium';
}

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const { label, color, icon } = CONFIG[status];
  return <Chip icon={icon} label={label} color={color} size={size} />;
}
