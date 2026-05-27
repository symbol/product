describe('config', () => {
	const originalEnv = process.env;

	afterEach(() => {
		jest.resetModules();
		process.env = originalEnv;
	});

	const loadPublicConfig = env => {
		jest.resetModules();
		process.env = {
			...originalEnv,
			...env
		};
		Object.keys(process.env)
			.filter(key => key.startsWith('NEXT_PUBLIC_') && !(key in env))
			.forEach(key => delete process.env[key]);

		return require('@/config').createPublicAppConfig();
	};

	it('uses legacy environment variable names', () => {
		// Act:
		const config = loadPublicConfig({
			PLATFORM: 'nem',
			NATIVE_MOSAIC_ID: 'nem.xem',
			NATIVE_MOSAIC_TICKER: 'XEM',
			NATIVE_MOSAIC_DIVISIBILITY: '6',
			API_BASE_URL: 'https://legacy.backend'
		});

		// Assert:
		expect(config.PLATFORM).toBe('nem');
		expect(config.NATIVE_MOSAIC_ID).toBe('nem.xem');
		expect(config.NATIVE_MOSAIC_TICKER).toBe('XEM');
		expect(config.NATIVE_MOSAIC_DIVISIBILITY).toBe(6);
		expect(config.API_BASE_URL).toBe('https://legacy.backend');
	});

	it('prefers NEXT_PUBLIC environment variable names', () => {
		// Act:
		const config = loadPublicConfig({
			PLATFORM: 'symbol',
			NATIVE_MOSAIC_ID: 'symbol.xym',
			NEXT_PUBLIC_PLATFORM: 'symbol',
			NEXT_PUBLIC_NATIVE_MOSAIC_ID: '72C0212E67A08BCE',
			NEXT_PUBLIC_NATIVE_MOSAIC_TICKER: 'XYM',
			NEXT_PUBLIC_NATIVE_MOSAIC_DIVISIBILITY: '6',
			NEXT_PUBLIC_API_BASE_URL: 'https://symbol.backend',
			NEXT_PUBLIC_SYMBOL_NODE_URL: 'https://symbol.node'
		});

		// Assert:
		expect(config.PLATFORM).toBe('symbol');
		expect(config.NATIVE_MOSAIC_ID).toBe('72C0212E67A08BCE');
		expect(config.NATIVE_MOSAIC_TICKER).toBe('XYM');
		expect(config.NATIVE_MOSAIC_DIVISIBILITY).toBe(6);
		expect(config.API_BASE_URL).toBe('https://symbol.backend');
		expect(config.SYMBOL_NODE_URL).toBe('https://symbol.node');
	});

	it('uses Next app config on client before the inline appConfig script executes', () => {
		// Arrange:
		const originalAppConfig = window.appConfig;
		const originalNextData = window['__NEXT_DATA__'];
		delete window.appConfig;
		window['__NEXT_DATA__'] = {
			props: {
				appConfig: {
					PLATFORM: 'nem',
					SOCIAL_URL_GITHUB: 'https://github.com/symbol'
				}
			}
		};
		jest.resetModules();

		// Act:
		const config = require('@/config').default;

		// Assert:
		expect(config.SOCIAL_URL_GITHUB).toBe('https://github.com/symbol');

		// Cleanup:
		window.appConfig = originalAppConfig;
		window['__NEXT_DATA__'] = originalNextData;
	});

	it('escapes app config before injecting it into the inline bootstrap script', () => {
		// Arrange:
		const { serializeAppConfig } = require('@/config');

		// Act:
		const serializedConfig = serializeAppConfig({
			SOCIAL_URL_GITHUB: '</script><script>alert(1)</script>'
		});

		// Assert:
		expect(serializedConfig).toBe('{"SOCIAL_URL_GITHUB":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}');
		expect(serializedConfig).not.toContain('</script>');
	});
});
