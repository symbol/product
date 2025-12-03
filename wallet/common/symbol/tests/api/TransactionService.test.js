import { transactionPageResponse } from '../__fixtures__/api/transaction-page-response';
import { mosaicInfos } from '../__fixtures__/local/mosaic';
import { namespaceNames } from '../__fixtures__/local/namespace';
import { networkProperties as networkPropertiesFixture } from '../__fixtures__/local/network';
import { currentAccount as currentAccountFixture } from '../__fixtures__/local/wallet';
import { runApiTest } from '../test-utils';
import { expect, jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils', () => {
	return {
		createSearchUrl: jest.fn((nodeUrl, path, base, additional) => {
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
jest.unstable_mockModule('wallet-common-core', () => ({
	ApiError: class ApiError extends Error { },
	NotFoundError: class NotFoundError extends Error { }
}));

const { TransactionService } = await import('../../src/api/TransactionService');
const { TransactionAnnounceGroup, TransactionGroup, TransactionBundleType } = await import('../../src/constants');
const utils = await import('../../src/utils');
const networkProperties = {
	...networkPropertiesFixture,
	nodeUrls: ['http://n-a:3000', 'http://n-b:3000', 'http://n-c:3000']
};
const currentAccount = currentAccountFixture;
const createSignedTransaction = (payload, hash) => ({ dto: { payload }, hash });

describe('TransactionService', () => {
	let transactionService;
	let mockMakeRequest;
	let mockApi;

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
				resolveAddresses: jest.fn()
			}
		};

		transactionService = new TransactionService({
			api: mockApi,
			makeRequest: mockMakeRequest
		});

		jest.clearAllMocks();
	});

	describe('fetchAccountTransactions', () => {
		const runFetchAccountTransactionsTest = async (config, expectedResult) => {
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
				expectedAdditional,
				aggregateDetailsResponse
			} = config;

			const expectedSearchUrl = utils.createSearchUrl(
				networkProperties.nodeUrl,
				`/transactions/${group}`,
				expectedBase,
				expectedAdditional
			);
			const expectedCalls = [{ url: expectedSearchUrl, options: undefined, response: pageResponse }];
			const aggregateHashes = (pageResponse?.data || [])
				.filter(x => x.isAggregate)
				.map(x => x.meta?.hash)
				.filter(Boolean);

			if (aggregateHashes.length > 0) {
				expectedCalls.push({
					url: `${networkProperties.nodeUrl}/transactions/${group}`,
					options: {
						method: 'POST',
						body: JSON.stringify({ transactionIds: aggregateHashes }),
						headers: { 'Content-Type': 'application/json' }
					},
					response: aggregateDetailsResponse || aggregateHashes.map(h => ({ meta: { hash: h }, detailed: true }))
				});
			}

			jest.spyOn(transactionService, 'resolveTransactionDTOs').mockResolvedValueOnce(resolveResult);
			const functionToTest = () =>
				transactionService.fetchAccountTransactions(
					networkProperties,
					currentAccount,
					{ group, pageNumber, pageSize, order, filter }
				);

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, expectedCalls, expectedResult);
		};

		it('builds search URL (no filters), fetches list and resolves DTOs', async () => {
			// Arrange:
			const group = TransactionGroup.CONFIRMED;
			const pageNumber = 1;
			const pageSize = 15;
			const order = 'desc';
			const expectedBase = { pageNumber, pageSize, order };
			const expectedAdditional = { address: currentAccount.address };
			const pageResponse = { data: [{ meta: { hash: 'hA' } }, { meta: { hash: 'hB' } }] };
			const mappedTransactions = [{ id: 'A' }, { id: 'B' }];
			const expectedResult = mappedTransactions;

			// Act & Assert:
			await runFetchAccountTransactionsTest(
				{
					group,
					pageNumber,
					pageSize,
					order,
					filter: undefined,
					pageResponse,
					resolveResult: mappedTransactions,
					expectedBase,
					expectedAdditional
				},
				expectedResult
			);
		});

		it('uses filter.to (recipient), builds search URL accordingly', async () => {
			// Arrange:
			const group = TransactionGroup.PARTIAL;
			const expectedBase = { pageNumber: 1, pageSize: 15, order: 'desc' };
			const toAddress = 'TOADDR...';
			const expectedAdditional = { signerPublicKey: currentAccount.publicKey, recipientAddress: toAddress };
			const pageResponse = { data: [] };
			const expectedResult = [];

			// Act & Assert:
			await runFetchAccountTransactionsTest(
				{
					group,
					...expectedBase,
					filter: { to: toAddress },
					pageResponse,
					resolveResult: [],
					expectedBase,
					expectedAdditional
				},
				expectedResult
			);
		});

		it('uses filter.from and merges aggregate details', async () => {
			// Arrange:
			const group = TransactionGroup.UNCONFIRMED;
			const expectedBase = { pageNumber: 1, pageSize: 15, order: 'desc' };
			const fromAddress = 'TFROMADDR...';
			const fromAccountInfo = { publicKey: 'PUBKEY_FROM' };
			mockApi.account.fetchAccountInfo.mockResolvedValueOnce(fromAccountInfo);
			const expectedAdditional = { signerPublicKey: fromAccountInfo.publicKey, recipientAddress: currentAccount.address };
			const aggregateHash = 'aggHash';
			const pageResponse = {
				data: [
					{ meta: { hash: aggregateHash }, isAggregate: true },
					{ meta: { hash: 'nonAggHash' }, isAggregate: false }
				]
			};
			const aggregateDetailsResponse = [{ meta: { hash: aggregateHash }, detailed: true }];
			const mappedTransactions = [{ id: 'M1' }, { id: 'M2' }];
			const expectedResult = mappedTransactions;

			// Act & Assert:
			await runFetchAccountTransactionsTest(
				{
					group,
					...expectedBase,
					filter: { from: fromAddress },
					pageResponse,
					aggregateDetailsResponse,
					resolveResult: mappedTransactions,
					expectedBase,
					expectedAdditional
				},
				expectedResult
			);

			expect(mockApi.account.fetchAccountInfo).toHaveBeenCalledWith(networkProperties, fromAddress);
		});
	});

	describe('fetchTransactionInfo', () => {
		const runFetchTransactionInfoTest = async (config, expectedResult) => {
			// Arrange:
			const { group, hash, dtoResponse } = config;
			const url = `${networkProperties.nodeUrl}/transactions/${group}/${hash}`;
			const expectedCalls = [{ url, options: undefined, response: dtoResponse }];
			jest.spyOn(transactionService, 'resolveTransactionDTOs').mockResolvedValueOnce([{ mapped: true }]);
			const functionToTest = () =>
				transactionService.fetchTransactionInfo(hash, { group, currentAccount, networkProperties });

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, expectedCalls, expectedResult);
		};

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
		const runAnnounceTransactionToNodeTest = async config => {
			// Arrange:
			const { nodeUrl, dto, group, endpoint } = config;
			const signedTransaction = { dto };
			const expectedCalls = [{
				url: endpoint,
				options: {
					method: 'PUT',
					body: JSON.stringify(dto),
					headers: { 'Content-Type': 'application/json' }
				},
				response: undefined
			}];
			const functionToTest = () =>
				transactionService.announceTransactionToNode(nodeUrl, signedTransaction, group);

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, expectedCalls);
		};

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
		const runAnnounceTransactionTest = async (config, shouldSucceed = true) => {
			// Arrange:
			const { dto, group } = config;

			if (shouldSucceed) {
				const spyAnnounce = jest.spyOn(transactionService, 'announceTransactionToNode').mockResolvedValue(undefined);

				// Act & Assert:
				await expect(transactionService.announceTransaction(networkProperties, dto, group)).resolves.toBeUndefined();
				expect(spyAnnounce).toHaveBeenCalledTimes(4);
				expect(spyAnnounce).toHaveBeenCalledWith(networkProperties.nodeUrl, dto, group);
			} else {
				const { ApiError } = await import('wallet-common-core');
				jest.spyOn(transactionService, 'announceTransactionToNode').mockRejectedValue(new Error('Rejected by node'));

				// Act & Assert:
				await expect(transactionService.announceTransaction(networkProperties, dto, group)).rejects.toBeInstanceOf(ApiError);
			}
		};

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

	describe('fetchTransactionStatus', () => {
		it('returns group from transaction status endpoint', async () => {
			// Arrange:
			const hash = 'STAT_HASH';
			const response = { group: 'unconfirmed' };
			const expectedResult = { group: 'unconfirmed' };
			const url = `${networkProperties.nodeUrl}/transactionStatus/${hash}`;
			const expectedCalls = [{ url, options: undefined, response }];
			const functionToTest = () => transactionService.fetchTransactionStatus(networkProperties, hash);

			// Act & Assert:
			await runApiTest(mockMakeRequest, functionToTest, expectedCalls, expectedResult);
		});
	});

	describe('resolveTransactionDTOs', () => {
		const runResolveTransactionDTOsTest = async config => {
			// Arrange:
			const { transactionDTOs } = config;
			mockApi.mosaic.fetchMosaicInfos.mockResolvedValue(mosaicInfos);
			mockApi.namespace.fetchNamespaceNames.mockResolvedValue(namespaceNames);
			mockApi.namespace.resolveAddresses.mockResolvedValue({});

			// Act:
			const result = await transactionService.resolveTransactionDTOs(networkProperties, transactionDTOs, currentAccount);

			// Assert:
			expect(utils.transactionFromDTO).toHaveBeenCalledTimes(transactionDTOs.length);
			expect(result).toHaveLength(transactionDTOs.length);
		};

		it('resolves data using api resolvers and maps via transactionFromDTO (fixtures)', async () => {
			// Arrange:
			const transactionDTOs = transactionPageResponse.slice(0, 2);

			// Act & Assert:
			await runResolveTransactionDTOsTest({ transactionDTOs });
		});
	});

	describe('resolveTransactionFromPayload', () => {
		const runResolveTransactionFromPayloadTest = async (config, expectedResult) => {
			// Arrange:
			const { payload, fillSignerPublickey } = config;
			mockApi.mosaic.fetchMosaicInfos.mockResolvedValue(mosaicInfos);
			mockApi.namespace.fetchNamespaceNames.mockResolvedValue(namespaceNames);
			mockApi.namespace.resolveAddresses.mockResolvedValue({});

			// Act:
			const result = await transactionService.resolveTransactionFromPayload(
				networkProperties,
				payload,
				currentAccount,
				fillSignerPublickey
			);

			// Assert:
			expect(utils.symbolTransactionFromPayload).toHaveBeenCalledWith(payload);
			expect(utils.getUnresolvedIdsFromSymbolTransactions).toHaveBeenCalled();
			expect(utils.transactionFromSymbol).toHaveBeenCalled();
			expect(result).toStrictEqual(expectedResult);
		};

		it('maps symbol payload to Transaction, resolving unresolved ids', async () => {
			// Arrange:
			const payload = '0xSOME_PAYLOAD';
			const fillSignerPublickey = currentAccount.publicKey;
			const expectedResult = { mappedFromSymbol: true };

			// Act & Assert:
			await runResolveTransactionFromPayloadTest({ payload, fillSignerPublickey }, expectedResult);
		});
	});

	describe('announceTransactionBundle', () => {
		it('uses announceTransactionsSequentially with PARTIAL for MULTISIG_TRANSFER', async () => {
			// Arrange:
			const bundle = {
				metadata: { type: TransactionBundleType.MULTISIG_TRANSFER },
				transactions: [createSignedTransaction('p1', 'H1'), createSignedTransaction('p2', 'H2')]
			};
			const spySequential = jest
				.spyOn(transactionService, 'announceTransactionsSequentially')
				.mockResolvedValue();

			// Act:
			await transactionService.announceTransactionBundle(networkProperties, bundle);

			// Assert:
			expect(spySequential).toHaveBeenCalledTimes(1);
			expect(spySequential).toHaveBeenCalledWith(
				networkProperties,
				bundle.transactions,
				TransactionAnnounceGroup.PARTIAL
			);
		});

		it('announces each transaction with DEFAULT group when not multisig', async () => {
			// Arrange:
			const signedTransaction1 = createSignedTransaction('a', 'H1');
			const signedTransaction2 = createSignedTransaction('b', 'H2');
			const bundle = {
				metadata: { type: 'OTHER_TYPE' },
				transactions: [signedTransaction1, signedTransaction2]
			};
			const spyAnnounce = jest
				.spyOn(transactionService, 'announceTransaction')
				.mockResolvedValue();

			// Act:
			await transactionService.announceTransactionBundle(networkProperties, bundle);

			// Assert:
			expect(spyAnnounce).toHaveBeenCalledTimes(2);
			expect(spyAnnounce).toHaveBeenNthCalledWith(
				1,
				networkProperties,
				signedTransaction1,
				TransactionAnnounceGroup.DEFAULT
			);
			expect(spyAnnounce).toHaveBeenNthCalledWith(
				2,
				networkProperties,
				signedTransaction2,
				TransactionAnnounceGroup.DEFAULT
			);
		});

		it('rejects if any announce fails for non-multisig bundle', async () => {
			// Arrange:
			const signedTransaction1 = createSignedTransaction('ok', 'H1');
			const signedTransaction2 = createSignedTransaction('fail', 'H2');
			const bundle = {
				metadata: { type: 'OTHER_TYPE' },
				transactions: [signedTransaction1, signedTransaction2]
			};
			const error = new Error('one failed');
			jest
				.spyOn(transactionService, 'announceTransaction')
				.mockResolvedValueOnce()
				.mockRejectedValueOnce(error);

			// Act & Assert:
			await expect(transactionService.announceTransactionBundle(networkProperties, bundle))
				.rejects.toBe(error);
		});
	});

	describe('announceTransactionsSequentially', () => {
		const runAnnounceTransactionsSequentiallyTest = async (config, expected) => {
			// Arrange:
			const {
				signedTransactions,
				lastTransactionGroup,
				fetchStatusImpl,
				announceImpl
			} = config;
			const spyAnnounce = jest
				.spyOn(transactionService, 'announceTransaction')
				.mockImplementation(announceImpl || (async () => undefined));
			const spyFetchStatus = jest
				.spyOn(transactionService, 'fetchTransactionStatus')
				.mockImplementation(fetchStatusImpl || (async () => ({ group: TransactionGroup.CONFIRMED })));

			// Act & Assert:
			const promise = transactionService.announceTransactionsSequentially(
				networkProperties,
				signedTransactions,
				lastTransactionGroup
			);
			if (expected.shouldThrow) {
				const { ApiError } = await import('wallet-common-core');
				await expect(promise).rejects.toBeInstanceOf(ApiError);
			} else {
				await expect(promise).resolves.toBeUndefined();
			}

			// Assert:
			const expectedAnnounceCalls = expected.announceCalls || [];
			expect(spyAnnounce).toHaveBeenCalledTimes(expectedAnnounceCalls.length);
			expectedAnnounceCalls.forEach((callArgs, index) => {
				expect(spyAnnounce).toHaveBeenNthCalledWith(index + 1, ...callArgs);
			});

			const expectedFetchCalls = expected.fetchStatusCalls || [];
			expect(spyFetchStatus).toHaveBeenCalledTimes(expectedFetchCalls.length);
			expectedFetchCalls.forEach((callArgs, index) => {
				expect(spyFetchStatus).toHaveBeenNthCalledWith(index + 1, ...callArgs);
			});
		};

		it('returns immediately when no transactions provided', async () => {
			// Arrange:
			const signedTransactions = [];
			const expected = {
				announceCalls: [],
				fetchStatusCalls: []
			};

			// Act & Assert:
			await runAnnounceTransactionsSequentiallyTest(
				{ signedTransactions },
				expected
			);
		});

		it('announces one transaction without group', async () => {
			// Arrange:
			const signedTransaction1 = createSignedTransaction('p1', 'H1');
			const signedTransactions = [signedTransaction1];
			const expected = {
				announceCalls: [
					[networkProperties, signedTransaction1]
				],
				fetchStatusCalls: []
			};

			// Act & Assert:
			await runAnnounceTransactionsSequentiallyTest(
				{ signedTransactions },
				expected
			);
		});

		it('announces sequentially and uses lastTransactionGroup for final transaction', async () => {
			// Arrange:
			const signedTransaction1 = createSignedTransaction('p1', 'H1');
			const signedTransaction2 = createSignedTransaction('p2', 'H2');
			const lastTransactionGroup = TransactionAnnounceGroup.PARTIAL;
			const fetchStatusImpl = async (networkProperties, hash) => {
				if (hash === signedTransaction1.hash)
					return { group: TransactionGroup.CONFIRMED };

				return { group: TransactionGroup.UNCONFIRMED };
			};
			const expected = {
				announceCalls: [
					[networkProperties, signedTransaction1],
					[networkProperties, signedTransaction2, lastTransactionGroup]
				],
				fetchStatusCalls: [
					[networkProperties, signedTransaction1.hash]
				]
			};

			// Act & Assert:
			await runAnnounceTransactionsSequentiallyTest(
				{ signedTransactions: [signedTransaction1, signedTransaction2], lastTransactionGroup, fetchStatusImpl },
				expected
			);
		});

		it('throws ApiError when a transaction fails during confirmation', async () => {
			// Arrange:
			const signedTransaction1 = createSignedTransaction('p1', 'H1');
			const signedTransaction2 = createSignedTransaction('p2', 'H2');
			const lastTransactionGroup = TransactionAnnounceGroup.PARTIAL;
			const fetchStatusImpl = async (networkProperties, hash) => {
				if (hash === signedTransaction1.hash)
					return { group: TransactionGroup.FAILED };

				return { group: TransactionGroup.UNCONFIRMED };
			};
			const expected = {
				announceCalls: [
					[networkProperties, signedTransaction1]
				],
				fetchStatusCalls: [
					[networkProperties, signedTransaction1.hash]
				],
				shouldThrow: true
			};

			// Act & Assert:
			await runAnnounceTransactionsSequentiallyTest(
				{ signedTransactions: [signedTransaction1, signedTransaction2], lastTransactionGroup, fetchStatusImpl },
				expected
			);
		});

		it('processes multiple transactions, confirming each before announcing the next', async () => {
			// Arrange:
			const signedTransaction1 = createSignedTransaction('p1', 'H1');
			const signedTransaction2 = createSignedTransaction('p2', 'H2');
			const signedTransaction3 = createSignedTransaction('p3', 'H3');
			const lastTransactionGroup = TransactionAnnounceGroup.COSIGNATURE;
			const fetchStatusImpl = async (networkProperties, hash) => {
				if (hash === signedTransaction1.hash || hash === signedTransaction2.hash)
					return { group: TransactionGroup.CONFIRMED };

				return { group: TransactionGroup.UNCONFIRMED };
			};
			const expected = {
				announceCalls: [
					[networkProperties, signedTransaction1],
					[networkProperties, signedTransaction2],
					[networkProperties, signedTransaction3, lastTransactionGroup]
				],
				fetchStatusCalls: [
					[networkProperties, signedTransaction1.hash],
					[networkProperties, signedTransaction2.hash]
				]
			};

			// Act & Assert:
			await runAnnounceTransactionsSequentiallyTest(
				{ signedTransactions: [signedTransaction1, signedTransaction2, signedTransaction3], lastTransactionGroup, fetchStatusImpl },
				expected
			);
		});
	});
});
