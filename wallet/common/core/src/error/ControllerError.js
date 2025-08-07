import { WalletError } from './WalletError';
import { ErrorCode } from '../constants';

export class ControllerError extends WalletError {
	/**
	 * @param {string} message - Error message.
	 * @param {string} [code] - Error code.
	 */
	constructor(message, code = ErrorCode.CONTROLLER_ERROR) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
	}
}
