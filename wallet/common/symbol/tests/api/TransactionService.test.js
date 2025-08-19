import { transactionPageResponse } from '../__fixtures__/api/transaction-page-response';
import { mosaicInfos } from '../__fixtures__/local/mosaic';
import { namespaceNames } from '../__fixtures__/local/namespace';
import { networkProperties as networkPropertiesFixture } from '../__fixtures__/local/network';
import { currentAccount as currentAccountFixture } from '../__fixtures__/local/wallet';
import { runApiTest } from '../test-utils';
import { expect, jest } from '@jest/globals';

// Mock utils BEFORE importing the SUT (ESM requires unstable_mockModule + dynamic import)
jest.unstable_mockModule('../../src/utils', () => {
	return {
		createSearchUrl: jest.fn((nodeUrl, path, base, additional) => {
			// Deterministic URL so we can assert reliably
			const q = encodeURIComponent(JSON.stringify({ base, additional }));
			return `${nodeUrl}${path}?q=${q}`;
		}),
		isAggregateTransactionDTO: jest.fn(dto => Boolean(dto.isAggregate)),
		getUnresolvedIdsFromTransactionDTOs: jest.fn(() => ({
			addresses: ['ADDR_ALIAS_1'],
			mosaicIds: ['MOCK_MOS_ID'],
			namespaceIds: ['NAMESPACE_ID']
		})),
		getUnresolvedIdsFromSymbolTransactions: jest.fn(() => ({
			addresses: ['ADDR_ALIAS_2'],
			mosaicIds: ['MOCK_MOS_ID_2'],
			namespaceIds: ['NAMESPACE_ID_2']
		})),
		promiseAllSettled: jest.fn(promises => Promise.allSettled(promises)),
		symbolTransactionFromPayload: jest.fn(() => ({ mock: 'symbolTx' })),
		transactionFromDTO: jest.fn(dto => ({ mappedFromDTO: dto.meta?.hash || 'no-hash' })),
		transactionFromSymbol: jest.fn(() => ({ mappedFromSymbol: true }))
	};
});

// Mock ApiError for failure path tests
jest.unstable_mockModule('wallet-common-core', () => ({
	ApiError: class ApiError extends Error {}
}));

// Dynamically import after mocks are set up
const { TransactionService } = await import('../../src/api/TransactionService');
const { TransactionAnnounceGroup, TransactionGroup } = await import('../../src/constants');
const utils = await import('../../src/utils');

describe('TransactionService', () => {
	let service;
	let mockMakeRequest;
	let mockApi;

	// Use fixtures and extend with nodeUrls for announce tests
	const networkProperties = {
		...networkPropertiesFixture,
		nodeUrls: ['http://n-a:3000', 'http://n-b:3000', 'http://n-c:3000']
	};
	const currentAccount = currentAccountFixture;

	beforeEach(() => {
		mockMakeRequest = jest.fn();
		mockApi = {
			account: {
				fetchAccountInfo: jest.fn()
			},
			mosaic: {
				fetchMosaicInfos: jest.fn()
			},
			namespace: {
				fetchNamespaceNames: jest.fn(),
				resolveAddressesAtHeight: jest.fn()
			}
		};

		service = new TransactionService({
			api: mockApi,
			makeRequest: mockMakeRequest
		});

		jest.clearAllMocks();
	});

	const runFetchAccountTransactionsTest = async (options, expectedResult) => {
		// Arrange:
		const {
			group,
			pageNumber = 1,
			pageSize = 15,
			order = 'desc',
			filter,
			pageResponse,
			resolveResult,
			expectedBase = { pageNumber, pageSize, order },
			expectedAdditional
		} = options;

		const expectedSearchUrl = utils.createSearchUrl(
			networkProperties.nodeUrl,
			`/transactions/${group}`,
			expectedBase,
			expectedAdditional
		);
		const apiCalls = [{ url: expectedSearchUrl, options: undefined, response: pageResponse }];
		const aggregateHashes = (pageResponse?.data || [])
			.filter(x => x.isAggregate)
			.map(x => x.meta?.hash)
			.filter(Boolean);

		if (aggregateHashes.length > 0) {
			apiCalls.push({
				url: `${networkProperties.nodeUrl}/transactions/${group}`,
				options: {
					method: 'POST',
					body: JSON.stringify({ transactionIds: aggregateHashes }),
					headers: { 'Content-Type': 'application/json' }
				},
				response: options.aggregateDetailsResponse || aggregateHashes.map(h => ({ meta: { hash: h }, detailed: true }))
			});
		}
		const spyResolve = jest.spyOn(service, 'resolveTransactionDTOs').mockResolvedValueOnce(resolveResult);

		// Act & Assert:
		const functionToTest = () =>
			service.fetchAccountTransactions(
				networkProperties,
				currentAccount,
				{ group, pageNumber, pageSize, order, filter }
			);

		await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);

		return { spyResolve };
	};

	const runFetchTransactionInfoTest = async (options, expectedResult) => {
		// Arrange:
		const { group, hash, dtoResponse } = options;
		const url = `${networkProperties.nodeUrl}/transactions/${group}/${hash}`;
		const apiCalls = [{ url, options: undefined, response: dtoResponse }];

		jest.spyOn(service, 'resolveTransactionDTOs').mockResolvedValueOnce([{ mapped: true }]);

		// Act & Assert:
		const functionToTest = () =>
			service.fetchTransactionInfo(hash, { group, currentAccount, networkProperties });

		await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);
	};

	const runAnnounceTransactionToNodeTest = async options => {
		// Arrange:
		const { nodeUrl, dto, group, endpoint } = options;
		const apiCalls = [{
			url: endpoint,
			options: {
				method: 'PUT',
				body: JSON.stringify(dto),
				headers: { 'Content-Type': 'application/json' }
			},
			response: undefined
		}];

		// Act & Assert:
		const functionToTest = () =>
			service.announceTransactionToNode(nodeUrl, dto, group);

		await runApiTest(mockMakeRequest, functionToTest, apiCalls);
	};

	const runAnnounceTransactionTest = async (options, shouldSucceed = true) => {
		// Arrange:
		const { dto, group } = options;

		if (shouldSucceed) {
			const spyAnnounce = jest.spyOn(service, 'announceTransactionToNode').mockResolvedValue(undefined);
            
			// Act & Assert:
			await expect(service.announceTransaction(networkProperties, dto, group)).resolves.toBeUndefined();
			expect(spyAnnounce).toHaveBeenCalledTimes(4);
			expect(spyAnnounce).toHaveBeenCalledWith(networkProperties.nodeUrl, dto, group);
		} else {
			const { ApiError } = await import('wallet-common-core');
			jest.spyOn(service, 'announceTransactionToNode').mockRejectedValue(new Error('Rejected by node'));
            
			// Act & Assert:
			await expect(service.announceTransaction(networkProperties, dto, group)).rejects.toBeInstanceOf(ApiError);
		}
	};

	const runFetchStatusTest = async (options, expectedResult) => {
		// Arrange:
		const { hash, response } = options;
		const url = `${networkProperties.nodeUrl}/transactionStatus/${hash}`;
		const apiCalls = [{ url, options: undefined, response }];

		// Act & Assert:
		const functionToTest = () => service.fetchStatus(hash, networkProperties);

		await runApiTest(mockMakeRequest, functionToTest, apiCalls, expectedResult);
	};

	const runResolveTransactionDTOsTest = async options => {
		// Arrange:
		const { dtos } = options;

		// Use fixtures for resolvers
		mockApi.mosaic.fetchMosaicInfos.mockResolvedValue(mosaicInfos);
		mockApi.namespace.fetchNamespaceNames.mockResolvedValue(namespaceNames);
		mockApi.namespace.resolveAddressesAtHeight.mockResolvedValue({});

		// Act:
		const result = await service.resolveTransactionDTOs(networkProperties, dtos, currentAccount);

		// Assert:
		expect(utils.transactionFromDTO).toHaveBeenCalledTimes(dtos.length);
		expect(result).toHaveLength(dtos.length);
	};

	const runResolveTransactionFromPayloadTest = async (options, expectedResult) => {
		// Arrange:
		const { payload, fillSignerPublickey } = options;

		// Use fixtures for resolvers
		mockApi.mosaic.fetchMosaicInfos.mockResolvedValue(mosaicInfos);
		mockApi.namespace.fetchNamespaceNames.mockResolvedValue(namespaceNames);
		mockApi.namespace.resolveAddressesAtHeight.mockResolvedValue({});

		// Act:
		const result = await service.resolveTransactionFromPayload(
			networkProperties,
			payload,
			currentAccount,
			fillSignerPublickey
		);

		// Assert:
		expect(utils.symbolTransactionFromPayload).toHaveBeenCalledWith(payload);
		expect(utils.getUnresolvedIdsFromSymbolTransactions).toHaveBeenCalled();
		expect(utils.transactionFromSymbol).toHaveBeenCalled();
		expect(result).toEqual(expectedResult);
	};

	describe('fetchAccountTransactions', () => {
		it('builds search URL (no filters), fetches list and resolves DTOs', async () => {
			// Arrange:
			const group = TransactionGroup.CONFIRMED;
			const pageNumber = 1;
			const pageSize = 15;
			const order = 'desc';
			const base = { pageNumber, pageSize, order };
			const additional = { address: currentAccount.address };

			const pageResponse = { data: [{ meta: { hash: 'hA' } }, { meta: { hash: 'hB' } }] };
			const mapped = [{ id: 'A' }, { id: 'B' }];
			const expectedResult = mapped;

			// Act & Assert:
			await runFetchAccountTransactionsTest(
				{
					group,
					pageNumber,
					pageSize,
					order,
					filter: undefined,
					pageResponse,
					resolveResult: mapped,
					expectedBase: base,
					expectedAdditional: additional
				},
				expectedResult
			);
		});

		it('uses filter.to (recipient), builds search URL accordingly', async () => {
			// Arrange:
			const group = TransactionGroup.PARTIAL;
			const base = { pageNumber: 1, pageSize: 15, order: 'desc' };
			const toAddress = 'TOADDR...';
			const additional = { signerPublicKey: currentAccount.publicKey, recipientAddress: toAddress };

			const pageResponse = { data: [] };
			const expectedResult = [];

			// Act & Assert:
			await runFetchAccountTransactionsTest(
				{
					group,
					...base,
					filter: { to: toAddress },
					pageResponse,
					resolveResult: [],
					expectedBase: base,
					expectedAdditional: additional
				},
				expectedResult
			);
		});

		it('uses filter.from and merges aggregate details', async () => {
			// Arrange:
			const group = TransactionGroup.UNCONFIRMED;
			const base = { pageNumber: 1, pageSize: 15, order: 'desc' };
			const fromAddress = 'TFROMADDR...';
			const fromAccountInfo = { publicKey: 'PUBKEY_FROM' };
			mockApi.account.fetchAccountInfo.mockResolvedValueOnce(fromAccountInfo);

			const additional = { signerPublicKey: fromAccountInfo.publicKey, recipientAddress: currentAccount.address };

			const aggregateHash = 'aggHash';
			const pageResponse = {
				data: [
					{ meta: { hash: aggregateHash }, isAggregate: true },
					{ meta: { hash: 'nonAggHash' }, isAggregate: false }
				]
			};
			const aggregateDetailsResponse = [{ meta: { hash: aggregateHash }, detailed: true }];

			const mapped = [{ id: 'M1' }, { id: 'M2' }];
			const expectedResult = mapped;

			// Act & Assert:
			await runFetchAccountTransactionsTest(
				{
					group,
					...base,
					filter: { from: fromAddress },
					pageResponse,
					aggregateDetailsResponse,
					resolveResult: mapped,
					expectedBase: base,
					expectedAdditional: additional
				},
				expectedResult
			);

			expect(mockApi.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, fromAddress);
		});
	});

	describe('fetchTransactionInfo', () => {
		it('fetches transaction by hash and maps via resolveTransactionDTOs', async () => {
			// Arrange:
			const group = TransactionGroup.CONFIRMED;
			const hash = 'TX_HASH_123';
			const dtoResponse = { meta: { hash } };
			const expectedResult = { mapped: true };

			// Act & Assert:
			await runFetchTransactionInfoTest({ group, hash, dtoResponse }, expectedResult);
		});
	});

	describe('announceTransactionToNode', () => {
		it('announces to correct endpoint for DEFAULT', async () => {
			// Arrange:
			const nodeUrl = 'http://node.one:3000';
			const dto = { payload: 'SIGNED_PAYLOAD' };
			const group = TransactionAnnounceGroup.DEFAULT;
			const endpoint = `${nodeUrl}/transactions`;

			// Act & Assert:
			await runAnnounceTransactionToNodeTest({ nodeUrl, dto, group, endpoint });
		});

		it('announces to correct endpoint for PARTIAL', async () => {
			// Arrange:
			const nodeUrl = 'http://node.two:3000';
			const dto = { payload: 'SIGNED_PAYLOAD' };
			const group = TransactionAnnounceGroup.PARTIAL;
			const endpoint = `${nodeUrl}/transactions/partial`;

			// Act & Assert:
			await runAnnounceTransactionToNodeTest({ nodeUrl, dto, group, endpoint });
		});

		it('announces to correct endpoint for COSIGNATURE', async () => {
			// Arrange:
			const nodeUrl = 'http://node.three:3000';
			const dto = { parentHash: 'PARENT_HASH', signature: 'SIG' };
			const group = TransactionAnnounceGroup.COSIGNATURE;
			const endpoint = `${nodeUrl}/transactions/cosignature`;

			// Act & Assert:
			await runAnnounceTransactionToNodeTest({ nodeUrl, dto, group, endpoint });
		});
	});

	describe('announceTransaction', () => {
		it('resolves when any announce succeeds', async () => {
			// Arrange:
			const dto = { payload: 'SIGNED' };
			const group = TransactionAnnounceGroup.DEFAULT;

			// Act & Assert:
			await runAnnounceTransactionTest({ dto, group }, true);
		});

		it('throws ApiError when all announces fail', async () => {
			// Arrange:
			const dto = { payload: 'SIGNED' };
			const group = TransactionAnnounceGroup.DEFAULT;

			// Act & Assert:
			await runAnnounceTransactionTest({ dto, group }, false);
		});
	});

	describe('fetchStatus', () => {
		it('returns group from transaction status endpoint', async () => {
			// Arrange:
			const hash = 'STAT_HASH';
			const response = { group: 'unconfirmed' };
			const expectedResult = { group: 'unconfirmed' };

			// Act & Assert:
			await runFetchStatusTest({ hash, response }, expectedResult);
		});
	});

	describe('resolveTransactionDTOs', () => {
		it('resolves data using api resolvers and maps via transactionFromDTO (fixtures)', async () => {
			// Arrange:
			const dtos = transactionPageResponse.slice(0, 2);

			// Act & Assert:
			await runResolveTransactionDTOsTest({ dtos });
		});
	});

	describe('resolveTransactionFromPayload', () => {
		it('maps symbol payload to Transaction, resolving unresolved ids', async () => {
			// Arrange:
			const payload = '0xSOME_PAYLOAD';
			const fillSignerPublickey = currentAccount.publicKey;
			const expectedResult = { mappedFromSymbol: true };

			// Act & Assert:
			await runResolveTransactionFromPayloadTest({ payload, fillSignerPublickey }, expectedResult);
		});
	});
});
