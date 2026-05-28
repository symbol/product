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
const BLOCK_TYPE_NAMES = {
	32835: 'Nemesis Block',
	33091: 'Normal Block',
	33347: 'Importance Block'
};
const STATE_HASH_SUB_CACHE_MERKLE_ROOT_KEYS = [
	'accountState',
	'namespace',
	'mosaic',
	'multisig',
	'hashLockInfo',
	'secretLookInfo',
	'accountRestriction',
	'mosaicRestriction',
	'metadata'
];

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
	const statementsPath =
		`statements/transaction?fromHeight=${fromHeight}&toHeight=${toHeight}&receiptType=${INFLATION_RECEIPT_TYPE}&pageSize=100`;
	const response = await fetchSymbolNode(statementsPath);

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
	const blockType = BLOCK_TYPE_NAMES[Number(block.type)];
	const stateHashSubCacheMerkleRoots = STATE_HASH_SUB_CACHE_MERKLE_ROOT_KEYS.reduce((roots, key, index) => ({
		...roots,
		[key]: meta.stateHashSubCacheMerkleRoots?.[index] || null
	}), {});

	return {
		hash: block.hash || meta.hash,
		height: Number(block.height || 0),
		signature: block.signature,
		size: Number(block.size || 0),
		timestamp: symbolTimestampToDate(block.timestamp || 0),
		harvester: publicKeyToSymbolAddress(block.signerPublicKey),
		beneficiaryAddress: block.beneficiaryAddress ? hexToSymbolAddress(block.beneficiaryAddress) : null,
		totalFee: absoluteToRelative(meta.totalFee || 0),
		transactionCount: Number(meta.transactionsCount ?? meta.totalTransactionsCount ?? 0),
		statementCount: Number(meta.statementsCount || 0),
		rawDifficulty: `${block.difficulty || 0}`,
		feeMultiplier: Number(block.feeMultiplier || 0),
		proofGamma: block.proofGamma,
		proofScalar: block.proofScalar,
		proofVerificationHash: block.proofVerificationHash,
		stateHash: block.stateHash,
		stateHashSubCacheMerkleRoots,
		receiptsHash: block.receiptsHash || block.receiptHash,
		transactionsHash: block.transactionsHash || block.transactionHash,
		difficulty: difficulty ? ((difficulty / Math.pow(10, 14)) * 100).toFixed(2) : 0,
		...(blockType && { blockType })
	};
};

export const fetchBlockPage = async searchParams => {
	const {
		includeBlockRewards = true,
		includeFinalization = true,
		...blockSearchParams
	} = searchParams || {};
	const url = createSymbolSearchURL('blocks', blockSearchParams, { orderBy: 'height' });
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
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
	const chainInfo = await fetchSymbolNode('chain/info');
	const latestFinalizedBlockHeight = Number(chainInfo.latestFinalizedBlock?.height || 0);
	const blockInfo = blockInfoFromDTO(block);

	return {
		...blockInfo,
		isFinalized: blockInfo.height <= latestFinalizedBlockHeight
	};
});
