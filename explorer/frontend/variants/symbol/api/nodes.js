import { fetchSymbolNode } from '../utils';

const nodeInfoFromDTO = data => {
	const endpoint = data.endpoint || data.host || '';

	return {
		endpoint,
		name: data.friendlyName || data.name || endpoint,
		version: data.version || null,
		height: data.height || null,
		mainPublicKey: data.publicKey || data.mainPublicKey || data.nodePublicKey,
		nodePublicKey: data.publicKey || data.nodePublicKey,
		balance: data.balance || null,
		roles: data.roles
	};
};

export const fetchNodeList = async () => {
	const response = await fetchSymbolNode('node/peers');

	return Array.isArray(response) ? response.map(nodeInfoFromDTO) : [];
};
