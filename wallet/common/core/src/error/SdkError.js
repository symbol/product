import { WalletError } from './WalletError';
import { ErrorCode } from '../constants';

export class SdkError extends WalletError {
	/**
	 * @param {string} message - Error message.
	 * @param {string} [code] - Error code.
	 */
	constructor(message, code = ErrorCode.SDK_ERROR) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
	}
}
