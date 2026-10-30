import { marketDataResponse } from '../../../../__fixtures__/api/symbol/market-data';
import { marketDataResult } from '../../../../__fixtures__/local/symbol/market-data';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import * as utils from '@/app/utils/server';
import { fetchMarketData } from '@/app/variants/symbol/api/stats';
import axios from 'axios';

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
