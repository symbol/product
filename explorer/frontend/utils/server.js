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

// Creates an API URL.
export const createApiUrl = path => `${config.API_BASE_URL}/${path}`;

// Creates a search URL, which uses in fetching paged data.
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
// Formats data rows using the "formatter" callback.
export const createPage = (data, pageNumber, formatter) => {
	let formattedData;

	if (formatter)
		formattedData = data.map(formatter);
	else
		formattedData = data;

	return {
		data: formattedData,
		pageNumber
	};
};

// Creates a wrapper for the info fetch function.
// Handles client errors.
export const createTryFetchInfoFunction =
	func =>
		async (...args) => {
			try {
				return await func(...args);
			} catch (error) {
				if ([400, 404, 409].includes(error.response?.status) || [400, 404, 409].includes(error.response?.data?.status))
					return null;

				throw error;
			}
		};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getRetryAfterDelay = retryAfter => {
	const retryAfterSeconds = Number(retryAfter);

	return Number.isFinite(retryAfterSeconds)
		? retryAfterSeconds * 1000
		: null;
};

// Makes HTTP requests.
export const makeRequest = async (url, options = {}) => {
	const {
		timeout = config.REQUEST_TIMEOUT,
		method = 'get',
		retryCount = 2,
		retryDelay = 250
	} = options;
	const axiosOptions = {
		method,
		url,
		data: options.data || options.body,
		timeout
	};

	if (options.headers)
		axiosOptions.headers = options.headers;

	let attempt = 0;

	while (true) {
		try {
			const response = await axios(axiosOptions);

			return response.data;
		} catch (error) {
			const status = error.response?.status;

			if (status !== 429 || attempt >= retryCount)
				throw error;

			const retryAfterDelay = getRetryAfterDelay(error.response?.headers?.['retry-after']);
			await sleep(retryAfterDelay ?? retryDelay);
			attempt++;
		}
	}
};
