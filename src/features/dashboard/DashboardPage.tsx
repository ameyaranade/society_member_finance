import { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useDashboard } from './useDashboard';
import SankeyChart from './SankeyChart';
import { formatMoney } from '../../lib/money';
import { FUND_COLOR } from '../../theme/chartColors';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Metric card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: 'success' | 'error' | 'primary' | 'inherit';
  loading?: boolean;
}

function MetricCard({ label, value, icon, color = 'inherit', loading }: MetricCardProps) {
  const colorMap = { success: 'success.main', error: 'error.main', primary: 'primary.main', inherit: 'text.primary' };
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <Box sx={{ color: colorMap[color] }}>{icon}</Box>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
        </Stack>
        {loading
          ? <Skeleton width={120} height={32} />
          : <Typography variant="h5" fontWeight={600} sx={{ color: colorMap[color] }}>
              {formatMoney(value)}
            </Typography>
        }
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState(currentPeriod);
  const { balance, accounts, fundHeads, sankeyData, loading } = useDashboard(period);

  const totalIn  = balance?.totalInPaise  ?? 0;
  const totalOut = balance?.totalOutPaise ?? 0;
  const net      = totalIn - totalOut;

  // Total current balance across all accounts
  const totalCash = accounts.reduce((s, a) => s + (a.currentBalancePaise ?? 0), 0);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Typography variant="h5" fontWeight={500}>Dashboard</Typography>
        <Box flex={1} />
        <TextField
          label="Month" type="month" size="small"
          InputLabelProps={{ shrink: true }}
          value={period}
          onChange={e => setPeriod(e.target.value)}
          sx={{ width: 160 }}
        />
      </Stack>

      {/* ── Summary metric cards ── */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Total income"
            value={totalIn}
            icon={<TrendingUpIcon />}
            color="success"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Total expenses"
            value={totalOut}
            icon={<TrendingDownIcon />}
            color="error"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Net surplus"
            value={net}
            icon={net >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
            color={net >= 0 ? 'success' : 'error'}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Cash position"
            value={totalCash}
            icon={<AccountBalanceIcon />}
            color="primary"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Account + fund breakdowns ── */}
      <Grid container spacing={2} mb={3}>
        {/* Accounts */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={2}>
                Account balances
              </Typography>
              {accounts.length === 0 && !loading && (
                <Typography variant="body2" color="text.secondary">No accounts configured.</Typography>
              )}
              <Stack spacing={1.5}>
                {accounts.map(acc => (
                  <Box key={acc.id}>
                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                      <Typography variant="body2">{acc.name}</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {loading ? <Skeleton width={80} /> : formatMoney(acc.currentBalancePaise ?? 0)}
                      </Typography>
                    </Stack>
                    {balance?.byAccount?.[acc.id] && (
                      <Typography variant="caption" color="text.secondary">
                        +{formatMoney(balance.byAccount[acc.id].inPaise)} &nbsp;
                        −{formatMoney(balance.byAccount[acc.id].outPaise)}
                      </Typography>
                    )}
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Fund heads */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={2}>
                Fund allocation (this month)
              </Typography>
              {fundHeads.length === 0 && !loading && (
                <Typography variant="body2" color="text.secondary">No fund heads configured.</Typography>
              )}
              <Stack spacing={2}>
                {fundHeads.map(fh => {
                  const data = balance?.byFund?.[fh.code];
                  const inP  = data?.inPaise  ?? 0;
                  const outP = data?.outPaise ?? 0;
                  const pct  = inP > 0 ? Math.min(100, Math.round((outP / inP) * 100)) : 0;
                  return (
                    <Box key={fh.id}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2" fontWeight={500}>{fh.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {loading ? <Skeleton width={100} /> : `${formatMoney(inP)} in · ${formatMoney(outP)} out`}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant={loading ? 'indeterminate' : 'determinate'}
                        value={pct}
                        sx={{
                          height: 8, borderRadius: 4,
                          bgcolor: 'action.hover',
                          '& .MuiLinearProgress-bar': { bgcolor: FUND_COLOR[fh.code] ?? 'primary.main' },
                        }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Sankey ── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" mb={3}>
            Cash flow — {period}
          </Typography>
          {loading && <Skeleton variant="rectangular" height={360} />}
          {!loading && !sankeyData && (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No transaction data for {period}. Select a month with recorded transactions.
              </Typography>
            </Box>
          )}
          {!loading && sankeyData && (
            <Box sx={{ pt: 3 }}>
              <SankeyChart
                nodes={sankeyData.nodes}
                links={sankeyData.links}
                height={360}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
