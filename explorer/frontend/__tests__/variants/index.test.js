describe('variants', () => {
	const originalPlatform = process.env.NEXT_PUBLIC_PLATFORM;

	afterEach(() => {
		jest.resetModules();
		process.env.NEXT_PUBLIC_PLATFORM = originalPlatform;
	});

	const loadVariant = platform => {
		jest.resetModules();
		if (platform)
			process.env.NEXT_PUBLIC_PLATFORM = platform;
		else
			delete process.env.NEXT_PUBLIC_PLATFORM;

		return require('@/variants');
	};

	it('loads NEM variant by default', () => {
		// Act:
		const { variant, api, pageConfig, DocumentHead } = loadVariant();

		// Assert:
		expect(variant.platform).toBe('nem');
		expect(api.fetchBlockPage).toEqual(expect.any(Function));
		expect(pageConfig.home.showSupernodeCount).toBe(true);
		expect(DocumentHead).toEqual(expect.any(Function));
	});

	it('loads Symbol variant when requested', () => {
		// Act:
		const { variant, api, pageConfig, DocumentHead } = loadVariant('symbol');

		// Assert:
		expect(variant.platform).toBe('symbol');
		expect(api.fetchBlockPage).toEqual(expect.any(Function));
		expect(pageConfig.home.showSupernodeCount).toBe(false);
		expect(DocumentHead).toEqual(expect.any(Function));
	});

	it('dispatches lazy API calls through the selected variant modules', async () => {
		// Arrange:
		const mockApiModules = {
			blocks: {
				fetchBlockPage: jest.fn().mockResolvedValue('block page'),
				fetchChainHight: jest.fn().mockResolvedValue('chain height'),
				fetchBlockInfo: jest.fn().mockResolvedValue('block info')
			},
			mosaics: {
				fetchMosaicPage: jest.fn().mockResolvedValue('mosaic page')
			},
			nodes: {
				fetchNodeList: jest.fn().mockResolvedValue('node list')
			},
			stats: {
				fetchAccountStats: jest.fn().mockResolvedValue('account stats'),
				fetchTransactionStats: jest.fn().mockResolvedValue('transaction stats'),
				fetchBlockStats: jest.fn().mockResolvedValue('block stats'),
				fetchNodeStats: jest.fn().mockResolvedValue('node stats'),
				fetchMarketData: jest.fn().mockResolvedValue('market data')
			}
		};
		jest.doMock('@/variants/symbol/api/blocks', () => mockApiModules.blocks);
		jest.doMock('@/variants/symbol/api/mosaics', () => mockApiModules.mosaics);
		jest.doMock('@/variants/symbol/api/nodes', () => mockApiModules.nodes);
		jest.doMock('@/variants/symbol/api/stats', () => mockApiModules.stats);
		const { api } = loadVariant('symbol');

		// Act + Assert:
		await expect(api.fetchChainHight('height arg')).resolves.toBe('chain height');
		await expect(api.fetchBlockInfo('block arg')).resolves.toBe('block info');
		await expect(api.fetchMosaicPage('mosaic arg')).resolves.toBe('mosaic page');
		await expect(api.fetchNodeList('node arg')).resolves.toBe('node list');
		await expect(api.fetchAccountStats('account stats arg')).resolves.toBe('account stats');
		await expect(api.fetchTransactionStats('transaction stats arg')).resolves.toBe('transaction stats');
		await expect(api.fetchBlockStats('block stats arg')).resolves.toBe('block stats');
		await expect(api.fetchNodeStats('node stats arg')).resolves.toBe('node stats');
		await expect(api.fetchMarketData('market data arg')).resolves.toBe('market data');
		expect(mockApiModules.blocks.fetchChainHight).toHaveBeenCalledWith('height arg');
		expect(mockApiModules.blocks.fetchBlockInfo).toHaveBeenCalledWith('block arg');
		expect(mockApiModules.mosaics.fetchMosaicPage).toHaveBeenCalledWith('mosaic arg');
		expect(mockApiModules.nodes.fetchNodeList).toHaveBeenCalledWith('node arg');
		expect(mockApiModules.stats.fetchAccountStats).toHaveBeenCalledWith('account stats arg');
		expect(mockApiModules.stats.fetchTransactionStats).toHaveBeenCalledWith('transaction stats arg');
		expect(mockApiModules.stats.fetchBlockStats).toHaveBeenCalledWith('block stats arg');
		expect(mockApiModules.stats.fetchNodeStats).toHaveBeenCalledWith('node stats arg');
		expect(mockApiModules.stats.fetchMarketData).toHaveBeenCalledWith('market data arg');
	});
});
