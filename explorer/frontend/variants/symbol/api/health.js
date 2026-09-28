import { createApiUrl, makeRequest } from '@/app/utils/server';

export const healthConfig = {
	isUnavailableWarningEnabled: true
};

/**
 * Fetches the Symbol Explorer REST health response without rewriting its values.
 * @returns {Promise<object|null>} the health response, including unhealthy/null values.
 */
export const fetchBackendHealthStatus = async () => makeRequest(createApiUrl('health'));
