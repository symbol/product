import { WalletError } from './WalletError';
import { ErrorCode } from '../constants';

export class NetworkError extends WalletError {
	/**
	 * @param {string} message - Error message.
	 * @param {string} code - Error code.
	 * @param {number} statusCode - HTTP status code.
	 */
	constructor(message, code, statusCode) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.statusCode = statusCode;
	}
}

export const InvalidRequestError = class extends NetworkError {
	constructor(message, statusCode = 400) {
		super(message, ErrorCode.FETCH_INVALID_REQUEST, statusCode);
		this.name = this.constructor.name;
	}
};

export class UnauthorizedError extends NetworkError {
	constructor(message, statusCode = 401) {
		super(message, ErrorCode.FETCH_UNAUTHORIZED, statusCode);
		this.name = this.constructor.name;
	}
};

export class NotFoundError extends NetworkError {
	constructor(message, statusCode = 404) {
		super(message, ErrorCode.FETCH_NOT_FOUND, statusCode);
		this.name = this.constructor.name;
	}
};

export class RateLimitError extends NetworkError {
	constructor(message, statusCode = 429) {
		super(message, ErrorCode.FETCH_RATE_LIMIT, statusCode);
		this.name = this.constructor.name;
	}
};

export class InternalServerError extends NetworkError {
	constructor(message, statusCode = 500) {
		super(message, ErrorCode.FETCH_SERVER_ERROR, statusCode);
		this.name = this.constructor.name;
	}
};

export class NetworkRequestError extends NetworkError {
	constructor(message, statusCode) {
		super(message, ErrorCode.NETWORK_REQUEST_ERROR, statusCode);
		this.name = this.constructor.name;
	}
}
