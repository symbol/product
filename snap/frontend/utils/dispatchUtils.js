import { actionTypes } from '../context/index';

const dispatchUtils = dispatch => ({
	/**
	 * Set snap installed status
	 * @param {boolean} isInstalled - The snap installed status.
	 */
	setIsSnapInstalled: isInstalled => {
		dispatch({ type: actionTypes.SET_SNAP_INSTALLED, payload: isInstalled });
	},
	/**
	 * Set loading status
	 * @param {{isLoading: boolean, message: string}} status - The loading status.
	 */
	setLoadingStatus: status => {
		dispatch({ type: actionTypes.SET_LOADING_STATUS, payload: status });
	},
	/**
	 * Set network
	 * @param {NodeInfo} network - The network information.
	 */
	setNetwork: network => {
		dispatch({ type: actionTypes.SET_NETWORK, payload: network });
	}
});

export default dispatchUtils;

// region type declarations

/**
 * Result of a node request.
 * @typedef {object} NodeInfo
 * @property {number} identifier - The network identifier.
 * @property {string} networkName - The network name.
 * @property {string} url - The node URL.
 */

// endregion
