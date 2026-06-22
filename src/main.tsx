import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeModeProvider } from './theme/ThemeContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <App />
    </ThemeModeProvider>
  </React.StrictMode>,
);
