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

const estimationFeeToken = TokenFixtureBuilder
	.createWithToken(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.setAmount('0.2')
	.build();

const estimationReceiveToken = TokenFixtureBuilder
	.createWithToken('ethereum', NETWORK_IDENTIFIER, 1)
	.setAmount('11.8')
	.build();

const estimationData = {
	fee: {
		token: estimationFeeToken
	},
	receive: {
		token: estimationReceiveToken
	}
};

const bridgeManager = {
	estimateRequest: jest.fn().mockResolvedValue(estimationData)
};

// Hook Helpers

const createHookParams = overrides => ({
	bridge: bridgeManager,
	mode: BridgeMode.WRAP,
	amount: AMOUNT,
	...overrides
});

describe('hooks/useEstimation', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useEstimation, {
		props: [createHookParams()],
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
				expect(bridgeManager.estimateRequest).toHaveBeenCalledWith(expectedMode, expectedAmount);
				expect(hookTester.currentResult.estimation).toStrictEqual(estimationData);
				expect(hookTester.currentResult.isLoading).toBe(false);
			});
		});
	});
});
