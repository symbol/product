const platform = process.env.NEXT_PUBLIC_PLATFORM || process.env.PLATFORM || 'nem';

const call = (loadModule, exportName) => async (...args) => {
	const apiModule = await loadModule();

	return apiModule[exportName](...args);
};

const createApi = variantName => ({
	fetchAccountPage: call(() => import(`./${variantName}/api/accounts`), 'fetchAccountPage'),
	fetchAccountInfo: call(() => import(`./${variantName}/api/accounts`), 'fetchAccountInfo'),
	fetchAccountInfoByPublicKey: call(() => import(`./${variantName}/api/accounts`), 'fetchAccountInfoByPublicKey'),
	fetchBlockPage: call(() => import(`./${variantName}/api/blocks`), 'fetchBlockPage'),
	fetchChainHight: call(() => import(`./${variantName}/api/blocks`), 'fetchChainHight'),
	fetchBlockInfo: call(() => import(`./${variantName}/api/blocks`), 'fetchBlockInfo'),
	fetchMosaicPage: call(() => import(`./${variantName}/api/mosaics`), 'fetchMosaicPage'),
	fetchMosaicInfo: call(() => import(`./${variantName}/api/mosaics`), 'fetchMosaicInfo'),
	fetchNamespacePage: call(() => import(`./${variantName}/api/namespaces`), 'fetchNamespacePage'),
	fetchNamespaceInfo: call(() => import(`./${variantName}/api/namespaces`), 'fetchNamespaceInfo'),
	fetchNodeList: call(() => import(`./${variantName}/api/nodes`), 'fetchNodeList'),
	search: call(() => import(`./${variantName}/api/search`), 'search'),
	fetchAccountStats: call(() => import(`./${variantName}/api/stats`), 'fetchAccountStats'),
	fetchTransactionChart: call(() => import(`./${variantName}/api/stats`), 'fetchTransactionChart'),
	fetchTransactionStats: call(() => import(`./${variantName}/api/stats`), 'fetchTransactionStats'),
	fetchBlockStats: call(() => import(`./${variantName}/api/stats`), 'fetchBlockStats'),
	fetchNodeStats: call(() => import(`./${variantName}/api/stats`), 'fetchNodeStats'),
	fetchMarketData: call(() => import(`./${variantName}/api/stats`), 'fetchMarketData'),
	fetchPriceByDate: call(() => import(`./${variantName}/api/stats`), 'fetchPriceByDate'),
	fetchTransactionPage: call(() => import(`./${variantName}/api/transactions`), 'fetchTransactionPage'),
	fetchTransactionInfo: call(() => import(`./${variantName}/api/transactions`), 'fetchTransactionInfo'),
	resolveTransactionBlockSearch: call(() => import(`./${variantName}/api/transactions`), 'resolveTransactionBlockSearch'),
	resolveTransactionMosaicSearch: call(() => import(`./${variantName}/api/transactions`), 'resolveTransactionMosaicSearch'),
	resolveTransactionRecipientSearch: call(() => import(`./${variantName}/api/transactions`), 'resolveTransactionRecipientSearch'),
	resolveTransactionSignerSearch: call(() => import(`./${variantName}/api/transactions`), 'resolveTransactionSignerSearch')
});

const loadNemVariant = () => {
	const { DocumentHead } = require('./nem/DocumentHead');
	const { pageConfig } = require('./nem/config');

	return {
		platform: 'nem',
		api: createApi('nem'),
		DocumentHead,
		pageConfig
	};
};

const loadSymbolVariant = () => {
	const { DocumentHead } = require('./symbol/DocumentHead');
	const { pageConfig } = require('./symbol/config');

	return {
		platform: 'symbol',
		api: createApi('symbol'),
		DocumentHead,
		pageConfig
	};
};

const loadVariant = () => {
	switch (platform) {
	case 'symbol':
		return loadSymbolVariant();
	case 'nem':
	default:
		return loadNemVariant();
	}
};

export const variant = loadVariant();
export const { api } = variant;
export const { DocumentHead } = variant;
export const { pageConfig } = variant;
