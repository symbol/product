import config from '@/config';
import { createAPICallFunction, createAPISearchURL, createPage, createSearchCriteria, makeRequest, truncateDecimals } from '@/utils';

export const fetchBlockPage = async searchCriteria => {
	const { pageNumber, pageSize } = createSearchCriteria(searchCriteria);
	const url = createAPISearchURL(`${config.API_BASE_URL}/blocks`, { pageNumber, pageSize });
	const blocks = await makeRequest(url);

	return createPage(blocks, pageNumber, block => ({
		...block,
		harvester: block.signer,
		totalFee: block.totalFees,
		transactionCount: block.totalTransactions,
		difficulty: ((block.difficulty / Math.pow(10, 14)) * 100).toFixed(2)
	}));
};

export const fetchChainHight = async () => {
	const blockPage = await fetchBlockPage({ pageSize: 1 });

	return blockPage.data[0].height;
};

export const fetchBlockInfo = createAPICallFunction(async height => {
	const block = await makeRequest(`${config.API_BASE_URL}/block/${height}`);
	const chainHeight = await fetchChainHight();

	return {
		...block,
		isSafe: chainHeight - block.height > config.BLOCKCHAIN_UNWIND_LIMIT,
		harvester: block.signer,
		totalFee: block.totalFees,
		transactionCount: block.totalTransactions,
		difficulty: ((block.difficulty / Math.pow(10, 14)) * 100).toFixed(2),
		averageFee: block.totalTransactions
			? truncateDecimals(block.totalFees / block.totalTransactions, config.NATIVE_MOSAIC_DIVISIBILITY)
			: 0
	};
});
