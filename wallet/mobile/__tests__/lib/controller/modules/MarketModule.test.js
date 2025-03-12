import { MarketModule } from '@/app/lib/controller/modules/MarketModule';
import { MarketService } from '@/app/lib/services';
import { config } from '@/app/config';

jest.mock('@/app/lib/services', () => ({
    MarketService: {
        fetchPrices: jest.fn(),
    },
}));

describe('MarketModule', () => {
    let marketModule, mockRoot;

    beforeEach(() => {
        mockRoot = {
            _persistentStorage: {
                getUserCurrency: jest.fn(),
                setUserCurrency: jest.fn(),
            },
        };
        marketModule = new MarketModule({ root: mockRoot, isObservable: false });
    });

    describe('loadCache', () => {
        it('loads user currency from persistent storage', async () => {
            // Arrange:
            const expectedCurrency = 'USD';
            mockRoot._persistentStorage.getUserCurrency.mockResolvedValue(expectedCurrency);

            // Act:
            await marketModule.loadCache();

            // Assert:
            expect(marketModule._state.userCurrency).toBe(expectedCurrency);
        });
    });

    describe('selectUserCurrency', () => {
        it('updates user currency in state and persistent storage', async () => {
            // Arrange:
            const newCurrency = 'EUR';

            // Act:
            await marketModule.selectUserCurrency(newCurrency);

            // Assert:
            expect(mockRoot._persistentStorage.setUserCurrency).toHaveBeenCalledWith(newCurrency);
            expect(marketModule._state.userCurrency).toBe(newCurrency);
        });
    });

    describe('fetchData', () => {
        const runFetchDataTest = async (marketData, currentTimestamp, expectedResult, shouldFetchCalled) => {
            // Arrange:
            marketModule._state.marketData = marketData;
            Date.now = jest.fn(() => currentTimestamp);
            MarketService.fetchPrices.mockResolvedValue({ USD: 0.5 });

            // Act:
            await marketModule.fetchData();

            // Assert:
            if (shouldFetchCalled) {
                expect(MarketService.fetchPrices).toHaveBeenCalled();
                expect(marketModule._state.marketData).toEqual(expectedResult);
            } else {
                expect(MarketService.fetchPrices).not.toHaveBeenCalled();
                expect(marketModule._state.marketData).toEqual(marketData);
            }
        };

        it('fetches new market data when outdated', async () => {
            // Arrange:
            const oldTimestamp = Date.now() - config.allowedMarkedDataCallInterval - 1;
            const marketData = { fetchedAt: oldTimestamp, prices: { USD: 0.3 } };
            const currentTimestamp = Date.now();
            const expectedMarketData = { fetchedAt: currentTimestamp, prices: { USD: 0.5 } };
            const shouldFetchCalled = true;

            // Act & Assert:
            await runFetchDataTest(marketData, currentTimestamp, expectedMarketData, shouldFetchCalled);
        });

        it('does not fetch market data when up-to-date', async () => {
            // Arrange:
            const recentTimestamp = Date.now() - config.allowedMarkedDataCallInterval + 1;
            const marketData = { fetchedAt: recentTimestamp, prices: { USD: 0.3 } };
            const currentTimestamp = Date.now();
            const expectedMarketData = { fetchedAt: recentTimestamp, prices: { USD: 0.3 } };
            const shouldFetchCalled = false;

            // Act & Assert:
            await runFetchDataTest(marketData, currentTimestamp, expectedMarketData, shouldFetchCalled);
        });
    });

    describe('price getter', () => {
        it('returns the correct price for the selected user currency', () => {
            // Arrange:
            marketModule._state.userCurrency = 'USD';
            marketModule._state.marketData.prices = { USD: 0.5, EUR: 0.6, UAH: 15 };
            const expectedPrice = { value: 0.5, currency: 'USD' };

            // Act & Assert:
            expect(marketModule.price).toEqual(expectedPrice);
        });
    });
});
