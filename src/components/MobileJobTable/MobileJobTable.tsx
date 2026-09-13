/** @file Mobile-optimized job table component for displaying dental jobs in a card layout.
 * Provides a responsive, touch-friendly interface for viewing and managing job entries.
 * Includes interactive elements for editing and deleting jobs, with visual tooth grid representations.
 */

import React from 'react';
import { 
    Box, Typography, Card, CardActionArea, 
    Button
} from '@mui/material';
import type { Job } from '../../types';
import i11n from './MobileJobTable-i11n.json';
import { useLanguage } from '../../context/LanguageContext';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import './MobileJobTable.css';

/**
 * Props for the MobileJobTable component
 * 
 * @interface MobileJobTableProps
 * @property {Job[]} sortedJobs - Array of job objects sorted for display
 * @property {(job: Job) => void} onEdit - Callback function invoked when a job is edited
 * @property {(id: string) => void} onDelete - Callback function invoked when a job is deleted
 * @property {(job: Job) => void} [onDiscard] - Optional callback for discarding a job
 * @property {string[]} [materials] - Optional array of material names for filtering
 * @property {string[]} [types] - Optional array of job types for filtering
 */
/**
 * Props for the {@link MobileJobTable} component.
 * @interface MobileJobTableProps
 */
interface MobileJobTableProps {
    /** Array of job objects sorted for display */
    sortedJobs: Job[];
    /** Callback invoked when a job's edit action is triggered */
    onEdit: (job: Job) => void;
    /** Callback invoked when a job's delete action is triggered */
    onDelete: (id: string) => void;
    /** Optional callback for discarding/unsubmitting jobs */
    onDiscard?: (job: Job) => void;
    /** Optional list of available materials for filtering */
    materials?: string[];
    /** Optional list of available restoration types for filtering */
    types?: string[];
}

/**
 * MobileJobTable component for displaying dental jobs in a mobile-friendly card layout
 * 
 * This component renders a list of dental job cards optimized for mobile devices.
 * Each card displays patient information, doctor name, price, and a visual teeth grid.
 * Supports touch interactions and includes edit/delete functionality.
 * 
 * @component
 * @param {MobileJobTableProps} props - Component properties
 * @param {Job[]} props.sortedJobs - Array of sorted job objects to display
 * @param {(job: Job) => void} props.onEdit - Callback for editing a job
 * @param {(id: string) => void} props.onDelete - Callback for deleting a job
 * @returns {React.ReactElement} Mobile-optimized job table component
 * 
 * @example
 * ```tsx
 * <MobileJobTable
 *   sortedJobs={jobs}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * />
 * ```
 */
/**
 * Mobile-optimized job table component that displays dental jobs as interactive cards.
 * Each card shows patient information, price, and a visual tooth grid, with edit/delete actions.
 * Optimized for touch interaction and responsive layouts.
 * 
 * @component
 * @param {MobileJobTableProps} props - Component props
 * @param {Job[]} props.sortedJobs - Array of job objects to display
 * @param {(job: Job) => void} props.onEdit - Callback for editing a job
 * @param {(id: string) => void} props.onDelete - Callback for deleting a job
 * @param {(job: Job) => void} [props.onDiscard] - Optional callback for discarding jobs
 * @param {string[]} [props.materials] - Optional list of available materials
 * @param {string[]} [props.types] - Optional list of available restoration types
 * @returns {JSX.Element} Mobile-optimized job table component
 */
export const MobileJobTable: React.FC<MobileJobTableProps> = ({
    sortedJobs,
    onEdit,
    onDelete
}) => {
    const { language } = useLanguage();
    const localT = (key: keyof typeof i11n.en) => i11n[language as 'en' | 'hu']?.[key] || i11n.en[key];

    /**
     * Formats a price value with Hungarian locale formatting
     * 
     * @param {number} price - The price value to format
     * @returns {string} Formatted price string with Hungarian thousands separators and 'Ft' suffix
     */
    /**
     * Formats a numeric price into Hungarian currency format.
     * @param {number} price - The price value to format
     * @returns {string} Formatted price string with Hungarian locale formatting and "Ft" suffix
     * @private
     */
    const formatPrice = (price: number) => {
        return price.toLocaleString('hu-HU') + ' Ft';
    };

    /**
     * Renders a mini 4-quadrant teeth grid visualization for a dental job
     * 
     * Creates a visual representation of dental quadrants showing active teeth.
     * Uses standard FDI tooth numbering system for quadrant representation.
     * 
     * @param {Job} job - The job object containing teeth data
     * @returns {React.ReactElement} Mini teeth grid visualization component
     */
    /**
     * Renders a mini 4-quadrant visual representation of teeth involved in a job.
     * Shows active teeth as highlighted squares arranged in standard dental quadrants.
     * @param {Job} job - The job object containing teeth data
     * @returns {JSX.Element} Mini tooth grid visualization component
     * @private
     */
    const renderMiniTeethGrid = (job: Job) => {
        const activeTeethNums = new Set(job.teeth?.map(t => t.number) || []);
        // Standard quadrants
        const q1 = [18, 17, 16, 15, 14, 13, 12, 11];
        const q2 = [21, 22, 23, 24, 25, 26, 27, 28];
        const q3 = [48, 47, 46, 45, 44, 43, 42, 41];
        const q4 = [31, 32, 33, 34, 35, 36, 37, 38];

        /**
         * Renders a single dental quadrant with active teeth visualization
         * 
         * @param {number[]} nums - Array of tooth numbers in the quadrant
         * @returns {React.ReactElement} Visual representation of a dental quadrant
         */
        /**
         * Renders a single quadrant of teeth as a row of colored squares.
         * @param {number[]} nums - Array of tooth numbers in the quadrant
         * @returns {JSX.Element} Visual representation of a tooth quadrant
         * @private
         */
        const renderQuadrant = (nums: number[]) => (
            <Box className="teeth-row">
                {nums.map(n => {
                    const isActive = activeTeethNums.has(n);
                    return (
                        <Box
                            key={n}
                            className={`teeth-unit ${isActive ? 'active' : ''}`}
                        />
                    );
                })}
            </Box>
        );

        return (
            <Box className="teeth-grid-container">
                <Box className="teeth-row">
                    {renderQuadrant(q1)}
                    <Box className="divider-vertical" />
                    {renderQuadrant(q2)}
                </Box>
                <Box className="divider-horizontal" />
                <Box className="teeth-row">
                    {renderQuadrant(q3)}
                    <Box className="divider-vertical" />
                    {renderQuadrant(q4)}
                </Box>
            </Box>
        );
    };

    return (
        <Box className="mobile-job-container">
            {sortedJobs.map((job) => (
                <Card key={job.id} variant="outlined" className="job-card">
                    <ResponsiveTooltip title={localT('editJobTooltip')}>
                        <CardActionArea onClick={() => onEdit(job)}>
                            <Box className="job-content">
                                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                    <Box className="job-info-section">
                                        <Typography variant="h6" fontWeight="bold" noWrap>
                                            {job.patientName}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" gutterBottom>
                                            Dr. {job.doctorName}
                                        </Typography>
                                        <Typography variant="h6" color="primary" fontWeight="bold" className="price-text">
                                            {formatPrice(job.price || 0)}
                                        </Typography>
                                    </Box>
                                    
                                    <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                                        <Typography variant="caption" color="text.secondary" className="arch-map-label">
                                            {localT('archMap')}
                                        </Typography>
                                        {renderMiniTeethGrid(job)}
                                    </Box>
                                </Box>

                                <Box className="footer-section">
                                    <Typography variant="caption" color="text.secondary">
                                        {job.teeth?.length || 0} {localT('units')} • {new Date(job.createdAt).toLocaleDateString()}
                                    </Typography>
                                    <Box className="button-group">
                                        <ResponsiveTooltip title={localT('edit')}>
                                            <Button 
                                                variant="text" 
                                                size="small" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit(job);
                                                }}
                                            >
                                                {localT('edit')}
                                            </Button>
                                        </ResponsiveTooltip>
                                        <ResponsiveTooltip title={localT('delete')}>
                                            <Button 
                                                variant="text" 
                                                size="small" 
                                                color="error" 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(job.id);
                                                }}
                                            >
                                                {localT('delete')}
                                            </Button>
                                        </ResponsiveTooltip>
                                    </Box>
                                </Box>
                            </Box>
                        </CardActionArea>
                    </ResponsiveTooltip>
                </Card>
            ))}
        </Box>
    );
};
