import config from '@/config';
import axios from 'axios';

// Creates search criteria from search parameters.
// Uses default values if some is not provided.
export const createSearchCriteria = (searchParams = {}) => {
	const { pageNumber, pageSize, ...filter } = searchParams;
	const parsedPageNumber = parseInt(pageNumber);
	const parsedPageSize = parseInt(pageSize);

	return {
		pageNumber: isNaN(parsedPageNumber) ? 1 : parsedPageNumber,
		pageSize: isNaN(parsedPageSize) ? 10 : parsedPageSize,
		filter
	};
};

// Creates a search URL, which uses in fetching paged data
export const createSearchURL = (baseURL, searchCriteria) => {
	const { pageNumber, pageSize, filter } = searchCriteria;
	const limit = pageSize;
	const offset = pageSize * (pageNumber - 1);
	const params = new URLSearchParams({
		limit,
		offset,
		...filter
	}).toString();

	return `${baseURL}?${params}`;
};

// Creates page from data response.
// Formats data rows using the "formatter" callback
export const createPage = (data, pageNumber, formatter) => {
	let formattedData;

	if (formatter) {
		formattedData = data.map(formatter);
	} else {
		formattedData = data;
	}

	return {
		data: formattedData,
		pageNumber
	};
};

// Creates a wrapper for the info fetch function.
// Handles 404 error
export const createFetchInfoFunction =
	func =>
	async (...args) => {
		try {
			return await func(...args);
		} catch (error) {
			if (error.response.data.status === 404) {
				return null;
			}

			throw error.response.data;
		}
	};

// Makes HTTP requests
export const makeRequest = async (url, options = {}) => {
	const { timeout = config.REQUEST_TIMEOUT, method = 'get' } = options;

	const response = await axios({
		method,
		url,
		data: options.data || options.body,
		timeout
	});

	return response.data;
};
