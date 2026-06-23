/**
 * @file Utility functions for measuring and logging function execution performance.
 *       Provides both synchronous and asynchronous measurement helpers.
 */

/**
 * Measures the execution time of a synchronous function.
 *
 * @param name - A descriptive label for the measurement, used in the log output.
 * @param fn - The synchronous function to execute and measure.
 * @returns The return value of the executed function.
 */
export const measure = <T>(name: string, fn: () => T): T => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;
    
    // Only log if it takes noticeable time (> 1ms) to reduce noise
    if (duration > 1) {
        console.log(`⏱️ [${name}] took ${duration.toFixed(2)}ms`);
    }
    return result;
};

/**
 * Measures the execution time of an asynchronous function.
 *
 * @param name - A descriptive label for the measurement, used in the log output.
 * @param fn - The asynchronous function to execute and measure.
 * @returns A promise that resolves to the return value of the executed function.
 */
export const measureAsync = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`⏱️ [${name}] took ${(end - start).toFixed(2)}ms`);
    return result;
};
