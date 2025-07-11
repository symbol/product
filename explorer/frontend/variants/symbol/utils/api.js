import config from '@/config';

export const createAPIURL = path => `${config.SYMBOL_NODE_URL}/${path}`;

// Creates a search URL, which uses in fetching paged data.
export const createSearchURL = (baseURL, searchCriteria, additionalParams) => {
	const { pageNumber, pageSize, order = 'desc', filter } = searchCriteria;
	const limit = pageSize;
	const offset = pageSize * (pageNumber - 1);
	const params = new URLSearchParams({
		pageNumber,
		pageSize,
        order,
        ...additionalParams,
		...filter
	}).toString();

	return `${baseURL}?${params}`;
};
