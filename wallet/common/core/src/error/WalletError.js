export class WalletError extends Error {
	/**
	 * @param {string} message - Error message.
	 * @param {string} code - Error code.
	 */
	constructor(message, code) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
	}
}
