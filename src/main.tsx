import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ThemeModeProvider } from './theme/ThemeContext';
import { router } from './app/routes';
import './i18n/i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <RouterProvider router={router} />
    </ThemeModeProvider>
  </React.StrictMode>,
);
