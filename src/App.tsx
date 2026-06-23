import { HashRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useEffect, useMemo } from 'react';
import { JobProvider } from './context/JobContext';
import { TariffProvider } from './context/TariffContext';
import { InvoiceProvider } from './context/InvoiceContext';
import { LogProvider } from './context/LogContext';
import { MainLayout } from './components/MainLayout';
import { GlobalToast } from './components/GlobalToast';
import { CustomScrollbarStyles } from './components/CustomScrollbarStyles';
import { Dashboard } from './pages/Dashboard';
import { JobManagerPage } from './pages/JobManager';
import { TariffEditorPage } from './pages/TariffEditor';
import { SyncSettings } from './pages/SyncSettings';
import { InvoicesPage } from './pages/Invoices';
import { LogsPage } from './pages/LogsPage';
import { useColorMode } from './context/ThemeContext';
import { getThemeOptions } from './theme';
import { initDB } from './services/db';
import { runRuleKindMigration } from './services/migrate-rule-kinds';


/**
 * Root Application Component.
 * Sets up Providers and Routing.
 */
function App() {
  const { mode } = useColorMode();

  const theme = useMemo(() => createTheme(getThemeOptions(mode)), [mode]);

  // Run the rule-kind migration on app boot. Idempotent: a fresh install
  // is a no-op; a legacy install converts `hide` → `ignoreUnit`,
  // `toothExtra` → `unitExtra`, and deletes `hideAttribute` rules.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await initDB();
        const result = await runRuleKindMigration(db);
        if (!cancelled && (result.hideConverted > 0
            || result.hideAttributeDeleted > 0
            || result.toothExtraRenamed > 0)) {
            console.info('[App] rule-kind migration:', result);
        }
      } catch (err) {
        console.error('[App] rule-kind migration failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CustomScrollbarStyles />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <HashRouter>
          <LogProvider>
            <GlobalToast />
            <JobProvider>
              <TariffProvider>
                <InvoiceProvider>
                  <MainLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/jobs" element={<JobManagerPage />} />
                      <Route path="/tariffs" element={<TariffEditorPage />} />
                      <Route path="/invoices" element={<InvoicesPage />} />
                      <Route path="/sync" element={<SyncSettings />} />
                      <Route path="/logs" element={<LogsPage />} />
                    </Routes>
                  </MainLayout>
                </InvoiceProvider>
              </TariffProvider>
            </JobProvider>
          </LogProvider>
        </HashRouter>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;
