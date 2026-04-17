/**
 * Custom error class for parameter validation failures.
 * Provides structured error information for better debugging and user feedback.
 */
export class ValidationError extends Error {
	/**
     * Creates a new ValidationError.
     * 
     * @param {string} message - Main error message
     * @param {string[]} [details=[]] - Array of specific validation failure descriptions
     */
	constructor(message, details = []) {
		super(message);
		this.name = 'ValidationError';
		this.details = details;
	}

	/**
     * Returns a formatted error message including all details.
     * 
     * @returns {string} Full error message with semicolon-separated details
     */
	getFullMessage() {
		const hasDetails = this.details.length > 0;
        
		if (!hasDetails)
			return this.message;

		return `${this.message}: ${this.details.join('; ')}`;
	}
}

/**
 * Custom error class for URI parsing failures.
 * Thrown when a URI string cannot be parsed due to format issues.
 */
export class ParseError extends Error {
	/**
     * Creates a new ParseError.
     * 
     * @param {string} message - Error message describing the parsing failure
     * @param {string} [uri=''] - The URI string that failed to parse
     */
	constructor(message, uri = '') {
		super(message);
		this.name = 'ParseError';
		this.uri = uri;
	}
}

/**
 * Custom error class for unsupported action types or methods.
 * Thrown when attempting to use an action that is not registered.
 */
export class UnsupportedActionError extends Error {
	/**
     * Creates a new UnsupportedActionError.
     * 
     * @param {string} actionType - The action type that was not supported
     * @param {string} [method=''] - The method that was not supported (if applicable)
     */
	constructor(actionType, method = '') {
		const hasMethod = method.length > 0;
		const message = hasMethod 
			? `Unsupported action: ${actionType}/${method}`
			: `Unsupported action type: ${actionType}`;
		super(message);
		this.name = 'UnsupportedActionError';
		this.actionType = actionType;
		this.method = method;
	}
}
