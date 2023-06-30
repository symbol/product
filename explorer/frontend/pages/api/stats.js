import { getStatsStub } from '../../stubs/stats';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getStats();

	res.status(200).json(data);
}

export const getStats = async () => {
	return getStatsStub();
};
