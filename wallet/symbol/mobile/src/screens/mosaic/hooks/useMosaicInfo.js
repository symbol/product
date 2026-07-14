import { useAsyncManager } from '@/app/hooks';

/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('wallet-common-symbol/src/types/Mosaic').MosaicInfo} MosaicInfo */

/**
 * Return type for useMosaicInfo hook.
 * @typedef {object} UseMosaicInfoReturnType
 * @property {MosaicInfo} mosaic - The fetched mosaic info.
 * @property {boolean} isLoading - Whether the mosaic info is being fetched.
 * @property {() => void} load - Fetches the mosaic info.
 * @property {() => void} reset - Resets the mosaic info state.
 */

/**
 * React hook for loading a mosaic's info. Provides the divisibility and name the revoke screen needs.
 * @param {object} params - Hook parameters.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string} params.tokenId - The mosaic id to load.
 * @returns {UseMosaicInfoReturnType}
 */
export const useMosaicInfo = ({ walletController, tokenId }) => {
	const { networkProperties } = walletController;

	const mosaicInfoManager = useAsyncManager({
		callback: () => walletController.networkApi.mosaic.fetchMosaicInfo(networkProperties, tokenId)
	});

	return {
		mosaic: mosaicInfoManager.data,
		isLoading: mosaicInfoManager.isLoading,
		load: mosaicInfoManager.call,
		reset: mosaicInfoManager.reset
	};
};
