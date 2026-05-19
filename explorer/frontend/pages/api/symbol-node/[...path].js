import axios from 'axios';

export default async function handler(req, res) {
	const { path, ...queryParams } = req.query;
	const pathStr = Array.isArray(path) ? path.join('/') : path;
	const symbolNodeUrl = process.env.NEXT_PUBLIC_SYMBOL_NODE_URL;
	const query = new URLSearchParams(queryParams).toString();
	const targetUrl = `${symbolNodeUrl}/${pathStr}${query ? '?' + query : ''}`;

	try {
		const response = await axios({
			method: req.method,
			url: targetUrl,
			data: req.body,
			timeout: 15000
		});
		res.status(response.status).json(response.data);
	} catch (error) {
		if (error.response)
			res.status(error.response.status).json(error.response.data);
		else
			res.status(500).json({ message: error.message });
	}
}
