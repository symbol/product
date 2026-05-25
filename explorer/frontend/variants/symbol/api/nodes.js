import { fetchSymbolNode, publicKeyToSymbolAddress } from '../utils';
import config from '@/config';
import { makeRequest } from '@/utils/server';

const formatVersion = version => {
	if ('number' !== typeof version)
		return version;

	const versionParts = [
		(version >> 24) & 0xFF,
		(version >> 16) & 0xFF,
		(version >> 8) & 0xFF,
		version & 0xFF
	];

	return versionParts.join('.');
};

const createEndpoint = data => {
	if (data.endpoint)
		return data.endpoint;

	if (!data.host)
		return '';

	const apiNodeInfo = data.apiNodeInfo || {};
	const { port: nodePort } = data;
	const isSsl = apiNodeInfo.isSSL || apiNodeInfo.isSslEnabled;
	const hasApi = apiNodeInfo.restVersion;
	let port = nodePort;
	if (isSsl)
		port = 3001;
	else if (hasApi)
		port = 3000;

	return `http${isSsl ? 's' : ''}://${data.host}:${port}`;
};

const nodeInfoFromDTO = data => {
	const mainPublicKey = data.mainPublicKey || data.publicKey;
	const extraData = data.extraData || {};

	return {
		address: data.address || data.mainAddress || publicKeyToSymbolAddress(mainPublicKey),
		endpoint: createEndpoint(data),
		name: data.name || data.friendlyName,
		version: formatVersion(data.version),
		height: data.height ?? extraData.height,
		finalizedHeight: data.finalizedHeight ?? extraData.finalizedHeight,
		mainPublicKey,
		nodePublicKey: data.nodePublicKey,
		balance: data.balance ?? extraData.balance,
		roles: data.roles
	};
};

const createNodeListUrl = url => url?.replace(/\/api\/symbol\/nodes\/?$/, '/api/symbol/nodes/peer');

export const fetchNodeList = async () => {
	const response = config.NODELIST_URL
		? await makeRequest(createNodeListUrl(config.NODELIST_URL))
		: await fetchSymbolNode('node/peers');

	return Array.isArray(response) ? response.map(nodeInfoFromDTO) : [];
};
