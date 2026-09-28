import { createApiUrl, makeRequest } from '@/app/utils/server';

export const healthConfig = {
	// Preserve NEM's existing warning behavior: suppress additional ERROR/UNAVAILABLE warnings,
	// while still showing warnings for isHealthy: false responses.
	isUnavailableWarningEnabled: false
};

export const fetchBackendHealthStatus = async () => {
	return makeRequest(createApiUrl('health'));
};
