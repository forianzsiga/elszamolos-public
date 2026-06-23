import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { Link as MuiLink } from '@mui/material';
import i11n from './ShowcaseLabel-i11n.json';
import './ShowcaseLabel.css';

/**
 * Renders the rich text label for the showcase overlay with clickable links.
 */
export const ShowcaseLabel = () => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as Record<string, Record<string, string>>)[language]?.[key] || key;

    return (
        <>
            {localT('part1')}
            <MuiLink 
                component={Link} 
                to="/jobs" 
                className="showcase-link"
            >
                {localT('jobs')}
            </MuiLink>
            {localT('part2')}
            <MuiLink 
                component={Link} 
                to="/sync" 
                className="showcase-link"
            >
                {localT('drive')}
            </MuiLink>
            {localT('part3')}
        </>
    );
};
