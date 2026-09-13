import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { LanguageProvider } from '../../../context/LanguageContext';
import { ColorModeProvider } from '../../../context/ThemeContext';
import JobTeethTableRow from '../JobTeethTableRow';
import type { JobTeethTableEntry } from '../../../utils/teethTableUtils';
import type { ColumnDef } from '../../VirtualDataTable';
import type { AppliedRuleBreakdown } from '../../../types';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));

// Mock column defs to simulate the table behavior
const mockColumnDefs: ColumnDef<JobTeethTableEntry>[] = [
    {
        id: 'number',
        label: 'Number',
        renderCell: (entry) => <span>{entry.tooth.number}</span>
    },
    {
        id: 'rule',
        label: 'Rule',
        renderCell: (entry) => <span>{entry.tooth.appliedRuleLabel || 'None'}</span>
    },
    {
        id: 'actions',
        label: 'Actions',
        renderCell: (entry) => {
            let isExcluded = false;
            if (entry.kind === 'tooth') {
                isExcluded = !!entry.tooth.isExcluded;
            } else {
                isExcluded = entry.extraRule ? !!entry.extraRule.isExcluded : !!entry.tooth.isExcluded;
            }

            if (entry.kind === 'unitExtra') {
                return <span>{isExcluded ? '(excluded rule)' : '(rule generated entry)'}</span>;
            }
            return null;
        }
    }
];

function WithProviders({ children }: { children: React.ReactNode }) {
    return (
        <ColorModeProvider>
            <LanguageProvider>
                {children}
            </LanguageProvider>
        </ColorModeProvider>
    );
}

describe('JobTeethTableRow', () => {
    const mockOnHoverTooth = vi.fn();

    const normalEntry: JobTeethTableEntry = {
        id: '1',
        kind: 'tooth',
        tooth: {
            id: 't1',
            number: 11,
            material: 'Zircon',
            type: 'Crown',
            status: 'Calculated',
            price: 50000,
            isExcluded: false
        }
    };

    const excludedEntry: JobTeethTableEntry = {
        id: '2',
        kind: 'unitExtra',
        tooth: {
            id: 't1',
            number: 11,
            material: 'Zircon',
            type: 'Crown',
            status: 'Calculated',
            price: 50000,
            isExcluded: true,
            appliedRuleLabel: 'Excluded Rule'
        }
    };

    test('renders normal row without is-excluded class', () => {
        const { container } = render(
            <WithProviders>
                <JobTeethTableRow
                    entry={normalEntry}
                    gridTemplateColumns="24px 1fr 1fr 1fr"
                    columnDefs={mockColumnDefs}
                    visibleColumns={{ number: true, rule: true, actions: true }}
                    hoveredTooth={null}
                    onHoverTooth={mockOnHoverTooth}
                />
            </WithProviders>
        );

        const row = container.querySelector('.job-teeth-table-row');
        expect(row?.classList.contains('is-excluded')).toBe(false);
    });

    test('renders excluded row with is-excluded class and correct label', () => {
        const { container } = render(
            <WithProviders>
                <JobTeethTableRow
                    entry={excludedEntry}
                    gridTemplateColumns="24px 1fr 1fr 1fr"
                    columnDefs={mockColumnDefs}
                    visibleColumns={{ number: true, rule: true, actions: true }}
                    hoveredTooth={null}
                    onHoverTooth={mockOnHoverTooth}
                />
            </WithProviders>
        );

        const row = container.querySelector('.job-teeth-table-row');
        expect(row?.classList.contains('is-excluded')).toBe(true);
        expect(screen.getByText('(excluded rule)')).toBeDefined();
    });

    test('renders the chevron toggle on tooth rows', () => {
        const { container } = render(
            <WithProviders>
                <JobTeethTableRow
                    entry={normalEntry}
                    gridTemplateColumns="24px 1fr 1fr 1fr"
                    columnDefs={mockColumnDefs}
                    visibleColumns={{ number: true, rule: true, actions: true }}
                    hoveredTooth={null}
                    onHoverTooth={mockOnHoverTooth}
                    expanded={false}
                    onToggleExpand={() => {}}
                />
            </WithProviders>
        );
        // The chevron cell exists for tooth-kind entries.
        const chevronCell = container.querySelector('.chevron-cell');
        expect(chevronCell).toBeTruthy();
    });

    test('expanded row exposes a dedicated edit-rule icon button per bullet that fires onJumpToRule', () => {
        const appliedRules: AppliedRuleBreakdown[] = [
            { id: 'rule-1', name: 'Base crown', label: '', priority: 1, kind: 'base', amount: 1000, currency: 'HUF' },
            { id: 'rule-2', name: 'Zircon surcharge', label: '', priority: 2, kind: 'unitExtra', amount: 500, currency: 'HUF' }
        ];
        const entryWithRules: JobTeethTableEntry = {
            id: '3',
            kind: 'tooth',
            tooth: {
                ...normalEntry.tooth,
                appliedRules
            }
        };
        const onJumpToRule = vi.fn();

        const { container } = render(
            <WithProviders>
                <JobTeethTableRow
                    entry={entryWithRules}
                    gridTemplateColumns="24px 1fr 1fr 1fr"
                    columnDefs={mockColumnDefs}
                    visibleColumns={{ number: true, rule: true, actions: true }}
                    hoveredTooth={null}
                    onHoverTooth={mockOnHoverTooth}
                    expanded={true}
                    onToggleExpand={() => {}}
                    onJumpToRule={onJumpToRule}
                />
            </WithProviders>
        );

        const bullets = container.querySelectorAll('.applied-rule-bullet');
        expect(bullets.length).toBe(2);

        // Each bullet has a dedicated edit button (not the whole row being clickable).
        const editButtons = container.querySelectorAll('.applied-rule-action-button.applied-rule-edit');
        expect(editButtons.length).toBe(2);

        // The first bullet's edit button is the explicit click target — NOT
        // the bullet itself. Clicking the button fires onJumpToRule with the
        // right id; clicking the row does not.
        const firstBullet = bullets[0] as HTMLElement;
        expect(firstBullet.querySelector('.MuiButtonBase-root.applied-rule-edit')).toBeTruthy();

        fireEvent.click(editButtons[0]);
        expect(onJumpToRule).toHaveBeenCalledWith('rule-1');

        // The row is no longer a giant click target.
        const listItemButton = container.querySelector('.applied-rule-bullet-button');
        expect(listItemButton).toBeNull();
    });
});
