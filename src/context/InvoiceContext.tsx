/**
 * @file InvoiceContext.tsx
 * Provides React context and provider for invoice state management,
 * including CRUD operations, personal details persistence, and
 * automatic synchronisation with job data.
 */

import { createContext, useReducer, useContext, useEffect, useRef, type ReactNode, type Dispatch } from 'react';
import type { Invoice, PersonalDetails } from '../types';
import { dbService } from '../services/db';
import { invoiceService } from '../services/invoiceService';
import { useJobs } from './JobContext';

/**
 * Represents the full state shape for the invoice context.
 */
interface InvoiceState {
    invoices: Invoice[];
    loading: boolean;
    personalDetails: PersonalDetails;
}

/**
 * Discriminated union of all actions that can be dispatched to the invoice reducer.
 */
type InvoiceAction = 
    | { type: 'SET_INVOICES'; payload: Invoice[] }
    | { type: 'ADD_INVOICE'; payload: Invoice }
    | { type: 'UPDATE_INVOICE'; payload: Invoice }
    | { type: 'DELETE_INVOICE'; payload: string }
    | { type: 'SET_PERSONAL_DETAILS'; payload: PersonalDetails };

/**
 * Default invoice state used when the provider mounts.
 */
const initialState: InvoiceState = {
    invoices: [],
    loading: true,
    personalDetails: {
        companyName: '',
        streetAddress: '',
        cityStateZip: '',
        phone: '',
        fax: '',
        website: '',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        taxRate: 0,
    }
};

/**
 * Reducer that processes invoice actions and returns the next state.
 * @param state  - The current invoice state.
 * @param action - The dispatched action describing the state transition.
 * @returns The next invoice state after applying the action.
 */
const invoiceReducer = (state: InvoiceState, action: InvoiceAction): InvoiceState => {
    switch (action.type) {
        case 'SET_INVOICES':
            return { ...state, invoices: action.payload, loading: false };
        case 'ADD_INVOICE':
            return { ...state, invoices: [...state.invoices, action.payload] };
        case 'UPDATE_INVOICE':
            return { ...state, invoices: state.invoices.map(inv => inv.id === action.payload.id ? action.payload : inv) };
        case 'DELETE_INVOICE':
            return { ...state, invoices: state.invoices.filter(i => i.id !== action.payload) };
        case 'SET_PERSONAL_DETAILS':
            return { ...state, personalDetails: action.payload };
        default:
            return state;
    }
};

/**
 * React context that holds the current invoice state and dispatch function.
 * Consumers should use the {@link useInvoices} hook instead of consuming this context directly.
 */
const InvoiceContext = createContext<{ state: InvoiceState; dispatch: Dispatch<InvoiceAction> } | undefined>(undefined);

/**
 * Provider component that wraps the application with invoice state management.
 * It loads invoices from IndexedDB on mount, persists personal details to
 * localStorage, and synchronises invoice data with job data automatically.
 *
 * @param props.children - Child nodes rendered inside the provider.
 * @returns The provider element that exposes invoice state and dispatch.
 */
export const InvoiceProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(invoiceReducer, initialState);
    const { state: jobState, dispatch: jobDispatch } = useJobs();
    const isSyncingRef = useRef(false);

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await dbService.getAllInvoices();
                dispatch({ type: 'SET_INVOICES', payload: data });
            } catch (error) {
                console.error("Failed to load invoices:", error);
            }
        };
        const loadDetails = () => {
            const saved = localStorage.getItem('personalDetails');
            if (saved) {
                dispatch({ type: 'SET_PERSONAL_DETAILS', payload: JSON.parse(saved) });
            }
        };
        loadData();
        loadDetails();
    }, []);

    // Save personal details to localStorage
    useEffect(() => {
        // Avoid writing initial empty state to localStorage
        if (state.personalDetails && state.personalDetails.companyName !== '') {
            localStorage.setItem('personalDetails', JSON.stringify(state.personalDetails));
        }
    }, [state.personalDetails]);

    useEffect(() => {
        const synchronizeFromJobs = async () => {
            if (state.loading || jobState.isLoading || isSyncingRef.current) {
                return;
            }

            const syncResult = invoiceService.syncInvoicesFromJobs(jobState.jobs, state.invoices);
            if (!syncResult.jobsChanged && !syncResult.invoicesChanged) {
                return;
            }

            isSyncingRef.current = true;
            try {
                if (syncResult.jobsChanged) {
                    await dbService.updateJobs(syncResult.changedJobs);
                    jobDispatch({ type: 'UPDATE_JOBS', payload: syncResult.changedJobs });
                }

                if (syncResult.invoicesChanged) {
                    const nextInvoiceIds = new Set(syncResult.invoices.map(invoice => invoice.id));
                    const idsToDelete = state.invoices
                        .filter(invoice => !nextInvoiceIds.has(invoice.id))
                        .map(invoice => invoice.id);

                    if (syncResult.invoices.length > 0) {
                        await dbService.upsertInvoices(syncResult.invoices);
                    }

                    if (idsToDelete.length > 0) {
                        await dbService.deleteInvoices(idsToDelete);
                    }

                    dispatch({ type: 'SET_INVOICES', payload: syncResult.invoices });
                }
            } catch (error) {
                console.error('Failed to synchronize invoices from jobs:', error);
            } finally {
                isSyncingRef.current = false;
            }
        };

        void synchronizeFromJobs();
    }, [dispatch, jobDispatch, jobState.isLoading, jobState.jobs, state.invoices, state.loading]);

    return (
        <InvoiceContext.Provider value={{ state, dispatch }}>
            {children}
        </InvoiceContext.Provider>
    );

};

// Hook
/**
 * Hook that returns the current invoice context value.
 * Must be used within an InvoiceProvider.
 *
 * @returns An object containing `state` (InvoiceState) and `dispatch`.
 * @throws If called outside of an InvoiceProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useInvoices = () => {
    const context = useContext(InvoiceContext);
    if (!context) {
        throw new Error('useInvoices must be used within an InvoiceProvider');
    }
    return context;
};
