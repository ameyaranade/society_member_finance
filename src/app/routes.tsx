import { createBrowserRouter } from 'react-router-dom';
import Shell from './Shell';
import Gallery from './Gallery';
import NotFound from './NotFound';
import Placeholder from './Placeholder';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Shell />,
      children: [
        { index: true, element: <Placeholder name="Dashboard" /> },
        { path: 'payables', element: <Placeholder name="Payables" /> },
        { path: 'receivables', element: <Placeholder name="Receivables" /> },
        { path: 'members', element: <Placeholder name="Members" /> },
        { path: 'settings', element: <Placeholder name="Settings" /> },
        { path: '_gallery', element: <Gallery /> },
      ],
    },
    { path: '*', element: <NotFound /> },
  ],
  { future: { v7_relativeSplatPath: true } },
);
