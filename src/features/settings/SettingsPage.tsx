import { useState } from 'react';
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
import { useAuth } from '../auth/useAuth';

const ALL_TABS = [
  { label: 'General',        component: <GeneralSettings />,        roles: null }, // all
  { label: 'Accounts',       component: <AccountsSettings />,       roles: ['admin', 'fm'] },
  { label: 'Fund heads',     component: <FundHeadsSettings />,      roles: ['admin', 'fm'] },
  { label: 'Approval tiers', component: <ApprovalTiersSettings />,  roles: null }, // all
  { label: 'Vendors',        component: <VendorsSettings />,        roles: null }, // all members can read
  { label: 'Recurring',      component: <RecurringSettings />,      roles: null }, // all members can read
];

export default function SettingsPage() {
  const { role } = useAuth();
  const TABS = ALL_TABS.filter(t => !t.roles || (role && t.roles.includes(role)));
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={500} mb={3}>Settings</Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
      >
        {TABS.map((t, i) => (
          <Tab key={i} label={t.label} id={`settings-tab-${i}`} aria-controls={`settings-panel-${i}`} />
        ))}
      </Tabs>

      {TABS.map((t, i) => (
        <Box
          key={i}
          role="tabpanel"
          id={`settings-panel-${i}`}
          aria-labelledby={`settings-tab-${i}`}
          hidden={tab !== i}
        >
          {tab === i && t.component}
        </Box>
      ))}
    </Box>
  );
}
