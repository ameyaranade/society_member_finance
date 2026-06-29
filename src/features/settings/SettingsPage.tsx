import { useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import GeneralSettings from './GeneralSettings';
import AccountsSettings from './AccountsSettings';
import FundHeadsSettings from './FundHeadsSettings';
import ApprovalTiersSettings from './ApprovalTiersSettings';
import VendorsSettings from './VendorsSettings';
import RecurringSettings from './RecurringSettings';
import UnitsSettings from './UnitsSettings';
import AuditSettings from './AuditSettings';
import { useAuth } from '../auth/useAuth';

const ALL_TABS = [
  { key: 'general',   label: 'General',        component: <GeneralSettings />,        roles: null },
  { key: 'accounts',  label: 'Accounts',        component: <AccountsSettings />,       roles: ['admin', 'fm'] },
  { key: 'funds',     label: 'Fund heads',      component: <FundHeadsSettings />,      roles: ['admin', 'fm'] },
  { key: 'approval',  label: 'Approval tiers',  component: <ApprovalTiersSettings />,  roles: null },
  { key: 'vendors',   label: 'Vendors',         component: <VendorsSettings />,        roles: null },
  { key: 'recurring', label: 'Recurring',       component: <RecurringSettings />,      roles: null },
  { key: 'units',     label: 'Units',           component: <UnitsSettings />,          roles: ['admin'] },
  { key: 'audit',     label: 'Audit log',       component: <AuditSettings />,          roles: ['admin'] },
];

export default function SettingsPage() {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const TABS = ALL_TABS.filter(t => !t.roles || (role && t.roles.includes(role)));
  const tabKey = searchParams.get('tab') ?? TABS[0]?.key ?? 'general';
  const tabIdx = Math.max(0, TABS.findIndex(t => t.key === tabKey));
  function setTab(idx: number) { setSearchParams({ tab: TABS[idx].key }, { replace: true }); }

  return (
    <Box>
      <Typography variant="h5" fontWeight={500} mb={3}>Settings</Typography>

      <Tabs
        value={tabIdx}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((t, i) => (
          <Tab key={t.key} label={t.label} id={`settings-tab-${i}`} aria-controls={`settings-panel-${t.key}`} />
        ))}
      </Tabs>

      {TABS.map((t, i) => (
        <Box
          key={t.key}
          role="tabpanel"
          id={`settings-panel-${t.key}`}
          aria-labelledby={`settings-tab-${i}`}
          hidden={tabIdx !== i}
        >
          {tabIdx === i && t.component}
        </Box>
      ))}
    </Box>
  );
}
