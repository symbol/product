class HttpError extends Error {
	constructor(statusCode, code, message) {
		super(message);
		this.statusCode = statusCode;
		this.code = code;
	}
}

export default HttpError;
