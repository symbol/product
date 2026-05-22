import axios from 'axios';

const createURLSearchParams = values => {
	const params = new URLSearchParams();

	Object.entries(values).forEach(([key, value]) => {
		if (Array.isArray(value))
			value.forEach(item => params.append(key, item));
		else
			params.append(key, value);
	});

	return params;
};

export default async function handler(req, res) {
	const { path, ...queryParams } = req.query;
	const pathStr = Array.isArray(path) ? path.join('/') : path;
	const symbolNodeUrl = process.env.NEXT_PUBLIC_SYMBOL_NODE_URL;
	const requestTimeout = Number(process.env.NEXT_PUBLIC_REQUEST_TIMEOUT) || 60000;
	const query = createURLSearchParams(queryParams).toString();
	const targetUrl = `${symbolNodeUrl}/${pathStr}${query ? '?' + query : ''}`;

	try {
		const response = await axios({
			method: req.method,
			url: targetUrl,
			data: req.body,
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
