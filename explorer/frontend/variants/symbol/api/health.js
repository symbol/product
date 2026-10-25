import { createApiUrl, makeRequest } from '@/app/utils/server';

export const fetchBackendHealthStatus = async () => {
	return makeRequest(createApiUrl('health'));
};
