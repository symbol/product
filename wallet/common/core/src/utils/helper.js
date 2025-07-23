/**
 * Omits specified keys from an object.
 * @param {object} obj - The object to omit keys from.
 * @param {string[]} keysToOmit - An array of keys to omit from the object.
 * @returns {object} - A new object with the specified keys omitted.
 */
export const omit = (obj, keysToOmit) => {
	const omitSet = new Set(keysToOmit);
	const result = {};
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key) && !omitSet.has(key))
			result[key] = obj[key];
	}

	return result;
};

/**
 * Performs a simple deep clone of an object or array.
 * @param {any} value - The value to clone.
 * @returns {any} - The cloned value.
 */
export const cloneDeep = value => {
	if (value === null || typeof value !== 'object')
		return value;

	if (Array.isArray(value))
		return value.map(cloneDeep);

	const result = {};
	for (const key in value) {
		if (Object.hasOwn(value, key))
			result[key] = cloneDeep(value[key]);
	}

	return result;
};

/**
 * Validates object fields against a list of required fields.
 * @param {object} obj - The object to validate.
 * @param {{key: string, type: string}[]} fields - The list of required field names.
 * @throws {Error} If any required fields are missing.
 */
export const validateFields = (obj, fields) => {
	for (const { key, type } of fields) {
		if (!Object.prototype.hasOwnProperty.call(obj, key))
			throw new Error(`Missing required field: "${key}"`);

		if (typeof obj[key] !== type)
			throw new Error(`Invalid type for field "${key}": expected ${type}, got "${typeof obj[key]}"`);
	}
};

/**
 * Validates that an object has the required methods.
 * @param {object} obj - The object to validate.
 * @param {string[]} methods - An array of method names that must exist on the object.
 * @throws {Error} If any required methods are missing.
 */
export const validateFacade = (obj, methods) => {
	methods.forEach(method => {
		if (!obj[method] || typeof obj[method] !== 'function')
			throw new Error(`Missing required method: "${method}"`);
	});
};

/**
 * Validates that an object has the required methods.
 * @param {object} obj - The object to validate.
 * @param {string[]} methodPaths - An array of method paths in the format 'namespace.method'.
 * @throws {Error} If any required methods are missing.
 */
export const validateNamespacedFacade = (obj, methodPaths) => {
	methodPaths.forEach(path => {
		const [namespaceName, methodName] = path.split('.');
		const namespace = obj[namespaceName];

		if (!namespace || typeof namespace !== 'object')
			throw new Error(`Missing namespace: "${namespaceName}"`);

		if (!namespace[methodName] || typeof namespace[methodName] !== 'function')
			throw new Error(`Missing required method: "${path}" in namespace "${namespaceName}"`);
	});
};
