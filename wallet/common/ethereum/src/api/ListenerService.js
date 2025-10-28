import { Listener } from './Listener';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class ListenerService {
	constructor() {}

	/**
	 * Creates a new Listener instance.
	 * @param {NetworkProperties} networkProperties - The network properties.
	 * @param {string} accountAddress - The address of the account to listen for events.
	 * @returns {Listener} - The Listener instance.
	 */
	createListener = (networkProperties, accountAddress) => {
		return new Listener(networkProperties, accountAddress);
	};
}
