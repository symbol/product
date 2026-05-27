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
});
