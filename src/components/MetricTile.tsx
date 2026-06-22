import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';

interface MetricTileProps {
  label: string;
  value: string;
  secondary?: string;
  loading?: boolean;
}

export default function MetricTile({ label, value, secondary, loading }: MetricTileProps) {
  return (
    <Card variant="outlined" sx={{ minWidth: 160 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {label}
        </Typography>
        {loading ? (
          <Skeleton variant="text" width="80%" height={32} />
        ) : (
          <Typography variant="h4" color="primary" fontWeight={500}>
            {value}
          </Typography>
        )}
        {secondary && (
          <Typography variant="caption" color="text.secondary">
            {secondary}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
