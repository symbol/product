import { stubMosaics } from './fixtures';
import { stubValue } from './stub';
import { createApiUrl, createPage, createSearchURL, makeRequest } from '@/app/utils/server';

const MAX_MOSAIC_LIMIT = 100;
const MAX_MOSAIC_OFFSET = 100000;

const normalizeSafeIntegerParameter = (value, defaultValue, parameterName) => {
	if (value === undefined || value === null)
		return defaultValue;

	const isInteger = typeof value === 'number'
		? Number.isInteger(value)
		: typeof value === 'string' && /^[+-]?\d+$/.test(value);
	if (!isInteger)
		throw new Error(`${parameterName} must be an integer`);

	const normalizedValue = typeof value === 'number' ? value : Number(value);

	if (!Number.isSafeInteger(normalizedValue))
		throw new Error(`${parameterName} must be a safe integer`);

	return normalizedValue;
};

const mosaicInfoFromDTO = data => ({
	...data,
	name: data.id,
	// The existing list reads this view field for expiration on both variants.
	namespaceExpirationHeight: data.expirationHeight
});

/**
 * Fetches a Symbol mosaic page from Explorer REST.
 * @param {object} [searchParams] - page number, page size, and optional sort order.
 * @returns {Promise<object>} the mosaic page and its pagination state.
 */
export const fetchMosaicPage = async (searchParams = {}) => {
	const pageNumber = normalizeSafeIntegerParameter(searchParams.pageNumber, 1, 'pageNumber');
	const pageSize = normalizeSafeIntegerParameter(searchParams.pageSize, 10, 'limit');

	if (pageNumber < 1)
		throw new Error('pageNumber must be at least 1');

	if (pageSize < 1 || pageSize > MAX_MOSAIC_LIMIT)
		throw new Error(`limit must be between 1 and ${MAX_MOSAIC_LIMIT}`);

	const offset = pageSize * (pageNumber - 1);

	if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_MOSAIC_OFFSET)
		throw new Error(`offset must be between 0 and ${MAX_MOSAIC_OFFSET}`);

	let sort;
	if (searchParams.sort !== undefined && searchParams.sort !== null) {
		sort = `${searchParams.sort}`.toUpperCase();
		if (!['ASC', 'DESC'].includes(sort))
			throw new Error('sort must be either ASC or DESC');
	}

	const url = createSearchURL(createApiUrl('mosaics'), {
		pageNumber,
		pageSize,
		filter: sort ? { sort } : {}
	});
	const mosaics = await makeRequest(url);

	if (!Array.isArray(mosaics))
		throw new Error('Symbol mosaics response must be an array');

	return {
		...createPage(mosaics, pageNumber, mosaicInfoFromDTO),
		isLastPage: mosaics.length < pageSize || offset + pageSize > MAX_MOSAIC_OFFSET
	};
};

export const fetchMosaicInfo = stubValue(stubMosaics[0]);
