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

export const getMarketData = async () => {
	const response = await fetch('https://min-api.cryptocompare.com/data/pricemultifull?fsyms=XEM&tsyms=USD');
	const parsedResponse = await response.json();
	const data = parsedResponse.RAW.XEM.USD;

	return {
		price: data.PRICE,
		priceChange: data.CHANGEPCTDAY,
		volume: data.VOLUME24HOUR,
		circulatingSupply: data.CIRCULATINGSUPPLYMKTCAP
	};
};

export const getPriceByDate = async (timestamp, currency = 'USD') => {
	const date = new Date(timestamp);
	const yyyy = date.getFullYear();
	let mm = date.getMonth() + 1;
	let dd = date.getDate();

	if (dd < 10) dd = '0' + dd;
	if (mm < 10) mm = '0' + mm;

	const formattedDate = dd + '-' + mm + '-' + yyyy;

	const response = await fetch(`https://api.coingecko.com/api/v3/coins/nem/history?date=${formattedDate}`);
	const parsedResponse = await response.json();

	return parsedResponse.market_data.current_price[currency.toLowerCase()];
};
