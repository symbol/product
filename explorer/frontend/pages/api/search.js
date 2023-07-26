import { getStatsStub } from '../../stubs/stats';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await search(req.query.q);

	res.status(200).json(data);
}

export const fetchSearch = async q => {
	const params = new URLSearchParams({q}).toString();
	const response = await fetch(`/search?${params}`);

	return response.json();
};

export const search = async (query) => {
	return null;
};
