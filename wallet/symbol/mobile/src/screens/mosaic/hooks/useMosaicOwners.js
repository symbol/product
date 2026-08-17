import { useAsyncManager } from '@/app/hooks';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicOwner} MosaicOwner */

/**
 * Return type for useMosaicOwners hook.
 * @typedef {object} UseMosaicOwnersReturnType
 * @property {MosaicOwner[]} owners - The accounts holding the mosaic.
 * @property {boolean} isLoading - Whether the holders are being fetched.
 * @property {() => void} load - Fetches the holders.
 * @property {() => void} reset - Resets the holders state.
 */

/**
 * React hook for loading the accounts holding a mosaic. Populates the source account selector.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string} params.mosaicId - The mosaic id to load holders for.
 * @returns {UseMosaicOwnersReturnType}
 */
export const useMosaicOwners = ({ walletController, mosaicId }) => {
	const mosaicOwnersManager = useAsyncManager({
		callback: () => walletController.modules.mosaic.fetchMosaicOwners(mosaicId),
		defaultData: []
	});

	return {
		owners: mosaicOwnersManager.data,
		isLoading: mosaicOwnersManager.isLoading,
		load: mosaicOwnersManager.call,
		reset: mosaicOwnersManager.reset
	};
};
