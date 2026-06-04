const { spawnSync } = require('child_process');
const path = require('path');

jest.mock('@next/env', () => ({
	loadEnvConfig: jest.fn()
}));

describe('next.config', () => {
	const originalEnv = process.env;

	afterEach(() => {
		jest.resetModules();
		process.env = originalEnv;
	});

	const loadNextConfig = env => {
		jest.resetModules();
		process.env = {
			...originalEnv,
			...env
		};

		return require('../next.config');
	};

	it('aliases browser-safe stubs for client webpack builds', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });
		const webpackConfig = {
			resolve: {
				alias: {}
			}
		};

		// Act:
		const result = nextConfig.webpack(webpackConfig, { isServer: false });

		// Assert:
		expect(result).toBe(webpackConfig);
		expect(result.resolve.alias['symbol-crypto-wasm-node']).toContain('utils/symbol-wasm-stub.js');
		expect(result.resolve.alias['bitcore-mnemonic']).toContain('utils/bitcore-mnemonic-stub.js');
	});

	it('aliases only the shared mnemonic stub for server webpack builds', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });
		const webpackConfig = {
			resolve: {
				alias: {}
			}
		};

		// Act:
		const result = nextConfig.webpack(webpackConfig, { isServer: true });

		// Assert:
		expect(result.resolve.alias['symbol-crypto-wasm-node']).toBeUndefined();
		expect(result.resolve.alias['bitcore-mnemonic']).toContain('utils/bitcore-mnemonic-stub.js');
	});

	it('injects the selected variant variables into shared SCSS files', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });

		// Act:
		const result = nextConfig.sassOptions.additionalData('$color: red;', {
			resourcePath: '/workspace/styles/globals.scss'
		});

		// Assert:
		expect(result).toBe('@import "variants/symbol/styles/variables.scss";\n$color: red;');
	});

	it('does not inject variant variables into variable or variant SCSS files', () => {
		// Arrange:
		const nextConfig = loadNextConfig({ NEXT_PUBLIC_PLATFORM: 'symbol' });

		// Act + Assert:
		expect(nextConfig.sassOptions.additionalData('$color: red;', {
			resourcePath: '/workspace/styles/variables.scss'
		})).toBe('$color: red;');
		expect(nextConfig.sassOptions.additionalData('$color: red;', {
			resourcePath: 'C:\\workspace\\variants\\symbol\\styles\\variables.scss'
		})).toBe('$color: red;');
	});

	it('executes Next config callbacks in a native Node process', () => {
		// Arrange:
		const script = `
			const nextConfig = require('./next.config');
			const clientConfig = { resolve: { alias: {} } };
			const serverConfig = { resolve: { alias: {} } };
			nextConfig.webpack(clientConfig, { isServer: false });
			nextConfig.webpack(serverConfig, { isServer: true });
			const injected = nextConfig.sassOptions.additionalData('$color: red;', {
				resourcePath: '/workspace/styles/globals.scss'
			});
			const skipped = nextConfig.sassOptions.additionalData('$color: red;', {
				resourcePath: 'C:\\\\workspace\\\\variants\\\\symbol\\\\styles\\\\variables.scss'
			});
			if (!clientConfig.resolve.alias['symbol-crypto-wasm-node'])
				throw new Error('client alias was not configured');
			if (serverConfig.resolve.alias['symbol-crypto-wasm-node'])
				throw new Error('server alias was configured');
			if (!injected.includes('variants/symbol/styles/variables.scss'))
				throw new Error('variant variables were not injected');
			if ('$color: red;' !== skipped)
				throw new Error('variant variables were injected into a variant file');
		`;

		// Act:
		const result = spawnSync(process.execPath, ['-e', script], {
			cwd: path.resolve(__dirname, '..'),
			encoding: 'utf8',
			env: {
				...process.env,
				NEXT_PUBLIC_PLATFORM: 'symbol'
			}
		});

		// Assert:
		expect(result.stderr).toBe('');
		expect(result.status).toBe(0);
	});
});
