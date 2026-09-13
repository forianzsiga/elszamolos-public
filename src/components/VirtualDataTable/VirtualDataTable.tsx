import React from 'react';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import {
    TableContainer, 
    Checkbox, Menu, MenuItem, FormControlLabel, Box, Typography
} from '@mui/material';
import { Virtuoso } from 'react-virtuoso';
import type { IndexLocationWithAlign } from 'react-virtuoso';
import { VirtualTableHeader } from '../VirtualTableHeader';
import { useAutoColumnWidths } from '../../hooks/useAutoColumnWidths';
import { getHeaderMinimumWidth } from '../../utils/columnSizing';
import { useLanguage } from '../../context/LanguageContext';
import './VirtualDataTable.css';
import i11nRaw from './VirtualDataTable-i11n.json';
const i11n: Record<string, Record<string, string>> = i11nRaw;

export interface ColumnDef<T> {
    id: string;
    label: string;
    width?: number;
    minWidth: number;
    contentMinWidth?: number;
    flex?: number;
    renderHeader?: (props: { 
        column: ColumnDef<T>;
        sortConfig: { key: string, direction: 'asc' | 'desc' } | null;
        onSort: (key: string) => void;
        width: number;
        minWidth: number;
        onResize: (width: number) => void;
    }) => React.ReactNode;
    renderCell?: (item: T, index: number) => React.ReactNode;
    sortable?: boolean;
    align?: 'left' | 'right' | 'center';
    filterOptions?: string[];
    headerMinWidth?: number;
}

interface VirtualDataTableProps<T> {
    data: T[];
    columns: ColumnDef<T>[];
    visibleColumns: Record<string, boolean>;
    columnWidths?: Record<string, number>;
    sortConfig: { key: string, direction: 'asc' | 'desc' } | null;
    selectedIds?: Set<string>;
    selectionState?: { allSelected: boolean, someSelected: boolean };
    columnMenuAnchor: HTMLElement | null;
    filterOptions: Record<string, string[]>;
    columnFilters: Record<string, string[]>;
    onColumnResize?: (key: string, newWidth: number) => void;
    onSort: (key: string) => void;
    onSelectAll?: (checked: boolean) => void;
    onSelectOne?: (id: string, checked: boolean) => void;
    onColumnMenuOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onColumnMenuClose: () => void;
    onColumnToggle: (column: string) => void;
    onColumnFilterChange: (field: string, values: string[]) => void;
    getRowId: (item: T) => string;
    rowProps?: (item: T) => React.HTMLAttributes<HTMLDivElement>;
    noRowSeparator?: boolean;
    disableColumnMenu?: boolean;
    /**
     * Optional width (in pixels) of a leading column reserved for row-level
     * chrome that is rendered by the consumer (e.g. a chevron toggle in
     * `JobTeethTableRow`). When set, the column is prepended to the
     * `gridTemplateColumns`, added to `totalGridWidthPx`, and a leading
     * placeholder cell is rendered in the header. The consumer is
     * responsible for rendering the matching first cell in each row.
     */
    leadingColumnWidth?: number;
    height?: number | string;
    defaultItemHeight?: number;
    
    RowComponent?: React.FC<{
        item: T;
        index: number;
        visibleColumns: Record<string, boolean>;
        gridTemplateColumns: string;
        isSelected?: boolean;
        onToggleSelection?: (id: string, checked: boolean) => void;
    }>;

    renderRow?: (args: {
        item: T;
        index: number;
        visibleColumns: Record<string, boolean>;
        gridTemplateColumns: string;
        isSelected: boolean;
        toggleSelection: (id: string, checked: boolean) => void;
    }) => React.ReactNode;
    
    headerZIndex?: number;
    followOutput?: boolean;

    /**
     * Optional index (or index location with alignment) passed
     * through to the underlying `Virtuoso` as `initialTopMostItemIndex`.
     * Allows callers to restore the list's scroll position on mount.
     */
    initialTopMostItemIndex?: IndexLocationWithAlign | number;

    /**
     * Optional callback invoked on every scroll event with the
     * current `scrollTop` value (in pixels). Use it to persist
     * scroll position via `useListState` or similar.
     */
    onScroll?: (scrollTop: number) => void;
}

const VirtualTableScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => {
    const { style: virtuosoStyle, className, ...rest } = props;
    const containerProps = {
        ...rest,
        style: virtuosoStyle,
        className: `vdt-scroller ${className || ''}`
    };
    return (
        <TableContainer 
            component="div" 
            {...containerProps}
            ref={ref} 
        />
    );
});


const RowRenderer = <T,>({
    item,
    index,
    selectedIds,
    getRowId,
    onSelectOne,
    renderRow,
    RowComponent,
    visibleColumns,
    gridTemplateColumns,
    rowProps,
    noRowSeparator,
    visibleDefs,
    disableColumnMenu,
    localT,
    onSelectAll
}: {
    item: T;
    index: number;
    selectedIds?: Set<string>;
    getRowId: (item: T) => string;
    onSelectOne?: (id: string, checked: boolean) => void;
    renderRow?: (args: {
        item: T;
        index: number;
        visibleColumns: Record<string, boolean>;
        gridTemplateColumns: string;
        isSelected: boolean;
        toggleSelection: (id: string, checked: boolean) => void;
    }) => React.ReactNode;
    RowComponent?: React.FC<{
        item: T;
        index: number;
        visibleColumns: Record<string, boolean>;
        gridTemplateColumns: string;
        isSelected?: boolean;
        onToggleSelection?: (id: string, checked: boolean) => void;
    }>;
    visibleColumns: Record<string, boolean>;
    gridTemplateColumns: string;
    rowProps?: (item: T) => React.HTMLAttributes<HTMLDivElement>;
    noRowSeparator?: boolean;
    visibleDefs: ColumnDef<T>[];
    disableColumnMenu?: boolean;
    localT: (key: string) => string;
    onSelectAll?: (checked: boolean) => void;
}) => {
    const isSelected = selectedIds?.has(getRowId(item)) ?? false;
    const toggleSelection = onSelectOne || (() => {});

    if (renderRow) {
        return (
            <Box className="vdt-render-row-box">
                {renderRow({
                    item,
                    index,
                    visibleColumns,
                    gridTemplateColumns,
                    isSelected,
                    toggleSelection
                })}
            </Box>
        );
    }
    
    if (RowComponent) {
            return (
            <Box className="vdt-render-row-box">
                <RowComponent 
                    item={item} 
                    index={index}
                    visibleColumns={visibleColumns} 
                    gridTemplateColumns={gridTemplateColumns}
                    isSelected={isSelected}
                    onToggleSelection={toggleSelection}
                />
            </Box>
        );
    }
    
    const customRowProps = rowProps ? rowProps(item) : {};
    
    return (
        <Box 
            {...customRowProps}
            className={`vdt-row-box ${noRowSeparator ? '' : 'vdt-row-separator'} ${customRowProps.className || ''}`}
        >
                {onSelectAll && selectedIds && onSelectOne && (
                <Box className="vdt-cell-checkbox">
                    <ResponsiveTooltip title={localT('selectRow')}>
                        <Checkbox 
                            size="small" 
                            checked={selectedIds.has(getRowId(item))}
                            onChange={(e) => onSelectOne(getRowId(item), e.target.checked)}
                        />
                    </ResponsiveTooltip>
                </Box>
            )}
            {visibleDefs.map(col => (
                    <Box 
                    key={col.id} 
                    className={`vdt-cell-content vdt-cell-align-${col.align || 'left'}`}
                >
                    <Box
                        className="vdt-cell-measure"
                        data-vdt-measure-col={col.id}
                    >
                        {col.renderCell ? col.renderCell(item, index) : null}
                    </Box>
                    </Box>
            ))}
            {!disableColumnMenu && <Box className="vdt-cell-end-spacer" />}
        </Box>
    );
};

const ZoomIndicator = ({
    zoomScale,
    setZoomScale,
    setShowZoomIndicator,
    zoomIndicatorTimeoutRef,
    t,
    localT
}: {
    zoomScale: number;
    setZoomScale: React.Dispatch<React.SetStateAction<number>>;
    setShowZoomIndicator: React.Dispatch<React.SetStateAction<boolean>>;
    zoomIndicatorTimeoutRef: React.MutableRefObject<number | null>;
    t: (key: string) => string;
    localT: (key: string) => string;
}) => (
    <ResponsiveTooltip title={localT('resetZoom')}>
        <Box 
            className="vdt-zoom-indicator"
            onClick={() => {
                setZoomScale(1.0);
                setShowZoomIndicator(true);
                if (zoomIndicatorTimeoutRef.current) {
                    window.clearTimeout(zoomIndicatorTimeoutRef.current);
                }
                zoomIndicatorTimeoutRef.current = window.setTimeout(() => {
                    setShowZoomIndicator(false);
                }, 1500);
            }}
        >
            {t('common.zoom')}: {Math.round(zoomScale * 100)}%
            <Typography variant="caption" className="vdt-zoom-help">
                ({t('common.clickToReset')})
            </Typography>
        </Box>
    </ResponsiveTooltip>
);

const ColumnMenu = <T,>({
    columnMenuAnchor,
    onColumnMenuClose,
    columns,
    localT,
    visibleColumns,
    onColumnToggle
}: {
    columnMenuAnchor: HTMLElement | null;
    onColumnMenuClose: () => void;
    columns: ColumnDef<T>[];
    localT: (key: string) => string;
    visibleColumns: Record<string, boolean>;
    onColumnToggle: (column: string) => void;
}) => (
    <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={onColumnMenuClose}
    >
        <Box className="vdt-column-menu-header">
            <Typography variant="subtitle2" fontWeight="bold">{localT('visibleColumns')}</Typography>
        </Box>
        {columns.map((col) => (
            <ResponsiveTooltip key={col.id} title={localT('toggleColumn')}>
                <MenuItem onClick={() => onColumnToggle(col.id)} className="vdt-column-menu-item">
                    <FormControlLabel
                        control={
                            <Checkbox 
                                checked={visibleColumns[col.id]} 
                                size="small" 
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => onColumnToggle(col.id)}
                            />
                        }
                        label={col.label}
                        className="vdt-column-menu-label" 
                    />
                </MenuItem>
            </ResponsiveTooltip>
        ))}
    </Menu>
);

export function VirtualDataTable<T>({
    data,
    columns,
    visibleColumns,
    columnWidths: propColumnWidths,
    sortConfig,
    selectedIds,
    selectionState,
    columnMenuAnchor,
    filterOptions,
    columnFilters,
    onColumnResize,
    onSort,
    onSelectAll,
    onSelectOne,
    onColumnMenuOpen,
    onColumnMenuClose,
    onColumnToggle,
    onColumnFilterChange,
    getRowId,
    rowProps,
    noRowSeparator,
    disableColumnMenu,
    leadingColumnWidth,
    RowComponent,
    renderRow,
    headerZIndex = 100,
    height = '100%',
    defaultItemHeight,
    followOutput = false,
    initialTopMostItemIndex,
    onScroll
}: VirtualDataTableProps<T>) {
    const { language, t } = useLanguage();
    const localT = React.useCallback((key: string) => (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key, [language]);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const outerRef = React.useRef<HTMLDivElement>(null);

    const [resolvedWidths, setResolvedWidths] = React.useState<Record<string, number>>({});

    const needsWidthInitialization = React.useMemo(
        () => columns.some(col => resolvedWidths[col.id] == null && propColumnWidths?.[col.id] == null),
        [columns, resolvedWidths, propColumnWidths]
    );

    const effectiveMinWidths = React.useMemo(() => {
        const widths: Record<string, number> = {};

        columns.forEach(col => {
            const headerMinWidth = col.headerMinWidth ?? (
                col.renderHeader
                    ? 0
                    : getHeaderMinimumWidth({
                        label: col.label,
                        sortable: col.sortable !== false,
                        filterable: Boolean(col.filterOptions || filterOptions[col.id])
                    })
            );

            widths[col.id] = Math.max(col.minWidth ?? 50, headerMinWidth, col.contentMinWidth ?? 0);
        });

        return widths;
    }, [columns, filterOptions]);

    const autoWidths = useAutoColumnWidths(columns, data, null, 50, needsWidthInitialization);

    React.useEffect(() => {
        setResolvedWidths(prev => {
            let changed = false;
            const next: Record<string, number> = { ...prev };

            columns.forEach(col => {
                const minWidth = effectiveMinWidths[col.id] ?? col.minWidth ?? 50;
                const incomingWidth = propColumnWidths?.[col.id];

                if (incomingWidth != null) {
                    const clampedIncomingWidth = Math.max(minWidth, Math.round(incomingWidth));
                    if (next[col.id] !== clampedIncomingWidth) {
                        next[col.id] = clampedIncomingWidth;
                        changed = true;
                    }
                    return;
                }

                if (next[col.id] == null) {
                    const initialWidth = autoWidths[col.id] ?? col.width ?? minWidth;
                    next[col.id] = Math.max(minWidth, Math.round(initialWidth));
                    changed = true;
                    return;
                }

                if (next[col.id] < minWidth) {
                    next[col.id] = minWidth;
                    changed = true;
                }
            });

            const activeColumnIds = new Set(columns.map(col => col.id));
            Object.keys(next).forEach(colId => {
                if (!activeColumnIds.has(colId)) {
                    delete next[colId];
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [columns, autoWidths, propColumnWidths, effectiveMinWidths]);

    const handleResize = React.useCallback((key: string, newWidth: number) => {
        const colDef = columns.find(c => c.id === key);
        const minWidth = effectiveMinWidths[key] ?? colDef?.minWidth ?? 50;

        const clamped = Math.max(minWidth, Math.round(newWidth));

        setResolvedWidths(prev => {
            if (prev[key] === clamped) {
                return prev;
            }
            return { ...prev, [key]: clamped };
        });
        if (onColumnResize) {
            onColumnResize(key, clamped);
        }
    }, [columns, effectiveMinWidths, onColumnResize]);
    
    const visibleDefs = React.useMemo(() => columns.filter(col => visibleColumns[col.id]), [columns, visibleColumns]);

    const trackWidths = React.useMemo(() => {
        const widths: Record<string, number> = {};
        visibleDefs.forEach(col => {
            const minWidth = effectiveMinWidths[col.id] ?? col.minWidth ?? 50;
            const width = resolvedWidths[col.id] ?? propColumnWidths?.[col.id] ?? autoWidths[col.id] ?? col.width ?? minWidth;
            widths[col.id] = Math.max(minWidth, Math.round(width));
        });
        return widths;
    }, [visibleDefs, resolvedWidths, propColumnWidths, autoWidths, effectiveMinWidths]);

    const totalGridWidthPx = React.useMemo(() => {
        let total = 0;
        if (leadingColumnWidth) total += leadingColumnWidth;
        if (onSelectAll) total += 50;
        visibleDefs.forEach(col => {
            total += trackWidths[col.id] ?? (col.minWidth || 50);
        });
        if (!disableColumnMenu) total += 50;
        return total;
    }, [leadingColumnWidth, onSelectAll, visibleDefs, trackWidths, disableColumnMenu]);

    const onScrollRef = React.useRef<((scrollTop: number) => void) | undefined>(onScroll);
    React.useEffect(() => {
        onScrollRef.current = onScroll;
    }, [onScroll]);

    const [zoomScale, setZoomScale] = React.useState<number>(() => {
        const colHash = columns.map(c => c.id).join('_');
        const saved = localStorage.getItem(`vdt_zoom_${colHash}`);
        if (saved) {
            const parsed = parseFloat(saved);
            if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
                return parsed;
            }
        }
        return 1.0;
    });

    React.useEffect(() => {
        const colHash = columns.map(c => c.id).join('_');
        localStorage.setItem(`vdt_zoom_${colHash}`, zoomScale.toString());
    }, [zoomScale, columns]);

    const [showZoomIndicator, setShowZoomIndicator] = React.useState(false);
    const zoomIndicatorTimeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (zoomIndicatorTimeoutRef.current) {
                window.clearTimeout(zoomIndicatorTimeoutRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        const element = outerRef.current;
        if (!element) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                
                const containerWidth = element.clientWidth;
                const fitScale = containerWidth > 0 && totalGridWidthPx > 0 ? containerWidth / totalGridWidthPx : 0.5;
                const dynamicMinScale = Math.max(0.5, fitScale);

                const delta = e.deltaY;
                const factor = 1 - (delta * 0.005);
                
                setZoomScale(prev => {
                    let next = prev * factor;
                    next = Math.max(dynamicMinScale, Math.min(2.0, next));
                    next = Math.round(next * 10000) / 10000;
                    return next;
                });

                setShowZoomIndicator(true);
                if (zoomIndicatorTimeoutRef.current) {
                    window.clearTimeout(zoomIndicatorTimeoutRef.current);
                }
                zoomIndicatorTimeoutRef.current = window.setTimeout(() => {
                    setShowZoomIndicator(false);
                }, 1500);
            }
        };

        element.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            element.removeEventListener('wheel', handleWheel);
        };
    }, [totalGridWidthPx]);

    const touchStartDistRef = React.useRef<number | null>(null);
    const initialScaleRef = React.useRef<number>(1.0);

    React.useEffect(() => {
        const element = outerRef.current;
        if (!element) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                e.stopPropagation();
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dx = t1.clientX - t2.clientX;
                const dy = t1.clientY - t2.clientY;
                touchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
                
                setZoomScale(current => {
                    initialScaleRef.current = current;
                    return current;
                });
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && touchStartDistRef.current !== null) {
                e.preventDefault();
                e.stopPropagation();
                
                const containerWidth = element.clientWidth;
                const fitScale = containerWidth > 0 && totalGridWidthPx > 0 ? containerWidth / totalGridWidthPx : 0.5;
                const dynamicMinScale = Math.max(0.5, fitScale);

                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dx = t1.clientX - t2.clientX;
                const dy = t1.clientY - t2.clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                const ratio = dist / touchStartDistRef.current;
                
                setZoomScale(() => {
                    let next = initialScaleRef.current * ratio;
                    next = Math.max(dynamicMinScale, Math.min(2.0, next));
                    next = Math.round(next * 10000) / 10000;
                    return next;
                });

                setShowZoomIndicator(true);
                if (zoomIndicatorTimeoutRef.current) {
                    window.clearTimeout(zoomIndicatorTimeoutRef.current);
                }
                zoomIndicatorTimeoutRef.current = window.setTimeout(() => {
                    setShowZoomIndicator(false);
                }, 1500);
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (touchStartDistRef.current !== null) {
                e.stopPropagation();
            }
            touchStartDistRef.current = null;
        };

        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [totalGridWidthPx]);

    React.useEffect(() => {
        const element = outerRef.current;
        if (!element) return;

        const checkAndSnapZoom = () => {
            const containerWidth = element.clientWidth;
            if (containerWidth > 0 && totalGridWidthPx > 0) {
                const fitScale = containerWidth / totalGridWidthPx;
                const dynamicMinScale = Math.max(0.5, fitScale);
                
                if (zoomScale < dynamicMinScale) {
                    const snappedScale = Math.round(dynamicMinScale * 10000) / 10000;
                    setZoomScale(snappedScale);
                }
            }
        };

        checkAndSnapZoom();

        const observer = new ResizeObserver(() => {
            checkAndSnapZoom();
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [totalGridWidthPx, zoomScale]);
    React.useEffect(() => {
        const scroller = containerRef.current;
        if (!scroller || !onScroll) {
            return;
        }

        const handleScroll = () => {
            onScrollRef.current?.(scroller.scrollTop);
        };

        scroller.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            scroller.removeEventListener('scroll', handleScroll);
        };
    }, [onScroll]);


    const gridTemplateColumns = React.useMemo(() => {
        const parts: string[] = [];
        if (leadingColumnWidth) parts.push(`${leadingColumnWidth}px`);
        if (onSelectAll) parts.push('50px');
        visibleDefs.forEach(col => {
            parts.push(`${trackWidths[col.id]}px`);
        });
        if (!disableColumnMenu) {
            parts.push('50px');
        }
        return parts.join(' ');
    }, [leadingColumnWidth, visibleDefs, trackWidths, onSelectAll, disableColumnMenu]);

    const itemContent = React.useCallback((index: number, item: T) => {
        return (
            <RowRenderer
                item={item}
                index={index}
                selectedIds={selectedIds}
                getRowId={getRowId}
                onSelectOne={onSelectOne}
                renderRow={renderRow}
                RowComponent={RowComponent}
                visibleColumns={visibleColumns}
                gridTemplateColumns={gridTemplateColumns}
                rowProps={rowProps}
                noRowSeparator={noRowSeparator}
                visibleDefs={visibleDefs}
                disableColumnMenu={disableColumnMenu}
                localT={localT}
                onSelectAll={onSelectAll}
            />
        );
    }, [
        selectedIds, getRowId, onSelectOne, renderRow, RowComponent, 
        visibleColumns, gridTemplateColumns, rowProps, noRowSeparator, 
        onSelectAll, visibleDefs, disableColumnMenu, localT
    ]);

    const HeaderElement = React.useMemo(() => (
        <VirtualTableHeader
            headerZIndex={headerZIndex}
            gridTemplateColumns={gridTemplateColumns}
            totalGridWidthPx={totalGridWidthPx}
            onSelectAll={onSelectAll}
            selectionState={selectionState}
            visibleDefs={visibleDefs}
            trackWidths={trackWidths}
            effectiveMinWidths={effectiveMinWidths}
            sortConfig={sortConfig}
            onSort={onSort}
            data={data}
            filterOptions={filterOptions}
            columnFilters={columnFilters}
            onColumnFilterChange={onColumnFilterChange}
            handleResize={handleResize}
            disableColumnMenu={disableColumnMenu}
            leadingColumnWidth={leadingColumnWidth}
            onColumnMenuOpen={onColumnMenuOpen}
        />
    ), [
        headerZIndex, gridTemplateColumns,
        totalGridWidthPx, onSelectAll, selectionState, visibleDefs, trackWidths,
        effectiveMinWidths, sortConfig, onSort, data, filterOptions, columnFilters,
        onColumnFilterChange, handleResize, disableColumnMenu, leadingColumnWidth, onColumnMenuOpen
    ]);

    const VirtuosoComponents = React.useMemo(() => ({
        Scroller: VirtualTableScroller,
        Footer: () => <div className="vdt-footer-spacer" />,
        EmptyPlaceholder: () => (
            <Box className="vdt-empty-placeholder">
                <Typography variant="body2" color="text.secondary">
                    {localT('noEntries')}
                </Typography>
            </Box>
        )
    }), [localT]);

    React.useLayoutEffect(() => {
        if (outerRef.current) {
            outerRef.current.style.setProperty('--vdt-height', typeof height === 'number' ? `${height}px` : height || '100%');
            outerRef.current.style.setProperty('--vdt-total-width', `${totalGridWidthPx}px`);
            outerRef.current.style.setProperty('--vdt-grid-columns', gridTemplateColumns);
            outerRef.current.style.setProperty('--vdt-zoom-scale', zoomScale.toString());
        }
    }, [height, totalGridWidthPx, gridTemplateColumns, zoomScale]);

    return (
        <Box
            ref={outerRef}
            className="vdt-container"
        >
            <Box className="vdt-header-slot">
                {HeaderElement}
            </Box>
            <Box className="vdt-inner-box">
                <Virtuoso
                    className="vdt-virtuoso-container"
                    data={data}
                    itemContent={itemContent}
                    defaultItemHeight={defaultItemHeight}
                    followOutput={followOutput}
                    {...(initialTopMostItemIndex != null ? { initialTopMostItemIndex } : {})}
                    scrollerRef={(node) => {
                        if (node) {
                            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node as HTMLDivElement;
                        }
                    }}
                    components={VirtuosoComponents}
                />
            </Box>

            {showZoomIndicator && (
                <ZoomIndicator
                    zoomScale={zoomScale}
                    setZoomScale={setZoomScale}
                    setShowZoomIndicator={setShowZoomIndicator}
                    zoomIndicatorTimeoutRef={zoomIndicatorTimeoutRef}
                    t={t}
                    localT={localT}
                />
            )}

            <ColumnMenu
                columnMenuAnchor={columnMenuAnchor}
                onColumnMenuClose={onColumnMenuClose}
                columns={columns}
                localT={localT}
                visibleColumns={visibleColumns}
                onColumnToggle={onColumnToggle}
            />
        </Box>
    );
}
