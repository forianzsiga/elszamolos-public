import React, { useLayoutEffect, useRef } from 'react';
import { Box, Checkbox, IconButton } from '@mui/material';
import { ViewColumn } from '@mui/icons-material';
import { SortableTableHeader } from '../SortableTableHeader';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import './VirtualTableHeader.css';
import i11nRaw from './VirtualTableHeader-i11n.json';
const i11n: Record<'en' | 'hu', Record<string, string>> = i11nRaw;

import type { ColumnDef } from '../VirtualDataTable';

const getJustifyContent = (align: string | undefined) => {
    if (align === 'center') return 'center';
    if (align === 'right') return 'flex-end';
    return 'flex-start';
};

interface Props<T> {
    headerZIndex: number;
    gridTemplateColumns: string;
    totalGridWidthPx: number;
    onSelectAll?: (checked: boolean) => void;
    selectionState?: { allSelected: boolean; someSelected: boolean } | undefined;
    visibleDefs: ColumnDef<T>[];
    trackWidths: Record<string, number>;
    effectiveMinWidths: Record<string, number>;
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
    data: T[];
    filterOptions: Record<string, string[]>;
    columnFilters: Record<string, string[]>;
    onColumnFilterChange: (field: string, values: string[]) => void;
    handleResize: (key: string, newWidth: number) => void;
    disableColumnMenu?: boolean;
    /**
     * Optional width (in pixels) of a leading column reserved for
     * consumer-rendered row chrome. When set, the header renders a
     * leading placeholder cell matching that width so the header
     * grid stays aligned with the rows.
     */
    leadingColumnWidth?: number;
    onColumnMenuOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function VirtualTableHeader<T>(props: Props<T>) {
    const {
        headerZIndex,
        gridTemplateColumns,
        totalGridWidthPx,
        onSelectAll,
        selectionState,
        visibleDefs,
        trackWidths,
        effectiveMinWidths,
        sortConfig,
        onSort,
        data,
        filterOptions,
        columnFilters,
        onColumnFilterChange,
        handleResize,
        disableColumnMenu,
        leadingColumnWidth,
        onColumnMenuOpen
    } = props;

    const headerRef = useRef<HTMLDivElement>(null);

    const { language } = useLanguage();
    const localT = (key: string) => {
        if (language === 'debug') return key;
        return i11n[language as 'en' | 'hu']?.[key] || key;
    };

    useLayoutEffect(() => {
        const el = headerRef.current;
        if (!el) return;

        el.style.setProperty('--grid-template-columns', gridTemplateColumns);
        el.style.setProperty('--total-grid-width', `${totalGridWidthPx}px`);
        el.style.setProperty('--header-z-index', String(headerZIndex));

        const headers = el.querySelectorAll('.sortable-table-header-root');
        let headerIndex = 0;
        visibleDefs.forEach((col) => {
            if (col.renderHeader) return;
            const headerEl = headers[headerIndex] as HTMLElement;
            if (headerEl) {
                headerEl.style.display = 'flex';
                headerEl.style.justifyContent = getJustifyContent(col.align);
            }
            headerIndex++;
        });
    }, [
        gridTemplateColumns,
        totalGridWidthPx,
        headerZIndex,
        visibleDefs
    ]);

    return (
        <Box
            ref={headerRef}
            className="virtual-table-header-grid"
        >
            {leadingColumnWidth !== undefined && leadingColumnWidth > 0 && (
                <div
                    className="virtual-table-header-leading-wrapper"
                    style={{ width: `${leadingColumnWidth}px` }}
                    aria-hidden="true"
                />
            )}
            {onSelectAll && selectionState && (
                <div className="virtual-table-header-checkbox-wrapper">
                    <ResponsiveTooltip title={localT('selectRow')}>
                        <Checkbox
                            size="small"
                            checked={selectionState.allSelected}
                            indeterminate={selectionState.someSelected}
                            onChange={(e) => onSelectAll(e.target.checked)}
                        />
                    </ResponsiveTooltip>
                </div>
            )}

            {visibleDefs.map(col => {
                if (col.renderHeader) {
                    return (
                        <React.Fragment key={col.id}>
                            {col.renderHeader({
                                column: col,
                                sortConfig,
                                onSort,
                                width: trackWidths[col.id] ?? col.minWidth,
                                minWidth: effectiveMinWidths[col.id] ?? col.minWidth,
                                onResize: (w) => handleResize(col.id, w)
                            })}
                        </React.Fragment>
                    );
                }

                return (
                    <SortableTableHeader
                        key={col.id}
                        component="div"
                        label={col.label}
                        field={col.id}
                        width={trackWidths[col.id] ?? col.minWidth}
                        minWidth={effectiveMinWidths[col.id] ?? col.minWidth}
                        onResize={(w) => handleResize(col.id, w)}
                        sortConfig={sortConfig}
                        onSort={onSort}
                        sortable={col.sortable}
                        rows={data}
                        options={col.filterOptions || filterOptions[col.id]}
                        selectedValues={columnFilters[col.id]}
                        onFilterChange={(v) => onColumnFilterChange(col.id, v)}
                    />
                );
            })}

            {!disableColumnMenu && (
                <div className="virtual-table-header-column-menu-wrapper">
                    <Box display="flex" alignItems="center" justifyContent="center" width="100%">
                        <ResponsiveTooltip title={localT('toggleColumnMenu')}>
                            <IconButton
                                size="small"
                                onClick={onColumnMenuOpen}
                            >
                                <ViewColumn fontSize="small" />
                            </IconButton>
                        </ResponsiveTooltip>
                    </Box>
                </div>
            )}
        </Box>
    );
}

export default VirtualTableHeader;
