import { marketDataResponse } from '../../../../__fixtures__/api/symbol/market-data';
import { marketDataResult } from '../../../../__fixtures__/local/symbol/market-data';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import * as utils from '@/app/utils/server';
import { fetchMarketData, fetchPriceByDate } from '@/app/variants/symbol/api/stats';
import axios from 'axios';
const { execFileSync } = require('child_process');
const path = require('path');

jest.mock('axios');
jest.mock('@/app/utils/server', () => ({ __esModule: true, ...jest.requireActual('@/app/utils/server') }));

describe('Symbol fetchMarketData', () => {
	runApiRequestTests({
		functionToTest: fetchMarketData,
		response: marketDataResponse,
		cases: [{ description: 'requests the Symbol USD endpoint', config: {}, expected: { url: config.PUBLIC_SYMBOL_MARKET_DATA_URL } }]
	});
	runApiResultTests({
		functionToTest: fetchMarketData,
		cases: [{
			description: 'maps five fields preserving precision and a negative percentage',
			config: { response: [{ id: 'nem', symbol: 'xem' }, { id: 'symbol', symbol: 'other' }, ...marketDataResponse] },
			expected: { result: marketDataResult }
		}]
	});

	it('preserves valid zero prices, changes and volume', async () => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue([{
			...marketDataResponse[0], current_price: 0, price_change_percentage_24h: 0, total_volume: 0
		}]);

		// Act:
		const result = await fetchMarketData();

		// Assert:
		expect(result).toStrictEqual({ ...marketDataResult, price: 0, priceChange: 0, volume: 0 });
	});

	it.each([
		['converts null supply and cap to null', null, null, null, null],
		['converts missing supply and cap to null', undefined, undefined, null, null],
		['converts zero supply and cap to null', 0, 0, null, null],
		['preserves positive supply and cap', 123.456, 123.456, 123.456, 123.456],
		['preserves positive cap when only supply is null', null, 789.123, null, 789.123],
		['preserves positive supply when only cap is null', 456.789, null, 456.789, null]
	])('%s', async (name, supply, cap, expectedSupply, expectedCap) => {
		// Arrange:
		const data = { ...marketDataResponse[0], circulating_supply: supply, market_cap: cap };
		if (supply === undefined)
			delete data.circulating_supply;

		if (cap === undefined)
			delete data.market_cap;

		jest.spyOn(utils, 'makeRequest').mockResolvedValue([data]);

		// Act:
		const result = await fetchMarketData();

		// Assert:
		expect(result).toStrictEqual({
			...marketDataResult,
			circulatingSupply: expectedSupply,
			marketCap: expectedCap
		});
	});

	it.each([null, {}, 'invalid', 42])('rejects invalid response %s', async response => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue(response);

		// Act + Assert:
		await expect(fetchMarketData()).rejects.toThrow('Invalid Symbol market data response');
	});

	it.each([
		[], [null], [{ id: 'nem', symbol: 'xem' }], [{ id: 'symbol', symbol: 'XYM' }], [{ id: 'other', symbol: 'xym' }]
	])('rejects responses without the exact target: %j', async (...items) => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue(items);

		// Act + Assert:
		await expect(fetchMarketData()).rejects.toThrow('Symbol market data not found');
	});

	describe.each([
		'current_price', 'price_change_percentage_24h', 'total_volume', 'circulating_supply', 'market_cap'
	])('%s validation', field => {
		it.each(['1.23', NaN, Infinity, -Infinity, true])('rejects invalid number %s', async value => {
			// Arrange:
			jest.spyOn(utils, 'makeRequest').mockResolvedValue([{ ...marketDataResponse[0], [field]: value }]);

			// Act + Assert:
			await expect(fetchMarketData()).rejects.toThrow(`Invalid Symbol market data field: ${field}`);
		});
	});

	it.each(['current_price', 'total_volume', 'circulating_supply', 'market_cap'])('rejects negative %s', async field => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue([{ ...marketDataResponse[0], [field]: -1 }]);

		// Act + Assert:
		await expect(fetchMarketData()).rejects.toThrow(`Invalid Symbol market data field: ${field}`);
	});

	describe.each(['current_price', 'price_change_percentage_24h', 'total_volume'])('%s required', field => {
		it.each([null, undefined])('rejects missing number %s', async value => {
			// Arrange:
			jest.spyOn(utils, 'makeRequest').mockResolvedValue([{ ...marketDataResponse[0], [field]: value }]);

			// Act + Assert:
			await expect(fetchMarketData()).rejects.toThrow(`Invalid Symbol market data field: ${field}`);
		});
	});

	it.each([
		['HTTP 429', { response: { status: 429 } }],
		['HTTP 503', { response: { status: 503 } }],
		['network', new Error('Network Error')],
		['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })]
	])('propagates %s without retry or fallback', async (name, error) => {
		// Arrange: exercise the real makeRequest wrapper at the HTTP boundary.
		axios.mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchMarketData()).rejects.toBe(error);
		expect(axios).toHaveBeenCalledTimes(1);
		expect(axios).toHaveBeenCalledWith({
			method: 'get', url: config.PUBLIC_SYMBOL_MARKET_DATA_URL, data: undefined, timeout: config.PUBLIC_REQUEST_TIMEOUT
		});
	});
});

describe('Symbol fetchPriceByDate', () => {
	const response = {
		id: 'symbol', symbol: 'xym',
		market_data: { current_price: { usd: 0.0025956685909754164, jpy: 0.40968605422230936 } }
	};

	it.each([
		['2026-01-02T00:00:00', '02-01-2026'],
		['2026-01-31T23:59:59', '31-01-2026'],
		['2026-02-01T00:00:00', '01-02-2026'],
		['2026-01-01T00:30:00+09:00', '31-12-2025'],
		['2025-12-31T23:30:00-05:00', '01-01-2026']
	])('requests the local-calendar date for %s', async (timestamp, date) => {
		// Arrange: the shared Jest suite uses UTC.
		const request = jest.spyOn(utils, 'makeRequest').mockResolvedValue(response);

		// Act:
		await fetchPriceByDate(timestamp, 'USD');

		// Assert:
		expect(request).toHaveBeenCalledWith(`https://symbol.history/?date=${date}`);
	});

	it.each([
		['https://symbol.history?localization=false', 'https://symbol.history/?localization=false&date=29-10-2026'],
		['https://symbol.history?localization=false&date=01-01-2020', 'https://symbol.history/?localization=false&date=29-10-2026']
	])('sets the requested date while preserving query parameters in %s', async (configuredUrl, expectedUrl) => {
		// Arrange:
		const originalUrl = config.PUBLIC_SYMBOL_HISTORICAL_PRICE_URL;
		config.PUBLIC_SYMBOL_HISTORICAL_PRICE_URL = configuredUrl;
		const request = jest.spyOn(utils, 'makeRequest').mockResolvedValue(response);

		try {
			// Act:
			await fetchPriceByDate('2026-10-29T12:00:00', 'USD');

			// Assert:
			expect(request).toHaveBeenCalledWith(expectedUrl);
		} finally {
			config.PUBLIC_SYMBOL_HISTORICAL_PRICE_URL = originalUrl;
		}
	});

	it.each([
		['USD', 0.0025956685909754164], ['jPy', 0.40968605422230936], ['UNKNOWN', null]
	])('returns the selected %s price without changing precision', async (currency, expected) => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue(response);

		// Act:
		const result = await fetchPriceByDate('2026-10-29', currency);

		// Assert:
		expect(result).toBe(expected);
	});

	it.each([
		['returns null for a zero price', 0],
		['returns null for a null price', null],
		['returns null for a missing price', undefined]
	])('%s', async (name, price) => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue({ ...response, market_data: { current_price: { usd: price } } });

		// Act:
		const result = await fetchPriceByDate('2026-10-29', 'USD');

		// Assert:
		expect(result).toBeNull();
	});

	it('returns unavailable when the daily market data is absent', async () => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue({ id: 'symbol', symbol: 'xym' });

		// Act + Assert:
		await expect(fetchPriceByDate('2026-10-29', 'USD')).resolves.toBeNull();
	});

	it.each([
		null, [], {}, { id: 'nem', symbol: 'xem' },
		{ id: 'symbol', symbol: 'xym', market_data: 'invalid' },
		{ id: 'symbol', symbol: 'xym', market_data: { current_price: [] } }
	])('rejects invalid history response %j', async data => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue(data);

		// Act + Assert:
		await expect(fetchPriceByDate('2026-10-29', 'USD')).rejects.toThrow('Invalid Symbol historical price response');
	});

	it.each(['0.1', true, -1, NaN, Infinity])('rejects invalid history price %s', async price => {
		// Arrange:
		jest.spyOn(utils, 'makeRequest').mockResolvedValue({ ...response, market_data: { current_price: { usd: price } } });

		// Act + Assert:
		await expect(fetchPriceByDate('2026-10-29', 'USD')).rejects.toThrow('Invalid Symbol historical price');
	});

	it.each([
		['401', { response: { status: 401 } }], ['429', { response: { status: 429 } }],
		['503', { response: { status: 503 } }], ['network', new Error('Network Error')],
		['timeout', Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })]
	])('propagates %s without fallback or retry', async (name, error) => {
		// Arrange:
		axios.mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchPriceByDate('2026-10-29', 'USD')).rejects.toBe(error);
		expect(axios).toHaveBeenCalledTimes(1);
	});
});

// A child Jest run uses the existing transforms/mocks, but applies TZ after loading the UTC-pinned config.
if (process.env.SYMBOL_HISTORY_TEST_TZ) {
	it('uses the requested timezone for the history year boundary', async () => {
		// Arrange:
		const expectations = {
			UTC: { offset: 0, url: 'https://symbol.history/?date=31-12-2025' },
			'Asia/Tokyo': { offset: -540, url: 'https://symbol.history/?date=01-01-2026' }
		};
		const timezone = process.env.SYMBOL_HISTORY_TEST_TZ;
		const expected = expectations[timezone];
		const request = jest.spyOn(utils, 'makeRequest').mockResolvedValue({
			id: 'symbol', symbol: 'xym', market_data: { current_price: { usd: 2 } }
		});

		// Sanity check: verify the effective timezone, not just the environment variable.
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timezone);
		expect(new Date('2026-01-01T00:30:00+09:00').getTimezoneOffset()).toBe(expected.offset);

		// Act:
		await fetchPriceByDate('2026-01-01T00:30:00+09:00', 'USD');

		// Assert:
		expect(request).toHaveBeenCalledWith(expected.url);
	});
} else {
	it.each(['UTC', 'Asia/Tokyo'])('verifies the history year boundary in a real %s process', timezone => {
		// Arrange:
		const root = path.resolve(__dirname, '../../../..');
		const script = `
			(async () => {
				const config = await require('./jest.config.js')();
				config.modulePathIgnorePatterns = [...(config.modulePathIgnorePatterns || []), '<rootDir>/.next/'];
				process.env.TZ = process.env.SYMBOL_HISTORY_TEST_TZ;
				const { results } = await require('jest').runCLI({
					config: JSON.stringify(config), runInBand: true, watch: false, watchman: false,
					runTestsByPath: true, _: [process.env.SYMBOL_HISTORY_TEST_FILE],
					testNamePattern: '^uses the requested timezone for the history year boundary$'
				}, [process.cwd()]);
				if (!results.success) process.exit(1);
				process.stdout.write(JSON.stringify({ passed: results.numPassedTests }));
			})().catch(error => { console.error(error); process.exit(1); });
		`;

		// Act:
		const output = execFileSync(process.execPath, ['-e', script], {
			cwd: root,
			env: { ...process.env, SYMBOL_HISTORY_TEST_TZ: timezone, SYMBOL_HISTORY_TEST_FILE: __filename },
			encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000
		});

		// Assert: a passing child must actually execute the boundary test.
		expect(JSON.parse(output)).toStrictEqual({ passed: 1 });
	}, 25000);
}
