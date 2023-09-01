import { getAccountChartsStub, getStatsStub, getTransactionChartStub } from '../../stubs/stats';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getStats();

	res.status(200).json(data);
}

export const fetchAccountCharts = async () => {
	return getAccountChartsStub();
};

export const fetchTransactionChart = async ({ isPerDay, isPerMonth }) => {
	const filter = isPerDay ? 'perDay' : isPerMonth ? 'perMonth' : '';

	return getTransactionChartStub(filter);
};

export const getStats = async () => {
	return getStatsStub();
};
