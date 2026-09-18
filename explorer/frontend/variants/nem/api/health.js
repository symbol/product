import { createApiUrl, makeRequest } from '@/app/utils/server';

export const healthConfig = {
	isUnavailableWarningEnabled: false
};

export const fetchBackendHealthStatus = async () => {
	return makeRequest(createApiUrl('health'));
};
