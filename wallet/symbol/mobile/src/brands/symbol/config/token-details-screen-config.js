import { MosaicCreatorActions } from '../screens/mosaic/components/MosaicCreatorActions';

/** @typedef {import('@/app/screens/assets/types/Assets').TokenDetailsScreenConfig} TokenDetailsScreenConfig */

/** @type {TokenDetailsScreenConfig} */
export const tokenDetailsScreenConfig = {
	actionsByChain: {
		symbol: [{ id: 'mosaicCreatorActions', Component: MosaicCreatorActions }]
	}
};
