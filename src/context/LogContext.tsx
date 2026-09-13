/**
 * @file LogContext.tsx
 * Provides a React context for managing application logs, toast notifications,
 * and their lifecycle (creation, display, persistence, cleanup).
 *
 * The context centralises log entries that are persisted via the database service
 * and enqueues toasts shown temporarily in the UI.
 */

import { createContext, useReducer, useContext, type ReactNode, useEffect } from 'react';
import { dbService } from '../services/db';

/**
 * Severity levels for a log entry.
 *
 * - `success`:  A successful operation.
 * - `info`:     General informational message.
 * - `warning`:  Non-critical issue that may require attention.
 * - `error`:    A failure or critical issue.
 */
export type LogSeverity = 'success' | 'info' | 'warning' | 'error';

/**
 * A single log entry stored in the application state and optionally persisted.
 */
export interface LogEntry {
    /** Unique identifier for the log entry (usually a UUID). */
    id: string;
    /** ISO-8601 timestamp of when the log was created. */
    timestamp: string;
    /** Human-readable log message. */
    message: string;
    /** Severity classification of the log. */
    severity: LogSeverity;
    /** Optional context data (e.g. Rule ID, Job ID). */
    details?: string;
}

/**
 * @internal
 * The complete state shape held by the log reducer.
 */
interface LogState {
    logs: LogEntry[];
    toasts: LogEntry[];
    queue: LogEntry[];
}

/**
 * @internal
 * Discriminated union of all actions supported by the log reducer.
 *
 * - `SET_LOGS`      – Replace the entire logs array (used on initial load).
 * - `ADD_LOG`       – Prepend a new log entry and add it to the toast queue.
 * - `CLEAR_LOGS`    – Remove all logs, toasts and queued entries.
 * - `REMOVE_TOAST`  – Dismiss a specific toast by its ID.
 * - `PROCESS_QUEUE` – Move the next queued entry into the active toasts array.
 */
type LogAction =
    | { type: 'SET_LOGS'; payload: LogEntry[] }
    | { type: 'ADD_LOG'; payload: LogEntry }
    | { type: 'CLEAR_LOGS' }
    | { type: 'REMOVE_TOAST'; payload: string }
    | { type: 'PROCESS_QUEUE' };

const initialState: LogState = {
    logs: [],
    toasts: [],
    queue: [],
};

/**
 * @internal
 * Reducer that processes log actions and returns the next state.
 *
 * @param state - Current log state.
 * @param action - Dispatched log action.
 * @returns The next log state after applying the action.
 */
const logReducer = (state: LogState, action: LogAction): LogState => {
    switch (action.type) {
        case 'SET_LOGS':
            return { ...state, logs: action.payload };
        case 'ADD_LOG':
             // Add to logs immediately, but add to queue for toasts
            return { ...state, logs: [action.payload, ...state.logs], queue: [...state.queue, action.payload] };
        case 'CLEAR_LOGS':
            return { ...state, logs: [], toasts: [], queue: [] };
        case 'REMOVE_TOAST':
            return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        case 'PROCESS_QUEUE': {
            if (state.queue.length === 0) return state;
            
            const nextToast = state.queue[0];
            const remainingQueue = state.queue.slice(1);
            
            // Max 5 toasts on screen. If full, remove the OLDEST (first in array)
            // But wait, if we are stacking upwards, usually index 0 is bottom?
            // Let's assume toasts array order maps to display order.
            // If we have [A, B, C, D, E], and F comes.
            // We want [B, C, D, E, F].
            
            let newToasts = [...state.toasts, nextToast];
            if (newToasts.length > 5) {
                newToasts = newToasts.slice(newToasts.length - 5);
            }
            
            return { ...state, toasts: newToasts, queue: remainingQueue };
        }
        default:
            return state;
    }
};

/**
 * @internal
 * React context that provides the log state and actions to descendants.
 * Components access this via the exported {@link useLogs} hook.
 */
const LogContext = createContext<{
    /** Current log state (logs, toasts, queue). */
    state: LogState;
    /** Append a new log entry. */
    addLog: (message: string, severity?: LogSeverity, details?: string) => void;
    /** Clear every log, toast and queued entry. */
    clearLogs: () => void;
    /** Dismiss a specific toast by its unique ID. */
    removeToast: (id: string) => void;
} | undefined>(undefined);

/**
 * Provider component that wraps the application (or a subtree) with the log
 * context. It initialises the reducer, loads persisted logs from the database
 * on mount, and exposes the `addLog`, `clearLogs` and `removeToast` actions.
 *
 * @param props.children - Child nodes that will have access to the log context.
 * @returns A context provider element.
 */
export const LogProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(logReducer, initialState);

    // Initial Load
    useEffect(() => {
        dbService.getAllLogs().then(logs => {
            // Sort by timestamp desc
            const sorted = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            dispatch({ type: 'SET_LOGS', payload: sorted });
        });
    }, []);

    // Queue Processing Loop
    useEffect(() => {
        if (state.queue.length > 0) {
            const timer = setTimeout(() => {
                dispatch({ type: 'PROCESS_QUEUE' });
            }, 50); // 50ms delay between toasts appearing
            return () => clearTimeout(timer);
        }
    }, [state.queue]);

    const addLog = (message: string, severity: LogSeverity = 'info', details?: string) => {
        const newLog: LogEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            message,
            severity,
            details
        };
        // Fire and forget DB save
        dbService.addLog(newLog).catch(err => console.error("Failed to save log", err));
        dispatch({ type: 'ADD_LOG', payload: newLog });
    };

    const clearLogs = () => {
        dbService.clearLogs().catch(err => console.error("Failed to clear logs", err));
        dispatch({ type: 'CLEAR_LOGS' });
    };

    const removeToast = (id: string) => {
        dispatch({ type: 'REMOVE_TOAST', payload: id });
    };

    return (
        <LogContext.Provider value={{ state, addLog, clearLogs, removeToast }}>
            {children}
        </LogContext.Provider>
    );
};

/**
 * Custom hook to access the log context. Guarantees the hook is called within a
 * {@link LogProvider}; throws a descriptive error otherwise.
 *
 * @returns An object containing the current `LogState` and action helpers
 *          (`addLog`, `clearLogs`, `removeToast`).
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useLogs = () => {
    const context = useContext(LogContext);
    if (!context) {
        throw new Error('useLogs must be used within a LogProvider');
    }
    return context;
};
