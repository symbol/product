import config from '@/app/config';
import { TRANSACTION_DIRECTION } from '@/app/constants';
import { usePagination } from '@/app/utils';
import * as serverUtils from '@/app/utils/server';
import { fetchTransactionPage } from '@/app/variants/symbol/api/transactions';
import { act, renderHook } from '@testing-library/react';

jest.mock('@/app/utils/server', () => ({
	__esModule: true,
	...jest.requireActual('@/app/utils/server')
}));

const symbolApiBaseURL = 'https://explorer.backend/api/symbol';
const senderAddress = 'TDSENDERADDRESS';
const recipientAddress = 'TDRECIPIENTADDRESS';
const confirmedTransaction = {
	hash: 'AB'.repeat(32),
	isEmbedded: false,
	aggregateHash: null,
	embeddedIndex: null,
	group: 'confirmed',
	height: 123,
	type: 'TRANSFER',
	sender: senderAddress,
	signer: senderAddress,
	recipient: recipientAddress,
	value: [{ id: '72C0212E67A08BCE', name: 'symbol.xym', amount: '1.25' }],
	amount: '1.25',
	fee: '0.0125',
	timestamp: '2026-10-16 01:02:03',
	message: { type: 'plain', text: 'confirmed message' }
};

const expectSingleRequest = (makeRequest, expectedURL) => {
	expect(makeRequest).toHaveBeenCalledTimes(1);
	expect(makeRequest).toHaveBeenCalledWith(expectedURL);
};

describe('variants/symbol/api/transactions', () => {
	beforeEach(() => {
		config.PUBLIC_API_BASE_URL = symbolApiBaseURL;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('requests the default confirmed page from Symbol REST', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchTransactionPage();

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC`);
		expect(result).toEqual({ data: [], pageNumber: 1, isLastPage: true });
	});

	it('treats a null search object as the default page request', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchTransactionPage(null);

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC`);
		expect(result).toEqual({ data: [], pageNumber: 1, isLastPage: true });
	});

	it('omits null UI filters instead of sending them as strings', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		await fetchTransactionPage({
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
		});

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC`);
	});

	it('requests the selected page size and page number', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ pageNumber: 3, pageSize: 25 });

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=25&offset=50&embedded=false&order=DESC`);
		expect(result).toEqual({
			data: [{ ...confirmedTransaction, account: senderAddress, direction: null }],
			pageNumber: 3,
			isLastPage: false
		});
	});

	it('returns distinct REST rows and page numbers for consecutive pages', async () => {
		// Arrange:
		const firstTransaction = { ...confirmedTransaction, hash: 'AB'.repeat(32), height: 123 };
		const secondTransaction = { ...confirmedTransaction, hash: 'CD'.repeat(32), height: 122 };
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest')
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
			data: [{ ...firstTransaction, account: senderAddress, direction: null }],
			pageNumber: 1,
			isLastPage: false
		});
		expect(secondPage).toEqual({
			data: [{ ...secondTransaction, account: senderAddress, direction: null }],
			pageNumber: 2,
			isLastPage: false
		});
	});

	it('preserves the Symbol REST transaction type name in the mapped page', async () => {
		// Arrange:
		const aggregateTransaction = { ...confirmedTransaction, type: 'AGGREGATE_COMPLETE' };
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([aggregateTransaction]);

		// Act:
		const result = await fetchTransactionPage();

		// Assert:
		expect(result.data[0].type).toBe('AGGREGATE_COMPLETE');
	});

	it('returns an empty REST array as an empty page', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		const result = await fetchTransactionPage({ pageNumber: 4, pageSize: 10 });

		// Assert:
		expect(result).toEqual({ data: [], pageNumber: 4, isLastPage: true });
	});

	it('marks a non-empty page at offset 100000 as terminal and preserves its data and page number', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ pageNumber: 401, pageSize: 250 });

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=250&offset=100000&embedded=false&order=DESC`);
		expect(result).toEqual({
			data: [{ ...confirmedTransaction, account: senderAddress, direction: null }],
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
			data: [{ ...confirmedTransaction, account: senderAddress, direction: null }],
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
		expect(result.data).toEqual([{ ...confirmedTransaction, account: senderAddress, direction: null }]);
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
		expect(result.data).toEqual([{ ...confirmedTransaction, account: senderAddress, direction: null }]);
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

	it.each([
		{ description: 'zero page size', searchParams: { pageSize: 0 }, expectedError: /pageSize must be between/ },
		{ description: 'page size above REST limit', searchParams: { pageSize: 251 }, expectedError: /pageSize must be between/ },
		{ description: 'fractional page size', searchParams: { pageSize: 1.5 }, expectedError: /pageSize must be an integer/ },
		{ description: 'boolean page size', searchParams: { pageSize: true }, expectedError: /pageSize must be an integer/ },
		{
			description: 'zero page number',
			searchParams: { pageNumber: 0 },
			expectedError: /pageNumber must be greater than or equal to 1/
		},
		{
			description: 'offset above REST limit',
			searchParams: { pageNumber: 402, pageSize: 250 },
			expectedError: /offset must be between/
		}
	])('rejects $description without requesting REST', async ({ searchParams, expectedError }) => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage(searchParams)).rejects.toThrow(expectedError);
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('maps UI filters to Symbol REST query names and preserves namespace mosaic aliases', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);
		const filters = {
			pageNumber: 2,
			pageSize: 5,
			types: ['TRANSFER', 'AGGREGATE_COMPLETE'],
			from: senderAddress,
			to: recipientAddress,
			height: 345,
			mosaic: 'symbol.xym'
		};

		// Act:
		await fetchTransactionPage(filters);

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=5&offset=5&height=345&transactionTypes=TRANSFER%2CAGGREGATE_COMPLETE&` +
			`senderAddress=${senderAddress}&recipientAddress=${recipientAddress}&mosaic=symbol.xym&embedded=false&order=DESC`;
		expectSingleRequest(makeRequest, expectedURL);
	});

	it('sends a mosaic ID without changing it', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		await fetchTransactionPage({ mosaic: '72c0212e67a08bce' });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=10&offset=0&mosaic=72c0212e67a08bce&embedded=false&order=DESC`;
		expectSingleRequest(makeRequest, expectedURL);
	});

	it('sends a large block height as an exact decimal string', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);
		const height = '9223372036854775807';

		// Act:
		await fetchTransactionPage({ height });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=10&offset=0&height=${height}&` +
			'embedded=false&order=DESC';
		expectSingleRequest(makeRequest, expectedURL);
	});

	it('sends a single transaction type value without changing the REST query', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);
		const type = 'TRANSFER';
		// The combined-filter case above covers array-to-comma conversion; this representative
		// scalar case covers direct pass-through without repeating the same URL assertion 25 times.

		// Act:
		await fetchTransactionPage({ types: type });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=10&offset=0&transactionTypes=${type}&embedded=false&order=DESC`;
		expectSingleRequest(makeRequest, expectedURL);
	});

	it('uses address alone for account history', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		await fetchTransactionPage({ address: senderAddress });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=10&offset=0&address=${senderAddress}&` +
			'embedded=false&order=DESC';
		expectSingleRequest(makeRequest, expectedURL);
	});

	it('maps an account page from filter to sender and account to recipient', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ address: recipientAddress, from: senderAddress });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=10&offset=0&senderAddress=${senderAddress}&` +
			`recipientAddress=${recipientAddress}&embedded=false&order=DESC`;
		expectSingleRequest(makeRequest, expectedURL);
		expect(result.data[0]).toMatchObject({
			account: senderAddress,
			direction: TRANSACTION_DIRECTION.INCOMING
		});
	});

	it('maps an account page to sender and filter to recipient', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([confirmedTransaction]);

		// Act:
		const result = await fetchTransactionPage({ address: senderAddress, to: recipientAddress });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=10&offset=0&senderAddress=${senderAddress}&` +
			`recipientAddress=${recipientAddress}&embedded=false&order=DESC`;
		expectSingleRequest(makeRequest, expectedURL);
		expect(result.data[0]).toMatchObject({
			account: recipientAddress,
			direction: TRANSACTION_DIRECTION.OUTGOING
		});
	});

	it('omits the confirmed group and supports the REST signer key filter', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);
		const signerPublicKey = 'AB'.repeat(32);

		// Act:
		await fetchTransactionPage({ group: 'confirmed', signerPublicKey });

		// Assert:
		const expectedURL = `${symbolApiBaseURL}/transactions?limit=10&offset=0&signerPublicKey=${signerPublicKey}&` +
			'embedded=false&order=DESC';
		expectSingleRequest(makeRequest, expectedURL);
	});

	it.each(['unconfirmed', 'partial', 'unknown'])('rejects group %s without requesting REST', async group => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ group })).rejects.toThrow(`Symbol transaction group is not supported: ${group}`);
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('rejects account filters that REST does not allow together', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ address: senderAddress, signerPublicKey: 'AB'.repeat(32) }))
			.rejects.toThrow('address cannot be combined with signerPublicKey');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('rejects an account filter with both direction filters', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ address: senderAddress, from: senderAddress, to: recipientAddress }))
			.rejects.toThrow('address cannot be combined with both from and to');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('rejects an order other than descending', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ order: 'ASC' })).rejects.toThrow('order must be DESC');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('accepts an explicit false embedded filter without enabling embedded rows', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);

		// Act:
		await fetchTransactionPage({ embedded: false });

		// Assert:
		expectSingleRequest(makeRequest, `${symbolApiBaseURL}/transactions?limit=10&offset=0&embedded=false&order=DESC`);
	});

	it('rejects embedded transactions because shared rows require a transaction hash', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest');

		// Act + Assert:
		await expect(fetchTransactionPage({ embedded: true }))
			.rejects.toThrow('embedded Symbol transactions are not supported by the shared transaction list');
		expect(makeRequest).not.toHaveBeenCalled();
	});

	it('preserves REST amounts, fee, timestamp, mosaics, null recipient, and null message', async () => {
		// Arrange:
		const transfer = {
			...confirmedTransaction,
			recipient: null,
			value: [
				{ id: '72C0212E67A08BCE', name: 'symbol.xym', amount: '1.25' },
				{ id: 'ABCDEF0123456789', name: 'alias.namespace', amount: '2.5' }
			],
			amount: '1.25',
			fee: '0.0125',
			timestamp: '2026-10-16 01:02:03',
			message: null
		};
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([transfer]);

		// Act:
		const result = await fetchTransactionPage();

		// Assert:
		expect(result.data[0]).toEqual({
			...transfer,
			account: senderAddress,
			direction: null
		});
	});

	it('derives the opposite account and direction from the REST sender and recipient', async () => {
		// Arrange:
		const makeRequest = jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([
			confirmedTransaction,
			{ ...confirmedTransaction, hash: 'CD'.repeat(32), sender: recipientAddress, recipient: senderAddress }
		]);

		// Act:
		const result = await fetchTransactionPage({ address: senderAddress });

		// Assert:
		expect(result.data).toEqual([
			{ ...confirmedTransaction, account: recipientAddress, direction: TRANSACTION_DIRECTION.OUTGOING },
			{
				...confirmedTransaction,
				hash: 'CD'.repeat(32),
				sender: recipientAddress,
				recipient: senderAddress,
				account: recipientAddress,
				direction: TRANSACTION_DIRECTION.INCOMING
			}
		]);
		expect(makeRequest).toHaveBeenCalledTimes(1);
	});

	it('does not mutate the caller search parameters', async () => {
		// Arrange:
		jest.spyOn(serverUtils, 'makeRequest').mockResolvedValue([]);
		const searchParams = { pageNumber: 2, pageSize: 5, address: senderAddress, from: recipientAddress, types: ['TRANSFER'] };
		const searchParamsBeforeRequest = { ...searchParams, types: [...searchParams.types] };

		// Act:
		await fetchTransactionPage(searchParams);

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
