import { MarketModule } from '../../src/lib/modules/MarketModule';
import { createStorageMock } from '../test-utils/storage';
import { jest } from '@jest/globals';

describe('MarketModule', () => {
	let persistentStorageInterface;
	let marketModule;
	let onStateChange;
	let api;

	const mockPrices = {
		USD: 1.2,
		EUR: 1.0,
		JPY: 130
	};

	beforeEach(() => {
		persistentStorageInterface = createStorageMock({});
		api = {
			market: {
				fetchPrices: jest.fn().mockResolvedValue(mockPrices)
			}
		};
		onStateChange = jest.fn();

		marketModule = new MarketModule({
			persistentStorageInterface,
			api,
			onStateChange
		});

		// Mock repository methods
		marketModule._persistentStorageRepository.getUserCurrency = jest.fn();
		marketModule._persistentStorageRepository.setUserCurrency = jest.fn();

		// Mock Date.now() for predictable timestamps
		jest.spyOn(Date, 'now').mockReturnValue(1000000);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(MarketModule.name).toBe('market');
	});

	describe('initial state', () => {
		it('starts with default state', () => {
			// Assert:
			expect(marketModule._state.userCurrency).toBeNull();
			expect(marketModule._state.marketData.fetchedAt).toBe(0);
			expect(marketModule._state.marketData.prices).toEqual({});
		});

		it('price getter returns undefined value and null currency initially', () => {
			// Assert:
			expect(marketModule.price).toEqual({
				value: undefined,
				currency: null
			});
		});
	});

	describe('loadCache()', () => {
		it('loads user currency from persistent storage', async () => {
			// Arrange:
			marketModule._persistentStorageRepository.getUserCurrency.mockResolvedValue('EUR');

			// Act:
			await marketModule.loadCache();

			// Assert:
			expect(marketModule._persistentStorageRepository.getUserCurrency).toHaveBeenCalled();
			expect(marketModule._state.userCurrency).toBe('EUR');
			expect(onStateChange).toHaveBeenCalled();
		});

		it('falls back to default currency if none is stored', async () => {
			// Arrange:
			marketModule._persistentStorageRepository.getUserCurrency.mockResolvedValue(null);

			// Act:
			await marketModule.loadCache();

			// Assert:
			expect(marketModule._state.userCurrency).toBe('USD');
		});
	});

	describe('clear()', () => {
		it('resets state to default', async () => {
			// Arrange:
			await marketModule.selectUserCurrency('JPY');
			await marketModule.fetchData();
			expect(marketModule._state.userCurrency).toBe('JPY');
			expect(marketModule._state.marketData.fetchedAt).not.toBe(0);

			// Act:
			marketModule.clear();

			// Assert:
			expect(marketModule._state.userCurrency).toBeNull();
			expect(marketModule._state.marketData.fetchedAt).toBe(0);
			expect(marketModule._state.marketData.prices).toEqual({});
			expect(onStateChange).toHaveBeenCalledTimes(2);
		});
	});

	describe('selectUserCurrency()', () => {
		it('sets the user currency and persists it', async () => {
			// Act:
			await marketModule.selectUserCurrency('JPY');

			// Assert:
			expect(marketModule._persistentStorageRepository.setUserCurrency).toHaveBeenCalledWith('JPY');
			expect(marketModule._state.userCurrency).toBe('JPY');
			expect(onStateChange).toHaveBeenCalled();
		});
	});

	describe('fetchData()', () => {
		it('fetches market data from the API', async () => {
			// Act:
			await marketModule.fetchData();

			// Assert:
			expect(api.market.fetchPrices).toHaveBeenCalled();
			expect(marketModule._state.marketData.fetchedAt).toBe(1000000);
			expect(marketModule._state.marketData.prices).toEqual(mockPrices);
			expect(onStateChange).toHaveBeenCalled();
		});

		it('does not fetch if data is not outdated', async () => {
			// Arrange:
			await marketModule.fetchData(); // First fetch
			api.market.fetchPrices.mockClear();
			onStateChange.mockClear();

			// Act:
			await marketModule.fetchData(); // Second fetch attempt

			// Assert:
			expect(api.market.fetchPrices).not.toHaveBeenCalled();
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it('fetches new data if existing data is outdated', async () => {
			// Arrange:
			await marketModule.fetchData(); // First fetch at 1_000_000
			api.market.fetchPrices.mockClear();
			onStateChange.mockClear();
			jest.spyOn(Date, 'now').mockReturnValue(1000000 + 60001); // Advance time past interval

			// Act:
			await marketModule.fetchData(); // Second fetch

			// Assert:
			expect(api.market.fetchPrices).toHaveBeenCalled();
			expect(marketModule._state.marketData.fetchedAt).toBe(1060001);
			expect(onStateChange).toHaveBeenCalled();
		});
	});

	describe('price getter', () => {
		it('returns the correct price based on user currency', async () => {
			// Arrange:
			await marketModule.selectUserCurrency('EUR');
			await marketModule.fetchData();

			// Assert:
			expect(marketModule.price).toEqual({
				value: 1.0,
				currency: 'EUR'
			});

			// Arrange 2:
			await marketModule.selectUserCurrency('USD');

			// Assert 2:
			expect(marketModule.price).toEqual({
				value: 1.2,
				currency: 'USD'
			});
		});

		it('returns undefined value if price for user currency is not available', async () => {
			// Arrange:
			await marketModule.selectUserCurrency('CAD'); // CAD is not in mockPrices
			await marketModule.fetchData();

			// Assert:
			expect(marketModule.price).toEqual({
				value: undefined,
				currency: 'CAD'
			});
		});
	});
});
