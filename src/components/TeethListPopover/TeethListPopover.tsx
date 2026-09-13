import { 
    Popover, Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Typography, Box 
} from '@mui/material';
import type { Tooth } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import i11n from './TeethListPopover-i11n.json';
import './TeethListPopover.css';

interface TeethListPopoverProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    onClose: () => void;
    teeth: Tooth[];
}

/**
 * A popover that displays a read-only list of teeth details for a specific job.
 */
export const TeethListPopover = ({ open, anchorEl, onClose, teeth }: TeethListPopoverProps) => {
    const { language } = useLanguage();
    const typedI11n = i11n as Record<'en' | 'hu', Record<string, string>>;
    const localT = (key: string) => (language === 'debug' ? key : typedI11n[language as 'en' | 'hu']?.[key] || key);

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
            }}
        >
            <Box className="teeth-list-popover-container">
                <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    {localT('teethList.title')} ({teeth?.length || 0})
                </Typography>
                
                {(!teeth || teeth.length === 0) ? (
                    <Typography variant="body2" color="text.secondary">
                        {localT('teethList.noDetails')}
                    </Typography>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{localT('teethTable.number')}</TableCell>
                                    <TableCell>{localT('teethTable.material')}</TableCell>
                                    <TableCell>{localT('teethTable.type')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {teeth.map((tooth, index) => (
                                    <TableRow key={index} hover>
                                        <TableCell>{tooth.number}</TableCell>
                                        <TableCell>{tooth.material}</TableCell>
                                        <TableCell>{tooth.type}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Popover>
    );
};
