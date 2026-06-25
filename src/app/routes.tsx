import { createBrowserRouter } from 'react-router-dom';
import Shell from './Shell';
import Gallery from './Gallery';
import NotFound from './NotFound';
import Forbidden from './Forbidden';
import NoSociety from './NoSociety';
import SignInPage from '../features/auth/SignInPage';
import RequireAuth from '../features/auth/RequireAuth';
import RequireSociety from '../features/auth/RequireSociety';
import MembersPage from '../features/admin/MembersPage';
import SuperAdminPage from '../features/admin/SuperAdminPage';
import SettingsPage from '../features/settings/SettingsPage';
import PayablesPage from '../features/payables/PayablesPage';
import ReceivablesPage from '../features/receivables/ReceivablesPage';
import DashboardPage from '../features/dashboard/DashboardPage';

export const router = createBrowserRouter(
  [
    // ── Public routes ──────────────────────────────────────────────────────
    { path: '/sign-in',    element: <SignInPage /> },
    { path: '/forbidden',  element: <Forbidden /> },
    { path: '/no-society', element: <NoSociety /> },

    // ── Super-admin shell (no society required) ────────────────────────────
    {
      path: '/super-admin',
      element: (
        <RequireAuth>
          <SuperAdminPage />
        </RequireAuth>
      ),
    },

    // ── Authenticated app shell ────────────────────────────────────────────
    {
      path: '/',
      element: (
        <RequireAuth>
          <RequireSociety>
            <Shell />
          </RequireSociety>
        </RequireAuth>
      ),
      children: [
        { index: true,         element: <DashboardPage /> },
        { path: 'payables',    element: <PayablesPage /> },
        { path: 'receivables', element: <ReceivablesPage /> },
        { path: 'members',     element: <MembersPage /> },
        { path: 'settings',    element: <SettingsPage /> },
        { path: '_gallery',    element: <Gallery /> },
      ],
    },

    { path: '*', element: <NotFound /> },
  ],
  { future: { v7_relativeSplatPath: true } },
);
