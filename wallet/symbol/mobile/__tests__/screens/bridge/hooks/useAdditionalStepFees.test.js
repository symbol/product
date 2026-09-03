import { useAdditionalStepFees } from '@/app/screens/bridge/hooks/useAdditionalStepFees';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { act } from '@testing-library/react-native';

// Constants

const CHAIN_NAME_ETHEREUM = 'ethereum';

// Fixtures

const feeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('0.5', '1', '2', CHAIN_NAME_ETHEREUM)
		.build()
];

const networkCurrency = {
	id: 'eth',
	name: 'ETH',
	divisibility: 18
};

const transactionBundle = { transactions: [{ type: 'transfer' }] };

const estimations = [
	{ bridgeFee: '2.5', receiveAmount: '735', error: null },
	{ bridgeFee: '0.75', receiveAmount: '99', error: null }
];

// Stubs

const createWalletControllerStub = () => ({
	chainName: CHAIN_NAME_ETHEREUM,
	networkProperties: { networkCurrency },
	modules: {
		transfer: {
			calculateTransactionFees: jest.fn().mockResolvedValue(feeTiers)
		}
	}
});

const createBridgeStub = (walletController, steps = 2) => ({
	steps,
	getPairForStep: jest.fn().mockReturnValue({ sourceWalletController: walletController })
});

// Hook Helpers

const createHookParams = overrides => ({
	bridge: createBridgeStub(createWalletControllerStub()),
	estimations,
	createTransaction: jest.fn().mockResolvedValue(transactionBundle),
	...overrides
});

describe('hooks/useAdditionalStepFees', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useAdditionalStepFees, {
		props: [createHookParams()],
		contract: {
			additionalStepFees: 'object',
			fetchAdditionalStepFees: 'function',
			clearAdditionalStepFees: 'function',
			isLoading: 'boolean'
		}
	});

	describe('fetch', () => {
		it('estimates the fees of every step after the first one', async () => {
			// Arrange:
			const walletController = createWalletControllerStub();
			const bridge = createBridgeStub(walletController);
			const createTransaction = jest.fn().mockResolvedValue(transactionBundle);
			const params = createHookParams({ bridge, createTransaction });
			const expectedStepFees = [{
				chainName: CHAIN_NAME_ETHEREUM,
				networkCurrency,
				feeTiers
			}];

			// Act:
			const hookTester = new HookTester(useAdditionalStepFees, [params]);
			await act(async () => {
				hookTester.currentResult.fetchAdditionalStepFees();
			});

			// Assert: only the second step is estimated, through its own pair's source wallet controller
			await hookTester.waitFor(() => {
				expect(createTransaction).toHaveBeenCalledTimes(1);
				expect(createTransaction).toHaveBeenCalledWith(1);
				expect(walletController.modules.transfer.calculateTransactionFees).toHaveBeenCalledWith(transactionBundle);
				expect(hookTester.currentResult.additionalStepFees).toStrictEqual(expectedStepFees);
				expect(hookTester.currentResult.isLoading).toBe(false);
			});
		});

		const runEmptyResultTest = (description, config) => {
			it(description, async () => {
				// Arrange:
				const createTransaction = jest.fn().mockResolvedValue(transactionBundle);
				const params = createHookParams({ ...config, createTransaction });

				// Act:
				const hookTester = new HookTester(useAdditionalStepFees, [params]);
				await act(async () => {
					hookTester.currentResult.fetchAdditionalStepFees();
				});

				// Assert:
				await hookTester.waitFor(() => {
					expect(createTransaction).not.toHaveBeenCalled();
					expect(hookTester.currentResult.additionalStepFees).toStrictEqual([]);
				});
			});
		};

		const emptyResultCases = [
			[
				'resolves to an empty list for a single-step route',
				{ bridge: createBridgeStub(createWalletControllerStub(), 1) }
			],
			[
				'resolves to an empty list without estimations',
				{ estimations: null }
			],
			[
				'resolves to an empty list when the estimation is incomplete',
				{ estimations: [estimations[0]] }
			],
			[
				'resolves to an empty list when a step estimation failed',
				{ estimations: [estimations[0], { bridgeFee: null, receiveAmount: null, error: { code: 'amount_low' } }] }
			]
		];

		emptyResultCases.forEach(([description, config]) => runEmptyResultTest(description, config));
	});

	describe('reset', () => {
		it('clears the fetched fees', async () => {
			// Arrange:
			const params = createHookParams();
			const hookTester = new HookTester(useAdditionalStepFees, [params]);
			await act(async () => {
				hookTester.currentResult.fetchAdditionalStepFees();
			});
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.additionalStepFees).not.toBeNull();
			});

			// Act:
			await act(async () => {
				hookTester.currentResult.clearAdditionalStepFees();
			});

			// Assert:
			expect(hookTester.currentResult.additionalStepFees).toBeNull();
		});
	});
});
