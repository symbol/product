import { useAsyncManager } from '@/app/hooks';
import { useCallback, useMemo } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */

/**
 * Picks a random element from an array.
 * @template T
 * @param {T[]} array - Array to pick from.
 * @returns {T|null} Random element or null if array is empty.
 */
const pickRandom = array => {
	if (!array || array.length === 0)
		return null;

	const randomIndex = Math.floor(Math.random() * array.length);
	return array[randomIndex];
};

/**
 * Return type for useRandomNode hook.
 * @typedef {object} UseRandomNodeReturnType
 * @property {string|null} randomNodeUrl - Randomly selected node URL.
 * @property {string[]} nodeList - Full list of available nodes.
 * @property {boolean} isLoading - Whether node list is loading.
 * @property {() => void} load - Loads the node list.
 * @property {() => void} reset - Resets node list state.
 */

/**
 * React hook for fetching node list and selecting a random node.
 * @param {MainWalletController} walletController - Wallet controller instance.
 * @returns {UseRandomNodeReturnType}
 */
export const useRandomNode = walletController => {
	const nodeListManager = useAsyncManager({
		callback: async () => walletController.modules.harvesting.fetchNodeList(),
		defaultData: []
	});

	const randomNodeUrl = useMemo(
		() => pickRandom(nodeListManager.data),
		[nodeListManager.data]
	);

	const load = useCallback(() => {
		nodeListManager.call();
	}, [nodeListManager]);

	const reset = useCallback(() => {
		nodeListManager.reset();
	}, [nodeListManager]);

	return {
		randomNodeUrl,
		nodeList: nodeListManager.data,
		isLoading: nodeListManager.isLoading,
		load,
		reset
	};
};
