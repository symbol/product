import { WalletError } from './WalletError';
import { ErrorCode } from '../constants';

export class ApiError extends WalletError {
	/**
	 * @param {string} message - Error message.
	 * @param {string} [code] - Error code.
	 */
	constructor(message, code = ErrorCode.API_ERROR) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
	}
}
