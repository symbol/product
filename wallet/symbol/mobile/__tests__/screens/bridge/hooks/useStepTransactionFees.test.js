import { useStepTransactionFees } from '@/app/screens/bridge/hooks/useStepTransactionFees';
import { TransactionFeeFixtureBuilder } from '__fixtures__/local/TransactionFeeFixtureBuilder';
import { HookTester } from '__tests__/HookTester';
import { runHookContractTest } from '__tests__/hook-tests';
import { act } from '@testing-library/react-native';

// Constants

const CHAIN_NAME_ETHEREUM = 'ethereum';
const NETWORK_IDENTIFIER = 'testnet';

// Fixtures

const feeTiers = [
	TransactionFeeFixtureBuilder
		.createWithAmounts('0.5', '1', '2', CHAIN_NAME_ETHEREUM)
		.build()
];

const transactionBundle = { transactions: [{ type: 'transfer' }] };

const estimations = [
	{ bridgeFee: '2.5', receiveAmount: '735', error: null },
	{ bridgeFee: '0.75', receiveAmount: '99', error: null }
];

const failedEstimations = [
	estimations[0],
	{ bridgeFee: null, receiveAmount: null, error: { code: 'amount_low' } }
];

// Stubs

const createWalletControllerStub = () => ({
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	modules: {
		transfer: {
			calculateTransactionFees: jest.fn().mockResolvedValue(feeTiers)
		}
	}
});

const createStepStub = walletController => ({ sourceWalletController: walletController });

const createSteps = (stepCount, walletController) => Array.from({ length: stepCount }, () => createStepStub(walletController));

// Hook Helpers

const createHookParams = overrides => ({
	steps: createSteps(2, createWalletControllerStub()),
	createTransaction: jest.fn().mockResolvedValue(transactionBundle),
	...overrides
});

const createExpectedStepFees = (stepIndex, expectedFeeTiers) => ({
	stepIndex,
	chainName: CHAIN_NAME_ETHEREUM,
	networkIdentifier: NETWORK_IDENTIFIER,
	feeTiers: expectedFeeTiers
});

describe('hooks/useStepTransactionFees', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	runHookContractTest(useStepTransactionFees, {
		props: [createHookParams()],
		contract: {
			stepFees: 'array',
			firstStepFeeTiers: 'object',
			isLoading: 'boolean',
			fetchFirstStepFees: 'function',
			fetchRemainingStepFees: 'function',
			clearRemainingStepFees: 'function'
		}
	});

	describe('initial state', () => {
		it('builds one entry per step without fee tiers before any fetch', () => {
			// Arrange:
			const params = createHookParams();
			const expectedStepFees = [createExpectedStepFees(0, null), createExpectedStepFees(1, null)];

			// Act:
			const hookTester = new HookTester(useStepTransactionFees, [params]);

			// Assert:
			expect(hookTester.currentResult.stepFees).toStrictEqual(expectedStepFees);
			expect(hookTester.currentResult.firstStepFeeTiers).toBeNull();
			expect(hookTester.currentResult.isLoading).toBe(false);
		});
	});

	describe('fetch first step', () => {
		it('estimates the first step fees through the first step wallet controller', async () => {
			// Arrange:
			const walletController = createWalletControllerStub();
			const createTransaction = jest.fn().mockResolvedValue(transactionBundle);
			const params = createHookParams({ steps: createSteps(2, walletController), createTransaction });
			const expectedStepFees = [createExpectedStepFees(0, feeTiers), createExpectedStepFees(1, null)];

			// Act:
			const hookTester = new HookTester(useStepTransactionFees, [params]);
			await act(async () => {
				hookTester.currentResult.fetchFirstStepFees();
			});

			// Assert:
			await hookTester.waitFor(() => {
				expect(createTransaction).toHaveBeenCalledTimes(1);
				expect(createTransaction).toHaveBeenCalledWith(0);
				expect(walletController.modules.transfer.calculateTransactionFees).toHaveBeenCalledWith(transactionBundle);
				expect(hookTester.currentResult.firstStepFeeTiers).toStrictEqual(feeTiers);
				expect(hookTester.currentResult.stepFees).toStrictEqual(expectedStepFees);
				expect(hookTester.currentResult.isLoading).toBe(false);
			});
		});
	});

	describe('fetch remaining steps', () => {
		it('estimates the fees of every step after the first one through its own wallet controller', async () => {
			// Arrange:
			const firstStepWalletController = createWalletControllerStub();
			const secondStepWalletController = createWalletControllerStub();
			const createTransaction = jest.fn().mockResolvedValue(transactionBundle);
			const params = createHookParams({
				steps: [createStepStub(firstStepWalletController), createStepStub(secondStepWalletController)],
				createTransaction
			});
			const expectedStepFees = [createExpectedStepFees(0, null), createExpectedStepFees(1, feeTiers)];

			// Act:
			const hookTester = new HookTester(useStepTransactionFees, [params]);
			await act(async () => {
				hookTester.currentResult.fetchRemainingStepFees(estimations);
			});

			// Assert:
			await hookTester.waitFor(() => {
				expect(createTransaction).toHaveBeenCalledTimes(1);
				expect(createTransaction).toHaveBeenCalledWith(1);
				expect(firstStepWalletController.modules.transfer.calculateTransactionFees).not.toHaveBeenCalled();
				expect(secondStepWalletController.modules.transfer.calculateTransactionFees).toHaveBeenCalledWith(transactionBundle);
				expect(hookTester.currentResult.stepFees).toStrictEqual(expectedStepFees);
				expect(hookTester.currentResult.isLoading).toBe(false);
			});
		});

		const runEmptyResultTest = (description, config) => {
			it(description, async () => {
				// Arrange:
				const createTransaction = jest.fn().mockResolvedValue(transactionBundle);
				const params = createHookParams({ steps: config.steps, createTransaction });

				// Act:
				const hookTester = new HookTester(useStepTransactionFees, [params]);
				await act(async () => {
					hookTester.currentResult.fetchRemainingStepFees(config.estimations);
				});

				// Assert:
				await hookTester.waitFor(() => {
					expect(createTransaction).not.toHaveBeenCalled();
					hookTester.currentResult.stepFees.forEach(stepFees => {
						expect(stepFees.feeTiers).toBeNull();
					});
				});
			});
		};

		const emptyResultCases = [
			[
				'estimates nothing for a single-step route',
				{ steps: createSteps(1, createWalletControllerStub()), estimations: [estimations[0]] }
			],
			[
				'estimates nothing without estimations',
				{ steps: createSteps(2, createWalletControllerStub()), estimations: null }
			],
			[
				'estimates nothing when the estimation is incomplete',
				{ steps: createSteps(2, createWalletControllerStub()), estimations: [estimations[0]] }
			],
			[
				'estimates nothing when a step estimation failed',
				{ steps: createSteps(2, createWalletControllerStub()), estimations: failedEstimations }
			]
		];

		emptyResultCases.forEach(([description, config]) => runEmptyResultTest(description, config));
	});

	describe('clear remaining steps', () => {
		it('drops the fees of the steps after the first one', async () => {
			// Arrange:
			const params = createHookParams();
			const hookTester = new HookTester(useStepTransactionFees, [params]);
			await act(async () => {
				hookTester.currentResult.fetchRemainingStepFees(estimations);
			});
			await hookTester.waitFor(() => {
				expect(hookTester.currentResult.stepFees[1].feeTiers).toStrictEqual(feeTiers);
			});

			// Act:
			await act(async () => {
				hookTester.currentResult.clearRemainingStepFees();
			});

			// Assert:
			expect(hookTester.currentResult.stepFees[1].feeTiers).toBeNull();
		});
	});
});
