import { createBrowserRouter } from 'react-router-dom';
import Shell from './Shell';
import Gallery from './Gallery';
import NotFound from './NotFound';
import Forbidden from './Forbidden';
import NoSociety from './NoSociety';
import Placeholder from './Placeholder';
import SignInPage from '../features/auth/SignInPage';
import RequireAuth from '../features/auth/RequireAuth';
import RequireSociety from '../features/auth/RequireSociety';
import MembersPage from '../features/admin/MembersPage';
import SuperAdminPage from '../features/admin/SuperAdminPage';
import SettingsPage from '../features/settings/SettingsPage';
import PayablesPage from '../features/payables/PayablesPage';

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
        { index: true,         element: <Placeholder name="Dashboard" /> },
        { path: 'payables',    element: <PayablesPage /> },
        { path: 'receivables', element: <Placeholder name="Receivables" /> },
        { path: 'members',     element: <MembersPage /> },
        { path: 'settings',    element: <SettingsPage /> },
        { path: '_gallery',    element: <Gallery /> },
      ],
    },

    { path: '*', element: <NotFound /> },
  ],
  { future: { v7_relativeSplatPath: true } },
);
