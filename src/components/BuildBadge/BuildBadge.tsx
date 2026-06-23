/**
 * @file BuildBadge.tsx
 * @description Displays a build version badge showing the current build date,
 *              whether an update is available, and the latest version date.
 *              Supports Hungarian and English localisation, a compact mobile
 *              mode, and colour-coded status indicators.
 */

import React from 'react';
import { Typography, Box } from '@mui/material';
import { useLanguage, type Language } from '../../context/LanguageContext';
import i11n from './BuildBadge-i11n.json';
import './BuildBadge.css';

/** Translation keys used for localised user-facing strings in the build badge. */
interface Translation {
  upToDate: string;
  latest: string;
  updateAvailable: string;
  build: string;
}

/** Top-level structure of the localisation JSON file mapping each locale to its translations. */
interface BuildBadgeI11n {
  en: Translation;
  hu: Translation;
}

/** Props accepted by the BuildBadge component. */
interface BuildBadgeProps {
  /** ISO‑like date string of the currently deployed build. */
  currentBuildDate: string;
  /**
   * Date string of a newer available version.
   * When truthy the badge is rendered in an "outdated" (warning) state.
   */
  newVersionDate?: string | null;
  /** When true, the caption text is hidden on small viewports via CSS. */
  hideTextOnMobile?: boolean;
  /** Release version string (e.g. "v0.3.0"), shown when provided. */
  version?: string;
  /**
   * Callback that transforms a raw date string into a display label.
   * @param dateStr    The raw date string to format.
   * @param compactDate When true the formatter should return a shorter representation.
   * @returns The formatted date string ready for display.
   */
  formatBuildDate: (dateStr: string, compactDate?: boolean) => string;
  /**
   * When set, replaces the build date with this label (e.g. "branch@hash")
   * and forces the badge into the up-to-date state. Used in dev mode.
   */
  devLabel?: string | null;
}

/**
 * Renders a small build information badge that shows the current deployment
 * date and optionally indicates whether a newer version is available.
 *
 * The badge is colour‑coded:
 * - **success** colour when the build is up‑to‑date,
 * - **warning** colour when a newer version exists.
 *
 * @param props               The component props.
 * @param props.currentBuildDate   The date string of the currently deployed build.
 * @param props.newVersionDate     Optional date string of a newer build. When
 *                                 provided the badge enters a "stale" state.
 * @param props.hideTextOnMobile   If true the text portion is hidden on
 *                                 narrow viewports via a CSS class.
 * @param props.formatBuildDate   A callback that converts a raw date string
 *                                 into a human‑readable label.
 * @returns A Typography element styled as a build badge.
 */
export const BuildBadge: React.FC<BuildBadgeProps> = ({
  currentBuildDate,
  newVersionDate,
  hideTextOnMobile = false,
  version,
  formatBuildDate,
  devLabel
}) => {
  const { language } = useLanguage();
  const localT = (key: keyof Translation) => {
    const lang = (language === 'debug' ? 'en' : language) as Exclude<Language, 'debug'>;
    return (i11n as BuildBadgeI11n)[lang]?.[key] || key;
  };
  
  // In dev mode we show the working-tree label and suppress the
  // "outdated / latest" status — HMR is the update mechanism there.
  const isOutdated = !devLabel && !!newVersionDate;

  let updateText: React.ReactNode = devLabel
    ? null
    : <Box component="span">({localT('upToDate')})</Box>;
  if (!devLabel && isOutdated) {
    if (newVersionDate) {
      updateText = (
        <Box component="span" className="build-badge-latest-info">
          ({localT('latest')} {formatBuildDate(newVersionDate)})
        </Box>
      );
    } else {
      updateText = <Box component="span" className="build-badge-latest-info">({localT('updateAvailable')})</Box>;
    }
  }

  return (
    <Typography
      variant="caption"
      className={`build-badge ${hideTextOnMobile ? 'build-badge-hide-mobile' : ''} ${
        isOutdated ? 'build-badge-status-outdated' : 'build-badge-status-uptodate'
      }`}
    >
      {version ? `${version} ` : ''}{localT('build')} {devLabel ?? formatBuildDate(currentBuildDate)}
      {updateText}
    </Typography>
  );
};

export default BuildBadge;
