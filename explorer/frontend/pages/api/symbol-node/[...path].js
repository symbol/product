import axios from 'axios';

const allowedPathPatterns = [
	/^accounts(?:\/[^/]+)?$/,
	/^blocks(?:\/[^/]+)?$/,
	/^chain\/info$/,
	/^mosaics(?:\/[^/]+)?$/,
	/^namespaces(?:\/[^/]+)?$/,
	/^node\/peers$/,
	/^statements\/transaction$/,
	/^transactions\/(?:confirmed|unconfirmed)(?:\/[^/]+)?$/
];

const allowedSearchQueryParams = new Set(['order', 'pageNumber', 'pageSize']);
const allowedQueryParamEntries = [
	{
		pattern: /^blocks$/,
		params: new Set([...allowedSearchQueryParams, 'orderBy'])
	},
	{
		pattern: /^accounts$/,
		params: allowedSearchQueryParams
	},
	{
		pattern: /^mosaics$/,
		params: allowedSearchQueryParams
	},
	{
		pattern: /^namespaces$/,
		params: allowedSearchQueryParams
	},
	{
		pattern: /^transactions\/(?:confirmed|unconfirmed)$/,
		params: new Set([...allowedSearchQueryParams, 'address', 'height', 'orderBy'])
	},
	{
		pattern: /^statements\/transaction$/,
		params: new Set(['fromHeight', 'toHeight', 'receiptType', 'pageSize'])
	}
];

const isAllowedPath = pathStr => /^[A-Za-z0-9/_-]+$/.test(pathStr) && allowedPathPatterns.some(pattern => pattern.test(pathStr));

const getAllowedQueryParams = pathStr => allowedQueryParamEntries.find(entry => entry.pattern.test(pathStr))?.params || new Set();

const getPositiveInteger = value => {
	const parsedValue = Number(value);

	return Number.isInteger(parsedValue) && 0 < parsedValue ? parsedValue : null;
};

const createAllowedQuery = (pathStr, queryParams) => {
	const query = new URLSearchParams();
	const allowedQueryParams = getAllowedQueryParams(pathStr);

	for (const [key, value] of Object.entries(queryParams)) {
		if (!allowedQueryParams.has(key) || Array.isArray(value) || 'string' !== typeof value || 256 < value.length)
			return null;

		if ('pageSize' === key) {
			const parsedPageSize = getPositiveInteger(value);
			if (!parsedPageSize)
				return null;

			query.set(key, String(Math.min(parsedPageSize, 100)));
		} else if ('pageNumber' === key) {
			const parsedPageNumber = getPositiveInteger(value);
			if (!parsedPageNumber)
				return null;

			query.set(key, String(parsedPageNumber));
		} else if ('order' === key) {
			if (!['asc', 'desc'].includes(value))
				return null;

			query.set(key, value);
		} else if ('orderBy' === key) {
			if (!['height', 'id'].includes(value))
				return null;

			query.set(key, value);
		} else if ('height' === key) {
			const parsedHeight = getPositiveInteger(value);
			if (!parsedHeight)
				return null;

			query.set(key, String(parsedHeight));
		} else if (['fromHeight', 'toHeight'].includes(key)) {
			const parsedHeight = getPositiveInteger(value);
			if (!parsedHeight)
				return null;

			query.set(key, String(parsedHeight));
		} else if ('receiptType' === key) {
			if ('20803' !== value)
				return null;

			query.set(key, value);
		} else {
			query.set(key, value);
		}
	}

	return query.toString();
};

export default async function handler(req, res) {
	const { path, ...queryParams } = req.query;
	const pathStr = Array.isArray(path) ? path.join('/') : path;
	const symbolNodeUrl = process.env.NEXT_PUBLIC_SYMBOL_NODE_URL
		|| process.env.SYMBOL_NODE_URL
		|| process.env.NEXT_PUBLIC_API_BASE_URL
		|| process.env.API_BASE_URL;

	if (!symbolNodeUrl) {
		res.status(500).json({ message: 'Symbol node URL is not configured.' });
		return;
	}

	if (req.method !== 'GET') {
		res.setHeader('Allow', 'GET');
		res.status(405).json({ message: 'Method not allowed.' });
		return;
	}

	if (!isAllowedPath(pathStr)) {
		res.status(403).json({ message: 'Symbol node path is not allowed.' });
		return;
	}

	const query = createAllowedQuery(pathStr, queryParams);
	if (null === query) {
		res.status(400).json({ message: 'Symbol node query is not allowed.' });
		return;
	}

	const targetUrl = `${symbolNodeUrl.replace(/\/$/, '')}/${pathStr}${query ? '?' + query : ''}`;
	const requestTimeout = Number(process.env.NEXT_PUBLIC_REQUEST_TIMEOUT || process.env.REQUEST_TIMEOUT) || 60000;

	try {
		const response = await axios({
			method: 'get',
			url: targetUrl,
			timeout: requestTimeout
		});
		res.status(response.status).json(response.data);
	} catch (error) {
		if (error.response)
			res.status(error.response.status).json(error.response.data);
		else
			res.status(500).json({ message: error.message });
	}
}
