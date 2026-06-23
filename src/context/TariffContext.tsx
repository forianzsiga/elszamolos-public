/** @file TariffContext.tsx - React context, reducer, and provider for managing the tariff rules state tree. */
import { createContext, useReducer, useContext, type ReactNode, type Dispatch } from 'react';
import type { TariffRule } from '../types';

/**
 * Represents the shape of the tariff context state.
 * @property rules - The list of tariff rules currently held in state.
 * @property isLoading - Flag indicating whether tariff rules are being fetched.
 */
interface TariffState {
    rules: TariffRule[];
    isLoading: boolean;
}

/**
 * Discriminated union of action types accepted by the tariff reducer.
 *
 * - `SET_RULES` – Replaces all rules with the given payload and clears the loading flag.
 * - `ADD_RULE` – Appends a single rule to the existing list.
 * - `UPDATE_RULE` – Replaces an existing rule whose id matches the payload id.
 * - `DELETE_RULE` – Removes a single rule by id.
 * - `DELETE_RULES` – Removes multiple rules by their id array.
 * - `REORDER_RULES` – Replaces the entire rules array with a reordered list.
 */
type TariffAction =
    | { type: 'SET_RULES'; payload: TariffRule[] }
    | { type: 'ADD_RULE'; payload: TariffRule }
    | { type: 'UPDATE_RULE'; payload: TariffRule }
    | { type: 'DELETE_RULE'; payload: string }
    | { type: 'DELETE_RULES'; payload: string[] }
    | { type: 'REORDER_RULES'; payload: TariffRule[] };

/**
 * Default initial TariffState with an empty rules array and loading set to false.
 */
const initialState: TariffState = {
    rules: [],
    isLoading: false,
};

/**
 * Reducer function for processing tariff rule state transitions.
 *
 * @param state  - The current TariffState before the action.
 * @param action - The dispatched action describing the desired mutation.
 * @returns The new TariffState after applying the action.
 */
const tariffReducer = (state: TariffState, action: TariffAction): TariffState => {
    switch (action.type) {
        case 'SET_RULES':
            return { ...state, rules: action.payload, isLoading: false };
        case 'ADD_RULE':
            return { ...state, rules: [...state.rules, action.payload] };
        case 'UPDATE_RULE':
            return {
                ...state,
                rules: state.rules.map((rule) =>
                    rule.id === action.payload.id ? action.payload : rule
                ),
            };
        case 'DELETE_RULE':
            return {
                ...state,
                rules: state.rules.filter((rule) => rule.id !== action.payload),
            };
        case 'DELETE_RULES':
            return {
                ...state,
                rules: state.rules.filter((rule) => !action.payload.includes(rule.id)),
            };
        case 'REORDER_RULES':
            return { ...state, rules: action.payload };
        default:
            return state;
    }
};

/**
 * React context that provides the tariff state and a dispatch function to all
 * descendant components wrapped by TariffProvider.
 */
const TariffContext = createContext<{
    state: TariffState;
    dispatch: Dispatch<TariffAction>;
}>({
    state: initialState,
    dispatch: () => null,
});

/**
 * Provider component that makes the tariff state and dispatch function
 * available to its descendants via TariffContext.
 *
 * @param children - Child React nodes that will have access to the tariff context.
 * @returns A JSX element wrapping children with the context provider.
 */
export const TariffProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(tariffReducer, initialState);

    return (
        <TariffContext.Provider value={{ state, dispatch }}>
            {children}
        </TariffContext.Provider>
    );
};

/**
 * Custom hook to consume the TariffContext.
 *
 * @returns The tariff state and dispatch function.
 * @throws Error if used outside of TariffProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useTariffs = () => {
    const context = useContext(TariffContext);
    if (!context) {
        throw new Error('useTariffs must be used within a TariffProvider');
    }
    return context;
};
