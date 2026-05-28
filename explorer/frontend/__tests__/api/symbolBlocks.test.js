import config from '@/config';
import * as utils from '@/utils/server';
import { fetchBlockInfo, fetchBlockPage } from '@/variants/symbol/api/blocks';

jest.mock('@/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils/server')
	};
});

describe('variants/symbol/api/blocks', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.SYMBOL_EPOCH_ADJUSTMENT = 1615853185;
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
	});

	describe('fetchBlockPage', () => {
		it('maps statement count from block meta and block reward from inflation receipts in the searched height range', async () => {
			// Arrange:
			const searchCriteria = {
				pageNumber: 2,
				pageSize: 123
			};
			const response = {
				data: [
					{
						meta: {
							hash: '5A9D',
							statementsCount: 7,
							stateHashSubCacheMerkleRoots: [
								'ACCOUNT_STATE_ROOT',
								'NAMESPACE_ROOT',
								'MOSAIC_ROOT',
								'MULTISIG_ROOT',
								'HASH_LOCK_ROOT',
								'SECRET_LOCK_ROOT',
								'ACCOUNT_RESTRICTION_ROOT',
								'MOSAIC_RESTRICTION_ROOT',
								'METADATA_ROOT'
							],
							totalFee: '123456',
							totalTransactionsCount: 3
						},
						block: {
							difficulty: '20000000000000',
							height: '1234',
							signature: 'ABCD',
							signerPublicKey: 'PUBLIC_KEY',
							size: '456',
							timestamp: '0',
							type: 33091,
							feeMultiplier: 100,
							proofGamma: 'GAMMA_1',
							proofScalar: 'SCALAR_1',
							proofVerificationHash: 'VERIFY_1',
							stateHash: 'STATE_HASH_1',
							receiptsHash: 'RECEIPTS_HASH_1',
							transactionsHash: 'TRANSACTIONS_HASH_1'
						}
					},
					{
						meta: {
							hash: '6BCD',
							statementsCount: 2,
							totalFee: '222222',
							totalTransactionsCount: 4
						},
						block: {
							difficulty: '30000000000000',
							height: '1235',
							signature: 'BCDE',
							signerPublicKey: 'PUBLIC_KEY_2',
							size: '789',
							timestamp: '1000',
							type: 33347,
							beneficiaryAddress: 'BENEFICIARY_2',
							feeMultiplier: 200,
							proofGamma: 'GAMMA_2',
							proofScalar: 'SCALAR_2',
							proofVerificationHash: 'VERIFY_2',
							stateHash: 'STATE_HASH_2',
							receiptHash: 'RECEIPTS_HASH_2',
							transactionHash: 'TRANSACTIONS_HASH_2'
						}
					}
				]
			};
			const statementResponse = {
				data: [
					{
						statement: {
							height: '1234',
							receipts: [
								{
									type: 20803,
									mosaicId: '72C0212E67A08BCE',
									amount: '123456'
								}
							]
						}
					},
					{
						statement: {
							height: '1235',
							receipts: [
								{
									type: 20803,
									mosaicId: '72C0212E67A08BCE',
									amount: '200000'
								},
								{
									type: 20803,
									mosaicId: '72C0212E67A08BCE',
									amount: '300000'
								}
							]
						}
					},
					{
						statement: {
							receipts: [
								{
									type: 8515,
									mosaicId: '72C0212E67A08BCE',
									amount: '999999'
								}
							]
						}
					}
				]
			};
			const chainInfoResponse = {
				latestFinalizedBlock: {
					height: '1234'
				}
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);
			makeRequest.mockResolvedValueOnce(statementResponse);
			const expectedResult = {
				data: [
					{
						difficulty: '20.00',
						hash: '5A9D',
						height: 1234,
						signature: 'ABCD',
						size: 456,
						timestamp: '2021-03-16T00:06:25.000Z',
						harvester: 'PUBLIC_KEY',
						beneficiaryAddress: null,
						totalFee: 0.123456,
						transactionCount: 3,
						statementCount: 7,
						rawDifficulty: '20000000000000',
						feeMultiplier: 100,
						proofGamma: 'GAMMA_1',
						proofScalar: 'SCALAR_1',
						proofVerificationHash: 'VERIFY_1',
						stateHash: 'STATE_HASH_1',
						stateHashSubCacheMerkleRoots: {
							accountState: 'ACCOUNT_STATE_ROOT',
							namespace: 'NAMESPACE_ROOT',
							mosaic: 'MOSAIC_ROOT',
							multisig: 'MULTISIG_ROOT',
							hashLockInfo: 'HASH_LOCK_ROOT',
							secretLookInfo: 'SECRET_LOCK_ROOT',
							accountRestriction: 'ACCOUNT_RESTRICTION_ROOT',
							mosaicRestriction: 'MOSAIC_RESTRICTION_ROOT',
							metadata: 'METADATA_ROOT'
						},
						receiptsHash: 'RECEIPTS_HASH_1',
						transactionsHash: 'TRANSACTIONS_HASH_1',
						blockType: 'Normal Block',
						blockReward: 0.123456,
						isFinalized: true
					},
					{
						difficulty: '30.00',
						hash: '6BCD',
						height: 1235,
						signature: 'BCDE',
						size: 789,
						timestamp: '2021-03-16T00:06:26.000Z',
						harvester: 'PUBLIC_KEY_2',
						beneficiaryAddress: 'BENEFICIARY_2',
						totalFee: 0.222222,
						transactionCount: 4,
						statementCount: 2,
						rawDifficulty: '30000000000000',
						feeMultiplier: 200,
						proofGamma: 'GAMMA_2',
						proofScalar: 'SCALAR_2',
						proofVerificationHash: 'VERIFY_2',
						stateHash: 'STATE_HASH_2',
						stateHashSubCacheMerkleRoots: {
							accountState: null,
							namespace: null,
							mosaic: null,
							multisig: null,
							hashLockInfo: null,
							secretLookInfo: null,
							accountRestriction: null,
							mosaicRestriction: null,
							metadata: null
						},
						receiptsHash: 'RECEIPTS_HASH_2',
						transactionsHash: 'TRANSACTIONS_HASH_2',
						blockType: 'Importance Block',
						blockReward: 0.5,
						isFinalized: false
					}
				],
				pageNumber: 2
			};

			// Act:
			const result = await fetchBlockPage(searchCriteria);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(
				1,
				'/api/symbol-node/blocks?pageNumber=2&pageSize=100&order=desc&orderBy=height'
			);
			expect(makeRequest).toHaveBeenNthCalledWith(
				2,
				'/api/symbol-node/chain/info'
			);
			expect(makeRequest).toHaveBeenNthCalledWith(
				3,
				'/api/symbol-node/statements/transaction?fromHeight=1234&toHeight=1235&receiptType=20803&pageSize=100'
			);
			expect(makeRequest).toHaveBeenCalledTimes(3);
			expect(result).toEqual(expectedResult);
		});

		it('uses zero block reward when the block has no statements', async () => {
			// Arrange:
			const response = {
				data: [
					{
						meta: {
							hash: '5A9D',
							statementsCount: 0,
							totalFee: '123456',
							totalTransactionsCount: 3
						},
						block: {
							height: '1234',
							timestamp: '0'
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce({
				latestFinalizedBlock: {
					height: '1233'
				}
			});

			// Act:
			const result = await fetchBlockPage();

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(2);
			expect(result.data[0].blockReward).toBe(0);
			expect(result.data[0].isFinalized).toBe(false);
		});

		it('can skip block reward and finalization side requests', async () => {
			// Arrange:
			const response = {
				data: [
					{
						meta: {
							hash: '5A9D',
							statementsCount: 7,
							totalFee: '123456',
							totalTransactionsCount: 3
						},
						block: {
							height: '1234',
							timestamp: '0'
						}
					}
				]
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);

			// Act:
			const result = await fetchBlockPage({
				includeBlockRewards: false,
				includeFinalization: false
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(1);
			expect(makeRequest).toHaveBeenCalledWith('/api/symbol-node/blocks?pageNumber=1&pageSize=10&order=desc&orderBy=height');
			expect(result.data[0].blockReward).toBe(0);
			expect(result.data[0].isFinalized).toBe(false);
		});
	});

	describe('fetchBlockInfo', () => {
		it('maps block type and finalization status from Symbol block and chain info', async () => {
			// Arrange:
			const response = {
				meta: {
					hash: '5A9D',
					statementsCount: 1,
					stateHashSubCacheMerkleRoots: [
						'ACCOUNT_STATE_ROOT',
						'NAMESPACE_ROOT',
						'MOSAIC_ROOT',
						'MULTISIG_ROOT',
						'HASH_LOCK_ROOT',
						'SECRET_LOCK_ROOT',
						'ACCOUNT_RESTRICTION_ROOT',
						'MOSAIC_RESTRICTION_ROOT',
						'METADATA_ROOT'
					],
					totalFee: '123456',
					totalTransactionsCount: 3
				},
				block: {
					difficulty: '20000000000000',
					height: '1234',
					signature: 'ABCD',
					signerPublicKey: 'PUBLIC_KEY',
					size: '456',
					timestamp: '0',
					type: 32835,
					beneficiaryAddress: 'BENEFICIARY',
					feeMultiplier: 100,
					proofGamma: 'GAMMA',
					proofScalar: 'SCALAR',
					proofVerificationHash: 'VERIFY',
					stateHash: 'STATE_HASH',
					receiptsHash: 'RECEIPTS_HASH',
					transactionsHash: 'TRANSACTIONS_HASH'
				}
			};
			const chainInfoResponse = {
				latestFinalizedBlock: {
					height: '1234'
				}
			};
			const makeRequest = jest.spyOn(utils, 'makeRequest');
			makeRequest.mockResolvedValueOnce(response);
			makeRequest.mockResolvedValueOnce(chainInfoResponse);

			// Act:
			const result = await fetchBlockInfo(1234);

			// Assert:
			expect(makeRequest).toHaveBeenNthCalledWith(1, '/api/symbol-node/blocks/1234');
			expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/chain/info');
			expect(result).toMatchObject({
				harvester: 'PUBLIC_KEY',
				beneficiaryAddress: 'BENEFICIARY',
				rawDifficulty: '20000000000000',
				feeMultiplier: 100,
				proofGamma: 'GAMMA',
				proofScalar: 'SCALAR',
				proofVerificationHash: 'VERIFY',
				stateHash: 'STATE_HASH',
				stateHashSubCacheMerkleRoots: {
					accountState: 'ACCOUNT_STATE_ROOT',
					namespace: 'NAMESPACE_ROOT',
					mosaic: 'MOSAIC_ROOT',
					multisig: 'MULTISIG_ROOT',
					hashLockInfo: 'HASH_LOCK_ROOT',
					secretLookInfo: 'SECRET_LOCK_ROOT',
					accountRestriction: 'ACCOUNT_RESTRICTION_ROOT',
					mosaicRestriction: 'MOSAIC_RESTRICTION_ROOT',
					metadata: 'METADATA_ROOT'
				},
				receiptsHash: 'RECEIPTS_HASH',
				transactionsHash: 'TRANSACTIONS_HASH',
				blockType: 'Nemesis Block',
				isFinalized: true
			});
		});
	});
});
