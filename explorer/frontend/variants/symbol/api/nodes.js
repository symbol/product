import { fetchSymbolNode } from '../utils';

export const fetchNodeList = async () => {
	const response = await fetchSymbolNode('node/peers');

	return Array.isArray(response) ? response : [];
};
