import {
	createApiUrl,
	createPage,
	createSearchCriteria,
	createSearchURL,
	createTryFetchInfoFunction,
	makeRequest
} from '@/app/utils/server';

const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const MAX_OFFSET = 100000;
const DEFAULT_SORT = 'DESC';
const SUPPORTED_FILTERS = ['aliasType', 'registrationType', 'ownerAddress'];

const hasOwnProperty = (value, property) => Object.prototype.hasOwnProperty.call(value, property);

const parsePageParameter = (searchParams, parameterName, defaultValue) => {
	if (!hasOwnProperty(searchParams, parameterName))
		return defaultValue;

	const value = searchParams[parameterName];
	const isNonEmptyString = typeof value === 'string' && '' !== value.trim();
	const parsedValue = typeof value === 'number' || isNonEmptyString ? Number(value) : NaN;

	if (!Number.isSafeInteger(parsedValue))
		throw new Error(`${parameterName} must be an integer`);

	return parsedValue;
};

const getPageCriteria = searchParams => {
	const pageNumber = parsePageParameter(searchParams, 'pageNumber', DEFAULT_PAGE_NUMBER);
	const pageSize = parsePageParameter(searchParams, 'pageSize', DEFAULT_PAGE_SIZE);

	if (pageNumber < 1)
		throw new Error('pageNumber must be greater than or equal to 1');

	if (pageSize < 1 || pageSize > MAX_PAGE_SIZE)
		throw new Error(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);

	const offset = pageSize * (pageNumber - 1);
	if (offset > MAX_OFFSET)
		throw new Error(`offset must be between 0 and ${MAX_OFFSET}`);

	return { pageNumber, pageSize };
};

const createNamespaceSearchCriteria = (searchParams, pageCriteria) => {
	const normalizedSearchParams = { ...searchParams, ...pageCriteria };
	const searchCriteria = createSearchCriteria(normalizedSearchParams);
	const filter = {
		sort: hasOwnProperty(searchParams, 'sort') ? searchParams.sort : DEFAULT_SORT
	};

	SUPPORTED_FILTERS.forEach(filterName => {
		if (hasOwnProperty(searchParams, filterName))
			filter[filterName] = searchParams[filterName];
	});

	return { ...searchCriteria, filter };
};

const namespaceInfoFromDTO = data => ({
	...data,
	name: data.namespaceName,
	registrationTimestamp: data.startTimestamp
});

const namespaceDetailFromDTO = data => ({
	...data,
	name: data.namespaceName,
	registrationTimestamp: data.startTimestamp,
	subNamespaceHierarchy: data.subNamespaces,
	subNamespaces: data.subNamespaces.map(namespace => namespace.namespaceName),
	namespaceMosaics: data.namespaceMosaics.map(group => ({
		...group,
		data: group.data.map(mosaic => ({
			...mosaic,
			name: mosaic.id,
			namespaceExpirationHeight: mosaic.expirationHeight,
			registrationTimestamp: mosaic.startTimestamp,
			displaySupply: mosaic.value
		}))
	}))
});

/**
 * Fetches a Symbol namespace page from Explorer REST.
 * @param {object} [searchParams] - page and supported namespace filter parameters.
 * @returns {Promise<object>} namespace page.
 */
export const fetchNamespacePage = async (searchParams = {}) => {
	const params = searchParams ?? {};
	const pageCriteria = getPageCriteria(params);
	const searchCriteria = createNamespaceSearchCriteria(params, pageCriteria);
	const url = createSearchURL(createApiUrl('namespaces'), searchCriteria);
	const namespaces = await makeRequest(url);

	return createPage(namespaces, searchCriteria.pageNumber, namespaceInfoFromDTO);
};
export const fetchNamespaceInfo = createTryFetchInfoFunction(async id => {
	const namespace = await makeRequest(createApiUrl(`namespace/${encodeURIComponent(id)}`));
	return namespaceDetailFromDTO(namespace);
});
