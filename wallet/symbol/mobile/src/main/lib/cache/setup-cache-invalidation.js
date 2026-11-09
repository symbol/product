import { CacheScope } from './config';
import { constants } from 'wallet-common-core';

const { ControllerEventName } = constants;

// Any transaction reaching the account means block-scoped data (balances, fees, transaction pages) may have changed.
const TRANSACTION_EVENT_NAMES = [
	ControllerEventName.NEW_TRANSACTION_CONFIRMED,
	ControllerEventName.NEW_TRANSACTION_UNCONFIRMED,
	ControllerEventName.NEW_TRANSACTION_PARTIAL
];

/**
 * Subscribes cache invalidation to wallet controller events: new blocks and transaction events
 * clear the owning chain's block scope, and a network switch wipes the whole cache. TTL expiry
 * remains the fallback when the websocket delivers no events.
 * @param {object} requestCache - The request cache to invalidate.
 * @param {object} walletControllers - The wallet controllers mapped to the cache scope they invalidate.
 * @param {object} walletControllers.symbolWalletController - The Symbol wallet controller.
 * @param {object} walletControllers.ethereumWalletController - The Ethereum wallet controller.
 * @returns {void}
 */
export const setupCacheInvalidation = (requestCache, { symbolWalletController, ethereumWalletController }) => {
	const controllerBlockScopes = [
		{ walletController: symbolWalletController, blockScope: CacheScope.SYMBOL_BLOCK },
		{ walletController: ethereumWalletController, blockScope: CacheScope.ETHEREUM_BLOCK }
	];

	controllerBlockScopes.forEach(({ walletController, blockScope }) => {
		const blockScopeEventNames = [ControllerEventName.NEW_BLOCK, ...TRANSACTION_EVENT_NAMES];

		blockScopeEventNames.forEach(eventName => {
			walletController.on(eventName, () => requestCache.clear([blockScope]));
		});

		walletController.on(ControllerEventName.NETWORK_CHANGE, () => requestCache.clearAll());
	});
};
