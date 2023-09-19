import config from '@/config';
import { createAPICallFunction } from '@/utils';

export const getNamespaceInfo = createAPICallFunction(async id => {
	console.log(`${config.API_BASE_URL}/namespace/${id}`)
	const response = await fetch(`${config.API_BASE_URL}/namespace/${id}`);
	const namespace = await response.json();

	return {
		...namespace,
		registrationHeight: namespace.registeredHeight,
		id,
		name: id
	};
});
