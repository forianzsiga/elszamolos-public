import React, { useState, forwardRef, useCallback, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Box, Button, Checkbox, FormControlLabel, List, Typography, Divider, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import { DeleteSweep, Lock, Warning, KeyboardArrowRight, KeyboardArrowDown } from '@mui/icons-material';
import { Virtuoso } from 'react-virtuoso';
import { SortableRuleItem } from '../SortableRuleItem';
import { ResponsiveTooltip } from '../ResponsiveTooltip';
import { useLanguage } from '../../context/LanguageContext';
import { useListState } from '../../hooks/useListState';
import type { TariffRule, Job } from '../../types';
import i11n from './RuleList-i11n.json';
import './RuleList.css';

interface RuleListProps {
    rules: TariffRule[];
    selectedRuleIds: Set<string>;
    onSelectAllRules: (checked: boolean) => void;
    onSelectOneRule: (id: string, checked: boolean) => void;
    onDeleteSelectedRules: () => void;
    onDragEnd: (event: DragEndEvent) => void;
    onEdit: (rule: TariffRule) => void;
    onDelete: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onDuplicate: (rule: TariffRule) => void;
    jobs?: Job[];
    /**
     * When `true`, dims the list to signal that a debounced preview
     * recalculation is running in the background. Inputs become
     * non-interactive until the recalc completes.
     */
    isRecalculating?: boolean;
}

/**
 * Discriminated row types rendered by the unified Virtuoso list.
 *  - `header` : the "System Rules (N)" section header (collapsible).
 *  - `rule`   : a single rule card (rendered with `SortableRuleItem`).
 *  - `divider`: a thin visual separator between the system and user sections.
 */
type UnifiedRow =
    | { kind: 'header'; count: number }
    | { kind: 'rule'; rule: TariffRule }
    | { kind: 'divider' };

/**
 * Header row for the system rules section, rendered as a regular item inside
 * the unified Virtuoso list. Its open/close state is owned by the parent
 * `RuleList` and toggled via `onToggle`.
 */
const SystemRulesHeaderRow = ({ count, open, onToggle, localT }: { count: number; open: boolean; onToggle: () => void; localT: (key: string) => string }) => (
    <ResponsiveTooltip title={localT('toggleSystemRulesTooltip')}>
        <Box
            className="system-rules-header"
            bgcolor="action.hover"
            borderBottom={1}
            borderColor="divider"
            onClick={onToggle}
            role="button"
            aria-expanded={open}
        >
            {open ? <KeyboardArrowDown color="action" /> : <KeyboardArrowRight color="action" />}
            <Typography variant="subtitle2" color="text.secondary" display="flex" alignItems="center" gap={1} flexGrow={1}>
                {localT('systemRules')} ({count}) <Lock fontSize="small" />
            </Typography>
        </Box>
    </ResponsiveTooltip>
);

const UnifiedRulesList = ({
    rows,
    sortableItemIds,
    sensors,
    onDragEnd,
    selectedRuleIds,
    onSelectOneRule,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    jobs,
    initialTopMostItemIndex,
    onScroll,
    systemRulesOpen,
    onToggleSystemRulesOpen,
    localT,
}: {
    rows: UnifiedRow[];
    sortableItemIds: string[];
    sensors: ReturnType<typeof useSensors>;
    onDragEnd: (event: DragEndEvent) => void;
    selectedRuleIds: Set<string>;
    onSelectOneRule: (id: string, checked: boolean) => void;
    onEdit: (rule: TariffRule) => void;
    onDelete: (id: string) => void;
    onMoveUp: (id: string) => void;
    onMoveDown: (id: string) => void;
    onDuplicate: (rule: TariffRule) => void;
    jobs?: Job[];
    initialTopMostItemIndex?: number;
    onScroll?: (scrollTop: number) => void;
    systemRulesOpen: boolean;
    onToggleSystemRulesOpen: () => void;
    localT: (key: string) => string;
}) => {
    const onScrollRef = React.useRef<((scrollTop: number) => void) | undefined>(onScroll);
    const scrollListenerCleanupRef = React.useRef<(() => void) | null>(null);
    React.useEffect(() => {
        onScrollRef.current = onScroll;
    }, [onScroll]);

    React.useEffect(() => {
        return () => {
            scrollListenerCleanupRef.current?.();
            scrollListenerCleanupRef.current = null;
        };
    }, []);

    const handleScrollerRef = React.useCallback((node: HTMLElement | null | Window) => {
        // Detach any previous listener before re-binding.
        scrollListenerCleanupRef.current?.();
        scrollListenerCleanupRef.current = null;
        if (!node || node === window) {
            return;
        }
        const element = node as HTMLElement;
        const handleScroll = () => {
            onScrollRef.current?.(element.scrollTop);
        };
        element.addEventListener('scroll', handleScroll, { passive: true });
        scrollListenerCleanupRef.current = () => {
            element.removeEventListener('scroll', handleScroll);
        };
        // Best-effort: emit the current value once on attach so any
        // pre-existing scroll position is captured by the parent.
        handleScroll();
    }, []);

    return (
        <Box className="unified-rules-container">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
            >
                <SortableContext
                    items={sortableItemIds}
                    strategy={verticalListSortingStrategy}
                >
                    <Virtuoso
                        className="unified-rules-virtuoso"
                        data={rows}
                        initialTopMostItemIndex={initialTopMostItemIndex}
                        scrollerRef={handleScrollerRef}
                        components={{
                            List: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <List {...props} component="div" ref={ref} />),
                            Item: forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => <div {...props} ref={ref} />)
                        }}
                        itemContent={(_index, row) => {
                            if (row.kind === 'header') {
                                return (
                                    <SystemRulesHeaderRow
                                        count={row.count}
                                        open={systemRulesOpen}
                                        onToggle={onToggleSystemRulesOpen}
                                        localT={localT}
                                    />
                                );
                            }
                            if (row.kind === 'divider') {
                                return (
                                    <Box className="unified-row unified-row--section-label" alignItems="center" display="flex">
                                        <Divider sx={{ flex: 1 }} />
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                px: 1.5,
                                                textTransform: 'uppercase',
                                                letterSpacing: 0.5,
                                                fontWeight: 600,
                                            }}
                                        >
                                            {localT('userRulesSection')}
                                        </Typography>
                                        <Divider sx={{ flex: 1 }} />
                                    </Box>
                                );
                            }
                            const rule = row.rule;
                            return (
                                <SortableRuleItem
                                    key={rule.id}
                                    rule={rule}
                                    selected={selectedRuleIds.has(rule.id)}
                                    isSystem={!!rule.isSystem}
                                    onSelect={(c: boolean) => onSelectOneRule(rule.id, c)}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onMoveUp={onMoveUp}
                                    onMoveDown={onMoveDown}
                                    onDuplicate={onDuplicate}
                                    jobs={jobs}
                                />
                            );
                        }}
                    />
                </SortableContext>
            </DndContext>
        </Box>
    );
};

const ConfirmationDialog = ({ open, onClose, title, message, onConfirm, confirmText, confirmColor, localT }: { open: boolean, onClose: () => void, title: string, message: string, onConfirm: () => void, confirmText: string, confirmColor: 'warning' | 'error', localT: (key: string) => string }) => {
    if (confirmColor === 'warning') {
        return (
            <Dialog open={open} onClose={onClose}>
                <DialogTitle display="flex" alignItems="center" gap={1}>
                    <Warning color={confirmColor} /> {title}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {message}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <ResponsiveTooltip title={localT('cancelTooltip')}>
                        <Button onClick={onClose}>{localT('cancel')}</Button>
                    </ResponsiveTooltip>
                    <ResponsiveTooltip title={localT('confirmEditTooltip')}>
                        <Button onClick={onConfirm} color={confirmColor} variant="contained" autoFocus>
                            {confirmText}
                        </Button>
                    </ResponsiveTooltip>
                </DialogActions>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle display="flex" alignItems="center" gap={1}>
                <Warning color={confirmColor} /> {title}
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {message}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <ResponsiveTooltip title={localT('cancelTooltip')}>
                    <Button onClick={onClose}>{localT('cancel')}</Button>
                </ResponsiveTooltip>
                <ResponsiveTooltip title={localT('confirmDeleteTooltip')}>
                    <Button onClick={onConfirm} color={confirmColor} variant="contained" autoFocus>
                        {confirmText}
                    </Button>
                </ResponsiveTooltip>
            </DialogActions>
        </Dialog>
    );
};

export const RuleList: React.FC<RuleListProps> = ({
    rules,
    selectedRuleIds,
    onSelectAllRules,
    onSelectOneRule,
    onDeleteSelectedRules,
    onDragEnd,
    onEdit,
    onDelete,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    jobs,
    isRecalculating = false,
}) => {
    const { language } = useLanguage();
    const localT = (key: string) => (i11n as { [key in 'en' | 'hu']: Record<string, string> })[language as 'en' | 'hu']?.[key] || key;

    const [warningOpen, setWarningOpen] = useState(false);
    const [deleteWarningOpen, setDeleteWarningOpen] = useState(false);
    const [ruleToEdit, setRuleToEdit] = useState<TariffRule | null>(null);
    const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);
    const [systemRulesOpen, setSystemRulesOpen] = useState(false);
    const [listState, setListState] = useListState('ruleList', { scrollTop: 0 });
    const handleRuleListScroll = useCallback((scrollTop: number) => {
        setListState({ scrollTop });
    }, [setListState]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const systemRules = useMemo(() => rules.filter(r => r.isSystem), [rules]);
    const userRules = useMemo(
        () => rules.filter(r => !r.isSystem).sort((a, b) => a.priority - b.priority),
        [rules]
    );

    // The unified list contains: [system header, ...visible system rules, divider, ...user rules].
    // When the system section is collapsed, the system rules and divider are skipped
    // but the header row remains so the user can re-open the section.
    const rows = useMemo<UnifiedRow[]>(() => {
        const out: UnifiedRow[] = [];
        if (systemRules.length > 0) {
            out.push({ kind: 'header', count: systemRules.length });
            if (systemRulesOpen) {
                for (const r of systemRules) {
                    out.push({ kind: 'rule', rule: r });
                }
                out.push({ kind: 'divider' });
            }
        }
        for (const r of userRules) {
            out.push({ kind: 'rule', rule: r });
        }
        return out;
    }, [systemRules, systemRulesOpen, userRules]);

    // All rule IDs (system + user) are registered with the SortableContext
    // so dnd-kit knows about the order, but `useSortable({ disabled: isSystem })`
    // inside `SortableRuleItem` prevents the system items from being dragged.
    const sortableItemIds = useMemo(
        () => [...systemRules.map(r => r.id), ...userRules.map(r => r.id)],
        [systemRules, userRules]
    );

    const handleSystemEditClick = (rule: TariffRule) => {
        setRuleToEdit(rule);
        setWarningOpen(true);
    };

    const handleSystemDeleteClick = (id: string) => {
        setRuleToDelete(id);
        setDeleteWarningOpen(true);
    };

    const confirmEdit = () => {
        if (ruleToEdit) {
            onEdit(ruleToEdit);
        }
        setWarningOpen(false);
        setRuleToEdit(null);
    };

    const confirmDelete = () => {
        if (ruleToDelete) {
            onDelete(ruleToDelete);
        }
        setDeleteWarningOpen(false);
        setRuleToDelete(null);
    };

    // The system rules get the confirmation-wrapped handlers; user rules
    // call onEdit/onDelete directly.
    const onEditWithConfirm = useCallback((rule: TariffRule) => {
        if (rule.isSystem) {
            handleSystemEditClick(rule);
        } else {
            onEdit(rule);
        }
    }, [onEdit]);

    const onDeleteWithConfirm = useCallback((id: string) => {
        const rule = rules.find(r => r.id === id);
        if (rule?.isSystem) {
            handleSystemDeleteClick(id);
        } else {
            onDelete(id);
        }
    }, [onDelete, rules]);

    return (
        <Box
            className="rule-list-root"
            sx={{
                opacity: isRecalculating ? 0.4 : 1,
                pointerEvents: isRecalculating ? 'none' : 'auto',
                filter: isRecalculating ? 'grayscale(0.5)' : 'none',
                transition: 'opacity 0.2s ease, filter 0.2s ease',
            }}
        >
            <Box className="rule-list-header" borderBottom={1} borderColor="divider">
                <FormControlLabel
                    className="rule-list-header-checkbox"
                    control={
                        <Checkbox
                            checked={userRules.length > 0 && selectedRuleIds.size === userRules.length}
                            indeterminate={selectedRuleIds.size > 0 && selectedRuleIds.size < userRules.length}
                            onChange={(e) => onSelectAllRules(e.target.checked)}
                            size="small"
                        />
                    }
                    label={localT('selectAll')}
                />
                {selectedRuleIds.size > 0 && (
                    <ResponsiveTooltip title={localT('deleteSelectedRulesTooltip')}>
                        <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<DeleteSweep />}
                            onClick={onDeleteSelectedRules}
                        >
                            {localT('delete')} ({selectedRuleIds.size})
                        </Button>
                    </ResponsiveTooltip>
                )}
            </Box>

            {/*
              The unified Virtuoso list contains:
                - the "System Rules (N)" section header (when system rules exist)
                - the system rules (when the section is expanded)
                - a divider between the two sections (when system is expanded)
                - the user rules

              All rules are draggable in principle, but system rules pass
              `disabled: true` to `useSortable` so they cannot be picked up.
            */}
            <UnifiedRulesList
                rows={rows}
                sortableItemIds={sortableItemIds}
                sensors={sensors}
                onDragEnd={onDragEnd}
                selectedRuleIds={selectedRuleIds}
                onSelectOneRule={onSelectOneRule}
                onEdit={onEditWithConfirm}
                onDelete={onDeleteWithConfirm}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onDuplicate={onDuplicate}
                initialTopMostItemIndex={listState.scrollTop}
                onScroll={handleRuleListScroll}
                jobs={jobs}
                systemRulesOpen={systemRulesOpen}
                onToggleSystemRulesOpen={() => setSystemRulesOpen(o => !o)}
                localT={localT}
            />

            <ConfirmationDialog
                open={warningOpen}
                onClose={() => setWarningOpen(false)}
                title={`${localT('confirmEditTitle')}`}
                message={localT('confirmEditMessage')}
                onConfirm={confirmEdit}
                confirmText={localT('confirmEdit')}
                confirmColor="warning"
                localT={localT}
            />

            <ConfirmationDialog
                open={deleteWarningOpen}
                onClose={() => setDeleteWarningOpen(false)}
                title={`${localT('confirmDeleteTitle')}`}
                message={localT('confirmDeleteMessage')}
                onConfirm={confirmDelete}
                confirmText={localT('confirmDelete')}
                confirmColor="error"
                localT={localT}
            />
        </Box>
    );
};
