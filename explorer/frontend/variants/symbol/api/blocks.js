import {
	absoluteToRelative,
	createSymbolPage,
	createSymbolSearchURL,
	fetchSymbolNode,
	hexToSymbolAddress,
	publicKeyToSymbolAddress,
	symbolTimestampToDate
} from '../utils';
import config from '@/config';
import { createTryFetchInfoFunction } from '@/utils/server';

const INFLATION_RECEIPT_TYPE = 20803;

const getBlockDTO = data => data?.block ? data : { block: data, meta: data?.meta || {} };

const getReceipts = response =>
	(Array.isArray(response?.data) ? response.data : []).flatMap(item => item.statement?.receipts || []);

const getStatementHeight = item => Number(item.statement?.height || item.meta?.height || item.height || 0);

const fetchBlockRewardsByHeight = async blocks => {
	const blockHeights = blocks
		.filter(block => block.statementCount)
		.map(block => block.height);

	if (!blockHeights.length)
		return {};

	const fromHeight = Math.min(...blockHeights);
	const toHeight = Math.max(...blockHeights);
	const response = await fetchSymbolNode(
		`statements/transaction?fromHeight=${fromHeight}&toHeight=${toHeight}&receiptType=${INFLATION_RECEIPT_TYPE}&pageSize=100`
	);

	return (Array.isArray(response?.data) ? response.data : []).reduce((rewardsByHeight, item) => {
		const height = getStatementHeight(item);
		const amount = getReceipts({ data: [item] })
			.filter(receipt => Number(receipt.type) === INFLATION_RECEIPT_TYPE)
			.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);

		if (height && amount)
			rewardsByHeight[height] = absoluteToRelative((rewardsByHeight[height] || 0) + amount);

		return rewardsByHeight;
	}, {});
};

const fetchLatestFinalizedBlockHeight = async () => {
	const chainInfo = await fetchSymbolNode('chain/info');

	return Number(chainInfo.latestFinalizedBlock?.height || 0);
};

const blockInfoFromDTO = data => {
	const dto = getBlockDTO(data);
	const block = dto.block || {};
	const meta = dto.meta || {};
	const difficulty = Number(block.difficulty || 0);

	return {
		hash: meta.hash || block.hash,
		height: Number(block.height || 0),
		signature: block.signature,
		size: Number(block.size || 0),
		timestamp: symbolTimestampToDate(block.timestamp || 0),
		harvester: block.beneficiaryAddress
			? hexToSymbolAddress(block.beneficiaryAddress)
			: publicKeyToSymbolAddress(block.signerPublicKey),
		totalFee: absoluteToRelative(meta.totalFee || 0),
		transactionCount: Number(meta.totalTransactionsCount || meta.transactionsCount || 0),
		statementCount: Number(meta.statementsCount || 0),
		difficulty: difficulty ? ((difficulty / Math.pow(10, 14)) * 100).toFixed(2) : 0
	};
};

export const fetchBlockPage = async searchParams => {
	const url = createSymbolSearchURL('blocks', searchParams, { orderBy: 'height' });
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);
	const page = createSymbolPage(response, pageNumber, blockInfoFromDTO);
	const latestFinalizedBlockHeight = await fetchLatestFinalizedBlockHeight();
	const blockRewardsByHeight = await fetchBlockRewardsByHeight(page.data);
	const data = page.data.map(block => ({
		...block,
		blockReward: blockRewardsByHeight[block.height] || 0,
		isFinalized: block.height <= latestFinalizedBlockHeight
	}));

	return {
		...page,
		data
	};
};

export const fetchChainHight = async () => {
	const chain = await fetchSymbolNode('chain/info');

	return Number(chain.height || 0);
};

export const fetchBlockInfo = createTryFetchInfoFunction(async height => {
	const block = await fetchSymbolNode(`blocks/${height}`);

	return blockInfoFromDTO(block);
});
