import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExpandableActionButton } from '../components/ExpandableActionButton';
import { Edit } from '@mui/icons-material';
import { LanguageProvider } from '../context/LanguageContext';

describe('ExpandableActionButton', () => {
    it('is keyboard focusable and activates on Enter and Space', () => {
        const handler = vi.fn();
        const { getByRole } = render(
            <LanguageProvider>
                <ExpandableActionButton icon={<Edit />} label="Edit" onClick={(e: React.MouseEvent) => handler(e)} ariaLabel="Edit job" />
            </LanguageProvider>
        );

        const btn = getByRole('button', { name: /edit job/i });
        expect(btn).toBeDefined();
        expect(btn.getAttribute('tabindex')).toBe('0');

        // Simulate Enter
        fireEvent.keyDown(btn, { key: 'Enter', code: 'Enter' });
        expect(handler).toHaveBeenCalledTimes(1);

        // Simulate Space
        fireEvent.keyDown(btn, { key: ' ', code: 'Space' });
        expect(handler).toHaveBeenCalledTimes(2);
    });
});
