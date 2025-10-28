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

	/**
	 * @returns {string} String representation of the error.
	 */
	toString() {
		return `${this.name}: ${this.message}${this.code ? ` (code: ${this.code})` : ''}`;
	}
}
