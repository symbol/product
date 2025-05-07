import { createAPIURL, makeRequest } from '@/utils/server';

export const fetchBackendHealthStatus = async () => {
	return makeRequest(createAPIURL('health'));
};
