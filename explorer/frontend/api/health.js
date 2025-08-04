import { createApiUrl, makeRequest } from '@/utils/server';

export const fetchBackendHealthStatus = async () => {
	return makeRequest(createApiUrl('health'));
};
