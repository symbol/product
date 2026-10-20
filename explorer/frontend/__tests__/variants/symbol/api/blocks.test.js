import config from '@/app/config';
import * as serverUtils from '@/app/utils/server';
import {
	fetchBlockInfo,
	fetchBlockPage,
	fetchChainHight,
	fetchChainStatus
} from '@/app/variants/symbol/api/blocks';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const symbolApiBaseURL = 'https://explorer.backend/api/symbol';
const symbolNodewatchURL = 'https://nodewatch.backend';

describe('variants/symbol/api/blocks', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = symbolApiBaseURL;
		config.PUBLIC_NODEWATCH_URL = symbolNodewatchURL;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('requests the Symbol cursor endpoint and preserves REST values', async () => {
		// Arrange:
		const blocks = [
			{
				height: 123,
				totalFee: 12.5,
				blockReward: null,
				difficulty: '123456789',
				timestamp: '2026-09-15T01:02:03Z',
				isFinalized: true
			},
			{
				height: 122,
				totalFee: 0,
				blockReward: 0,
				isFinalized: false
			},
			{
				height: 121,
				totalFee: 1.25,
				blockReward: 3.5,
				isFinalized: true
			}
		];
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(blocks);

		// Act:
		const result = await fetchBlockPage({ pageNumber: 2, pageSize: 3 });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/blocks?limit=3&sort=DESC`);
		expect(result).toEqual({
			data: blocks,
			pageNumber: 2,
			isLastPage: false,
			nextPageParams: { fromHeight: 120, sort: 'DESC' }
		});
	});

	it('accepts limit 100, requests 100 records, and returns the next descending cursor', async () => {
		// Arrange:
		const blocks = Array.from({ length: 100 }, (_, index) => ({ height: 200 - index }));
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(blocks);

		// Act:
		const result = await fetchBlockPage({ limit: 100 });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/blocks?limit=100&sort=DESC`);
		expect(result.data).toHaveLength(100);
		expect(result).toMatchObject({
			pageNumber: 1,
			isLastPage: false,
			nextPageParams: { fromHeight: 100, sort: 'DESC' }
		});
	});

	it('passes the cursor and normalizes sort without sending page pagination parameters', async () => {
		// Arrange:
		const blocks = [{ height: 99 }, { height: 98 }];
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(blocks);

		// Act:
		const result = await fetchBlockPage({ pageNumber: 3, pageSize: 2, fromHeight: 99, sort: 'desc' });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/blocks?limit=2&fromHeight=99&sort=DESC`);
		expect(result.nextPageParams).toEqual({ fromHeight: 97, sort: 'DESC' });
		expect(result.pageNumber).toBe(3);
	});

	it('supports ascending cursor progression', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([{ height: 1 }, { height: 2 }]);

		// Act:
		const result = await fetchBlockPage({ pageSize: 2, sort: 'ASC' });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/blocks?limit=2&sort=ASC`);
		expect(result.nextPageParams).toEqual({ fromHeight: 3, sort: 'ASC' });
	});

	it.each([
		['a short page', [{ height: 3 }, { height: 2 }], 3],
		['an empty page', [], 10],
		['height one', [{ height: 1 }], 1]
	])('marks %s as terminal without a zero cursor', async (description, blocks, pageSize) => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(blocks);

		// Act:
		const result = await fetchBlockPage({ pageSize });

		// Assert:
		expect(result).toMatchObject({ data: blocks, isLastPage: true, nextPageParams: null });
	});

	it.each([
		['a full page with an invalid first height', [{ height: '123' }, { height: 122 }], 2],
		['a short page with an invalid last height', [{ height: 123 }, { height: '122' }], 10],
		['a full page with an invalid non-terminal height', [{ height: 123 }, { height: '122' }, { height: 121 }], 3]
	])('rejects %s instead of treating it as a terminal page', async (_description, blocks, limit) => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(blocks);

		// Act + Assert:
		await expect(fetchBlockPage({ limit })).rejects.toThrow('Symbol blocks response must contain integer heights');
	});

	it('accepts fromHeight 1 and ends at block height 1 without a zero cursor', async () => {
		// Arrange:
		const blocks = [{ height: 1 }];
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(blocks);

		// Act:
		const result = await fetchBlockPage({ fromHeight: 1, limit: 1, sort: 'DESC' });

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/blocks?limit=1&fromHeight=1&sort=DESC`);
		expect(result.data).toEqual(blocks);
		expect(result.isLastPage).toBe(true);
		expect(result.nextPageParams).toBeNull();
	});

	it.each([
		[{ limit: 0 }, /limit must be between/],
		[{ limit: 101 }, /limit must be between/],
		[{ limit: 1.5 }, /limit must be an integer/],
		[{ fromHeight: 0 }, /fromHeight must be greater/],
		[{ sort: 'invalid' }, /sort must be either/],
		[{ pageNumber: 'invalid' }, /pageNumber must be an integer/]
	])('rejects invalid request parameters %#', async (searchParams, expectedError) => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchBlockPage(searchParams)).rejects.toThrow(expectedError);
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('rejects a non-array REST response', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue({ data: [] });

		// Act + Assert:
		await expect(fetchBlockPage()).rejects.toThrow('Symbol blocks response must be an array');
	});

	describe('fetchBlockInfo', () => {
		it('fetches block detail for the specified height and preserves REST values', async () => {
			// Arrange:
			const blockHeight = 822435;
			const response = {
				height: blockHeight,
				hash: '02'.repeat(32),
				previousHash: '01'.repeat(32),
				timestamp: '2026-01-02 00:00:00',
				networkTimestamp: 822435000,
				harvester: 'TBJU67Q5BITMUTRRN6IB4I7FLSDQDWZA34I2PMQ',
				beneficiaryAddress: 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				totalFee: 2,
				transactionCount: 2,
				statementCount: 2,
				blockReward: null,
				isFinalized: true,
				difficulty: '9007199254740993',
				signature: '02'.repeat(64),
				size: 102,
				feeMultiplier: 2,
				proofGamma: '02'.repeat(32),
				proofVerificationHash: '02'.repeat(16),
				proofScalar: '02'.repeat(32),
				stateHash: '02'.repeat(32),
				stateHashSubCacheMerkleRoots: ['ROOT 2'],
				receiptsHash: '02'.repeat(32),
				transactionsHash: '02'.repeat(32),
				votingEligibleAccountsCount: null,
				harvestingEligibleAccountsCount: '9007199254740993',
				totalVotingBalance: null,
				previousImportanceBlockHash: null,
				blockType: 'nemesis'
			};
			const expectedResponse = JSON.parse(JSON.stringify(response));
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue(response);

			// Act:
			const result = await fetchBlockInfo(`${blockHeight}`);

			// Assert:
			expect(makeRequest).toHaveBeenCalledWith(`${symbolApiBaseURL}/block/${blockHeight}`);
			expect(result).toStrictEqual(expectedResponse);
		});

		it.each([400, 404])('returns null for REST status %s', async status => {
			// Arrange:
			jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue({ response: { data: { status } } });

			// Act:
			const result = await fetchBlockInfo(822435);

			// Assert:
			expect(result).toBeNull();
		});

		it.each([
			['503 response', { response: { data: { status: 503 } } }],
			['communication failure', new Error('connection refused')],
			['timeout', Object.assign(new Error('request timed out'), { code: 'ECONNABORTED' })]
		])('propagates a %s', async (_description, error) => {
			// Arrange:
			jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchBlockInfo(822435)).rejects.toBe(error);
		});
	});

	it('keeps chain status connected to Nodewatch', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue({ height: '123', finalizedHeight: '120' });

		// Act:
		const result = await fetchChainStatus();

		// Assert:
		expect(makeRequest).toHaveBeenCalledWith(`${symbolNodewatchURL}/api/symbol/height`);
		expect(result).toEqual({ height: 123, finalizedHeight: 120 });
	});

	it('returns chain height from Nodewatch status', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue({ height: '123', finalizedHeight: '120' });

		// Act:
		const result = await fetchChainHight();

		// Assert:
		expect(result).toBe(123);
	});
});
