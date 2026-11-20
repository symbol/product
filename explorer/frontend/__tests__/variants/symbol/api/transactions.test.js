import { transactionResponse as confirmedTransaction } from '../../../../__fixtures__/api/symbol/transactions';
import { transaction } from '../../../../__fixtures__/local/symbol/transactions';
import { runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import { TRANSACTION_DIRECTION } from '@/app/constants';
import { usePagination } from '@/app/utils';
import * as serverUtils from '@/app/utils/server';
import { fetchAccountTransactionPage, fetchTransactionPage } from '@/app/variants/symbol/api/transactions';
import { act, renderHook } from '@testing-library/react';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const symbolApiBaseURL = 'https://explorer.backend/api/symbol';
const senderAddress = confirmedTransaction.sender;
const recipientAddress = confirmedTransaction.recipient;

const expectSingleRequest = (makeRequest, expectedURL) => {
	expect(makeRequest).toHaveBeenCalledTimes(1);
	expect(makeRequest).toHaveBeenCalledWith(expectedURL);
};

describe('variants/symbol/api/transactions', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = symbolApiBaseURL;
	});

	describe('fetchTransactionPage request', () => {
		runApiRequestTests({
			functionToTest: fetchTransactionPage,
			response: [],
			cases: [
				{
					description: 'requests the default confirmed page',
					config: {},
					expected: { url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC` }
				},
				{
					description: 'treats a null search object as the default request',
					config: { params: null },
					expected: { url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC` }
				},
				{
					description: 'omits null UI filters and uses the helper pagination defaults',
					config: {
						params: {
							pageNumber: null,
							pageSize: null,
							group: null,
							address: null,
							from: null,
							to: null,
							types: null,
							height: null,
							mosaic: null,
							signerPublicKey: null,
							embedded: 'FaLsE',
							order: null
						}
					},
					expected: { url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC` }
				},
				{
					description: 'requests the selected page size and page number',
					config: { params: { pageNumber: 3, pageSize: 25 } },
					expected: { url: `${symbolApiBaseURL}/transactions?limit=25&offset=50&embedded=false&order=DESC` }
				},
				{
					description: 'maps "from"/"to" to REST senderAddress/recipientAddress and preserves type, height and mosaic filters',
					config: {
						params: {
							pageNumber: 2,
							pageSize: 5,
							types: ['TRANSFER', 'AGGREGATE_COMPLETE'],
							from: senderAddress,
							to: recipientAddress,
							height: 345,
							mosaic: 'symbol.xym'
						}
					},
					expected: {
						url:
							`${symbolApiBaseURL}/transactions?limit=5&offset=5&height=345&transactionTypes=TRANSFER%2CAGGREGATE_COMPLETE&` +
							`senderAddress=${senderAddress}&recipientAddress=${recipientAddress}&mosaic=symbol.xym&` +
							'embedded=false&order=DESC'
					}
				},
				{
					description: 'preserves a mosaic ID',
					config: { params: { mosaic: '72c0212e67a08bce' } },
					expected: {
						url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&mosaic=72c0212e67a08bce&embedded=false&order=DESC`
					}
				},
				{
					description: 'preserves a large block height as an exact decimal string',
					config: { params: { height: '9223372036854775807' } },
					expected: {
						url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&height=9223372036854775807&embedded=false&order=DESC`
					}
				},
				{
					description: 'passes through a scalar transaction type',
					config: { params: { types: 'TRANSFER' } },
					expected: {
						url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&transactionTypes=TRANSFER&embedded=false&order=DESC`
					}
				},
				{
					description: 'combines sender and recipient with a signer public key',
					config: { params: { from: senderAddress, to: recipientAddress, signerPublicKey: 'AB'.repeat(32) } },
					expected: {
						url:
							`${symbolApiBaseURL}/transactions?limit=10&offset=0&senderAddress=${senderAddress}&` +
							`recipientAddress=${recipientAddress}&signerPublicKey=${'AB'.repeat(32)}&embedded=false&order=DESC`
					}
				},
				{
					description: 'omits the confirmed group and passes through the signer public key',
					config: { params: { group: 'confirmed', signerPublicKey: 'AB'.repeat(32) } },
					expected: {
						url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&signerPublicKey=${'AB'.repeat(32)}&` +
							'embedded=false&order=DESC'
					}
				},
				{
					description: 'keeps embedded rows disabled when explicitly false',
					config: { params: { embedded: false } },
					expected: { url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC` }
				},
				{
					description: 'uses address only for search and keeps referenceAddress out of the REST query',
					config: { params: { address: senderAddress, referenceAddress: recipientAddress } },
					expected: {
						url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&address=${senderAddress}&embedded=false&order=DESC`
					}
				}
			]
		});
	});

	describe('fetchTransactionPage result', () => {
		runApiResultTests({
			functionToTest: fetchTransactionPage,
			cases: [
				{
					description: 'maps the REST response while preserving identifiers, numeric amounts and timestamp',
					config: { response: [confirmedTransaction], params: { pageNumber: 3, pageSize: 25 } },
					expected: { result: { data: [transaction], pageNumber: 3, isLastPage: false } }
				},
				{
					description: 'preserves the Symbol aggregate type name',
					config: { response: [{ ...confirmedTransaction, type: 'AGGREGATE_COMPLETE' }] },
					expected: { result: { data: [{ ...transaction, type: 'AGGREGATE_COMPLETE' }], pageNumber: 1, isLastPage: false } }
				},
				{
					description: 'returns an empty page when REST returns no rows',
					config: { response: [], params: { pageNumber: 4 } },
					expected: { result: { data: [], pageNumber: 4, isLastPage: true } }
				},
				{
					description: 'preserves null recipient and message and multiple mosaic amounts',
					config: {
						response: [
							{
								...confirmedTransaction,
								recipient: null,
								message: null,
								value: [
									{ id: '72C0212E67A08BCE', name: 'symbol.xym', amount: 1.25 },
									{ id: 'ABCDEF0123456789', name: 'alias.namespace', amount: 2.5 }
								]
							}
						]
					},
					expected: {
						result: {
							data: [
								{
									...transaction,
									recipient: null,
									message: null,
									value: [
										{ id: '72C0212E67A08BCE', name: 'symbol.xym', amount: 1.25 },
										{ id: 'ABCDEF0123456789', name: 'alias.namespace', amount: 2.5 }
									]
								}
							],
							pageNumber: 1,
							isLastPage: false
						}
					}
				},
				{
					description: 'derives both directions and counterparties from referenceAddress',
					config: {
						params: { referenceAddress: senderAddress },
						response: [
							confirmedTransaction,
							{ ...confirmedTransaction, hash: 'CD'.repeat(32), sender: recipientAddress, recipient: senderAddress }
						]
					},
					expected: {
						result: {
							data: [
								{ ...transaction, account: recipientAddress, direction: TRANSACTION_DIRECTION.OUTGOING },
								{
									...transaction,
									hash: 'CD'.repeat(32),
									sender: recipientAddress,
									recipient: senderAddress,
									account: recipientAddress,
									direction: TRANSACTION_DIRECTION.INCOMING
								}
							],
							pageNumber: 1,
							isLastPage: false
						}
					}
				},
				{
					description: 'keeps the display reference independent from the account-wide search address',
					config: { params: { address: senderAddress, referenceAddress: recipientAddress }, response: [confirmedTransaction] },
					expected: {
						result: { data: [{ ...transaction, direction: TRANSACTION_DIRECTION.INCOMING }], pageNumber: 1, isLastPage: false }
					}
				}
			]
		});
	});

	describe('fetchAccountTransactionPage', () => {
		runApiRequestTests({
			functionToTest: fetchAccountTransactionPage,
			response: [],
			cases: [
				{
					description: 'uses the viewed address as an account-wide search',
					config: { params: { address: senderAddress } },
					expected: {
						url: `${symbolApiBaseURL}/transactions?limit=10&offset=0&address=${senderAddress}&embedded=false&order=DESC`
					}
				},
				{
					description: 'maps the "from" filter to senderAddress and the viewed account to recipientAddress',
					config: { params: { pageNumber: 2, pageSize: 5, address: recipientAddress, from: senderAddress } },
					expected: {
						url:
							`${symbolApiBaseURL}/transactions?limit=5&offset=5&senderAddress=${senderAddress}&` +
							`recipientAddress=${recipientAddress}&embedded=false&order=DESC`
					}
				},
				{
					description: 'maps the viewed account to senderAddress and the "to" filter to recipientAddress',
					config: { params: { address: senderAddress, to: recipientAddress } },
					expected: {
						url:
							`${symbolApiBaseURL}/transactions?limit=10&offset=0&senderAddress=${senderAddress}&` +
							`recipientAddress=${recipientAddress}&embedded=false&order=DESC`
					}
				}
			]
		});
		runApiResultTests({
			functionToTest: fetchAccountTransactionPage,
			cases: [
				{
					description: 'uses the viewed account as the outgoing display reference',
					config: { params: { address: senderAddress }, response: [confirmedTransaction] },
					expected: {
						result: {
							data: [{ ...transaction, account: recipientAddress, direction: TRANSACTION_DIRECTION.OUTGOING }],
							pageNumber: 1,
							isLastPage: false
						}
					}
				},
				{
					description: 'keeps the viewed recipient as the incoming reference with a from filter',
					config: {
						params: { pageNumber: 2, pageSize: 5, address: recipientAddress, from: senderAddress },
						response: [confirmedTransaction]
					},
					expected: {
						result: { data: [{ ...transaction, direction: TRANSACTION_DIRECTION.INCOMING }], pageNumber: 2, isLastPage: false }
					}
				},
				{
					description: 'keeps the viewed sender as the outgoing reference with a to filter',
					config: { params: { address: senderAddress, to: recipientAddress }, response: [confirmedTransaction] },
					expected: {
						result: {
							data: [{ ...transaction, account: recipientAddress, direction: TRANSACTION_DIRECTION.OUTGOING }],
							pageNumber: 1,
							isLastPage: false
						}
					}
				}
			]
		});
	});

	it('returns distinct REST rows and page numbers for consecutive pages', async () => {
		// Arrange:
		const firstTransaction = { ...confirmedTransaction, hash: 'AB'.repeat(32), height: 123 };
		const secondTransaction = { ...confirmedTransaction, hash: 'CD'.repeat(32), height: 122 };
		const makeRequest = jest
			.spyOn(serverUtils, 'makeRequest')
			.mockResolvedValueOnce([firstTransaction])
			.mockResolvedValueOnce([secondTransaction]);

		// Act:
		const firstPage = await fetchTransactionPage({ pageNumber: 1, pageSize: 1 });
		const secondPage = await fetchTransactionPage({ pageNumber: 2, pageSize: 1 });

		// Assert:
		expect(makeRequest).toHaveBeenCalledTimes(2);
		expect(makeRequest).toHaveBeenNthCalledWith(1, `${symbolApiBaseURL}/transactions?limit=1&offset=0&embedded=false&order=DESC`);
		expect(makeRequest).toHaveBeenNthCalledWith(2, `${symbolApiBaseURL}/transactions?limit=1&offset=1&embedded=false&order=DESC`);
		expect(firstPage).toEqual({
			data: [transaction],
			pageNumber: 1,
			isLastPage: false
		});
		expect(secondPage).toEqual({
			data: [{ ...transaction, hash: 'CD'.repeat(32), height: 122 }],
			pageNumber: 2,
			isLastPage: false
		});
	});

	it('marks a non-empty page at offset 100000 as terminal and preserves its data and page number', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ pageNumber: 401, pageSize: 250 });

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=250&offset=100000&embedded=false&order=DESC`);
		expect(result).toEqual({
			data: [transaction],
			pageNumber: 401,
			isLastPage: true
		});
	});

	it('continues pagination when the next offset is exactly 100000', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ pageNumber: 400, pageSize: 250 });

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=250&offset=99750&embedded=false&order=DESC`);
		expect(result).toEqual({
			data: [transaction],
			pageNumber: 400,
			isLastPage: false
		});
	});

	it('marks offset 99999 terminal when the next offset would exceed the REST limit', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ pageNumber: 33334, pageSize: 3 });

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=3&offset=99999&embedded=false&order=DESC`);
		expect(result.data).toEqual([transaction]);
		expect(result.pageNumber).toBe(33334);
		expect(result.isLastPage).toBe(true);
	});

	it('continues pagination when the next offset is within the REST limit', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ pageNumber: 33333, pageSize: 3 });

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=3&offset=99996&embedded=false&order=DESC`);
		expect(result.data).toEqual([transaction]);
		expect(result.pageNumber).toBe(33333);
		expect(result.isLastPage).toBe(false);
	});

	it('does not request another page after reaching a terminal page', async () => {
		try {
			// Arrange:
			jest.useFakeTimers();
			const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);
			const terminalPage = await fetchTransactionPage({ pageNumber: 401, pageSize: 250 });
			const { result } = renderHook(() => usePagination(fetchTransactionPage, terminalPage.data, {}, { initialPage: terminalPage }));
			const terminalData = result.current.data;

			// Act:
			await act(async () => {
				result.current.requestNextPage();
				await jest.runOnlyPendingTimersAsync();
			});

			// Assert:
			expect(makeRequest).toHaveBeenCalledTimes(1);
			expect(result.current.data).toEqual(terminalData);
			expect(result.current.isLastPage).toBe(true);
		} finally {
			jest.useRealTimers();
		}
	});

	it('propagates REST pagination validation errors without changing the requested limit', async () => {
		// Arrange:
		const error = Object.assign(new Error('Invalid limit'), { response: { status: 400 } });
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchTransactionPage({ pageSize: 251 })).rejects.toBe(error);
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=251&offset=0&embedded=false&order=DESC`);
	});

	it.each([
		{ description: 'omitted', searchParams: undefined },
		{ description: 'null', searchParams: null }
	])('defaults $description account-history filters to the unfiltered page', async ({ searchParams }) => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchAccountTransactionPage(searchParams);

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC`);
		expect(result).toEqual({ data: [], pageNumber: 1, isLastPage: true });
	});

	it.each(['unconfirmed', 'partial', 'unknown'])('rejects group %s without requesting REST', async group => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ group })).rejects.toThrow(`Symbol transaction group is not supported: ${group}`);
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it.each([
		{ description: 'from', filters: { from: senderAddress } },
		{ description: 'to', filters: { to: recipientAddress } },
		{ description: 'signer public key', filters: { signerPublicKey: 'AB'.repeat(32) } }
	])('rejects address with $description without requesting REST', async ({ filters }) => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ address: senderAddress, ...filters }))
			.rejects.toThrow('address cannot be combined with from, to, or signerPublicKey');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('rejects an account-history filter with both directions without requesting REST', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchAccountTransactionPage({ address: senderAddress, from: recipientAddress, to: senderAddress }))
			.rejects.toThrow('Account history cannot combine from and to');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('rejects an order other than descending', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ order: 'ASC' })).rejects.toThrow('order must be DESC');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('rejects embedded transactions because shared rows require a transaction hash', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ embedded: true }))
			.rejects.toThrow('embedded Symbol transactions are not supported by the shared transaction list');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('does not mutate the caller search parameters', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);
		const searchParams = { pageNumber: 2, pageSize: 5, address: senderAddress, from: recipientAddress, types: ['TRANSFER'] };
		const searchParamsBeforeRequest = { ...searchParams, types: [...searchParams.types] };

		// Act:
		await fetchAccountTransactionPage(searchParams);

		// Assert:
		expect(searchParams).toEqual(searchParamsBeforeRequest);
	});

	it('rejects a non-array REST response', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue({ data: [] });

		// Act + Assert:
		await expect(fetchTransactionPage()).rejects.toThrow('Symbol transactions response must be an array');
	});

	it.each([400, 404, 503])('propagates REST HTTP error %s', async status => {
		// Arrange:
		const error = Object.assign(new Error(`HTTP ${status}`), { response: { status } });
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchTransactionPage()).rejects.toBe(error);
	});

	it('propagates network errors', async () => {
		// Arrange:
		const error = new Error('connection failed');
		jest.spyOn(serverUtils, 'makeRequest').mockRejectedValue(error);

		// Act + Assert:
		await expect(fetchTransactionPage()).rejects.toBe(error);
	});
});
