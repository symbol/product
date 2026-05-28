const platform = process.env.NEXT_PUBLIC_PLATFORM || 'nem';

const call = (loadModule, exportName) => async (...args) => {
	const apiModule = await loadModule();

	return apiModule[exportName](...args);
};

const createNemApi = () => ({
	fetchAccountPage: call(() => import('./nem/api/accounts'), 'fetchAccountPage'),
	fetchAccountInfo: call(() => import('./nem/api/accounts'), 'fetchAccountInfo'),
	fetchAccountInfoByPublicKey: call(() => import('./nem/api/accounts'), 'fetchAccountInfoByPublicKey'),
	fetchBlockPage: call(() => import('./nem/api/blocks'), 'fetchBlockPage'),
	fetchChainHight: call(() => import('./nem/api/blocks'), 'fetchChainHight'),
	fetchBlockInfo: call(() => import('./nem/api/blocks'), 'fetchBlockInfo'),
	fetchBlockReceiptPage: call(() => import('./nem/api/blockReceipts'), 'fetchBlockReceiptPage'),
	fetchMosaicMetadataPage: call(() => import('./nem/api/mosaicMetadata'), 'fetchMosaicMetadataPage'),
	fetchMosaicPage: call(() => import('./nem/api/mosaics'), 'fetchMosaicPage'),
	fetchMosaicInfo: call(() => import('./nem/api/mosaics'), 'fetchMosaicInfo'),
	fetchMosaicArtifactExpiryReceiptPage: call(() => import('./nem/api/mosaicReceipts'), 'fetchMosaicArtifactExpiryReceiptPage'),
	fetchMosaicReceiptPage: call(() => import('./nem/api/mosaicReceipts'), 'fetchMosaicReceiptPage'),
	fetchMosaicRestrictionPage: call(() => import('./nem/api/mosaicRestrictions'), 'fetchMosaicRestrictionPage'),
	fetchNamespacePage: call(() => import('./nem/api/namespaces'), 'fetchNamespacePage'),
	fetchNamespaceInfo: call(() => import('./nem/api/namespaces'), 'fetchNamespaceInfo'),
	fetchNamespaceMetadataPage: call(() => import('./nem/api/namespaces'), 'fetchNamespaceMetadataPage'),
	fetchNamespaceReceiptPage: call(() => import('./nem/api/namespaces'), 'fetchNamespaceReceiptPage'),
	fetchNodeList: call(() => import('./nem/api/nodes'), 'fetchNodeList'),
	search: call(() => import('./nem/api/search'), 'search'),
	fetchAccountStats: call(() => import('./nem/api/stats'), 'fetchAccountStats'),
	fetchTransactionChart: call(() => import('./nem/api/stats'), 'fetchTransactionChart'),
	fetchTransactionStats: call(() => import('./nem/api/stats'), 'fetchTransactionStats'),
	fetchBlockStats: call(() => import('./nem/api/stats'), 'fetchBlockStats'),
	fetchNodeStats: call(() => import('./nem/api/stats'), 'fetchNodeStats'),
	fetchMarketData: call(() => import('./nem/api/stats'), 'fetchMarketData'),
	fetchPriceByDate: call(() => import('./nem/api/stats'), 'fetchPriceByDate'),
	fetchTransactionPage: call(() => import('./nem/api/transactions'), 'fetchTransactionPage'),
	fetchTransactionInfo: call(() => import('./nem/api/transactions'), 'fetchTransactionInfo'),
	resolveTransactionBlockSearch: call(() => import('./nem/api/transactions'), 'resolveTransactionBlockSearch'),
	resolveTransactionMosaicSearch: call(() => import('./nem/api/transactions'), 'resolveTransactionMosaicSearch'),
	resolveTransactionRecipientSearch: call(() => import('./nem/api/transactions'), 'resolveTransactionRecipientSearch'),
	resolveTransactionSignerSearch: call(() => import('./nem/api/transactions'), 'resolveTransactionSignerSearch')
});

const createSymbolApi = () => ({
	fetchAccountPage: call(() => import('./symbol/api/accounts'), 'fetchAccountPage'),
	fetchAccountInfo: call(() => import('./symbol/api/accounts'), 'fetchAccountInfo'),
	fetchAccountInfoByPublicKey: call(() => import('./symbol/api/accounts'), 'fetchAccountInfoByPublicKey'),
	fetchBlockPage: call(() => import('./symbol/api/blocks'), 'fetchBlockPage'),
	fetchChainHight: call(() => import('./symbol/api/blocks'), 'fetchChainHight'),
	fetchBlockInfo: call(() => import('./symbol/api/blocks'), 'fetchBlockInfo'),
	fetchBlockReceiptPage: call(() => import('./symbol/api/blockReceipts'), 'fetchBlockReceiptPage'),
	fetchFinalizationInfo: call(() => import('./symbol/api/finalization'), 'fetchFinalizationInfo'),
	fetchMosaicMetadataPage: call(() => import('./symbol/api/mosaicMetadata'), 'fetchMosaicMetadataPage'),
	fetchMosaicPage: call(() => import('./symbol/api/mosaics'), 'fetchMosaicPage'),
	fetchMosaicInfo: call(() => import('./symbol/api/mosaics'), 'fetchMosaicInfo'),
	fetchMosaicArtifactExpiryReceiptPage: call(() => import('./symbol/api/mosaicReceipts'), 'fetchMosaicArtifactExpiryReceiptPage'),
	fetchMosaicReceiptPage: call(() => import('./symbol/api/mosaicReceipts'), 'fetchMosaicReceiptPage'),
	fetchMosaicRestrictionPage: call(() => import('./symbol/api/mosaicRestrictions'), 'fetchMosaicRestrictionPage'),
	fetchNamespacePage: call(() => import('./symbol/api/namespaces'), 'fetchNamespacePage'),
	fetchNamespaceInfo: call(() => import('./symbol/api/namespaces'), 'fetchNamespaceInfo'),
	fetchNamespaceMetadataPage: call(() => import('./symbol/api/namespaces'), 'fetchNamespaceMetadataPage'),
	fetchNamespaceReceiptPage: call(() => import('./symbol/api/namespaces'), 'fetchNamespaceReceiptPage'),
	fetchNodeList: call(() => import('./symbol/api/nodes'), 'fetchNodeList'),
	search: call(() => import('./symbol/api/search'), 'search'),
	fetchAccountStats: call(() => import('./symbol/api/stats'), 'fetchAccountStats'),
	fetchTransactionChart: call(() => import('./symbol/api/stats'), 'fetchTransactionChart'),
	fetchTransactionStats: call(() => import('./symbol/api/stats'), 'fetchTransactionStats'),
	fetchBlockStats: call(() => import('./symbol/api/stats'), 'fetchBlockStats'),
	fetchNodeStats: call(() => import('./symbol/api/stats'), 'fetchNodeStats'),
	fetchMarketData: call(() => import('./symbol/api/stats'), 'fetchMarketData'),
	fetchPriceByDate: call(() => import('./symbol/api/stats'), 'fetchPriceByDate'),
	fetchTransactionPage: call(() => import('./symbol/api/transactions'), 'fetchTransactionPage'),
	fetchTransactionInfo: call(() => import('./symbol/api/transactions'), 'fetchTransactionInfo'),
	resolveTransactionBlockSearch: call(() => import('./symbol/api/transactions'), 'resolveTransactionBlockSearch'),
	resolveTransactionMosaicSearch: call(() => import('./symbol/api/transactions'), 'resolveTransactionMosaicSearch'),
	resolveTransactionRecipientSearch: call(() => import('./symbol/api/transactions'), 'resolveTransactionRecipientSearch'),
	resolveTransactionSignerSearch: call(() => import('./symbol/api/transactions'), 'resolveTransactionSignerSearch')
});

const loadNemVariant = () => {
	const { DocumentHead } = require('./nem/DocumentHead');
	const { pageConfig } = require('./nem/config');

	return {
		api: createNemApi(),
		DocumentHead,
		pageConfig
	};
};

const loadSymbolVariant = () => {
	const { DocumentHead } = require('./symbol/DocumentHead');
	const { pageConfig } = require('./symbol/config');

	return {
		api: createSymbolApi(),
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
