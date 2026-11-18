import { requestCache } from '@/app/lib/cache';
import { setupCacheInvalidation } from '@/app/lib/cache/setup-cache-invalidation';
import { useEffect } from 'react';

/** @typedef {import('wallet-common-core').WalletController} WalletController */

/**
 * React hook that clears the request cache when wallet controller reports a blockchain state change. 
 * A new block or transaction invalidates the block-scoped entries.
 * A network change clears the whole cache.
 * @param {object} options - Hook options.
 * @param {WalletController[]} options.walletControllers - Wallet controllers to listen to.
 * @returns {void}
 */
export const useCacheInvalidation = ({ walletControllers }) => {
	useEffect(() => {
		const removeListeners = setupCacheInvalidation(requestCache, walletControllers);

		return removeListeners;
	}, []);
};
