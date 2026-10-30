import { constants } from 'wallet-common-core';

/** @typedef {import('wallet-common-core').WalletController} WalletController */

const { ControllerEventName } = constants;

// Any transaction reaching the account means block-scoped data (balances, fees, transaction pages) may have changed.
const TRANSACTION_EVENT_NAMES = [
	ControllerEventName.NEW_TRANSACTION_CONFIRMED,
	ControllerEventName.NEW_TRANSACTION_UNCONFIRMED,
	ControllerEventName.NEW_TRANSACTION_PARTIAL
];

const BLOCK_SCOPE_EVENT_NAMES = [ControllerEventName.NEW_BLOCK, ...TRANSACTION_EVENT_NAMES];

/**
 * Builds the block cache scope key for a chain.
 * @param {string} chainName - Chain name.
 * @returns {string} Cache scope.
 */
const getBlockScope = chainName => `${chainName}:block`;

/**
 * Registers listeners on wallet controllers that clear cached requests.
 * A new block or transaction invalidates the block-scoped entries.
 * A network change clears the whole cache.
 * TTL expiry remains the fallback when the websocket delivers no events.
 * @param {object} requestCache - The request cache to invalidate.
 * @param {WalletController[]} walletControllers - The wallet controllers to listen to.
 * @returns {function(): void} Removes the listeners.
 */
export const setupCacheInvalidation = (requestCache, walletControllers) => {
	const subscriptions = walletControllers.flatMap(walletController => {
		const blockScope = getBlockScope(walletController.chainName);
		const clearBlockScope = () => requestCache.clear([blockScope]);
		const clearAll = () => requestCache.clearAll();

		return [
			...BLOCK_SCOPE_EVENT_NAMES.map(eventName => ({ walletController, eventName, listener: clearBlockScope })),
			{ walletController, eventName: ControllerEventName.NETWORK_CHANGE, listener: clearAll }
		];
	});

	subscriptions.forEach(({ walletController, eventName, listener }) => walletController.on(eventName, listener));

	return () => {
		subscriptions.forEach(({ walletController, eventName, listener }) =>
			walletController.removeListener(eventName, listener));
	};
};
