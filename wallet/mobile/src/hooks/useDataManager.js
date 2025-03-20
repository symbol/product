import { useState } from 'react';

/**
 * A custom React hook for managing asynchronous data fetching with loading and error handling.
 *
 * @template T - The type of the returned data from the callback or the default data.
 * @param {(...args: any[]) => Promise<T>} callback - An asynchronous function that fetches data.
 * @param {T} [defaultData] - The initial default value for the data state.
 * @param {(error: any) => void} [onError] - Optional callback that receives any error thrown from `callback`.
 * @returns {[
 *   (...args: any[]) => Promise<T>, // Function to execute the async operation
 *   boolean, // Loading state
 *   T // Data state
 * ]} A tuple containing:
 * - `call`: Function that executes the `callback` with provided arguments.
 * - `isLoading`: Boolean indicating whether the async operation is in progress.
 * - `data`: The current state of the fetched data.
 */
export const useDataManager = (callback, defaultData, onError) => {
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState(defaultData);

    const call = (...args) => {
        setIsLoading(true);
        return new Promise(async (resolve, reject) => {
            try {
                const data = await callback(...args);
                setData(data);
                setIsLoading(false);
                resolve(data);
            } catch (error) {
                setIsLoading(false);
                if (onError) {
                    onError(error);
                }
                reject(error);
            }
        });
    };

    return [call, isLoading, data];
};
