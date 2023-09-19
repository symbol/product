import config from '@/config';
import { createAPICallFunction, createAPISearchURL, createPage, createSearchCriteria, truncateDecimals } from '@/utils';

export default async function handler(req, res) {
	if (req.method !== 'GET') {
		return;
	}

	const data = await getBlockPage(req.query);

	res.status(200).json(data);
}

export const fetchBlockPage = async searchCriteria => {
	const params = new URLSearchParams(searchCriteria).toString();
	const response = await fetch(`/api/blocks?${params}`);

	return response.json();
};

export const getBlockPage = async searchCriteria => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const url = createAPISearchURL(`${config.API_BASE_URL}/blocks`, { pageNumber, pageSize });
	const response = await fetch(url);
	const blocks = await response.json();

	return createPage(blocks, pageNumber, block => ({
		...block,
		harvester: block.signer,
		totalFee: block.totalFees,
		transactionCount: block.totalTransactions,
		difficulty: ((block.difficulty / Math.pow(10, 14)) * 100).toFixed(2)
	}));
};

export const getChainHight = async () => {
	const blockPage = await getBlockPage({ pageSize: 1 });

	return blockPage.data[0].height;
};

export const getBlockInfo = createAPICallFunction(async height => {
	const response = await fetch(`${config.API_BASE_URL}/block/${height}`);
	const block = await response.json();
	const chainHeight = await getChainHight();

	return {
		...block,
		isSafe: chainHeight - block.height > config.BLOCKCHAIN_UNWIND_LIMIT,
		harvester: block.signer,
		totalFee: block.totalFees,
		transactionCount: block.totalTransactions,
		difficulty: ((block.difficulty / Math.pow(10, 14)) * 100).toFixed(2),
		averageFee: block.totalTransactions
			? truncateDecimals(block.totalFees / block.totalTransactions, config.NATIVE_MOSAIC_DIVISIBILITY)
			: null
	};
});
