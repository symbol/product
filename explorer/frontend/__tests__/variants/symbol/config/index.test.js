const { execFileSync } = require('child_process');
const path = require('path');

const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=symbol';
const configPath = path.resolve(__dirname, '../../../../variants/symbol/config/index.js');
const historyUrl = 'https://api.coingecko.com/api/v3/coins/symbol/history';
const loadServerConfig = (value, name = 'PUBLIC_SYMBOL_MARKET_DATA_URL') => {
	const env = { ...process.env, PUBLIC_SYMBOL_MARKET_DATA_URL: url, PUBLIC_SYMBOL_HISTORICAL_PRICE_URL: historyUrl };
	delete env[name];
	if (value !== undefined)
		env[name] = value;

	return execFileSync(process.execPath, ['--input-type=module', '-e',
		`import config from ${JSON.stringify(configPath)}; process.stdout.write(JSON.stringify(config));`
	], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
};

describe('Symbol market configuration', () => {
	it('loads the canonical URL on the server', () => {
		expect(JSON.parse(loadServerConfig(url))).toStrictEqual({
			PUBLIC_SYMBOL_MARKET_DATA_URL: url, PUBLIC_SYMBOL_HISTORICAL_PRICE_URL: historyUrl
		});
	});

	it.each([undefined, '', 'not-a-url', '/relative', 'ftp://example.com'])('rejects missing or invalid URL %s at load', value => {
		expect(() => loadServerConfig(value)).toThrow('PUBLIC_SYMBOL_MARKET_DATA_URL must be a valid HTTP(S) URL');
	});

	it.each([undefined, '', 'not-a-url', 'ftp://example.com'])('rejects invalid browser runtime URL %s', value => {
		// Arrange:
		const originalConfig = window.appConfig;
		window.appConfig = { ...originalConfig, PUBLIC_SYMBOL_MARKET_DATA_URL: value };

		try {
			// Act + Assert:
			jest.isolateModules(() => {
				expect(() => require('@/app/variants/symbol/config')).toThrow('PUBLIC_SYMBOL_MARKET_DATA_URL must be a valid HTTP(S) URL');
			});
		} finally {
			window.appConfig = originalConfig;
		}
	});

	it('passes the Symbol URL into public runtime configuration', () => {
		// Act:
		const { publicAppConfig } = require('@/app/config');

		// Assert:
		expect(publicAppConfig.PUBLIC_SYMBOL_MARKET_DATA_URL).toBe('https://symbol.market.data?vs_currency=usd&ids=symbol');
	});
});

describe('Symbol historical price configuration', () => {
	it.each([undefined, '', '/relative', 'ftp://example.com'])('rejects missing or invalid history URL %s', value => {
		expect(() => loadServerConfig(value, 'PUBLIC_SYMBOL_HISTORICAL_PRICE_URL'))
			.toThrow('PUBLIC_SYMBOL_HISTORICAL_PRICE_URL must be a valid HTTP(S) URL');
	});

	it('exposes the history URL through public runtime configuration', () => {
		// Act:
		const { publicAppConfig } = require('@/app/config');

		// Assert:
		expect(publicAppConfig.PUBLIC_SYMBOL_HISTORICAL_PRICE_URL).toBe('https://symbol.history');
	});
});
