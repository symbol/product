import { BRIDGE_HISTORY_PAGE_SIZE } from '@/app/screens/bridge/constants';
import { useBridgeHistory } from '@/app/screens/bridge/hooks/useBridgeHistory';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';

// Fixtures

const ACCOUNT = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

const HISTORY_ENTRY_1 = {
	id: 'bridge-request-1',
	sourceAddress: ACCOUNT.address,
	targetAddress: 'target-address-1',
	amount: '10'
};

const HISTORY_ENTRIES = [HISTORY_ENTRY_1];

const BRIDGE_READY = {
	isReady: true,
	fetchRecentHistory: jest.fn().mockResolvedValue(HISTORY_ENTRIES)
};

// Hook Helpers

const createHookParams = overrides => ({
	bridge: BRIDGE_READY,
	...overrides
});

describe('hooks/useBridgeHistory', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useBridgeHistory, {
		props: [createHookParams()],
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

			// Assert:
			await hookTester.waitFor(() => {
				expect(BRIDGE_READY.fetchRecentHistory).toHaveBeenCalledWith(BRIDGE_HISTORY_PAGE_SIZE);
				expect(hookTester.currentResult.history).toStrictEqual(HISTORY_ENTRIES);
			});
		});
	});
});
