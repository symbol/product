import { stubNamespaces } from './fixtures';
import { stubValue } from './stub';
import {
	createApiUrl,
	createPage,
	createSearchCriteria,
	createSearchURL,
	makeRequest
} from '@/app/utils/server';

const DEFAULT_SORT = 'DESC';
const SUPPORTED_FILTERS = ['sort', 'aliasType', 'registrationType', 'ownerAddress'];

const namespaceInfoFromDTO = data => ({
	...data,
	name: data.namespaceName,
	registrationTimestamp: data.startTimestamp
});

/**
 * Fetches a Symbol namespace page from Explorer REST.
 * @param {object} [searchParams] - page and supported namespace filter parameters.
 * @returns {Promise<object>} namespace page.
 */
export const fetchNamespacePage = async (searchParams = {}) => {
	const params = searchParams ?? {};
	const filter = { sort: DEFAULT_SORT };

	SUPPORTED_FILTERS.forEach(filterName => {
		if (Object.prototype.hasOwnProperty.call(params, filterName))
			filter[filterName] = params[filterName];
	});

	const searchCriteria = createSearchCriteria({
		...filter,
		pageNumber: params.pageNumber,
		pageSize: params.pageSize
	});
	const url = createSearchURL(createApiUrl('namespaces'), searchCriteria);
	const namespaces = await makeRequest(url);

	return createPage(namespaces, searchCriteria.pageNumber, namespaceInfoFromDTO);
};

export const fetchNamespaceInfo = stubValue(stubNamespaces[0]);
