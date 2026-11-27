import { Api } from '../../src/api';
import { TransactionAnnounceGroup, TransactionBundleType, TransactionGroup } from '../../src/constants';
import { multisigAccountResponse } from '../__fixtures__/api/account-dtos';
import { mosaicDefinitionDTO } from '../__fixtures__/api/token-dtos';
import {
	incomingTransferDTO,
	multisigTransferDTO,
	outgoingTransferDTO,
	transactionDTOs,
	unconfirmedMultisigTransferDTO,
	unconfirmedTransferDTO
} from '../__fixtures__/api/transaction-dtos';
import { networkProperties } from '../__fixtures__/local/network';
import {
	incomingTransfer,
	outgoingTransfer,
	unconfirmedMultisigTransfer,
	unconfirmedTransfer,
	walletTransactions
} from '../__fixtures__/local/transactions';
import { accounts, currentAccount } from '../__fixtures__/local/wallet';
import { createMakeRequestMock, runApiServiceTest } from '../test-utils';
import { ApiError, NotFoundError } from 'wallet-common-core';

// Constants

const NODE_URL = networkProperties.nodeUrl;
const ADDRESS = currentAccount.address;
const MULTISIG_ADDRESS = accounts.carol.address;
const TRANSACTION_HASH = outgoingTransferDTO.meta.hash.data;
const INNER_TRANSACTION_HASH = unconfirmedMultisigTransferDTO.meta.data;
const UNKNOWN_TRANSACTION_HASH = 'ffffff';

const transfersUrl = (direction, cursor = null) => {
	const cursorQuery = cursor === null ? '' : `&id=${cursor}`;

	return `${NODE_URL}/account/transfers/${direction}?address=${ADDRESS}&pageSize=15${cursorQuery}`;
};
const unconfirmedTransactionsUrl = `${NODE_URL}/account/unconfirmedTransactions?address=${ADDRESS}`;
const latestConfirmedPageUrl = `${NODE_URL}/account/transfers/all?address=${ADDRESS}&pageSize=100`;
const multisigAccountUrl = `${NODE_URL}/account/get?address=${MULTISIG_ADDRESS}`;
const definitionPageUrl = namespaceId => `${NODE_URL}/namespace/mosaic/definition/page?namespace=${namespaceId}&pageSize=100`;
const announceUrl = `${NODE_URL}/transaction/announce`;

// Fixtures

// The /account/get response of the multisig account (carol) that requires the given number of signatures.
const createMultisigAccountResponse = minApproval => ({
	...multisigAccountResponse,
	account: {
		...multisigAccountResponse.account,
		multisigInfo: { cosignatoriesCount: 2, minCosignatories: minApproval }
	}
});

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

// The NemAnnounceResult returned when the node already knows the transaction.
const neutralAnnounceResponse = { ...announceResponse, code: 0, message: 'NEUTRAL' };

// The NemAnnounceResult returned when the node rejects the transaction.
const failureAnnounceResponse = { ...announceResponse, code: 5, message: 'FAILURE_INSUFFICIENT_BALANCE' };

describe('api/TransactionService', () => {
	describe('fetchAccountTransactions', () => {
		const runFetchAccountTransactionsTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.transaction.fetchAccountTransactions(networkProperties, currentAccount, config.searchCriteria),
					expected: { data: expected.transactions, nextCursor: expected.nextCursor ?? null }
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
				expected: { transactions: walletTransactions, nextCursor: String(transactionDTOs.at(-1).meta.id) }
			},
			{
				description: 'fetches the page after the transaction id carried by the cursor',
				config: {
					searchCriteria: { cursor: String(outgoingTransferDTO.meta.id) },
					requestMap: { [transfersUrl('all', outgoingTransferDTO.meta.id)]: { data: [incomingTransferDTO] } }
				},
				expected: { transactions: [incomingTransfer] }
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
				description: 'returns pending multisig transactions awaiting cosignatures in the partial group',
				config: {
					searchCriteria: { group: TransactionGroup.PARTIAL },
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [unconfirmedTransferDTO, unconfirmedMultisigTransferDTO] },
						[multisigAccountUrl]: createMultisigAccountResponse(2)
					}
				},
				expected: { transactions: [unconfirmedMultisigTransfer] }
			},
			{
				description: 'keeps pending multisig transactions awaiting cosignatures out of the unconfirmed group',
				config: {
					searchCriteria: { group: TransactionGroup.UNCONFIRMED },
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [unconfirmedTransferDTO, unconfirmedMultisigTransferDTO] },
						[multisigAccountUrl]: createMultisigAccountResponse(2)
					}
				},
				expected: { transactions: [unconfirmedTransfer] }
			},
			{
				description: 'returns fully signed pending multisig transactions in the unconfirmed group',
				config: {
					searchCriteria: { group: TransactionGroup.UNCONFIRMED },
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [unconfirmedTransferDTO, unconfirmedMultisigTransferDTO] },
						[multisigAccountUrl]: createMultisigAccountResponse(1)
					}
				},
				expected: { transactions: [unconfirmedTransfer, unconfirmedMultisigTransfer] }
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
			const requestMap = {
				[unconfirmedTransactionsUrl]: { data: [] },
				[latestConfirmedPageUrl]: { data: [outgoingTransferDTO] }
			};

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.transaction.fetchAccountTransaction(networkProperties, currentAccount, TRANSACTION_HASH),
				expected: outgoingTransfer
			});
		});

		it('returns a pending multisig transaction found by its inner transaction hash', async () => {
			// Arrange:
			const requestMap = { [unconfirmedTransactionsUrl]: { data: [unconfirmedMultisigTransferDTO] } };

			// Act & Assert:
			await runApiServiceTest({
				requestMap,
				call: api => api.transaction.fetchAccountTransaction(networkProperties, currentAccount, INNER_TRANSACTION_HASH),
				expected: unconfirmedMultisigTransfer
			});
		});

		it('rejects with a NotFoundError when the account has no such transaction', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({
				[unconfirmedTransactionsUrl]: { data: [] },
				[latestConfirmedPageUrl]: { data: [outgoingTransferDTO] }
			});
			const api = new Api({ makeRequest });

			// Act & Assert:
			await expect(api.transaction.fetchAccountTransaction(networkProperties, currentAccount, UNKNOWN_TRANSACTION_HASH))
				.rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe('fetchTransactionStatus', () => {
		const runFetchTransactionStatusTest = (description, config, expected) => {
			it(description, async () => {
				// Act & Assert:
				await runApiServiceTest({
					requestMap: config.requestMap,
					call: api => api.transaction.fetchTransactionStatus(networkProperties, config.hash, currentAccount),
					expected: expected.status
				});
			});
		};

		const fetchTransactionStatusTests = [
			{
				description: 'reports a pending transfer found by its calculated hash as unconfirmed',
				config: {
					hash: unconfirmedTransfer.hash,
					requestMap: { [unconfirmedTransactionsUrl]: { data: [unconfirmedTransferDTO] } }
				},
				expected: { status: { group: TransactionGroup.UNCONFIRMED } }
			},
			{
				description: 'reports a pending multisig transaction awaiting cosignatures as partial',
				config: {
					hash: INNER_TRANSACTION_HASH,
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [unconfirmedMultisigTransferDTO] },
						[multisigAccountUrl]: createMultisigAccountResponse(2)
					}
				},
				expected: { status: { group: TransactionGroup.PARTIAL } }
			},
			{
				description: 'reports a pending multisig transaction found by its calculated hash as partial',
				config: {
					hash: unconfirmedMultisigTransfer.hash,
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [unconfirmedMultisigTransferDTO] },
						[multisigAccountUrl]: createMultisigAccountResponse(2)
					}
				},
				expected: { status: { group: TransactionGroup.PARTIAL } }
			},
			{
				description: 'reports a fully signed pending multisig transaction as unconfirmed',
				config: {
					hash: INNER_TRANSACTION_HASH,
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [unconfirmedMultisigTransferDTO] },
						[multisigAccountUrl]: createMultisigAccountResponse(1)
					}
				},
				expected: { status: { group: TransactionGroup.UNCONFIRMED } }
			},
			{
				description: 'reports a transaction found by its hash on the latest confirmed page as confirmed',
				config: {
					hash: TRANSACTION_HASH,
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [] },
						[latestConfirmedPageUrl]: { data: [outgoingTransferDTO] }
					}
				},
				expected: { status: { group: TransactionGroup.CONFIRMED } }
			},
			{
				description: 'reports a transaction found by its inner transaction hash on the latest confirmed page as confirmed',
				config: {
					hash: multisigTransferDTO.meta.innerHash.data,
					requestMap: {
						[unconfirmedTransactionsUrl]: { data: [] },
						[latestConfirmedPageUrl]: { data: [multisigTransferDTO] }
					}
				},
				expected: { status: { group: TransactionGroup.CONFIRMED } }
			}
		];

		fetchTransactionStatusTests.forEach(test => runFetchTransactionStatusTest(test.description, test.config, test.expected));

		it('rejects with a NotFoundError when the account has no such transaction', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({
				[unconfirmedTransactionsUrl]: { data: [unconfirmedTransferDTO] },
				[latestConfirmedPageUrl]: { data: [outgoingTransferDTO] }
			});
			const api = new Api({ makeRequest });

			// Act & Assert:
			await expect(api.transaction.fetchTransactionStatus(networkProperties, UNKNOWN_TRANSACTION_HASH, currentAccount))
				.rejects.toBeInstanceOf(NotFoundError);
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

		it('returns the node result when the node already knows the transaction', async () => {
			// Act & Assert:
			await runApiServiceTest({
				requestMap: { [announceUrl]: neutralAnnounceResponse },
				call: api => api.transaction.announceTransaction(networkProperties, signedTransaction),
				expected: neutralAnnounceResponse
			});
		});

		it('rejects with an ApiError carrying the node message when the node rejects the transaction', async () => {
			// Arrange:
			const makeRequest = createMakeRequestMock({ [announceUrl]: failureAnnounceResponse });
			const api = new Api({ makeRequest });
			const expectedError = new ApiError('Failed to announce transaction: FAILURE_INSUFFICIENT_BALANCE');

			// Act & Assert:
			await expect(api.transaction.announceTransaction(networkProperties, signedTransaction)).rejects.toStrictEqual(expectedError);
		});

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
