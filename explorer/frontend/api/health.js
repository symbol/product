import config from '@/config';
import { createApiUrl, makeRequest } from '@/utils/server';

export const fetchBackendHealthStatus = async () => {
	if (config.BACKEND_HEALTH_CHECK_ENABLED === false)
		return null;

	return makeRequest(createApiUrl('health'));
};
