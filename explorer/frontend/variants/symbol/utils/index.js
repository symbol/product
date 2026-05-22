/* eslint-disable import/no-deprecated */
import config from '@/config';
import { createPage, createSearchCriteria, makeRequest } from '@/utils/server';
import { Hash256, PublicKey } from 'symbol-sdk';
import { Address, Network } from 'symbol-sdk/symbol';

export const createSymbolApiUrl = path => `${config.SYMBOL_NODE_URL}/${path}`;

const createURLSearchParams = values => {
	const params = new URLSearchParams();

	Object.entries(values).forEach(([key, value]) => {
		if (Array.isArray(value))
			value.forEach(item => params.append(key, item));
		else
			params.append(key, value);
	});

	return params;
};

export const createSymbolSearchURL = (path, searchParams = {}, additionalParams = {}) => {
	const { pageNumber, pageSize, filter } = createSearchCriteria(searchParams);
	const symbolPageSize = Math.min(pageSize, 100);
	const params = createURLSearchParams({
		pageNumber,
		pageSize: symbolPageSize,
		order: filter.order || 'desc',
		...additionalParams,
		...filter
	}).toString();

	return `${createSymbolApiUrl(path)}?${params}`;
};

export const createSymbolPage = (response, pageNumber, formatter) => {
	const data = Array.isArray(response?.data) ? response.data : [];

	return createPage(data, pageNumber, formatter);
};

export const fetchSymbolNode = (path, options) => {
	const url = typeof window !== 'undefined'
		? `/api/symbol-node/${path}`
		: createSymbolApiUrl(path);

	return options ? makeRequest(url, options) : makeRequest(url);
};

export const symbolTimestampToDate = timestamp => {
	const epochMs = Number(config.SYMBOL_EPOCH_ADJUSTMENT) * 1000;
	return new Date(epochMs + Number(timestamp)).toISOString();
};

export const absoluteToRelative = amount => Number(amount || 0) / Math.pow(10, config.NATIVE_MOSAIC_DIVISIBILITY || 0);

export const hexToSymbolAddress = hex => {
	if (!/^[0-9A-Fa-f]{48}$/.test(hex))
		return hex;

	return Address.fromDecodedAddressHexString(hex).toString();
};

export const isSymbolAddress = value => /^[A-Z2-7]{39}$/i.test(`${value}`.trim().replace(/-/g, ''));

export const isSymbolPublicKey = value => /^[0-9A-Fa-f]{64}$/.test(`${value}`.trim());

export const publicKeyToSymbolAddress = publicKeyHex => {
	if (!isSymbolPublicKey(publicKeyHex))
		return publicKeyHex;

	const networkIdentifier = Number(config.SYMBOL_NETWORK_IDENTIFIER);
	const network = Network.NETWORKS.find(item => item.identifier === networkIdentifier) ||
		new Network(
			'custom',
			networkIdentifier,
			new Date(Number(config.SYMBOL_EPOCH_ADJUSTMENT || 0) * 1000),
			Hash256.zero()
		);

	return network.publicKeyToAddress(new PublicKey(publicKeyHex)).toString();
};

export const unsupportedSymbolFeature = feature => {
	throw new Error(`Symbol ${feature} is not implemented yet in the frontend adapter.`);
};
