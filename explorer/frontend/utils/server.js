export const getSearchCriteria = req => {
	const { searchParams } = new URL(req.url);
	const pageNumber = searchParams.get('pageNumber');
	const pageSize = searchParams.get('pageSize');

	return {
		pageNumber: pageNumber || 1,
		pageSize: pageSize || 50
	};
};

export const createSearchCriteria = (searchCriteria = {}) => {
	const pageNumber = parseInt(searchCriteria.pageNumber);
	const pageSize = parseInt(searchCriteria.pageSize);

	return {
		pageNumber: isNaN(pageNumber) ? 1 : pageNumber,
		pageSize: isNaN(pageSize) ? 50 : pageSize
	};
};

export const createPage = (data, pageNumber, formatter) => ({
	data: formatter ? data.map(formatter) : data,
	pageNumber
});

export const createAPISearchURL = (baseURL, searchCriteria, filter = {}) => {
	const limit = searchCriteria.pageSize;
	const offset = searchCriteria.pageSize * searchCriteria.pageNumber;
	const params = new URLSearchParams({
		limit,
		offset,
		...filter
	}).toString();

	return `${baseURL}?${params}`;
};

export const createAPICallFunction =
	func =>
	async (...args) => {
		try {
			const data = await func(...args);

			if (data.status) {
				return null;
			}

			return data;
		} catch {
			return null;
		}
	};
