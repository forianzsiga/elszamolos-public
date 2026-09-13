/**
 * @file JobContext.tsx
 * @description React context, reducer, provider, and hook for managing job state across the application.
 * Provides actions for CRUD operations on jobs, loading state, and error handling.
 */

import { createContext, useReducer, useContext, type ReactNode, type Dispatch } from 'react';
import type { Job } from '../types';

/**
 * State definition for the JobContext.
 */
interface JobState {
    jobs: Job[];
    isLoading: boolean;
    error: string | null;
}

/**
 * Action types for the JobReducer.
 */
type JobAction =
    | { type: 'SET_JOBS'; payload: Job[] }
    | { type: 'ADD_JOB'; payload: Job }
    | { type: 'ADD_JOBS'; payload: Job[] }
    | { type: 'UPDATE_JOB'; payload: Job }
    | { type: 'UPDATE_JOBS'; payload: Job[] }
    | { type: 'DELETE_JOB'; payload: string }
    | { type: 'DELETE_JOBS'; payload: string[] }
    | { type: 'RESET_JOBS' }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string };

/**
 * Initial state for the JobContext.
 */
const initialState: JobState = {
    jobs: [],
    isLoading: true,
    error: null,
};

/**
 * Reducer function to handle state transitions for Jobs.
 * Demonstrates complex state management logic.
 *
 * @param state Current state
 * @param action Action to perform
 */
const jobReducer = (state: JobState, action: JobAction): JobState => {
    switch (action.type) {
        case 'SET_JOBS':
            return { ...state, jobs: action.payload, isLoading: false, error: null };
        case 'ADD_JOB':
            return { ...state, jobs: [...state.jobs, action.payload] };
        case 'ADD_JOBS':
            return { ...state, jobs: [...state.jobs, ...action.payload] };
        case 'UPDATE_JOB':
            return {
                ...state,
                jobs: state.jobs.map((job) =>
                    job.id === action.payload.id ? action.payload : job
                ),
            };
        case 'UPDATE_JOBS': {
            const updateMap = new Map(action.payload.map(j => [j.id, j]));
            return {
                ...state,
                jobs: state.jobs.map(job => updateMap.get(job.id) || job)
            };
        }
        case 'DELETE_JOB':
            return {
                ...state,
                jobs: state.jobs.filter((job) => job.id !== action.payload),
            };
        case 'DELETE_JOBS':
            return {
                ...state,
                jobs: state.jobs.filter((job) => !action.payload.includes(job.id)),
            };
        case 'RESET_JOBS':
            return {
                ...state,
                jobs: state.jobs.map(job => 
                    job.status === 'Discarded' 
                        ? job 
                        : { ...job, status: 'Pending', price: 0 }
                )
            };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false };
        default:
            return state;
    }
};

/**
 * Context definition.
 */
const JobContext = createContext<{
    state: JobState;
    dispatch: Dispatch<JobAction>;
}>({
    state: initialState,
    dispatch: () => null,
});

/**
 * Provider component for JobContext.
 * Wraps part of the app to provide access to Job state.
 *
 * @param children Child components
 */
export const JobProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(jobReducer, initialState);

    return (
        <JobContext.Provider value={{ state, dispatch }}>
            {children}
        </JobContext.Provider>
    );
};

/**
 * Custom hook to consume the JobContext.
 *
 * @returns The job state and dispatch function.
 * @throws Error if used outside of JobProvider.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useJobs = () => {
    const context = useContext(JobContext);
    if (!context) {
        throw new Error('useJobs must be used within a JobProvider');
    }
    return context;
};
