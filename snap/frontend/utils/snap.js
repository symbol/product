import { defaultSnapOrigin } from '../config';

const symbolSnap = (provider = window.ethereum) =>({
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
		try {
			const snaps = await this.getSnaps();

			return Object.values(snaps).find(snap =>
				snap.id === defaultSnapOrigin && (!version || snap.version === version));
		} catch {
			return undefined;
		}
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
	}
});

export default symbolSnap;
