/* eslint-disable valid-jsdoc */
import { showError } from '@/app/utils';
import { useRef, useState } from 'react';

/**
 * A class representing an asynchronous operation manager.
 * @template T The type of data returned by the async operation.
 */
class AsyncManager {
	/**
	 * Creates an instance of AsyncManager.
	 * @param {function(...*): Promise<T>} call - The function to execute the async operation, returning a Promise of type T.
	 * @param {boolean} isLoading - Indicates if the operation is currently loading.
	 * @param {T} data - The data returned from the async operation.
	 * @param {*} error - The error object if the operation failed.
	 * @param {function()} reset - A function to reset the state to default values.
	 */
	constructor(call, isLoading, data, error, reset) {
		this.call = call;
		this.isLoading = isLoading;
		this.data = data;
		this.error = error;
		this.reset = reset;
	}
}

/**
 * Hook for managing asynchronous operations and data fetching with loading and error handling.
 * @template T The type of data returned by the callback.
 * @param {Object} config - The configuration object for the hook.
 * @param {function(...*): Promise<T>} config.callback - The asynchronous callback function to execute.
 * @param {T} [config.defaultData=null] - The default data value.
 * @param {function(*)} [config.onError=null] - An optional error handler function called on error.
 * @param {function(T)} [config.onSuccess=null] - An optional success handler function called on success.
 * @param {boolean} [config.shouldClearDataOnCall=false] - Whether to clear data when calling the async function.
 * @param {boolean} [config.defaultLoadingState=false] - The default loading state.
 * @returns {AsyncManager<T>} An instance of AsyncManager containing the call function, loading state, data, error, and reset function.
 */
export const useAsyncManager = config => {
	const { 
		callback, 
		defaultData = null, 
		onError = null,
		onSuccess = null,
		shouldClearDataOnCall = false, 
		defaultLoadingState = false 
	} = config;
	const [isLoading, setIsLoading] = useState(defaultLoadingState);
	const [error, setError] = useState(null);
	const [data, setData] = useState(defaultData);
	const requestIdRef = useRef(0);

	const reset = () => {
		++requestIdRef.current;
		setData(defaultData);
		setIsLoading(false);
		setError(null);
	};

	const call = (...args) => {
		setIsLoading(true);
		if (shouldClearDataOnCall)
			setData(defaultData);

		const currentId = ++requestIdRef.current;

		return new Promise((resolve, reject) => {
			setTimeout(async () => {
				try {
					const data = await callback(...args);
					
					if (requestIdRef.current !== currentId)
						return;

					setData(data);
					setIsLoading(false);

					if (onSuccess)
						onSuccess(data);

					resolve(data);
				} catch (error) {
					if (requestIdRef.current !== currentId)
						return;

					setIsLoading(false);
					setError(error);
					
					if (onError)
						onError(error);
					else
						showError(error);

					reject(error);
				}
			}, 0);
		});
	};

	return new AsyncManager(call, isLoading, data, error, reset);
};
