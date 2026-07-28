import config from '@/config';
import { PAGE_SIZE } from '@/constants';
import { makeGetRequest } from '@/utils/server';
import { parseSearchInput } from '@/utils/validation';

/**
 * Criteria used to query a bridge report endpoint.
 * @typedef {Object} ReportCriteria
 * @property {string} baseUrl Bridge API base URL.
 * @property {'wrap'|'unwrap'} operation Bridge operation.
 * @property {'requests'|'errors'} resource Report resource.
 * @property {number} [offset=0] Zero-based row offset.
 * @property {number} [limit=PAGE_SIZE] Maximum number of rows to request.
 * @property {string} [search] Symbol/Ethereum address or transaction hash used to filter rows.
 * @property {0|1|2|3|null} [payoutStatus] Payout status filter for request reports.
 * @property {number} [sort=0] Sort direction accepted by the bridge API.
 * @property {AbortSignal} [signal] Signal used to cancel the HTTP request.
 */

/**
 * A page returned by a bridge report endpoint.
 * @typedef {Object} ReportPage
 * @property {Object[]} data Report rows returned by the endpoint.
 * @property {boolean} hasMore Whether another page might be available.
 * @property {number} nextOffset Offset to use for the next request.
 */


/**
 * Removes a trailing slash from a bridge API base URL.
 * @param {string} baseUrl Bridge API base URL.
 * @returns {string} Base URL without a trailing slash.
 */
const normalizeBaseUrl = baseUrl => (baseUrl || '').replace(/\/$/, '');

/**
 * Builds the URL for a bridge report request.
 * @param {ReportCriteria} criteria Report filters and pagination criteria.
 * @returns {string} Bridge report URL with encoded path values and query parameters.
 * @throws {Error} If the search value is not a supported address or transaction hash.
 * @throws {Error} If an unwrap report is requested from the native bridge.
 */
export const buildBridgeUrl = ({ baseUrl, operation, resource, offset = 0, limit = PAGE_SIZE, search, payoutStatus, sort = 0 }) => {
	const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
	if ('unwrap' === operation && normalizeBaseUrl(config.PUBLIC_BRIDGE_NATIVE_URL) === normalizedBaseUrl)
		throw new Error('The native bridge does not support unwrap operations');

	const parsedSearch = parseSearchInput(search);
	if (search && !parsedSearch)
		throw new Error('Invalid address or transaction hash');

	let path = `${normalizedBaseUrl}/${operation}/${resource}`;
	if ('address' === parsedSearch?.type)
		path += `/${encodeURIComponent(parsedSearch.value)}`;
	if ('hash' === parsedSearch?.type)
		path += `/hash/${encodeURIComponent(parsedSearch.value)}`;

	const parameters = new URLSearchParams({ offset: String(offset), limit: String(limit), sort: String(sort) });
	if ('requests' === resource && null !== payoutStatus && undefined !== payoutStatus)
		parameters.set('payout_status', String(payoutStatus));

	return `${path}?${parameters.toString()}`;
};

/**
 * Fetches configuration metadata for the wrapped and native bridges concurrently.
 * A bridge configuration is null when its request fails.
 * @returns {Promise<{wrapped: Object|null, native: Object|null}>} Configuration metadata for each bridge.
 */
export const fetchBridgeConfiguration = async () => {
	const wrappedUrl = config.PUBLIC_BRIDGE_WRAPPED_URL;
	const nativeUrl = config.PUBLIC_BRIDGE_NATIVE_URL;

	const [wrappedResult, nativeResult] = await Promise.allSettled([
		makeGetRequest(normalizeBaseUrl(wrappedUrl)),
		makeGetRequest(normalizeBaseUrl(nativeUrl))
	]);

	return {
		wrapped: 'fulfilled' === wrappedResult.status ? wrappedResult.value : null,
		native: 'fulfilled' === nativeResult.status ? nativeResult.value : null
	};
};

/**
 * Fetches one page of bridge report rows and derives its pagination metadata.
 * @param {ReportCriteria} criteria Report filters, pagination criteria, and optional cancellation signal.
 * @returns {Promise<ReportPage>} Report rows and pagination metadata.
 */
export const fetchReportPage = async criteria => {
	const { limit = PAGE_SIZE, offset = 0, signal } = criteria;
	const url = buildBridgeUrl(criteria);
	const data = await makeGetRequest(url, { signal });

	return {
		data,
		hasMore: data.length === limit,
		nextOffset: offset + data.length
	};
};

/**
 * Fetches every page of a bridge report, starting at offset zero.
 * @param {ReportCriteria} criteria Report filters and page size.
 * @param {function(number): void} [onProgress] Called after each page with the total number of rows fetched.
 * @returns {Promise<Object[]>} All report rows in API order.
 */
export const fetchAllReportRows = async (criteria, onProgress) => {
	const limit = criteria.limit || PAGE_SIZE;
	let offset = 0;
	let rows = [];
	let hasMore = true;

	while (hasMore) {
		const { data, hasMore: pageHasMore, nextOffset } = await fetchReportPage({ ...criteria, limit, offset });
		rows = [...rows, ...data];
		offset = nextOffset;
		hasMore = pageHasMore;
		onProgress?.(rows.length);
	}

	return rows;
};
