import { defaultSnapOrigin } from '../config';

const symbolSnapFactory = {
	create(provider) {
		return {
			provider: provider,
			/**
			 * Get the installed snaps in MetaMask.
			 * @returns {object} The snaps installed in MetaMask.
			 */
			async getSnaps() {
				try {
					return await this.provider.request({
						method: 'wallet_getSnaps'
					});
				} catch {
					return {};
				}
			},
			/**
			 * Get the snap from MetaMask.
			 * @param {string} version - The version of the snap to install (optional).
			 * @returns {object} The snap object returned by the extension.
			 */
			async getSnap(version) {
				const snaps = await this.getSnaps();

				return Object.values(snaps).find(snap =>
					snap.id === defaultSnapOrigin && (!version || snap.version === version));
			},
			/**
			 * Connect a snap to MetaMask.
			 * @param {string} snapId - The ID of the snap.
			 * @param {object} params - The params to pass with the snap to connect.
			 * @returns {boolean} A boolean indicating if the snap was connected.
			 */
			async connectSnap(snapId = defaultSnapOrigin, params = {}) {
				try {
					await provider.request({
						method: 'wallet_requestSnaps',
						params: {
							[snapId]: params
						}
					});
					return true;
				} catch {
					return false;
				}
			},
			/**
			 * Get current selected network from snap MetaMask.
			 * @returns {object} The network object returned by the snap.
			 */
			async getNetwork() {
				const networkData = await provider.request({
					method: 'wallet_invokeSnap',
					params: {
						snapId: defaultSnapOrigin,
						request: {
							method: 'getNetwork'
						}
					}
				});

				return networkData;
			},
			/**
			 * Switch network in snap MetaMask.
			 * @typedef {'mainnet' | 'testnet'} NetworkName
			 * @param {NetworkName} networkName - The name of the network to switch to.
			 * @returns {object} The network object returned by the snap.
			 */
			async switchNetwork(networkName) {
				const network = await provider.request({
					method: 'wallet_invokeSnap',
					params: {
						snapId: defaultSnapOrigin,
						request: {
							method: 'switchNetwork',
							params: {
								networkName
							}
						}
					}
				});

				return network;
			}
		};
	}
};

export default symbolSnapFactory;
