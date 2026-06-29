import { Api } from '../../src/api';
import { TransactionAnnounceGroup, TransactionBundleType, TransactionGroup } from '../../src/constants';
import { mosaicDefinitionDTO } from '../__fixtures__/api/mosaic-dtos';
import { incomingTransferDTO, outgoingTransferDTO, transactionDTOs, unconfirmedTransferDTO } from '../__fixtures__/api/transaction-dtos';
import { networkProperties } from '../__fixtures__/local/network';
import { incomingTransfer, outgoingTransfer, unconfirmedTransfer, walletTransactions } from '../__fixtures__/local/transactions';
import { currentAccount } from '../__fixtures__/local/wallet';
import { createMakeRequestMock, runApiServiceTest } from '../test-utils';
import { ApiError, NotFoundError } from 'wallet-common-core';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const ADDRESS = currentAccount.address;
const TRANSACTION_HASH = outgoingTransferDTO.meta.hash.data;

const transfersUrl = (direction, pageNumber = 1, pageSize = 15) =>
	`${NODE_URL}/account/transfers/${direction}?address=${ADDRESS}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
const unconfirmedTransactionsUrl = `${NODE_URL}/account/unconfirmedTransactions?address=${ADDRESS}`;
const definitionPageUrl = namespaceId => `${NODE_URL}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;
const transactionGetUrl = hash => `${NODE_URL}/transaction/get?hash=${hash}`;
const announceUrl = `${NODE_URL}/transaction/announce`;

// Fixtures

// A signed transaction ready to announce: its dto is the { data, signature } payload NIS expects.
const signedTransaction = {
	hash: 'F8B2C1AA00112233445566778899AABBCCDDEEFF00112233445566778899AABB',
	dto: { data: '01010000980000002059...', signature: 'ABCDEF00...' }
};

// A second signed transaction (e.g. a cosignature) used for multi-transaction bundles.
const cosignatureSignedTransaction = {
	hash: 'C1AAF8B2778899AABBCCDDEEFF00112233445566778899AABBCC0011223344FF',
	dto: { data: '02020000980000002059...', signature: 'FEDCBA00...' }
};

// The NemAnnounceResult returned by /transaction/announce on success.
const announceResponse = {
	type: 1,
	code: 1,
	message: 'SUCCESS',
	transactionHash: { data: signedTransaction.hash.toLowerCase() }
};

describe('api/TransactionService', () => {
	describe('fetchAccountTransactions', () => {
		const runFetchAccountTransactionsTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.transaction.fetchAccountTransactions(networkProperties, currentAccount, config.searchCriteria),
					expected: expected.transactions
				});
			});
		};

		const fetchAccountTransactionsTests = [
			{
				description: 'fetches confirmed transactions and maps DTOs with their resolved mosaics',
				config: {
					searchCriteria: { group: TransactionGroup.CONFIRMED },
					requestMap: {
						[transfersUrl('all')]: { data: transactionDTOs },
						[definitionPageUrl('test')]: { data: [{ mosaic: mosaicDefinitionDTO }] }
					}
				},
				expected: { transactions: walletTransactions }
			},
			{
				description: 'fetches unconfirmed transactions from the unconfirmed endpoint',
				config: {
					searchCriteria: { group: TransactionGroup.UNCONFIRMED },
					requestMap: { [unconfirmedTransactionsUrl]: { data: [unconfirmedTransferDTO] } }
				},
				expected: { transactions: [unconfirmedTransfer] }
			},
			{
				description: 'uses the outgoing endpoint when filtering outgoing transactions',
				config: {
					searchCriteria: { filter: { direction: 'outgoing' } },
					requestMap: { [transfersUrl('outgoing')]: { data: [outgoingTransferDTO] } }
				},
				expected: { transactions: [outgoingTransfer] }
			},
			{
				description: 'uses the incoming endpoint when filtering incoming transactions',
				config: {
					searchCriteria: { filter: { direction: 'incoming' } },
					requestMap: { [transfersUrl('incoming')]: { data: [incomingTransferDTO] } }
				},
				expected: { transactions: [incomingTransfer] }
			},
			{
				description: 'returns an empty list for the partial group without making a request',
				config: { searchCriteria: { group: TransactionGroup.PARTIAL }, requestMap: {} },
				expected: { transactions: [] }
			},
			{
				description: 'returns an empty list when the node reports no transactions',
				config: {
					searchCriteria: { group: TransactionGroup.CONFIRMED },
					requestMap: { [transfersUrl('all')]: {} }
				},
				expected: { transactions: [] }
			}
		];

		fetchAccountTransactionsTests.forEach(test => runFetchAccountTransactionsTest(test.description, test.config, test.expected));
	});

	describe('fetchAccountTransaction', () => {
		it('fetches a single transaction by hash and maps it', async () => {
			// Arrange:
			const requestMap = { [transactionGetUrl(TRANSACTION_HASH)]: outgoingTransferDTO };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.transaction.fetchAccountTransaction(networkProperties, currentAccount, TRANSACTION_HASH),
				expected: outgoingTransfer
			});
		});
	});

	describe('fetchTransactionStatus', () => {
		const runFetchTransactionStatusTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.transaction.fetchTransactionStatus(networkProperties, TRANSACTION_HASH),
					expected: expected.status
				});
			});
		};

		const fetchTransactionStatusTests = [
			{
				description: 'reports a confirmed transaction when the node returns it',
				config: { requestMap: { [transactionGetUrl(TRANSACTION_HASH)]: outgoingTransferDTO } },
				expected: { status: { group: TransactionGroup.CONFIRMED } }
			},
			{
				description: 'reports an unconfirmed transaction when the node returns a 404',
				config: { requestMap: { [transactionGetUrl(TRANSACTION_HASH)]: new NotFoundError('Transaction not found') } },
				expected: { status: { group: TransactionGroup.UNCONFIRMED } }
			}
		];

		fetchTransactionStatusTests.forEach(test => runFetchTransactionStatusTest(test.description, test.config, test.expected));

		it('rethrows errors that are not a not-found', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({ [transactionGetUrl(TRANSACTION_HASH)]: new Error('Node unreachable') });
			const api = new Api({ makeRequest });

			// Act & Assert:
			await expect(api.transaction.fetchTransactionStatus(networkProperties, TRANSACTION_HASH)).rejects.toThrow('Node unreachable');
		});
	});

	describe('announceTransaction', () => {
		const runAnnounceTransactionTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: { [announceUrl]: announceResponse },
					call: api => api.transaction.announceTransaction(networkProperties, signedTransaction, config.group),
					expected: expected.response
				});
			});
		};

		const announceTransactionTests = [
			{
				description: 'announces a default transaction and returns the node result',
				config: { group: TransactionAnnounceGroup.DEFAULT },
				expected: { response: announceResponse }
			},
			{
				description: 'announces a cosignature through the same announce endpoint',
				config: { group: TransactionAnnounceGroup.COSIGNATURE },
				expected: { response: announceResponse }
			}
		];

		announceTransactionTests.forEach(test => runAnnounceTransactionTest(test.description, test.config, test.expected));

		it('wraps node failures in an ApiError', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({ [announceUrl]: new Error('Node unreachable') });
			const api = new Api({ makeRequest });

			// Act & Assert:
			await expect(api.transaction.announceTransaction(networkProperties, signedTransaction)).rejects.toBeInstanceOf(ApiError);
		});
	});

	describe('announceTransactionBundle', () => {
		const runAnnounceTransactionBundleTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: { [announceUrl]: announceResponse },
					call: api => api.transaction.announceTransactionBundle(networkProperties, config.bundle),
					expected: expected.responses
				});
			});
		};

		const bundleTransactions = [signedTransaction, cosignatureSignedTransaction];

		const announceTransactionBundleTests = [
			{
				description: 'announces every transaction for a default bundle',
				config: { bundle: { metadata: { type: TransactionBundleType.DEFAULT }, transactions: bundleTransactions } },
				expected: { responses: [announceResponse, announceResponse] }
			},
			{
				description: 'announces transactions sequentially for a multisig transfer bundle',
				config: {
					bundle: {
						metadata: {
							type: TransactionBundleType.MULTISIG_TRANSFER,
							groups: [TransactionAnnounceGroup.DEFAULT, TransactionAnnounceGroup.COSIGNATURE]
						},
						transactions: bundleTransactions
					}
				},
				expected: { responses: [announceResponse, announceResponse] }
			}
		];

		announceTransactionBundleTests.forEach(test => runAnnounceTransactionBundleTest(test.description, test.config, test.expected));
	});
});
