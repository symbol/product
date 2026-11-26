import { stubMosaics } from './fixtures';
import { stubValue } from './stub';
import { createApiUrl, createPage, createSearchCriteria, createSearchURL, makeRequest } from '@/app/utils/server';

// REST accepts offsets up to this value; avoid requesting a page beyond it.
const MAX_MOSAIC_OFFSET = 100000;

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
	// Only pagination and sort are supported by the list; ignore UI-only conditions.
	const { pageNumber, pageSize } = createSearchCriteria(searchParams);
	const filter = searchParams.sort == null ? {} : { sort: `${searchParams.sort}`.toUpperCase() };
	const url = createSearchURL(createApiUrl('mosaics'), { pageNumber, pageSize, filter });
	const mosaics = await makeRequest(url);
	const offset = pageSize * (pageNumber - 1);

	return {
		...createPage(mosaics, pageNumber, mosaicInfoFromDTO),
		isLastPage: mosaics.length < pageSize || offset + pageSize > MAX_MOSAIC_OFFSET
	};
};

export const fetchMosaicInfo = stubValue(stubMosaics[0]);
