import { useAsyncManager } from '@/app/hooks';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicOwner} MosaicOwner */

/**
 * Return type for useMosaicOwner hook.
 * @typedef {object} UseMosaicOwnerReturnType
 * @property {MosaicOwner|null} owner - The fetched holder with its held amount, or null while not loaded.
 * @property {boolean} isLoading - Whether the holder is being fetched.
 * @property {(address: string) => void} load - Fetches the holder with the given address.
 * @property {() => void} reset - Resets the holder state.
 */

/**
 * React hook for loading the held amount of a single mosaic holder. Provides the available balance of
 * a manually entered source address that is not in the loaded holder list.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string} params.mosaicId - The mosaic id to load the holder for.
 * @returns {UseMosaicOwnerReturnType}
 */
export const useMosaicOwner = ({ walletController, mosaicId }) => {
	const mosaicOwnerManager = useAsyncManager({
		callback: address => walletController.modules.mosaic.fetchMosaicOwner(mosaicId, address),
		shouldClearDataOnCall: true
	});

	return {
		owner: mosaicOwnerManager.data,
		isLoading: mosaicOwnerManager.isLoading,
		load: mosaicOwnerManager.call,
		reset: mosaicOwnerManager.reset
	};
};
