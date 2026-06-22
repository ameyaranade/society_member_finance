// App.tsx is the legacy entry point — routing now lives in src/app/routes.tsx.
// This file is kept only for tests that render the app in isolation.
import { RouterProvider } from 'react-router-dom';
import { router } from './app/routes';

export default function App() {
  return <RouterProvider router={router} />;
}
