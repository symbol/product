import symbolClient from '../services/symbolClient.js';
import stateManager from '../stateManager.js';

const mosaicUtils = {
	/**
     * Update mosaic info in state if given mosaic ids not exist in mosaicInfo.
     * @param {object} state - The state object.
     * @param {Array<string>} mosaicIds - The mosaic ids.
     * @returns {Promise<void>} - A promise that resolves when mosaic info is updated.
     */
	updateMosaicInfo: async (state, mosaicIds) => {
		try {
			const { network, mosaicInfo } = state;

			// filter out mosaic id didn't exist in mosaicInfo
			const missingMosaicIds = mosaicIds.filter(mosaicId => !mosaicInfo[mosaicId]);

			if (0 === missingMosaicIds.length)
				return;

			const client = symbolClient.create(network.url);

			const [mosaics, namespaceNames] = await Promise.all([
				client.fetchMosaicsInfo(missingMosaicIds),
				client.fetchMosaicNamespace(missingMosaicIds)
			]);

			// update networkName in mosaic info
			Object.keys(mosaics).forEach(mosaicId => {
				mosaics[mosaicId].networkName = network.networkName;
				mosaics[mosaicId].name = namespaceNames[mosaicId];
			});

			state.mosaicInfo = { ...mosaicInfo, ...mosaics };

			await stateManager.update(state);
		} catch (error) {
			throw new Error(`Failed to update mosaic info: ${error.message}`);
		}
	},
	/**
     * Get mosaic info from state filter by network name.
     * @param {object} state - The state object.
     * @returns {object<string, MosaicInfo>} - The mosaic info.
     */
	getMosaicInfo: ({ state }) => {
		const { network, mosaicInfo } = state;

		return Object.keys(mosaicInfo).reduce((info, key) => {
			if (mosaicInfo[key].networkName === network.networkName)
				info[key] = mosaicInfo[key];

			return info;
		}, {});
	}
};

export default mosaicUtils;

// region type declarations

/**
 * state of the mosaic.
 * @typedef {object} MosaicInfo
 * @property {number} divisibility - The divisibility.
 * @property {string} networkName - The network name.
 * @property {Array<string>} name - The mosaic namespace.
 */

// endregion
