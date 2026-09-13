import React from 'react';
import ReactDOM from 'react-dom/client';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import App from './App.tsx';
import { ColorModeProvider } from './context/ThemeContext.tsx';
import { DeveloperProvider } from './context/DeveloperContext.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { initDebugBridge } from './utils/debugBridge.ts';
import './index.css';

// Polyfill for crypto.randomUUID in non-secure (HTTP) contexts
if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined' && !window.crypto.randomUUID) {
  window.crypto.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      // eslint-disable-next-line sonarjs/pseudo-random
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  };
}

// Initialize the global debugging bridge for LLMs and developers
initDebugBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <ColorModeProvider>
        <DeveloperProvider>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </DeveloperProvider>
      </ColorModeProvider>
    </LocalizationProvider>
  </React.StrictMode>,
);