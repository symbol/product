describe('variants', () => {
	const originalEnv = process.env;

	afterEach(() => {
		jest.resetModules();
		jest.dontMock('@/variants/symbol/api');
		process.env = originalEnv;
	});

	const loadVariant = platform => {
		jest.resetModules();
		process.env = {
			...originalEnv
		};
		delete process.env.NEXT_PUBLIC_PLATFORM;
		delete process.env.PLATFORM;
		if (platform)
			process.env.NEXT_PUBLIC_PLATFORM = platform;

		return require('@/variants');
	};

	it('requires an explicit supported platform', () => {
		// Act + Assert:
		expect(() => loadVariant()).toThrow('NEXT_PUBLIC_PLATFORM or PLATFORM must be set to either "nem" or "symbol".');
		expect(() => loadVariant('catapult')).toThrow('NEXT_PUBLIC_PLATFORM or PLATFORM must be set to either "nem" or "symbol".');
	});

	it('loads NEM variant when requested', () => {
		// Act:
		const { variant, api, pageConfig, DocumentHead } = loadVariant('nem');
		const nemAPI = require('@/variants/nem/api');
		const { DocumentHead: NemDocumentHead } = require('@/variants/nem/DocumentHead');
		const { pageConfig: nemPageConfig } = require('@/variants/nem/config');

		// Assert:
		expect(variant.platform).toBe('nem');
		expect(api).toBe(nemAPI);
		expect(pageConfig).toBe(nemPageConfig);
		expect(DocumentHead).toBe(NemDocumentHead);
	});

	it('loads Symbol variant when requested', () => {
		// Act:
		const { variant, api, pageConfig, DocumentHead } = loadVariant('symbol');
		const symbolAPI = require('@/variants/symbol/api');
		const { DocumentHead: SymbolDocumentHead } = require('@/variants/symbol/DocumentHead');
		const { pageConfig: symbolPageConfig } = require('@/variants/symbol/config');

		// Assert:
		expect(variant.platform).toBe('symbol');
		expect(api).toBe(symbolAPI);
		expect(pageConfig).toBe(symbolPageConfig);
		expect(DocumentHead).toBe(SymbolDocumentHead);
	});

	it('dispatches API calls through the selected variant module', async () => {
		// Arrange:
		const mockSymbolAPI = {
			fetchBlockPage: jest.fn().mockResolvedValue('block page'),
			fetchChainHeight: jest.fn().mockResolvedValue('chain height'),
			fetchBlockInfo: jest.fn().mockResolvedValue('block info'),
			fetchMosaicPage: jest.fn().mockResolvedValue('mosaic page'),
			fetchNodeList: jest.fn().mockResolvedValue('node list'),
			fetchAccountStats: jest.fn().mockResolvedValue('account stats'),
			fetchTransactionStats: jest.fn().mockResolvedValue('transaction stats'),
			fetchBlockStats: jest.fn().mockResolvedValue('block stats'),
			fetchNodeStats: jest.fn().mockResolvedValue('node stats'),
			fetchMarketData: jest.fn().mockResolvedValue('market data')
		};
		jest.doMock('@/variants/symbol/api', () => mockSymbolAPI);
		const { api } = loadVariant('symbol');

		// Act + Assert:
		await expect(api.fetchChainHeight('height arg')).resolves.toBe('chain height');
		await expect(api.fetchBlockInfo('block arg')).resolves.toBe('block info');
		await expect(api.fetchMosaicPage('mosaic arg')).resolves.toBe('mosaic page');
		await expect(api.fetchNodeList('node arg')).resolves.toBe('node list');
		await expect(api.fetchAccountStats('account stats arg')).resolves.toBe('account stats');
		await expect(api.fetchTransactionStats('transaction stats arg')).resolves.toBe('transaction stats');
		await expect(api.fetchBlockStats('block stats arg')).resolves.toBe('block stats');
		await expect(api.fetchNodeStats('node stats arg')).resolves.toBe('node stats');
		await expect(api.fetchMarketData('market data arg')).resolves.toBe('market data');
		expect(mockSymbolAPI.fetchChainHeight).toHaveBeenCalledWith('height arg');
		expect(mockSymbolAPI.fetchBlockInfo).toHaveBeenCalledWith('block arg');
		expect(mockSymbolAPI.fetchMosaicPage).toHaveBeenCalledWith('mosaic arg');
		expect(mockSymbolAPI.fetchNodeList).toHaveBeenCalledWith('node arg');
		expect(mockSymbolAPI.fetchAccountStats).toHaveBeenCalledWith('account stats arg');
		expect(mockSymbolAPI.fetchTransactionStats).toHaveBeenCalledWith('transaction stats arg');
		expect(mockSymbolAPI.fetchBlockStats).toHaveBeenCalledWith('block stats arg');
		expect(mockSymbolAPI.fetchNodeStats).toHaveBeenCalledWith('node stats arg');
		expect(mockSymbolAPI.fetchMarketData).toHaveBeenCalledWith('market data arg');
	});

	it('keeps Symbol API implementation out of the core structure branch', async () => {
		// Arrange:
		const symbolAPI = require('@/variants/symbol/api');
		const errorMessage = 'Symbol API implementation belongs in the Symbol page/API implementation PR.';

		// Act + Assert:
		await Promise.all(Object.values(symbolAPI).map(apiFunction => expect(apiFunction()).rejects.toThrow(errorMessage)));
	});
});
