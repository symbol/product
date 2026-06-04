import {
	absoluteToRelative,
	createSymbolNodePath,
	createSymbolPage,
	createSymbolSearchURL,
	fetchSymbolNode,
	hexToSymbolAddress,
	publicKeyToSymbolAddress,
	symbolTimestampToDate
} from '../utils';
import { createTryFetchInfoFunction } from '@/utils/server';

const getBlockDTO = data => data?.block ? data : { block: data, meta: data?.meta || {} };

const INFLATION_RECEIPT_TYPE = 20803;

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
	const statementsPath =
		`statements/transaction?fromHeight=${fromHeight}&toHeight=${toHeight}&receiptType=${INFLATION_RECEIPT_TYPE}&pageSize=100`;
	const response = await fetchSymbolNode(statementsPath);

	const rewardsByHeight = (Array.isArray(response?.data) ? response.data : []).reduce((rewardsByHeight, item) => {
		const height = getStatementHeight(item);
		const amount = getReceipts({ data: [item] })
			.filter(receipt => Number(receipt.type) === INFLATION_RECEIPT_TYPE)
			.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);

		if (height && amount)
			rewardsByHeight[height] = (rewardsByHeight[height] || 0) + amount;

		return rewardsByHeight;
	}, {});

	return Object.entries(rewardsByHeight).reduce((relativeRewardsByHeight, [height, amount]) => ({
		...relativeRewardsByHeight,
		[height]: absoluteToRelative(amount)
	}), {});
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
		harvester: publicKeyToSymbolAddress(block.signerPublicKey),
		beneficiaryAddress: block.beneficiaryAddress ? hexToSymbolAddress(block.beneficiaryAddress) : null,
		totalFee: absoluteToRelative(meta.totalFee || 0),
		transactionCount: Number(meta.totalTransactionsCount ?? meta.transactionsCount ?? 0),
		statementCount: Number(meta.statementsCount || 0),
		difficulty: difficulty ? ((difficulty / Math.pow(10, 14)) * 100).toFixed(2) : 0
	};
};

export const fetchBlockPage = async searchParams => {
	const {
		includeBlockRewards = true,
		includeFinalization = true,
		...blockSearchParams
	} = searchParams || {};
	const url = createSymbolSearchURL('blocks', blockSearchParams, { orderBy: 'height' });
	const response = await fetchSymbolNode(createSymbolNodePath(url));
	const pageNumber = Number(blockSearchParams.pageNumber || 1);
	const page = createSymbolPage(response, pageNumber, blockInfoFromDTO);
	const latestFinalizedBlockHeight = includeFinalization ? await fetchLatestFinalizedBlockHeight() : 0;
	const blockRewardsByHeight = includeBlockRewards ? await fetchBlockRewardsByHeight(page.data) : {};
	const data = page.data.map(block => ({
		...block,
		blockReward: blockRewardsByHeight[block.height] || 0,
		isFinalized: includeFinalization ? block.height <= latestFinalizedBlockHeight : false
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
