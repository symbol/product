import { stubBlocks } from './fixtures';
import { stubValue } from './stub';
import { createApiUrl, makeRequest } from '@/app/utils/server';

const DEFAULT_BLOCK_LIMIT = 10;
const MAX_BLOCK_LIMIT = 100;
const DEFAULT_SORT = 'DESC';

const parseInteger = (value, parameterName) => {
	const parsedValue = Number(value);

	if (!Number.isInteger(parsedValue))
		throw new Error(`${parameterName} must be an integer`);

	return parsedValue;
};

const getLimit = searchParams => {
	const requestedLimit = searchParams?.limit ?? searchParams?.pageSize ?? DEFAULT_BLOCK_LIMIT;
	const limit = parseInteger(requestedLimit, 'limit');

	if (limit < 1 || limit > MAX_BLOCK_LIMIT)
		throw new Error(`limit must be between 1 and ${MAX_BLOCK_LIMIT}`);

	return limit;
};

const getFromHeight = searchParams => {
	if (searchParams?.fromHeight === undefined || searchParams.fromHeight === null)
		return null;

	const fromHeight = parseInteger(searchParams.fromHeight, 'fromHeight');

	if (fromHeight < 1)
		throw new Error('fromHeight must be greater than or equal to 1');

	return fromHeight;
};

const getSort = searchParams => {
	const sort = `${searchParams?.sort || DEFAULT_SORT}`.toUpperCase();

	if (!['ASC', 'DESC'].includes(sort))
		throw new Error('sort must be either ASC or DESC');

	return sort;
};

const createBlockSearchURL = ({ limit, fromHeight, sort }) => {
	const params = new URLSearchParams({ limit: `${limit}` });

	if (null !== fromHeight)
		params.set('fromHeight', `${fromHeight}`);

	params.set('sort', sort);

	return `${createApiUrl('blocks')}?${params.toString()}`;
};

const validateBlockHeights = blocks => {
	if (blocks.some(block => !Number.isInteger(block?.height)))
		throw new Error('Symbol blocks response must contain integer heights');
};

const getNextFromHeight = (blocks, sort) => {
	if (!blocks.length)
		return null;

	const lastHeight = blocks[blocks.length - 1].height;
	const nextFromHeight = 'ASC' === sort ? lastHeight + 1 : lastHeight - 1;

	return nextFromHeight > 0 ? nextFromHeight : null;
};

const createPageState = (blocks, pageNumber, limit, sort) => {
	const nextFromHeight = getNextFromHeight(blocks, sort);
	const isLastPage = blocks.length < limit || null === nextFromHeight;

	return {
		data: blocks,
		pageNumber,
		isLastPage,
		nextPageParams: isLastPage ? null : { fromHeight: nextFromHeight, sort }
	};
};

const STUB_FINALIZED_HEIGHT = stubBlocks[3].height;

/**
 * Fetches a Symbol block page from Explorer REST.
 *
 * `pageNumber` and `pageSize` are accepted for the shared page contract, but
 * only the REST cursor parameters are sent to the Symbol endpoint.
 * @param {object} [searchParams] - block page and cursor parameters.
 * @returns {Promise<object>} mapped block page state and the next cursor.
 */
export const fetchBlockPage = async (searchParams = {}) => {
	const limit = getLimit(searchParams);
	const fromHeight = getFromHeight(searchParams);
	const sort = getSort(searchParams);
	const pageNumber = searchParams.pageNumber === undefined || searchParams.pageNumber === null
		? 1
		: parseInteger(searchParams.pageNumber, 'pageNumber');
	const url = createBlockSearchURL({ limit, fromHeight, sort });
	const blocks = await makeRequest(url);

	if (!Array.isArray(blocks))
		throw new Error('Symbol blocks response must be an array');
	validateBlockHeights(blocks);

	return createPageState(blocks, pageNumber, limit, sort);
};

export const fetchChainHight = () => Promise.resolve(stubBlocks[0].height);
export const fetchChainStatus = () => Promise.resolve({ height: stubBlocks[0].height, finalizedHeight: STUB_FINALIZED_HEIGHT });
export const fetchBlockInfo = stubValue(stubBlocks[0]);
