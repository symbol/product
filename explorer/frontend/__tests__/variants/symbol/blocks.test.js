import '@testing-library/jest-dom';
import config from '@/config';
import * as utils from '@/utils/server';
import { fetchBlockPage } from '@/variants/symbol/api/blocks';

jest.mock('@/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/utils/server')
}));

describe('variants/symbol/api/blocks', () => {
	const originalConfig = { ...config };

	beforeEach(() => {
		config.PLATFORM = 'symbol';
		config.SYMBOL_NODE_URL = 'https://symbol.node';
		config.SYMBOL_EPOCH_ADJUSTMENT = 1615853185;
		config.NATIVE_MOSAIC_DIVISIBILITY = 6;
	});

	afterEach(() => {
		Object.assign(config, originalConfig);
	});

	it('maps Symbol block-list finalization, statement count, and batched block rewards', async () => {
		// Arrange:
		const blocksResponse = {
			data: [
				{
					meta: {
						hash: '5A9D',
						statementsCount: 7,
						totalFee: '123456',
						transactionsCount: 1,
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
						beneficiaryAddress: 'BENEFICIARY_2',
						size: '789',
						timestamp: '1000'
					}
				}
			]
		};
		const chainInfoResponse = {
			latestFinalizedBlock: {
				height: '1234'
			}
		};
		const statementsResponse = {
			data: [
				{
					statement: {
						height: '1234',
						receipts: [
							{
								type: 20803,
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
								amount: '200000'
							},
							{
								type: 20803,
								amount: '300000'
							}
						]
					}
				},
				{
					statement: {
						height: '1235',
						receipts: [
							{
								type: 8515,
								amount: '999999'
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
								amount: '100000'
							}
						]
					}
				}
			]
		};
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce(blocksResponse);
		makeRequest.mockResolvedValueOnce(chainInfoResponse);
		makeRequest.mockResolvedValueOnce(statementsResponse);

		// Act:
		const result = await fetchBlockPage({
			pageNumber: 2,
			pageSize: 123
		});

		// Assert:
		expect(makeRequest).toHaveBeenNthCalledWith(
			1,
			'/api/symbol-node/blocks?pageNumber=2&pageSize=100&order=desc&orderBy=height'
		);
		expect(makeRequest).toHaveBeenNthCalledWith(2, '/api/symbol-node/chain/info');
		expect(makeRequest).toHaveBeenNthCalledWith(
			3,
			'/api/symbol-node/statements/transaction?fromHeight=1234&toHeight=1235&receiptType=20803&pageSize=100'
		);
		expect(result).toEqual({
			data: [
				expect.objectContaining({
					hash: '5A9D',
					height: 1234,
					harvester: 'PUBLIC_KEY',
					totalFee: 0.123456,
					transactionCount: 3,
					statementCount: 7,
					blockReward: 0.123456,
					isFinalized: true
				}),
				expect.objectContaining({
					hash: '6BCD',
					height: 1235,
					harvester: 'PUBLIC_KEY_2',
					beneficiaryAddress: 'BENEFICIARY_2',
					totalFee: 0.222222,
					transactionCount: 4,
					statementCount: 2,
					blockReward: 0.6,
					isFinalized: false
				})
			],
			pageNumber: 2
		});
	});

	it('can skip block reward and finalization side requests', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(utils, 'makeRequest');
		makeRequest.mockResolvedValueOnce({
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
		});

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

describe('variants/symbol/api/stats', () => {
	it('skips Symbol block-list side requests when fetching block statistics', async () => {
		// Arrange:
		jest.resetModules();
		const fetchBlockPage = jest.fn().mockResolvedValue({
			data: [
				{
					height: 2,
					timestamp: '2026-01-01T00:01:00.000Z',
					totalFee: 2,
					difficulty: '20.00'
				},
				{
					height: 1,
					timestamp: '2026-01-01T00:00:00.000Z',
					totalFee: 1,
					difficulty: '10.00'
				}
			]
		});
		jest.doMock('@/variants/symbol/api/blocks', () => ({
			__esModule: true,
			fetchBlockPage
		}));
		const symbolStats = require('@/variants/symbol/api/stats');

		// Act:
		await symbolStats.fetchBlockStats();

		// Assert:
		expect(fetchBlockPage).toHaveBeenCalledWith({
			pageSize: 241,
			includeBlockRewards: false,
			includeFinalization: false
		});
		jest.dontMock('@/variants/symbol/api/blocks');
	});
});
