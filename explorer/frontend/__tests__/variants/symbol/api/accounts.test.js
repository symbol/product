import {
	accountInfoResponse,
	accountInfoWithoutPublicKeyResponse,
	mainAccountInfoResponse,
	multisigAccountInfoResponse,
	remoteAccountInfoResponse
} from '../../../../__fixtures__/api/symbol/account-info';
import { harvestBlockResponses, harvestReceiptsResponse } from '../../../../__fixtures__/api/symbol/harvest-receipts';
import {
	accountInfo,
	accountInfoWithoutPublicKey,
	mainAccountInfo,
	multisigAccountInfo,
	remoteAccountInfo
} from '../../../../__fixtures__/local/symbol/account';
import { accountHarvestedBlockList } from '../../../../__fixtures__/local/symbol/account-harvested-block-list';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import { usePagination } from '@/app/utils/hooks';
import * as serverUtils from '@/app/utils/server';
import { fetchAccountHarvestedBlockPage, fetchAccountInfo, fetchAccountInfoByPublicKey } from '@/app/variants/symbol/api/accounts';
import { act, renderHook, waitFor } from '@testing-library/react';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const address = 'TD6TLAMJMDD3DC3S6SNFLGH2T5YSUNKNWM7N4VY';
const otherAddress = 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI';
const baseURL = 'https://explorer.backend/api/symbol';

const receiptURL = `${baseURL}/receipts?limit=10&offset=0&targetAddress=${address}&receiptType=8515&group=balanceChange`;

const accountURL = `${baseURL}/account`;
const accountAddress = accountInfoResponse.address;
const accountPublicKey = accountInfoResponse.publicKey;
const error400Response = { response: { data: { status: 400 } } };

const accountInfoResultCases = [
	{
		description: 'maps the account including formatted mosaic amounts and importance percentage',
		config: { response: accountInfoResponse },
		expected: { result: accountInfo }
	},
	{
		description: 'converts an importance ratio of 0.29 to an exact percentage',
		config: { response: { ...accountInfoResponse, importance: 0.29 } },
		expected: { result: { ...accountInfo, importance: 29 } }
	},
	{
		description: 'converts a small scientific-notation importance ratio to a percentage',
		config: { response: { ...accountInfoResponse, importance: 0.0000001 } },
		expected: { result: { ...accountInfo, importance: 0.00001 } }
	},
	{
		description: 'preserves the significant digits of an importance ratio',
		config: { response: { ...accountInfoResponse, importance: 0.1234567890123456 } },
		expected: { result: { ...accountInfo, importance: 12.34567890123456 } }
	},
	{
		description: 'preserves an unset public key and nullable detail fields',
		config: { response: accountInfoWithoutPublicKeyResponse },
		expected: { result: accountInfoWithoutPublicKey }
	},
	{
		description: 'maps the linked account from a main account',
		config: { response: mainAccountInfoResponse },
		expected: { result: mainAccountInfo }
	},
	{
		description: 'maps the main account from a remote account',
		config: { response: remoteAccountInfoResponse },
		expected: { result: remoteAccountInfo }
	},
	{
		description: 'maps multisig relationships and the minimum cosignatory count',
		config: { response: multisigAccountInfoResponse },
		expected: { result: multisigAccountInfo }
	},
	{
		description: 'returns null when REST rejects an invalid query with 400',
		config: { error: error400Response },
		expected: { result: null }
	},
	{
		description: 'returns null when REST reports an account not found with 404',
		config: { error: error404Response },
		expected: { result: null }
	}
];

describe('variants/symbol/api/accounts', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = baseURL;
	});

	describe('fetchAccountHarvestedBlockPage', () => {
		runApiRequestTests({
			functionToTest: fetchAccountHarvestedBlockPage,
			response: [],
			cases: [
				{
					description: 'requests harvest-fee receipts paid to the account',
					config: { params: { address } },
					expected: { url: receiptURL }
				},
				{
					description: 'translates page size and number into limit and offset',
					config: { params: { address, pageNumber: 3, pageSize: 25 } },
					expected: {
						url: `${baseURL}/receipts?limit=25&offset=50&targetAddress=${address}&receiptType=8515&group=balanceChange`
					}
				},
				{
					description: 'sends a different target address for another account',
					config: { params: { address: otherAddress } },
					expected: {
						url: `${baseURL}/receipts?limit=10&offset=0&targetAddress=${otherAddress}&receiptType=8515&group=balanceChange`
					}
				}
			]
		});

		runApiResultTests({
			functionToTest: fetchAccountHarvestedBlockPage,
			cases: [{
				description: 'returns empty history as a terminal page',
				config: { params: { address, pageNumber: 2 }, response: [] },
				expected: { result: { data: [], pageNumber: 2, isLastPage: true } }
			}]
		});

		it.each([[3, false], [10, true]])('maps every receipt with page size %s and terminal state %s', async (pageSize, isLastPage) => {
			// Arrange:
			const request = jest.spyOn(serverUtils, 'makeRequest')
				.mockResolvedValueOnce(harvestReceiptsResponse)
				.mockResolvedValueOnce(harvestBlockResponses[0])
				.mockResolvedValueOnce(harvestBlockResponses[1]);

			// Act:
			const result = await fetchAccountHarvestedBlockPage({ address, pageSize });

			// Assert: preserve duplicates, zero and relative precision; use block timestamps, never total fees.
			expect(result).toEqual({ data: accountHarvestedBlockList, pageNumber: 1, isLastPage });
			expect(request.mock.calls).toEqual([
				[`${baseURL}/receipts?limit=${pageSize}&offset=0&targetAddress=${address}&receiptType=8515&group=balanceChange`],
				[`${baseURL}/block/1234`],
				[`${baseURL}/block/1200`]
			]);
		});

		it('returns independent histories for different accounts without requesting blocks for an empty history', async () => {
			// Arrange:
			const request = jest.spyOn(serverUtils, 'makeRequest')
				.mockResolvedValueOnce([harvestReceiptsResponse[0]])
				.mockResolvedValueOnce(harvestBlockResponses[0])
				.mockResolvedValueOnce([]);

			// Act:
			const first = await fetchAccountHarvestedBlockPage({ address });
			const second = await fetchAccountHarvestedBlockPage({ address: otherAddress });

			// Assert:
			expect(first).toEqual({ data: [accountHarvestedBlockList[0]], pageNumber: 1, isLastPage: true });
			expect(second).toEqual({ data: [], pageNumber: 1, isLastPage: true });
			expect(request).toHaveBeenCalledTimes(3);
		});

		it.each([
			['receipts', new Error('network unavailable')],
			['block', new Error('network unavailable')],
			['receipts', Object.assign(new Error('unavailable'), { response: { status: 503 } })],
			['receipts', Object.assign(new Error('invalid query'), { response: { status: 400 } })],
			['block', Object.assign(new Error('missing block'), { response: { status: 404 } })]
		])('propagates %s request failure %# without returning a partial page', async (stage, error) => {
			// Arrange:
			const request = jest.spyOn(serverUtils, 'makeRequest');
			if (stage === 'block')
				request.mockResolvedValueOnce(harvestReceiptsResponse);

			request.mockRejectedValue(error);

			// Act + Assert:
			await expect(fetchAccountHarvestedBlockPage({ address })).rejects.toBe(error);
		});

		it('restarts at offset zero and replaces loaded rows when changing the account after page two', async () => {
			// Arrange: load two distinct pages for the default account.
			const request = jest.spyOn(serverUtils, 'makeRequest')
				.mockResolvedValueOnce([harvestReceiptsResponse[0]])
				.mockResolvedValueOnce(harvestBlockResponses[0])
				.mockResolvedValueOnce([harvestReceiptsResponse[2]])
				.mockResolvedValueOnce(harvestBlockResponses[1])
				.mockResolvedValueOnce([{ ...harvestReceiptsResponse[1], targetAddress: otherAddress }])
				.mockResolvedValueOnce(harvestBlockResponses[0]);
			const { result } = renderHook(() => usePagination(fetchAccountHarvestedBlockPage, [], { address, pageSize: 1 }));
			act(() => result.current.initialRequest());
			await waitFor(() => expect(result.current.data).toEqual([accountHarvestedBlockList[0]]));
			act(() => result.current.requestNextPage());
			await waitFor(() => expect(result.current.pageNumber).toBe(2));
			// Sanity check: both old pages are loaded before changing the filter.
			expect(result.current.data).toEqual([accountHarvestedBlockList[0], accountHarvestedBlockList[2]]);

			// Act:
			act(() => result.current.changeFilter({ address: otherAddress, pageSize: 1 }));

			// Assert:
			await waitFor(() => expect(result.current.data).toEqual([accountHarvestedBlockList[1]]));
			expect(result.current.pageNumber).toBe(1);
			expect(request.mock.calls).toEqual([
				[`${baseURL}/receipts?limit=1&offset=0&targetAddress=${address}&receiptType=8515&group=balanceChange`],
				[`${baseURL}/block/1234`],
				[`${baseURL}/receipts?limit=1&offset=1&targetAddress=${address}&receiptType=8515&group=balanceChange`],
				[`${baseURL}/block/1200`],
				[`${baseURL}/receipts?limit=1&offset=0&targetAddress=${otherAddress}&receiptType=8515&group=balanceChange`],
				[`${baseURL}/block/1234`]
			]);
		});

		it('restores the default account at offset zero and replaces loaded rows when clearing after page two', async () => {
			// Arrange: load two distinct pages with a non-default account filter.
			const request = jest.spyOn(serverUtils, 'makeRequest')
				.mockResolvedValueOnce([{ ...harvestReceiptsResponse[1], targetAddress: otherAddress }])
				.mockResolvedValueOnce(harvestBlockResponses[0])
				.mockResolvedValueOnce([{ ...harvestReceiptsResponse[2], targetAddress: otherAddress }])
				.mockResolvedValueOnce(harvestBlockResponses[1])
				.mockResolvedValueOnce([harvestReceiptsResponse[0]])
				.mockResolvedValueOnce(harvestBlockResponses[0]);
			const { result } = renderHook(() => usePagination(fetchAccountHarvestedBlockPage, [], { address, pageSize: 1 }));
			act(() => result.current.changeFilter({ address: otherAddress, pageSize: 1 }));
			await waitFor(() => expect(result.current.data).toEqual([accountHarvestedBlockList[1]]));
			act(() => result.current.requestNextPage());
			await waitFor(() => expect(result.current.pageNumber).toBe(2));
			// Sanity check: both non-default pages are loaded before clearing the filter.
			expect(result.current.data).toEqual([accountHarvestedBlockList[1], accountHarvestedBlockList[2]]);

			// Act:
			act(() => result.current.clearFilter());

			// Assert:
			await waitFor(() => expect(result.current.data).toEqual([accountHarvestedBlockList[0]]));
			expect(result.current.pageNumber).toBe(1);
			expect(request.mock.calls).toEqual([
				[`${baseURL}/receipts?limit=1&offset=0&targetAddress=${otherAddress}&receiptType=8515&group=balanceChange`],
				[`${baseURL}/block/1234`],
				[`${baseURL}/receipts?limit=1&offset=1&targetAddress=${otherAddress}&receiptType=8515&group=balanceChange`],
				[`${baseURL}/block/1200`],
				[`${baseURL}/receipts?limit=1&offset=0&targetAddress=${address}&receiptType=8515&group=balanceChange`],
				[`${baseURL}/block/1234`]
			]);
		});
	});

	describe('fetchAccountInfo', () => {
		describe('request', () => {
			runApiRequestTests({
				functionToTest: fetchAccountInfo,
				response: accountInfoResponse,
				cases: [
					{
						description: 'requests the account by address',
						config: { params: accountAddress },
						expected: { url: `${accountURL}?address=${accountAddress}` }
					}
				]
			});
		});

		describe('result', () => {
			runApiResultTests({ functionToTest: fetchAccountInfo, cases: accountInfoResultCases });
		});
	});

	describe('fetchAccountInfoByPublicKey', () => {
		describe('request', () => {
			runApiRequestTests({
				functionToTest: fetchAccountInfoByPublicKey,
				response: accountInfoResponse,
				cases: [
					{
						description: 'requests the account by public key',
						config: { params: accountPublicKey },
						expected: { url: `${accountURL}?publicKey=${accountPublicKey}` }
					}
				]
			});
		});

		describe('result', () => {
			runApiResultTests({ functionToTest: fetchAccountInfoByPublicKey, cases: accountInfoResultCases });
		});
	});

	describe.each([
		['address lookup', fetchAccountInfo, accountAddress],
		['public key lookup', fetchAccountInfoByPublicKey, accountPublicKey]
	])('%s failure handling', (_description, functionToTest, parameter) => {
		it.each([
			['a 503 service error', { response: { data: { status: 503 } } }],
			['a communication failure', new Error('Network Error')]
		])('propagates %s', async (_errorDescription, error) => {
			// Arrange:
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

			// Act + Assert:
			await expect(functionToTest(parameter)).rejects.toBe(error);
			expect(makeRequest).toHaveBeenCalledTimes(1);
		});
	});
});
