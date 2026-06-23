import { memo, useRef, useLayoutEffect } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { ArrowUpward, ArrowDownward, Sort } from '@mui/icons-material';
import { ColumnFilter } from '../ColumnFilter';
import { ResizeHandle } from '../ResizeHandle/ResizeHandle';
import './SortableTableHeader.css';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import i11n from './SortableTableHeader-i11n.json';


interface SortableTableHeaderProps {
    label: string;
    field: string;
    width: number;
    minWidth: number;
    onResize: (width: number) => void;
    sortConfig: { key: string, direction: 'asc' | 'desc' } | null;
    onSort: (key: string) => void;
    sortable?: boolean;
    rows: unknown[];
    options?: string[];
    selectedValues?: string[];
    onFilterChange?: (values: string[]) => void;
    sx?: React.CSSProperties;
    component?: React.ElementType;
}

export const SortableTableHeader = memo(({
    label,
    field,
    width,
    minWidth,
    onResize,
    sortConfig,
    onSort,
    sortable = true,
    rows,
    options,
    selectedValues,
    onFilterChange,
    sx,
    component = 'div'
}: SortableTableHeaderProps) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language as 'en' | 'hu']?.[key] || key;
    
    const rootRef = useRef<HTMLElement>(null);

    useLayoutEffect(() => {
        const element = rootRef.current;
        if (!element) return;

        element.style.width = `${width}px`;
        if (sx) {
            Object.assign(element.style, sx);
        }
    }, [width, sx]);

    const renderSortIcon = () => {
        if (sortConfig?.key !== field) {
            return <Sort fontSize="small" className="sortable-table-header-sort-icon" />;
        }
        return sortConfig.direction === 'asc' ? (
            <ArrowUpward fontSize="small" color="primary" />
        ) : (
            <ArrowDownward fontSize="small" color="primary" />
        );
    };

    return (
        <Box 
            component={component} 
            ref={rootRef}
            className="sortable-table-header-root"
        >
            <Box className="sortable-table-header-inner">
                {/* Header Label - sorting only via explicit control now */}
                <Box className="sortable-table-header-label-container">
                    <Typography 
                        data-vdt-measure-col={field}
                        variant="body2" 
                        fontWeight="bold" 
                        noWrap 
                        title={label}
                        className="sortable-table-header-label"
                    >
                        {label}
                    </Typography>
                </Box>

                {/* Filter & Sort Icon Row */}
                <Box 
                    className="sortable-table-header-controls"
                    data-vdt-measure-col={field}
                >
                    {options && onFilterChange && (
                        <Box className="sortable-table-header-filter-wrapper">
                            <ColumnFilter 
                                field={field}
                                rows={rows || []}
                                options={options} 
                                selectedValues={selectedValues || []} 
                                onFilterChange={onFilterChange} 
                            />
                        </Box>
                    )}
                    
                    {sortable && (
                        <ResponsiveTooltip title={localT('sort')}>
                            <IconButton 
                                size="small" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSort(field);
                                }}
                                className="sortable-table-header-icon-button"
                            >
                                {renderSortIcon()}
                            </IconButton>
                        </ResponsiveTooltip>
                    )}
                </Box>
            </Box>
            
            <ResponsiveTooltip title={localT('resize')}>
                <ResizeHandle width={width} minWidth={minWidth} onResize={onResize} />
            </ResponsiveTooltip>
        </Box>
    );
});
