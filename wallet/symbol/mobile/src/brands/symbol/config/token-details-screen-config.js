import { MosaicCreatorActions } from '../screens/mosaic/components/MosaicCreatorActions';

/** @typedef {import('@/contract/types/Config').TokenDetailsScreenConfig} TokenDetailsScreenConfig */

/** @type {TokenDetailsScreenConfig} */
export const tokenDetailsScreenConfig = {
	actionsByChain: {
		symbol: [{ id: 'mosaicCreatorActions', Component: MosaicCreatorActions }]
	}
};
