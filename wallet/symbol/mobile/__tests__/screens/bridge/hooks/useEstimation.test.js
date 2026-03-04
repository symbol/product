import { useEstimation } from '@/app/screens/bridge/hooks/useEstimation';
import { BridgeMode } from '@/app/screens/bridge/types/Bridge';
import { TokenFixtureBuilder } from '__fixtures__/local/TokenFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { act } from '@testing-library/react-native';

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const AMOUNT = '12';

// Fixtures

const ESTIMATION_FEE_TOKEN = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('0.2')
	.build();

const ESTIMATION_RECEIVE_TOKEN = TokenFixtureBuilder
	.createWithToken('ethereum', NETWORK_IDENTIFIER, 1)
	.setAmount('11.8')
	.build();

const ESTIMATION_DATA = {
	fee: {
		token: ESTIMATION_FEE_TOKEN
	},
	receive: {
		token: ESTIMATION_RECEIVE_TOKEN
	}
};

const BRIDGE_MANAGER = {
	estimateRequest: jest.fn().mockResolvedValue(ESTIMATION_DATA)
};

// Hook Helpers

const createHookParams = overrides => ({
	bridge: BRIDGE_MANAGER,
	mode: BridgeMode.WRAP,
	amount: AMOUNT,
	...overrides
});

describe('hooks/useEstimation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useEstimation, {
		props: createHookParams(),
		contract: {
			estimate: 'function',
			estimation: 'object',
			clearEstimation: 'function',
			isLoading: 'boolean'
		}
	});

	describe('initialization', () => {
		it('initializes estimation flow with provided bridge and request params', async () => {
			// Arrange:
			const params = createHookParams();
			const expectedMode = BridgeMode.WRAP;
			const expectedAmount = AMOUNT;

			// Act:
			const hookTester = new HookTester(useEstimation, [params]);
			await act(async () => {
				hookTester.currentResult.estimate();
			});

			// Assert:
			await hookTester.waitFor(() => {
				expect(BRIDGE_MANAGER.estimateRequest).toHaveBeenCalledWith(expectedMode, expectedAmount);
				expect(hookTester.currentResult.estimation).toStrictEqual(ESTIMATION_DATA);
				expect(hookTester.currentResult.isLoading).toBe(false);
			});
		});
	});
});
