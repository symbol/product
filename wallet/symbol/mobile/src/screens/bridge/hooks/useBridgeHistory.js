import { useAsyncManager, useInit, useTimer } from '@/app/hooks';
import { BRIDGE_HISTORY_PAGE_SIZE } from '@/app/screens/bridge/constants';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeManager} BridgeManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeRequest} BridgeRequest */

const FETCH_INTERVAL = 10000;

/**
 * Return type for useBridgeHistory hook.
 * @typedef {Object} UseBridgeHistoryReturnType
 * @property {BridgeRequest[]} history - Array of recent bridge requests.
 * @property {boolean} isHistoryLoading - Whether history is being fetched.
 * @property {() => Promise<void>} refreshHistory - Refreshes the history data.
 * @property {() => void} clearHistory - Clears the history data.
 */

/**
 * React hook for fetching and auto-refreshing bridge transaction history.
 * Periodically polls for new history entries at a fixed interval.
 * @param {Object} params - Hook parameters.
 * @param {BridgeManager|null} params.bridge - The bridge manager instance.
 * @returns {UseBridgeHistoryReturnType}
 */
export const useBridgeHistory = ({ bridge }) => {
	const historyManager = useAsyncManager({
		callback: async () => bridge && bridge.isReady
			? bridge.fetchRecentHistory(BRIDGE_HISTORY_PAGE_SIZE)
			: [],
		defaultData: []
	});

	useTimer({
		callback: historyManager.call,
		interval: FETCH_INTERVAL,
		isActive: true,
		dependencies: [bridge]
	});

	useInit(() => {
		historyManager.call();
	}, bridge?.isReady, [bridge]);

	return {
		history: historyManager.data,
		isHistoryLoading: historyManager.isLoading,
		refreshHistory: historyManager.call,
		clearHistory: historyManager.reset
	};
};
