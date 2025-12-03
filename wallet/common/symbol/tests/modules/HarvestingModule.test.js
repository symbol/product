import { LinkAction, LinkActionMessage, MessageType, TransactionBundleType, TransactionType } from '../../src/constants';
import { addressFromPublicKey, createDeadline, createTransactionFee } from '../../src/utils';
import { accountInfoNonMultisig } from '../__fixtures__/local/account';
import { harvestedBlocks } from '../__fixtures__/local/harvesting';
import { networkProperties } from '../__fixtures__/local/network';
import { currentAccount } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ControllerError, TransactionBundle } from 'wallet-common-core';

jest.unstable_mockModule('lodash', () => ({
	shuffle: jest.fn(arr => [...arr].reverse())
}));

// Import after mocks
const { HarvestingModule } = await import('../../src/modules/HarvestingModule');

const FIXED_NOW_MS = 1_700_000_000_000;

const createFee = amount => ({
	token: {
		id: networkProperties.networkCurrency.mosaicId,
		amount,
		divisibility: networkProperties.networkCurrency.divisibility,
		name: networkProperties.networkCurrency.name
	}
});

const nodeList = [
	'https://node-1.example.com:3001',
	'https://node-2.example.com:3001',
	'https://node-3.example.com:3001'
];

const createAccountInfoWithNoKeys = () => ({
	...accountInfoNonMultisig,
	linkedKeys: {}
});

describe('HarvestingModule', () => {
	let harvestingModule;
	let api;
	let walletController;

	beforeEach(() => {
		api = {
			harvesting: {
				fetchStatus: jest.fn(),
				fetchHarvestedBlocks: jest.fn(),
				fetchNodeList: jest.fn(),
				fetchSummary: jest.fn()
			}
		};

		walletController = {
			currentAccount,
			currentAccountInfo: accountInfoNonMultisig,
			networkProperties,
			networkIdentifier: networkProperties.networkIdentifier,
			getCurrentAccountPrivateKey: jest.fn()
		};

		harvestingModule = new HarvestingModule();
		harvestingModule.init({ walletController, api });

		jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW_MS);
		jest.clearAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(HarvestingModule.name).toBe('harvesting');
	});

	describe('fetchStatus()', () => {
		it('fetches harvesting status for current account', async () => {
			// Arrange:
			const mockStatus = { isActive: true, nodePublicKey: 'ABCDEF', error: null };
			api.harvesting.fetchStatus.mockResolvedValue(mockStatus);

			// Act:
			const result = await harvestingModule.fetchStatus();

			// Assert:
			expect(result).toStrictEqual(mockStatus);
			expect(api.harvesting.fetchStatus).toHaveBeenCalledTimes(1);
			expect(api.harvesting.fetchStatus).toHaveBeenCalledWith(networkProperties, currentAccount);
		});
	});

	describe('fetchAccountHarvestedBlocks()', () => {
		it('fetches harvested blocks with pagination criteria', async () => {
			// Arrange:
			const searchCriteria = { pageNumber: 2, pageSize: 5 };
			api.harvesting.fetchHarvestedBlocks.mockResolvedValue(harvestedBlocks);

			// Act:
			const result = await harvestingModule.fetchAccountHarvestedBlocks(searchCriteria);

			// Assert:
			expect(result).toStrictEqual(harvestedBlocks);
			expect(api.harvesting.fetchHarvestedBlocks).toHaveBeenCalledTimes(1);
			expect(api.harvesting.fetchHarvestedBlocks).toHaveBeenCalledWith(
				networkProperties,
				currentAccount.address,
				searchCriteria
			);
		});
	});

	describe('fetchNodeList()', () => {
		it('fetches and shuffles node list (order not asserted)', async () => {
			// Arrange:
			api.harvesting.fetchNodeList.mockResolvedValue(nodeList);

			// Act:
			const result = await harvestingModule.fetchNodeList();

			// Assert:
			expect(api.harvesting.fetchNodeList).toHaveBeenCalledTimes(1);
			expect(api.harvesting.fetchNodeList).toHaveBeenCalledWith(networkProperties.networkIdentifier);
			expect(result).toEqual(expect.arrayContaining(nodeList));
			expect(result).toHaveLength(nodeList.length);
		});
	});

	describe('fetchSummary()', () => {
		it('fetches harvesting summary for current account', async () => {
			// Arrange:
			const mockSummary = {
				totalBlocks: 123,
				totalFees: '867.08944',
				lastBlockHeight: '2637258'
			};
			api.harvesting.fetchSummary.mockResolvedValue(mockSummary);

			// Act:
			const result = await harvestingModule.fetchSummary();

			// Assert:
			expect(result).toStrictEqual(mockSummary);
			expect(api.harvesting.fetchSummary).toHaveBeenCalledTimes(1);
			expect(api.harvesting.fetchSummary).toHaveBeenCalledWith(networkProperties, currentAccount.address);
		});
	});

	describe('createStopHarvestingTransaction()', () => {
		const runCreateStopHarvestingTransactionTest = async (config, expected) => {
			// Arrange:
			const { currentAccountInfo, options } = config;
			walletController.currentAccountInfo = currentAccountInfo;

			// Act:
			let error;
			let result;
			try {
				result = await harvestingModule.createStopHarvestingTransaction(options);
			} catch (e) {
				error = e;
			}

			// Assert:
			if (!expected.error && error) {
				throw error;
			} else if (expected.error) {
				expect(error).toBeDefined();
				expect(error).toStrictEqual(expected.error);
			} else if (expected.result) {
				expect(result.toJSON()).toStrictEqual(expected.result.toJSON());
			}
		};

		it('creates aggregate unlink transactions with default fee when keys are linked', async () => {
			// Arrange:
			const { linkedKeys } = accountInfoNonMultisig;
			const unlinkVrf = {
				type: TransactionType.VRF_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.vrfPublicKey,
				signerPublicKey: currentAccount.publicKey
			};
			const unlinkRemote = {
				type: TransactionType.ACCOUNT_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.linkedPublicKey,
				signerPublicKey: currentAccount.publicKey
			};
			const unlinkNode = {
				type: TransactionType.NODE_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.nodePublicKey,
				signerPublicKey: currentAccount.publicKey
			};

			const expectedAggregate = {
				type: TransactionType.AGGREGATE_COMPLETE,
				innerTransactions: [unlinkVrf, unlinkRemote, unlinkNode],
				signerPublicKey: currentAccount.publicKey,
				fee: createTransactionFee(networkProperties, '0'),
				deadline: createDeadline(2, networkProperties.epochAdjustment)
			};
			const expectedResult = new TransactionBundle(
				[expectedAggregate],
				{ type: TransactionBundleType.DELEGATED_HARVESTING }
			);

			// Act & Assert:
			await runCreateStopHarvestingTransactionTest(
				{
					currentAccountInfo: accountInfoNonMultisig,
					options: {}
				},
				{
					result: expectedResult
				}
			);
		});

		it('creates aggregate unlink transactions with provided fee', async () => {
			// Arrange:
			const customFee = createFee('1.5');
			const { linkedKeys } = accountInfoNonMultisig;
			const unlinkVrf = {
				type: TransactionType.VRF_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.vrfPublicKey,
				signerPublicKey: currentAccount.publicKey
			};
			const unlinkRemote = {
				type: TransactionType.ACCOUNT_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.linkedPublicKey,
				signerPublicKey: currentAccount.publicKey
			};
			const unlinkNode = {
				type: TransactionType.NODE_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: linkedKeys.nodePublicKey,
				signerPublicKey: currentAccount.publicKey
			};

			const expectedAggregate = {
				type: TransactionType.AGGREGATE_COMPLETE,
				innerTransactions: [unlinkVrf, unlinkRemote, unlinkNode],
				signerPublicKey: currentAccount.publicKey,
				fee: customFee,
				deadline: createDeadline(2, networkProperties.epochAdjustment)
			};
			const expectedResult = new TransactionBundle(
				[expectedAggregate],
				{ type: TransactionBundleType.DELEGATED_HARVESTING }
			);

			// Act & Assert:
			await runCreateStopHarvestingTransactionTest(
				{
					currentAccountInfo: accountInfoNonMultisig,
					options: { fee: customFee }
				},
				{
					result: expectedResult
				}
			);
		});

		it('throws when there are no keys to unlink', async () => {
			// Arrange:
			const expectedError = new ControllerError(
				'error_harvesting_no_keys_to_unlink',
				'Failed to create stop harvesting transaction. No keys to unlink.'
			);

			// Act & Assert:
			await runCreateStopHarvestingTransactionTest(
				{
					currentAccountInfo: createAccountInfoWithNoKeys(),
					options: {}
				},
				{
					error: expectedError
				}
			);
		});
	});

	describe('createStartHarvestingTransaction()', () => {
		const runCreateStartHarvestingTransactionTest = async (config, expected) => {
			// Arrange:
			const { currentAccountInfo, options, password } = config;
			walletController.currentAccountInfo = currentAccountInfo;
			walletController.getCurrentAccountPrivateKey.mockResolvedValue(currentAccount.privateKey);

			// Act:
			let error;
			let result;
			try {
				result = await harvestingModule.createStartHarvestingTransaction(options, password);
			} catch (e) {
				error = e;
			}

			// Assert:
			if (!expected.error && error) {
				throw error;
			} else if (expected.error) {
				expect(error).toBeDefined();
				expect(error).toStrictEqual(expected.error);
			} else {
				const [aggregate] = result.transactions;
				const { innerTransactions } = aggregate;
				const unlinkTransactions = [];
				if (currentAccountInfo.linkedKeys?.vrfPublicKey) {
					unlinkTransactions.push({
						type: TransactionType.VRF_KEY_LINK,
						linkAction: LinkActionMessage[LinkAction.Unlink],
						linkedPublicKey: currentAccountInfo.linkedKeys.vrfPublicKey,
						signerPublicKey: currentAccount.publicKey
					});
				}
				if (currentAccountInfo.linkedKeys?.linkedPublicKey) {
					unlinkTransactions.push({
						type: TransactionType.ACCOUNT_KEY_LINK,
						linkAction: LinkActionMessage[LinkAction.Unlink],
						linkedPublicKey: currentAccountInfo.linkedKeys.linkedPublicKey,
						signerPublicKey: currentAccount.publicKey
					});
				}
				if (currentAccountInfo.linkedKeys?.nodePublicKey) {
					unlinkTransactions.push({
						type: TransactionType.NODE_KEY_LINK,
						linkAction: LinkActionMessage[LinkAction.Unlink],
						linkedPublicKey: currentAccountInfo.linkedKeys.nodePublicKey,
						signerPublicKey: currentAccount.publicKey
					});
				}

				const linkVrf = innerTransactions.find(tx => tx.type === TransactionType.VRF_KEY_LINK 
					&& tx.linkAction === LinkActionMessage[LinkAction.Link]);
				const linkRemote = innerTransactions.find(tx => tx.type === TransactionType.ACCOUNT_KEY_LINK 
					&& tx.linkAction === LinkActionMessage[LinkAction.Link]);
				const transfer = innerTransactions.find(tx => tx.type === TransactionType.TRANSFER);

				const expectedInner = [
					...unlinkTransactions,
					{
						type: TransactionType.VRF_KEY_LINK,
						linkAction: LinkActionMessage[LinkAction.Link],
						linkedPublicKey: linkVrf.linkedPublicKey,
						signerPublicKey: currentAccount.publicKey
					},
					{
						type: TransactionType.ACCOUNT_KEY_LINK,
						linkAction: LinkActionMessage[LinkAction.Link],
						linkedPublicKey: linkRemote.linkedPublicKey,
						signerPublicKey: currentAccount.publicKey
					},
					{
						type: TransactionType.NODE_KEY_LINK,
						linkAction: LinkActionMessage[LinkAction.Link],
						linkedPublicKey: options.nodePublicKey,
						signerPublicKey: currentAccount.publicKey
					},
					{
						type: TransactionType.TRANSFER,
						mosaics: [],
						message: {
							type: MessageType.DelegatedHarvesting,
							payload: transfer.message.payload,
							text: ''
						},
						signerPublicKey: currentAccount.publicKey,
						recipientAddress: addressFromPublicKey(options.nodePublicKey, networkProperties.networkIdentifier)
					}
				];

				const expectedAggregate = {
					type: TransactionType.AGGREGATE_COMPLETE,
					innerTransactions: expectedInner,
					signerPublicKey: currentAccount.publicKey,
					fee: expected.fee,
					deadline: createDeadline(2, networkProperties.epochAdjustment)
				};
				const expectedResult = new TransactionBundle(
					[expectedAggregate],
					{ type: TransactionBundleType.DELEGATED_HARVESTING }
				);

				expect(result.toJSON()).toStrictEqual(expectedResult.toJSON());
				expect(walletController.getCurrentAccountPrivateKey).toHaveBeenCalledTimes(1);
				expect(walletController.getCurrentAccountPrivateKey).toHaveBeenCalledWith(password);
			}
		};

		it('creates unlink + link + delegated harvesting transfer with default fee when keys are already linked', async () => {
			// Arrange:
			const nodePublicKey = '26BB5F23FAE6E93798D170E971250963F025048928478825FC0F51A394C30987';
			const options = { nodePublicKey };
			const password = 'pwd';
			const expectedFee = createTransactionFee(networkProperties, '0');

			// Act & Assert:
			await runCreateStartHarvestingTransactionTest(
				{
					currentAccountInfo: accountInfoNonMultisig,
					options,
					password
				},
				{
					fee: expectedFee
				}
			);
		});

		it('creates link + delegated harvesting transfer with provided fee when no keys are linked', async () => {
			// Arrange:
			const nodePublicKey = '26BB5F23FAE6E93798D170E971250963F025048928478825FC0F51A394C30987';
			const customFee = createFee('1.2501');
			const options = { nodePublicKey, fee: customFee };
			const password = 'secret';
			const accountInfoWithNoKeys = {
				...accountInfoNonMultisig,
				linkedKeys: {}
			};

			// Act & Assert:
			await runCreateStartHarvestingTransactionTest(
				{
					currentAccountInfo: accountInfoWithNoKeys,
					options,
					password
				},
				{
					fee: customFee
				}
			);
		});
	});
});
