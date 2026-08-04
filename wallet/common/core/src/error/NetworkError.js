import { WalletError } from './WalletError';
import { ErrorCode } from '../constants';

export class NetworkError extends WalletError {
	/**
	 * @param {string} message - Error message.
	 * @param {string} code - Error code.
	 * @param {number} statusCode - HTTP status code.
	 * @param {object} [body] - Parsed response body, so callers can react to server-specific
	 * error codes that the message text does not carry.
	 */
	constructor(message, code, statusCode, body) {
		super(message);
		this.name = this.constructor.name;
		this.code = code;
		this.statusCode = statusCode;
		this.body = body ?? null;
	}
}

export const InvalidRequestError = class extends NetworkError {
	constructor(message, statusCode = 400, body) {
		super(message, ErrorCode.FETCH_INVALID_REQUEST, statusCode, body);
		this.name = this.constructor.name;
	}
};

export class UnauthorizedError extends NetworkError {
	constructor(message, statusCode = 401, body) {
		super(message, ErrorCode.FETCH_UNAUTHORIZED, statusCode, body);
		this.name = this.constructor.name;
	}
};

export class NotFoundError extends NetworkError {
	constructor(message, statusCode = 404, body) {
		super(message, ErrorCode.FETCH_NOT_FOUND, statusCode, body);
		this.name = this.constructor.name;
	}
};

export class RateLimitError extends NetworkError {
	constructor(message, statusCode = 429, body) {
		super(message, ErrorCode.FETCH_RATE_LIMIT, statusCode, body);
		this.name = this.constructor.name;
	}
};

export class InternalServerError extends NetworkError {
	constructor(message, statusCode = 500, body) {
		super(message, ErrorCode.FETCH_SERVER_ERROR, statusCode, body);
		this.name = this.constructor.name;
	}
};

export class NetworkRequestError extends NetworkError {
	constructor(message, statusCode, body) {
		super(message, ErrorCode.NETWORK_REQUEST_ERROR, statusCode, body);
		this.name = this.constructor.name;
	}
}
