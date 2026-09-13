/**
 * @file BuildStatus.tsx
 * Displays the current build date and checks for newer versions on the server.
 * When a newer build is detected, it shows a warning and a "Restart" button
 * to reload the application.
 */

import React, { useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useLanguage } from '../../context/LanguageContext';
import BuildBadge from '../BuildBadge/BuildBadge';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './BuildStatus-i11n.json';
import './BuildStatus.css';

/** Props for the BuildStatus component. */
interface BuildStatusProps {
  hideTextOnMobile?: boolean;
  compact?: boolean;
  iconOnlyOnMobile?: boolean;
}

/**
 * Component that renders the current build date and periodically checks for a
 * newer version on the server. If a newer build is found, it displays a warning
 * and provides a button to reload the application.
 *
 * @param props - Component props.
 * @param props.hideTextOnMobile - If true, hides textual labels on mobile viewports.
 * @param props.compact - If true, renders a compact variant without BuildBadge.
 * @param props.iconOnlyOnMobile - If true, shows only the refresh icon on mobile.
 * @returns A React element showing the build status.
 */
export const BuildStatus: React.FC<BuildStatusProps> = ({
  hideTextOnMobile = false,
  compact = false,
  iconOnlyOnMobile = false
}) => {
  const [newVersionDate, setNewVersionDate] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  const { language } = useLanguage();
  const localT = (key: string) => {
    const lang = (language === 'en' || language === 'hu') ? language : 'en';
    return (i11n as Record<'en' | 'hu', Record<string, string>>)[lang]?.[key] || key;
  };
  
  // `import.meta.env.DEV` is true only when Vite is running the dev
  // server (`npm run dev`). In that case we are talking to a live
  // hot-reloading server, so the version.json "out of date" check
  // does not apply — instead we display the current git branch and
  // short commit hash injected at config load (vite.config.ts).
  const isDev = import.meta.env.DEV;
  const devLabel = isDev && (__GIT_BRANCH__ || __GIT_COMMIT__)
    ? `${__GIT_BRANCH__}@${__GIT_COMMIT__}`
    : null;

  // __BUILD_DATE__ is defined in vite.config.ts and vite-env.d.ts
  const currentBuildDate = __BUILD_DATE__;

  useEffect(() => {
    if (isDev) {
      // Dev server serves the working tree directly with HMR; the
      // stale-build warning has no meaning here.
      return;
    }

    const checkVersion = async () => {
      try {
        // Append timestamp to avoid caching of the version file itself
        const response = await fetch(`./version.json?t=${Date.now()}`);
        if (!response.ok) return;
        
        const data = await response.json();
        setAppVersion(data.version || '');
        // If the server has a newer date than our build constant, we are outdated
        if (data.buildDate && data.buildDate !== currentBuildDate) {
          setNewVersionDate(data.buildDate);
        }
      } catch (error) {
        // Silently fail on network errors or missing file (dev mode)
        console.debug('Failed to check for updates:', error);
      }
    };

    // Check immediately on mount
    checkVersion();
    
    // Poll every 60 seconds
    const interval = setInterval(checkVersion, 60000);
    return () => clearInterval(interval);
  }, [currentBuildDate, isDev]);

  const handleRestart = () => {
    window.location.reload();
  };

  const formatBuildDate = (dateStr: string, compactDate = false) => {
    try {
      const date = new Date(dateStr);

      if (compactDate) {
        return new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date);
      }

      const parts = new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZoneName: 'short'
      }).formatToParts(date);

      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      const h = parts.find(p => p.type === 'hour')?.value;
      const min = parts.find(p => p.type === 'minute')?.value;
      const tz = parts.find(p => p.type === 'timeZoneName')?.value;

      return `${y}-${m}-${d} ${h}:${min} (${tz})`;
    } catch {
      return dateStr;
    }
  };

  const isOutdated = !devLabel && !!newVersionDate;

  if (compact) {
    return (
      <Box
        className="build-status-compact-container"
      >
        <Typography variant="caption" className="build-status-label">
          {localT('build')}
        </Typography>
        <Typography
          variant="caption"
          className={`build-status-date ${isOutdated ? 'outdated' : 'up-to-date'}`}
        >
          {devLabel ?? formatBuildDate(currentBuildDate, true)}
        </Typography>

        {!devLabel && isOutdated && newVersionDate && (
          <>
            <Typography variant="caption" className="build-status-latest-label">
              {localT('latest')}
            </Typography>
            <Typography
              variant="caption"
              className="build-status-latest-date"
            >
              {formatBuildDate(newVersionDate, true)}
            </Typography>
          </>
        )}

        {!devLabel && isOutdated && (
          <ResponsiveTooltip title={localT('restartTooltip')}>
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<RefreshIcon />}
              onClick={handleRestart}
              className="build-status-button"
            >
              {localT('restart')}
            </Button>
          </ResponsiveTooltip>
        )}
      </Box>
    );
  }

  return (
    <Box className="build-status-container">
      <BuildBadge
        currentBuildDate={currentBuildDate}
        newVersionDate={newVersionDate}
        hideTextOnMobile={hideTextOnMobile}
        version={appVersion}
        formatBuildDate={formatBuildDate}
        devLabel={devLabel}
      />
        {!devLabel && isOutdated && (
          <ResponsiveTooltip title={localT('restartTooltip')}>
            <Button
              size="small"
              variant="contained"
              color="warning"
              startIcon={<RefreshIcon />}
              onClick={handleRestart}
              className="build-status-restart-button"
              sx={iconOnlyOnMobile ? {
                textTransform: 'none',
                fontSize: '0.75rem',
                minWidth: { xs: '30px', sm: 'auto' },
                padding: { xs: 0, sm: '2px 8px' },
                height: { xs: '30px', sm: 'auto' },
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                '& .MuiButton-startIcon': {
                  margin: { xs: 0, sm: '0 8px 0 -4px' }
                },
                '& .restart-label': {
                  display: { xs: 'none', sm: 'inline' }
                }
              } : {
                textTransform: 'none',
                padding: '2px 8px',
                minWidth: 'auto',
                fontSize: '0.75rem',
              }}
            >
              <span className="restart-label">{localT('restart')}</span>
            </Button>
          </ResponsiveTooltip>
        )}

    </Box>
  );
};
