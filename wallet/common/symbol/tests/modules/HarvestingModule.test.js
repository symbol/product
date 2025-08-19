import { networkProperties as networkPropertiesFixture } from '../__fixtures__/local/network';
import { currentAccount as currentAccountFixture } from '../__fixtures__/local/wallet';
import { expect, jest } from '@jest/globals';
import { ControllerError } from 'wallet-common-core';

// Mock utils used by HarvestingModule for deterministic behavior
jest.unstable_mockModule('../../src/utils', () => {
	return {
		addressFromPublicKey: jest.fn(pk => `ADDR_${pk}`),
		createDeadline: jest.fn(() => 'DEADLINE'),
		createFee: jest.fn(() => 'FEE'),
		encodeDelegatedHarvestingMessage: jest.fn((_accPriv, nodePk, remotePriv, vrfPriv) =>
			`ENCMSG:${nodePk}:${remotePriv}:${vrfPriv}`),
		generateKeyPair: jest.fn(() => {
			// Will be overwritten per-test to provide deterministic keys
			return { publicKey: 'GEN_PK', privateKey: 'GEN_SK' };
		})
	};
});

// Mock lodash.shuffle to deterministic reverse
jest.unstable_mockModule('lodash', () => ({
	shuffle: jest.fn(arr => [...arr].reverse())
}));

// Import after mocks
const { HarvestingModule } = await import('../../src/modules/HarvestingModule');
const { LinkAction, LinkActionMessage, MessageType, TransactionType } = await import('../../src/constants');
const utils = await import('../../src/utils');
const { shuffle } = await import('lodash');

describe('HarvestingModule', () => {
	let harvestingModule;
	let api;

	const currentAccount = {
		...currentAccountFixture
	};
	const networkProperties = {
		...networkPropertiesFixture,
		epochAdjustment: Number(networkPropertiesFixture.epochAdjustment)
	};
	const {networkIdentifier} = networkProperties;

	beforeEach(() => {
		api = {
			harvesting: {
				fetchStatus: jest.fn(),
				fetchHarvestedBlocks: jest.fn(),
				fetchNodeList: jest.fn(),
				fetchSummary: jest.fn()
			}
		};

		harvestingModule = new HarvestingModule();
		harvestingModule.init({
			root: {
				currentAccount,
				currentAccountInfo: {
					linkedKeys: {}
				},
				networkProperties,
				networkIdentifier,
				getCurrentAccountPrivateKey: jest.fn()
			},
			api
		});

		jest.clearAllMocks();
	});

	it('has correct static name', () => {
		// Assert:
		expect(HarvestingModule.name).toBe('harvesting');
	});

	describe('fetchStatus()', () => {
		it('forwards to api.harvesting.fetchStatus with root args', async () => {
			// Arrange:
			const expected = { status: 'ACTIVE', nodeUrl: 'http://n:3000' };
			api.harvesting.fetchStatus.mockResolvedValue(expected);

			// Act:
			const result = await harvestingModule.fetchStatus();

			// Assert:
			expect(api.harvesting.fetchStatus).toHaveBeenCalledWith(networkProperties, currentAccount);
			expect(result).toEqual(expected);
		});
	});

	describe('fetchAccountHarvestedBlocks()', () => {
		it('forwards to api.harvesting.fetchHarvestedBlocks with search criteria', async () => {
			// Arrange:
			const criteria = { pageNumber: 2, pageSize: 10, order: 'desc' };
			const expected = [{ height: 1 }, { height: 2 }];
			api.harvesting.fetchHarvestedBlocks.mockResolvedValue(expected);

			// Act:
			const result = await harvestingModule.fetchAccountHarvestedBlocks(criteria);

			// Assert:
			expect(api.harvesting.fetchHarvestedBlocks).toHaveBeenCalledWith(
				networkProperties,
				currentAccount.address,
				criteria
			);
			expect(result).toEqual(expected);
		});
	});

	describe('fetchNodeList()', () => {
		it('fetches node list and returns shuffled array', async () => {
			// Arrange:
			const rawNodes = ['http://a:3000', 'http://b:3000', 'http://c:3000'];
			api.harvesting.fetchNodeList.mockResolvedValue(rawNodes);

			// Act:
			const result = await harvestingModule.fetchNodeList();

			// Assert:
			expect(api.harvesting.fetchNodeList).toHaveBeenCalledWith(networkIdentifier);
			expect(shuffle).toHaveBeenCalledWith(rawNodes);
			// Our mock shuffle reverses the array deterministically
			expect(result).toEqual([...rawNodes].reverse());
		});
	});

	describe('fetchSummary()', () => {
		it('forwards to api.harvesting.fetchSummary with root args', async () => {
			// Arrange:
			const expected = {
				latestAmount: '1.23',
				latestHeight: 123,
				latestDate: 1700000000,
				amountPer30Days: '10.00',
				blocksHarvestedPer30Days: 8
			};
			api.harvesting.fetchSummary.mockResolvedValue(expected);

			// Act:
			const result = await harvestingModule.fetchSummary();

			// Assert:
			expect(api.harvesting.fetchSummary).toHaveBeenCalledWith(
				networkProperties,
				currentAccount.address
			);
			expect(result).toEqual(expected);
		});
	});

	describe('createStartHarvestingTransaction()', () => {
		it('creates aggregate with unlink, link, and request transactions', async () => {
			// Arrange:
			const accPK = 'ACC_PK';
			const nodePublicKey = 'NODE_PK';
			const fee = 123;
			const password = 'pwd';
			const oldLinkedKeys = {
				vrfPublicKey: 'OLD_VRF',
				linkedPublicKey: 'OLD_REMOTE',
				nodePublicKey: 'OLD_NODE'
			};
			harvestingModule.init({
				root: {
					currentAccount: { ...currentAccount, publicKey: accPK },
					currentAccountInfo: { linkedKeys: oldLinkedKeys },
					networkProperties,
					networkIdentifier,
					getCurrentAccountPrivateKey: jest.fn().mockResolvedValue('CURR_PRIV')
				},
				api
			});

			// generateKeyPair returns two deterministic accounts: first VRF, then remote
			const generated = [
				{ publicKey: 'VRF_PK', privateKey: 'VRF_SK' },
				{ publicKey: 'REMOTE_PK', privateKey: 'REMOTE_SK' }
			];
			let genIndex = 0;
			jest.spyOn(utils, 'generateKeyPair').mockImplementation(() => generated[genIndex++]);

			// Act:
			const tx = await harvestingModule.createStartHarvestingTransaction({ nodePublicKey, fee }, password);

			// Assert:
			expect(utils.addressFromPublicKey).toHaveBeenCalledWith(nodePublicKey, networkIdentifier);
			expect(utils.createFee).toHaveBeenCalledWith(fee, networkProperties);
			expect(utils.createDeadline).toHaveBeenCalledWith(2, networkProperties.epochAdjustment);
			expect(utils.encodeDelegatedHarvestingMessage).toHaveBeenCalledWith(
				'CURR_PRIV',
				nodePublicKey,
				'REMOTE_SK',
				'VRF_SK'
			);

			expect(tx.type).toBe(TransactionType.AGGREGATE_COMPLETE);
			expect(tx.signerPublicKey).toBe(accPK);
			expect(tx.fee).toBe('FEE');
			expect(tx.deadline).toBe('DEADLINE');

			// 3 unlinks + 3 links + 1 transfer
			expect(tx.innerTransactions).toHaveLength(7);

			// Unlinks
			expect(tx.innerTransactions[0]).toEqual({
				type: TransactionType.VRF_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: 'OLD_VRF',
				signerPublicKey: accPK
			});
			expect(tx.innerTransactions[1]).toEqual({
				type: TransactionType.ACCOUNT_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: 'OLD_REMOTE',
				signerPublicKey: accPK
			});
			expect(tx.innerTransactions[2]).toEqual({
				type: TransactionType.NODE_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Unlink],
				linkedPublicKey: 'OLD_NODE',
				signerPublicKey: accPK
			});

			// Links
			expect(tx.innerTransactions[3]).toEqual({
				type: TransactionType.VRF_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Link],
				linkedPublicKey: 'VRF_PK',
				signerPublicKey: accPK
			});
			expect(tx.innerTransactions[4]).toEqual({
				type: TransactionType.ACCOUNT_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Link],
				linkedPublicKey: 'REMOTE_PK',
				signerPublicKey: accPK
			});
			expect(tx.innerTransactions[5]).toEqual({
				type: TransactionType.NODE_KEY_LINK,
				linkAction: LinkActionMessage[LinkAction.Link],
				linkedPublicKey: nodePublicKey,
				signerPublicKey: accPK
			});

			// Delegated harvesting request (transfer)
			expect(tx.innerTransactions[6]).toEqual({
				type: TransactionType.TRANSFER,
				mosaics: [],
				message: {
					type: MessageType.DelegatedHarvesting,
					payload: `ENCMSG:${nodePublicKey}:REMOTE_SK:VRF_SK`,
					text: ''
				},
				signerPublicKey: accPK,
				recipientAddress: `ADDR_${nodePublicKey}`
			});
		});
	});

	describe('createStopHarvestingTransaction()', () => {
		it('throws when no keys to unlink', () => {
			// Arrange:
			harvestingModule.init({
				root: {
					currentAccount,
					currentAccountInfo: { linkedKeys: {} },
					networkProperties,
					networkIdentifier
				},
				api
			});

			// Act & Assert:
			expect(() => harvestingModule.createStopHarvestingTransaction()).toThrow(ControllerError);
		});

		it('creates aggregate with unlink transactions only', () => {
			// Arrange:
			const accPK = 'ACC_PK';
			const linkedKeys = {
				vrfPublicKey: 'VRF_OLD',
				linkedPublicKey: 'REMOTE_OLD',
				nodePublicKey: 'NODE_OLD'
			};
			harvestingModule.init({
				root: {
					currentAccount: { ...currentAccount, publicKey: accPK },
					currentAccountInfo: { linkedKeys },
					networkProperties,
					networkIdentifier
				},
				api
			});

			// Act:
			const tx = harvestingModule.createStopHarvestingTransaction({ fee: 999 });

			// Assert:
			expect(utils.createFee).toHaveBeenCalledWith(999, networkProperties);
			expect(utils.createDeadline).toHaveBeenCalledWith(2, networkProperties.epochAdjustment);

			expect(tx.type).toBe(TransactionType.AGGREGATE_COMPLETE);
			expect(tx.signerPublicKey).toBe(accPK);
			expect(tx.innerTransactions).toEqual([
				{
					type: TransactionType.VRF_KEY_LINK,
					linkAction: LinkActionMessage[LinkAction.Unlink],
					linkedPublicKey: 'VRF_OLD',
					signerPublicKey: accPK
				},
				{
					type: TransactionType.ACCOUNT_KEY_LINK,
					linkAction: LinkActionMessage[LinkAction.Unlink],
					linkedPublicKey: 'REMOTE_OLD',
					signerPublicKey: accPK
				},
				{
					type: TransactionType.NODE_KEY_LINK,
					linkAction: LinkActionMessage[LinkAction.Unlink],
					linkedPublicKey: 'NODE_OLD',
					signerPublicKey: accPK
				}
			]);
			expect(tx.fee).toBe('FEE');
			expect(tx.deadline).toBe('DEADLINE');
		});
	});
});
