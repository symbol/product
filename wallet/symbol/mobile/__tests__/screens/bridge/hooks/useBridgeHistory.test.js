import { BRIDGE_HISTORY_PAGE_SIZE } from '@/app/screens/bridge/constants';
import { useBridgeHistory } from '@/app/screens/bridge/hooks/useBridgeHistory';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Fixtures

const account = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const historyEntry1 = {
	id: 'bridge-request-1',
	sourceAddress: account.address,
	targetAddress: 'target-address-1',
	amount: '10'
};

const historyEntries = [historyEntry1];

const bridgeReady = {
	isReady: true,
	fetchRecentHistory: jest.fn().mockResolvedValue(historyEntries)
};

// Hook Helpers

const createHookParams = overrides => ({
	bridge: bridgeReady,
	...overrides
});

describe('hooks/useBridgeHistory', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	runHookContractTest(useBridgeHistory, {
		props: [createHookParams()],
		waitAsyncEffects: true,
		contract: {
			history: 'object',
			isHistoryLoading: 'boolean',
			refreshHistory: 'function',
			clearHistory: 'function'
		}
	});

	describe('initialization', () => {
		it('fetches bridge history on initial render when bridge is ready', async () => {
			// Arrange:
			const params = createHookParams();

			// Act:
			const hookTester = new HookTester(useBridgeHistory, [params]);
			await hookTester.waitForTimer();

			// Assert:
			expect(bridgeReady.fetchRecentHistory).toHaveBeenCalledWith(BRIDGE_HISTORY_PAGE_SIZE);
			expect(hookTester.currentResult.history).toStrictEqual(historyEntries);
		});
	});
});
