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

const getBlockDTO = data => data?.block ? data : { block: data, meta: data?.meta || {} };

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
		difficulty: difficulty ? ((difficulty / Math.pow(10, 14)) * 100).toFixed(2) : 0
	};
};

export const fetchBlockPage = async searchParams => {
	const url = createSymbolSearchURL('blocks', searchParams, { orderBy: 'height' });
	const response = await fetchSymbolNode(url.replace(`${config.SYMBOL_NODE_URL}/`, ''));
	const pageNumber = Number(searchParams?.pageNumber || 1);

	return createSymbolPage(response, pageNumber, blockInfoFromDTO);
};

export const fetchChainHight = async () => {
	const chain = await fetchSymbolNode('chain/info');

	return Number(chain.height || 0);
};

export const fetchBlockInfo = createTryFetchInfoFunction(async height => {
	const block = await fetchSymbolNode(`blocks/${height}`);

	return blockInfoFromDTO(block);
});
