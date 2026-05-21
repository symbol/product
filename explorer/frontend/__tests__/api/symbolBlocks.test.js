import config from '@/config';
import * as utils from '@/utils/server';
import { fetchBlockPage } from '@/variants/symbol/api/blocks';

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
							totalFee: '123456',
							totalTransactionsCount: 3
						},
						block: {
							difficulty: '20000000000000',
							height: '1234',
							signature: 'ABCD',
							signerPublicKey: 'PUBLIC_KEY',
							size: '456',
							timestamp: '0'
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
							timestamp: '1000'
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
						totalFee: 0.123456,
						transactionCount: 3,
						statementCount: 7,
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
						totalFee: 0.222222,
						transactionCount: 4,
						statementCount: 2,
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
});
