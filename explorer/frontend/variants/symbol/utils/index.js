import config from '@/config';
import { createPage, createSearchCriteria, makeRequest } from '@/utils/server';
import { sha3_256 } from '@noble/hashes/sha3.js'; // eslint-disable-line import/extensions
import Ripemd160 from 'ripemd160';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const getSymbolNodeUrl = () => config.SYMBOL_NODE_URL?.replace(/\/$/, '');
export const createSymbolApiUrl = path => `${getSymbolNodeUrl()}/${path}`;
export const createSymbolNodePath = url => url.replace(`${getSymbolNodeUrl()}/`, '');

export const createSymbolSearchURL = (path, searchParams = {}, additionalParams = {}) => {
	const { pageNumber, pageSize, filter } = createSearchCriteria(searchParams);
	const params = new URLSearchParams({
		pageNumber,
		pageSize: Math.min(pageSize, 100),
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

export const fetchSymbolNode = path => {
	if (typeof window !== 'undefined')
		return makeRequest(`/api/symbol-node/${path}`);

	return makeRequest(createSymbolApiUrl(path));
};

export const symbolTimestampToDate = timestamp => {
	const epochMs = Number(config.SYMBOL_EPOCH_ADJUSTMENT || 0) * 1000;

	return new Date(epochMs + Number(timestamp || 0)).toISOString();
};

export const absoluteToRelative = amount => Number(amount || 0) / Math.pow(10, Number(config.NATIVE_MOSAIC_DIVISIBILITY || 0));

const base32Encode = bytes => {
	let bits = 0;
	let value = 0;
	let output = '';

	bytes.forEach(byte => {
		value = (value << 8) | byte;
		bits += 8;

		while (5 <= bits) {
			output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	});

	if (0 < bits)
		output += BASE32_ALPHABET[(value << (5 - bits)) & 31];

	return output;
};

export const hexToSymbolAddress = hex => {
	if (!/^[0-9A-Fa-f]{48}$/.test(hex || ''))
		return hex;

	const bytes = new Uint8Array(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));

	return base32Encode(bytes);
};

export const publicKeyToSymbolAddress = publicKeyHex => {
	if (!/^[0-9A-Fa-f]{64}$/.test(publicKeyHex || ''))
		return publicKeyHex;

	const publicKey = new Uint8Array(publicKeyHex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
	const partOneHash = sha3_256(publicKey);
	const partTwoHash = new Ripemd160().update(partOneHash).digest();
	const version = new Uint8Array([Number(config.SYMBOL_NETWORK_IDENTIFIER), ...partTwoHash]);
	const checksum = sha3_256(version).subarray(0, 3);

	return base32Encode(new Uint8Array([...version, ...checksum]));
};

export const unsupportedSymbolFeature = feature => {
	throw new Error(`Symbol ${feature} is not implemented yet in the frontend adapter.`);
};
