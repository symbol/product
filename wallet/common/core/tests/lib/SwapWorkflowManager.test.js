import { SwapWorkflowManager } from '../../src/lib/bridge/SwapWorkflowManager';
import { jest } from '@jest/globals';

// Workflow ID constants

const CUSTOM_WORKFLOW_ID = 'my-custom-workflow-id';
const PAIR_MANAGER_A_ID = 'pair-manager-a';
const PAIR_MANAGER_B_ID = 'pair-manager-b';
const PAIR_MANAGER_C_ID = 'pair-manager-c';

// Token info fixtures

const nativeTokenInfo = { id: 'native-token', name: 'Native Token', ticker: 'NAT', divisibility: 6 };
const wrappedTokenInfo = { id: 'wrapped-token', name: 'Wrapped Token', ticker: 'WRAP', divisibility: 8 };
const intermediaryTokenInfo = { id: 'mid-token', name: 'Intermediary Token', ticker: 'MID', divisibility: 6 };

// Wallet controller fixtures

const sourceWalletController = { chainName: 'source-chain' };
const targetWalletController = { chainName: 'target-chain' };
const middleWalletController = { chainName: 'middle-chain' };

// History item factory

const createHistoryItem = timestamp => ({ requestTransaction: { timestamp } });

// Estimation fixtures

const createEstimation = (receiveAmount, bridgeFee = '0') => ({ receiveAmount, bridgeFee, error: null });

// Factory functions

const createPairManagerMock = (overrides = {}) => ({
	id: 'default-pair-id',
	mode: 'wrap',
	isReady: true,
	hasHistory: true,
	nativeTokenInfo,
	wrappedTokenInfo,
	sourceWalletController,
	targetWalletController,
	load: jest.fn().mockResolvedValue(undefined),
	fetchRecentHistory: jest.fn().mockResolvedValue([]),
	estimateRequest: jest.fn().mockResolvedValue(createEstimation('1')),
	createTransaction: jest.fn().mockResolvedValue({}),
	...overrides
});

const createWorkflow = (pairManagers, workflowOptions = {}) => new SwapWorkflowManager({ pairManagers, ...workflowOptions });

// Tests

describe('bridge/SwapWorkflowManager', () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.clearAllMocks();
	});

	// Constructor

	describe('constructor', () => {
		it('throws when pairManagers is not provided', () => {
			// Arrange & Act & Assert:
			expect(() => new SwapWorkflowManager({}))
				.toThrow('SwapWorkflowManager requires at least one pair manager');
		});

		it('throws when pairManagers is an empty array', () => {
			// Arrange & Act & Assert:
			expect(() => new SwapWorkflowManager({ pairManagers: [] }))
				.toThrow('SwapWorkflowManager requires at least one pair manager');
		});

		it('does not throw with a single pair manager', () => {
			// Arrange & Act & Assert:
			expect(() => createWorkflow([createPairManagerMock()])).not.toThrow();
		});

		it('does not throw with multiple pair managers', () => {
			// Arrange & Act & Assert:
			expect(() => createWorkflow([createPairManagerMock(), createPairManagerMock()])).not.toThrow();
		});
	});

	// Properties

	describe('properties', () => {
		describe('id', () => {
			it('generates default id by joining pair manager ids with + when not specified', () => {
				// Arrange:
				const managerA = createPairManagerMock({ id: PAIR_MANAGER_A_ID });
				const managerB = createPairManagerMock({ id: PAIR_MANAGER_B_ID });
				const workflow = createWorkflow([managerA, managerB]);

				// Act & Assert:
				expect(workflow.id).toBe(`${PAIR_MANAGER_A_ID}+${PAIR_MANAGER_B_ID}`);
			});

			it('uses single pair manager id when there is only one step', () => {
				// Arrange:
				const manager = createPairManagerMock({ id: PAIR_MANAGER_A_ID });
				const workflow = createWorkflow([manager]);

				// Act & Assert:
				expect(workflow.id).toBe(PAIR_MANAGER_A_ID);
			});

			it('uses custom id when specified', () => {
				// Arrange:
				const workflow = createWorkflow([createPairManagerMock()], { id: CUSTOM_WORKFLOW_ID });

				// Act & Assert:
				expect(workflow.id).toBe(CUSTOM_WORKFLOW_ID);
			});
		});

		describe('steps', () => {
			it('returns 1 for a single-step workflow', () => {
				// Arrange:
				const workflow = createWorkflow([createPairManagerMock()]);

				// Act & Assert:
				expect(workflow.steps).toBe(1);
			});

			it('returns the number of pair managers for a multi-step workflow', () => {
				// Arrange:
				const workflow = createWorkflow([
					createPairManagerMock({ id: PAIR_MANAGER_A_ID }),
					createPairManagerMock({ id: PAIR_MANAGER_B_ID }),
					createPairManagerMock({ id: PAIR_MANAGER_C_ID })
				]);

				// Act & Assert:
				expect(workflow.steps).toBe(3);
			});
		});

		describe('isReady', () => {
			const runIsReadyTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const pairManagers = config.managerReadiness.map(isReady => createPairManagerMock({ isReady }));
					const workflow = createWorkflow(pairManagers);

					// Act & Assert:
					expect(workflow.isReady).toBe(expected.isReady);
				});
			};

			const isReadyTests = [
				{
					description: 'returns true when the single pair manager is ready',
					config: { managerReadiness: [true] },
					expected: { isReady: true }
				},
				{
					description: 'returns false when the single pair manager is not ready',
					config: { managerReadiness: [false] },
					expected: { isReady: false }
				},
				{
					description: 'returns true when all pair managers are ready',
					config: { managerReadiness: [true, true, true] },
					expected: { isReady: true }
				},
				{
					description: 'returns false when the first pair manager is not ready',
					config: { managerReadiness: [false, true, true] },
					expected: { isReady: false }
				},
				{
					description: 'returns false when a middle pair manager is not ready',
					config: { managerReadiness: [true, false, true] },
					expected: { isReady: false }
				},
				{
					description: 'returns false when the last pair manager is not ready',
					config: { managerReadiness: [true, true, false] },
					expected: { isReady: false }
				}
			];

			isReadyTests.forEach(test => {
				runIsReadyTest(test.description, test.config, test.expected);
			});
		});

		describe('hasHistory', () => {
			const runHasHistoryTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const pairManagers = config.managerHistory.map(hasHistory => createPairManagerMock({ hasHistory }));
					const workflow = createWorkflow(pairManagers);

					// Act & Assert:
					expect(workflow.hasHistory).toBe(expected.hasHistory);
				});
			};

			const hasHistoryTests = [
				{
					description: 'returns true when all pair managers have history',
					config: { managerHistory: [true, true] },
					expected: { hasHistory: true }
				},
				{
					description: 'returns false when first pair manager does not have history',
					config: { managerHistory: [false, true] },
					expected: { hasHistory: false }
				},
				{
					description: 'returns false when last pair manager does not have history',
					config: { managerHistory: [true, false] },
					expected: { hasHistory: false }
				},
				{
					description: 'returns false when no pair managers have history',
					config: { managerHistory: [false, false] },
					expected: { hasHistory: false }
				}
			];

			hasHistoryTests.forEach(test => {
				runHasHistoryTest(test.description, test.config, test.expected);
			});
		});

		describe('nativeTokenInfo', () => {
			const runNativeTokenInfoTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const firstManager = createPairManagerMock({
						mode: config.firstMode,
						nativeTokenInfo: config.firstManagerNativeTokenInfo,
						wrappedTokenInfo: config.firstManagerWrappedTokenInfo
					});
					const workflow = createWorkflow([firstManager]);

					// Act & Assert:
					expect(workflow.nativeTokenInfo).toBe(expected.tokenInfo);
				});
			};

			const nativeTokenInfoTests = [
				{
					description: 'returns nativeTokenInfo of first manager when its mode is wrap',
					config: {
						firstMode: 'wrap',
						firstManagerNativeTokenInfo: nativeTokenInfo,
						firstManagerWrappedTokenInfo: intermediaryTokenInfo
					},
					expected: { tokenInfo: nativeTokenInfo }
				},
				{
					description: 'returns wrappedTokenInfo of first manager when its mode is unwrap',
					config: {
						firstMode: 'unwrap',
						firstManagerNativeTokenInfo: nativeTokenInfo,
						firstManagerWrappedTokenInfo: intermediaryTokenInfo
					},
					expected: { tokenInfo: intermediaryTokenInfo }
				}
			];

			nativeTokenInfoTests.forEach(test => {
				runNativeTokenInfoTest(test.description, test.config, test.expected);
			});
		});

		describe('wrappedTokenInfo', () => {
			const runWrappedTokenInfoTest = (description, config, expected) => {
				it(description, () => {
					// Arrange:
					const lastManager = createPairManagerMock({
						mode: config.lastMode,
						nativeTokenInfo: intermediaryTokenInfo,
						wrappedTokenInfo: config.lastManagerWrappedTokenInfo
					});
					const workflow = createWorkflow([lastManager]);

					// Act & Assert:
					expect(workflow.wrappedTokenInfo).toBe(expected.tokenInfo);
				});
			};

			const wrappedTokenInfoTests = [
				{
					description: 'returns wrappedTokenInfo of last manager when its mode is wrap',
					config: {
						lastMode: 'wrap',
						lastManagerWrappedTokenInfo: wrappedTokenInfo
					},
					expected: { tokenInfo: wrappedTokenInfo }
				},
				{
					description: 'returns nativeTokenInfo of last manager when its mode is unwrap',
					config: {
						lastMode: 'unwrap',
						lastManagerWrappedTokenInfo: wrappedTokenInfo
					},
					expected: { tokenInfo: intermediaryTokenInfo }
				}
			];

			wrappedTokenInfoTests.forEach(test => {
				runWrappedTokenInfoTest(test.description, test.config, test.expected);
			});
		});

		describe('nativeTokenInfo and wrappedTokenInfo in a multi-step workflow', () => {
			it('uses first manager for nativeTokenInfo and last manager for wrappedTokenInfo', () => {
				// Arrange:
				const firstManager = createPairManagerMock({
					mode: 'wrap',
					nativeTokenInfo,
					wrappedTokenInfo: intermediaryTokenInfo
				});
				const lastManager = createPairManagerMock({
					mode: 'wrap',
					nativeTokenInfo: intermediaryTokenInfo,
					wrappedTokenInfo
				});
				const workflow = createWorkflow([firstManager, lastManager]);

				// Act & Assert:
				expect(workflow.nativeTokenInfo).toBe(nativeTokenInfo);
				expect(workflow.wrappedTokenInfo).toBe(wrappedTokenInfo);
			});
		});

		describe('sourceWalletController and targetWalletController', () => {
			it('sourceWalletController comes from the first pair manager', () => {
				// Arrange:
				const firstManager = createPairManagerMock({ sourceWalletController });
				const lastManager = createPairManagerMock({ targetWalletController });
				const workflow = createWorkflow([firstManager, lastManager]);

				// Act & Assert:
				expect(workflow.sourceWalletController).toBe(sourceWalletController);
			});

			it('targetWalletController comes from the last pair manager', () => {
				// Arrange:
				const firstManager = createPairManagerMock({ sourceWalletController });
				const lastManager = createPairManagerMock({ targetWalletController });
				const workflow = createWorkflow([firstManager, lastManager]);

				// Act & Assert:
				expect(workflow.targetWalletController).toBe(targetWalletController);
			});

			it('single-step workflow: source and target each come from the sole pair manager', () => {
				// Arrange:
				const manager = createPairManagerMock({ sourceWalletController, targetWalletController });
				const workflow = createWorkflow([manager]);

				// Act & Assert:
				expect(workflow.sourceWalletController).toBe(sourceWalletController);
				expect(workflow.targetWalletController).toBe(targetWalletController);
			});

			it('multi-step workflow: source is not affected by middle managers', () => {
				// Arrange:
				const firstManager = createPairManagerMock({
					sourceWalletController,
					targetWalletController: middleWalletController
				});
				const lastManager = createPairManagerMock({
					sourceWalletController: middleWalletController,
					targetWalletController
				});
				const workflow = createWorkflow([firstManager, lastManager]);

				// Act & Assert:
				expect(workflow.sourceWalletController).toBe(sourceWalletController);
				expect(workflow.targetWalletController).toBe(targetWalletController);
			});
		});
	});

	// Load

	describe('load', () => {
		it('calls load on the single pair manager', async () => {
			// Arrange:
			const manager = createPairManagerMock();
			const workflow = createWorkflow([manager]);

			// Act:
			await workflow.load();

			// Assert:
			expect(manager.load).toHaveBeenCalledTimes(1);
		});

		it('calls load on all pair managers', async () => {
			// Arrange:
			const managerA = createPairManagerMock({ id: PAIR_MANAGER_A_ID });
			const managerB = createPairManagerMock({ id: PAIR_MANAGER_B_ID });
			const workflow = createWorkflow([managerA, managerB]);

			// Act:
			await workflow.load();

			// Assert:
			expect(managerA.load).toHaveBeenCalledTimes(1);
			expect(managerB.load).toHaveBeenCalledTimes(1);
		});

		it('resolves only after all pair managers have finished loading', async () => {
			// Arrange:
			const loadedIds = [];
			const managerA = createPairManagerMock({ 
				load: jest.fn().mockImplementation(async () => { loadedIds.push(PAIR_MANAGER_A_ID); }) 
			});
			const managerB = createPairManagerMock({ 
				load: jest.fn().mockImplementation(async () => { loadedIds.push(PAIR_MANAGER_B_ID); }) 
			});
			const workflow = createWorkflow([managerA, managerB]);

			// Act:
			await workflow.load();

			// Assert:
			expect(loadedIds).toContain(PAIR_MANAGER_A_ID);
			expect(loadedIds).toContain(PAIR_MANAGER_B_ID);
		});
	});

	// fetchRecentHistory

	describe('fetchRecentHistory', () => {
		it('returns empty array when no pair managers have history', async () => {
			// Arrange:
			const manager = createPairManagerMock({ hasHistory: false });
			const workflow = createWorkflow([manager]);

			// Act:
			const history = await workflow.fetchRecentHistory(10);

			// Assert:
			expect(history).toStrictEqual([]);
			expect(manager.fetchRecentHistory).not.toHaveBeenCalled();
		});

		it('returns results from single history-capable manager sorted by timestamp descending', async () => {
			// Arrange:
			const olderItem = createHistoryItem(1000);
			const newerItem = createHistoryItem(2000);
			const manager = createPairManagerMock({
				hasHistory: true,
				fetchRecentHistory: jest.fn().mockResolvedValue([olderItem, newerItem])
			});
			const workflow = createWorkflow([manager]);

			// Act:
			const history = await workflow.fetchRecentHistory(10);

			// Assert:
			expect(history).toStrictEqual([newerItem, olderItem]);
		});

		it('merges results from multiple history-capable managers sorted by timestamp descending', async () => {
			// Arrange:
			const itemsA = [createHistoryItem(3000), createHistoryItem(1000)];
			const itemsB = [createHistoryItem(4000), createHistoryItem(2000)];
			const managerA = createPairManagerMock({ hasHistory: true, fetchRecentHistory: jest.fn().mockResolvedValue(itemsA) });
			const managerB = createPairManagerMock({ hasHistory: true, fetchRecentHistory: jest.fn().mockResolvedValue(itemsB) });
			const workflow = createWorkflow([managerA, managerB]);

			// Act:
			const history = await workflow.fetchRecentHistory(10);

			// Assert:
			expect(history.map(item => item.requestTransaction.timestamp)).toStrictEqual([4000, 3000, 2000, 1000]);
		});

		it('limits returned results to the specified count', async () => {
			// Arrange:
			const items = [createHistoryItem(4000), createHistoryItem(3000), createHistoryItem(2000), createHistoryItem(1000)];
			const manager = createPairManagerMock({ hasHistory: true, fetchRecentHistory: jest.fn().mockResolvedValue(items) });
			const workflow = createWorkflow([manager]);

			// Act:
			const history = await workflow.fetchRecentHistory(2);

			// Assert:
			expect(history).toHaveLength(2);
			expect(history.map(item => item.requestTransaction.timestamp)).toStrictEqual([4000, 3000]);
		});

		it('skips managers without history and only queries history-capable ones', async () => {
			// Arrange:
			const historyItems = [createHistoryItem(1000)];
			const historyManager = createPairManagerMock({
				hasHistory: true,
				fetchRecentHistory: jest.fn().mockResolvedValue(historyItems)
			});
			const noHistoryManager = createPairManagerMock({ hasHistory: false });
			const workflow = createWorkflow([noHistoryManager, historyManager]);

			// Act:
			const history = await workflow.fetchRecentHistory(10);

			// Assert:
			expect(noHistoryManager.fetchRecentHistory).not.toHaveBeenCalled();
			expect(historyManager.fetchRecentHistory).toHaveBeenCalledWith(10);
			expect(history).toStrictEqual(historyItems);
		});
	});

	// estimateRequest

	describe('estimateRequest', () => {
		it('delegates to the single pair manager with the original amount', async () => {
			// Arrange:
			const estimation = createEstimation('0.95', '0.05');
			const manager = createPairManagerMock({ estimateRequest: jest.fn().mockResolvedValue(estimation) });
			const workflow = createWorkflow([manager]);

			// Act:
			const result = await workflow.estimateRequest('1');

			// Assert:
			expect(manager.estimateRequest).toHaveBeenCalledWith('1');
			expect(result).toStrictEqual([estimation]);
		});

		it('chains receiveAmount from each step into the next step', async () => {
			// Arrange:
			const estimationA = createEstimation('0.9', '0.1');
			const estimationB = createEstimation('0.85', '0.05');
			const managerA = createPairManagerMock({ estimateRequest: jest.fn().mockResolvedValue(estimationA) });
			const managerB = createPairManagerMock({ estimateRequest: jest.fn().mockResolvedValue(estimationB) });
			const workflow = createWorkflow([managerA, managerB]);

			// Act:
			const result = await workflow.estimateRequest('1');

			// Assert:
			expect(managerA.estimateRequest).toHaveBeenCalledWith('1');
			expect(managerB.estimateRequest).toHaveBeenCalledWith('0.9');
			expect(result).toStrictEqual([estimationA, estimationB]);
		});

		it('returns ordered array of all step estimations for a three-step workflow', async () => {
			// Arrange:
			const estimationA = createEstimation('0.9', '0.1');
			const estimationB = createEstimation('0.85', '0.05');
			const estimationC = createEstimation('0.8', '0.05');
			const managerA = createPairManagerMock({ estimateRequest: jest.fn().mockResolvedValue(estimationA) });
			const managerB = createPairManagerMock({ estimateRequest: jest.fn().mockResolvedValue(estimationB) });
			const managerC = createPairManagerMock({ estimateRequest: jest.fn().mockResolvedValue(estimationC) });
			const workflow = createWorkflow([managerA, managerB, managerC]);

			// Act:
			const result = await workflow.estimateRequest('1');

			// Assert:
			expect(managerA.estimateRequest).toHaveBeenCalledWith('1');
			expect(managerB.estimateRequest).toHaveBeenCalledWith('0.9');
			expect(managerC.estimateRequest).toHaveBeenCalledWith('0.85');
			expect(result).toStrictEqual([estimationA, estimationB, estimationC]);
		});
	});

	// createTransactionForStep

	describe('createTransactionForStep', () => {
		it('throws when step index is out of bounds', async () => {
			// Arrange:
			const workflow = createWorkflow([createPairManagerMock()]);

			// Act & Assert:
			await expect(workflow.createTransactionForStep(1, {}))
				.rejects.toThrow('SwapWorkflowManager: no step at index 1');
		});

		it('throws when step index is negative', async () => {
			// Arrange:
			const workflow = createWorkflow([createPairManagerMock()]);

			// Act & Assert:
			await expect(workflow.createTransactionForStep(-1, {}))
				.rejects.toThrow('SwapWorkflowManager: no step at index -1');
		});

		it('delegates createTransaction to the first step manager', async () => {
			// Arrange:
			const expectedBundle = { transactions: [{ type: 'TRANSFER' }] };
			const managerA = createPairManagerMock({ createTransaction: jest.fn().mockResolvedValue(expectedBundle) });
			const managerB = createPairManagerMock();
			const workflow = createWorkflow([managerA, managerB]);
			const options = { amount: '1', recipientAddress: '0xabc' };

			// Act:
			const result = await workflow.createTransactionForStep(0, options);

			// Assert:
			expect(managerA.createTransaction).toHaveBeenCalledWith(options);
			expect(managerB.createTransaction).not.toHaveBeenCalled();
			expect(result).toBe(expectedBundle);
		});

		it('delegates createTransaction to the second step manager', async () => {
			// Arrange:
			const expectedBundle = { transactions: [{ type: 'SWAP' }] };
			const managerA = createPairManagerMock();
			const managerB = createPairManagerMock({ createTransaction: jest.fn().mockResolvedValue(expectedBundle) });
			const workflow = createWorkflow([managerA, managerB]);
			const options = { amount: '0.9', recipientAddress: '0xdef' };

			// Act:
			const result = await workflow.createTransactionForStep(1, options);

			// Assert:
			expect(managerA.createTransaction).not.toHaveBeenCalled();
			expect(managerB.createTransaction).toHaveBeenCalledWith(options);
			expect(result).toBe(expectedBundle);
		});

		it('passes all options through to the pair manager createTransaction', async () => {
			// Arrange:
			const manager = createPairManagerMock();
			const workflow = createWorkflow([manager]);
			const options = { amount: '5', recipientAddress: '0xabc', fee: { gasLimit: '21000' }, amountOutMinimum: '4.9' };

			// Act:
			await workflow.createTransactionForStep(0, options);

			// Assert:
			expect(manager.createTransaction).toHaveBeenCalledWith(options);
		});
	});
});
