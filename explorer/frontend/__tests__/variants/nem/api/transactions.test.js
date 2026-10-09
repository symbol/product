import {
	accountKeyLinkConfirmedTransactionResponse,
	mosaicDefinitionConfirmedTransactionResponse,
	mosaicSupplyChangeConfirmedTransactionResponse,
	multisigAccountModificationConfirmedTransactionResponse,
	multisigConfirmedTransactionResponse,
	multisigMultisigAccountModificationConfirmedTransactionResponse,
	multisigNamespaceRegistrationConfirmedTransactionResponse,
	namespaceRegistrationConfirmedTransactionResponse,
	transferConfirmedTransactionResponse,
	transferCustomMosaicOnlyConfirmedTransactionResponse,
	transferDecimalAmountConfirmedTransactionResponse,
	transferEncryptedMessageConfirmedTransactionResponse,
	transferMultipleMosaicsConfirmedTransactionResponse,
	transferNoMessageConfirmedTransactionResponse
} from '../../../../__fixtures__/api/nem/transaction-info';
import { transactionListConfirmedResponse } from '../../../../__fixtures__/api/nem/transaction-list-confirmed';
import { transactionListUnconfirmedResponse } from '../../../../__fixtures__/api/nem/transaction-list-unconfirmed';
import {
	accountKeyLinkConfirmedTransaction,
	mosaicDefinitionConfirmedTransaction,
	mosaicSupplyChangeConfirmedTransaction,
	multisigAccountModificationConfirmedTransaction,
	multisigConfirmedTransaction,
	multisigMultisigAccountModificationConfirmedTransaction,
	multisigNamespaceRegistrationConfirmedTransaction,
	namespaceRegistrationConfirmedTransaction,
	transferConfirmedTransaction,
	transferCustomMosaicOnlyConfirmedTransaction,
	transferDecimalAmountConfirmedTransaction,
	transferEncryptedMessageConfirmedTransaction,
	transferMultipleMosaicsConfirmedTransaction,
	transferNoMessageConfirmedTransaction
} from '../../../../__fixtures__/local/transaction';
import { transactionListConfirmed } from '../../../../__fixtures__/local/transaction-list-confirmed';
import { transactionListUnconfirmed } from '../../../../__fixtures__/local/transaction-list-unconfirmed';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import { TRANSACTION_DIRECTION, TRANSACTION_GROUP, TRANSACTION_TYPE } from '@/app/constants';
import { fetchTransactionInfo, fetchTransactionPage } from '@/app/variants/nem/api/transactions';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

// Constants

const transactionsURL = 'https://explorer.backend/transactions';
const firstPageURL = `${transactionsURL}?limit=10&offset=0`;
const unconfirmedTransactionsURL = 'https://explorer.backend/transactions/unconfirmed';
const transactionURL = 'https://explorer.backend/transaction';
const emptyPageResponse = [];
const unsupportedTransactionType = 'UNKNOWN';
const senderAddress = transferConfirmedTransaction.sender;
const recipientAddress = transferConfirmedTransaction.recipient;
const transferConfirmedListItem = transactionListConfirmed.find(transaction => transaction.hash === transferConfirmedTransaction.hash);
const transferMultipleMosaicsListItem = transactionListConfirmed.find(transaction =>
	transaction.hash === transferMultipleMosaicsConfirmedTransaction.hash);
const [nativeMosaic, customMosaic] = transferMultipleMosaicsListItem.body[0].mosaics;
const unsupportedTransactionResponse = {
	...accountKeyLinkConfirmedTransactionResponse,
	transactionType: unsupportedTransactionType
};
const unsupportedTransaction = {
	...accountKeyLinkConfirmedTransaction,
	type: unsupportedTransactionType,
	body: [
		{
			type: unsupportedTransactionType,
			sender: accountKeyLinkConfirmedTransaction.sender
		}
	]
};

// Tests

describe('variants/nem/api/transactions', () => {
	describe('fetchTransactionPage', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the first page with the default page size',
					config: { params: {} },
					expected: { url: firstPageURL }
				},
				{
					description: 'requests the given page when "pageNumber" and "pageSize" are provided',
					config: {
						params: {
							pageNumber: 3,
							pageSize: 123
						}
					},
					expected: { url: `${transactionsURL}?limit=123&offset=246` }
				},
				{
					description: 'requests the unconfirmed endpoint when the unconfirmed "group" is provided',
					config: {
						params: { group: TRANSACTION_GROUP.UNCONFIRMED }
					},
					expected: { url: `${unconfirmedTransactionsURL}?limit=10&offset=0` }
				},
				{
					description: 'requests the sender and recipient addresses when "from" and "to" are provided',
					config: {
						params: {
							from: senderAddress,
							to: recipientAddress
						}
					},
					expected: { url: `${firstPageURL}&senderAddress=${senderAddress}&recipientAddress=${recipientAddress}` }
				},
				{
					description: 'requests the transaction types when "types" is provided',
					config: {
						params: { types: TRANSACTION_TYPE.TRANSFER }
					},
					expected: { url: `${firstPageURL}&transactionTypes=${TRANSACTION_TYPE.TRANSFER}` }
				},
				{
					description: 'requests the address as is when "address" is provided',
					config: {
						params: { address: senderAddress }
					},
					expected: { url: `${firstPageURL}&address=${senderAddress}` }
				},
				{
					description: 'requests the address as the recipient when "address" and "from" are provided',
					config: {
						params: {
							address: recipientAddress,
							from: senderAddress
						}
					},
					expected: { url: `${firstPageURL}&senderAddress=${senderAddress}&recipientAddress=${recipientAddress}` }
				},
				{
					description: 'requests the address as the sender when "address" and "to" are provided',
					config: {
						params: {
							address: senderAddress,
							to: recipientAddress
						}
					},
					expected: { url: `${firstPageURL}&senderAddress=${senderAddress}&recipientAddress=${recipientAddress}` }
				},
				{
					description: 'requests the mosaic as is when "mosaic" is provided',
					config: {
						params: { mosaic: customMosaic.id }
					},
					expected: { url: `${firstPageURL}&mosaic=${customMosaic.id}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchTransactionPage,
				response: emptyPageResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps the confirmed transactions',
					config: { response: transactionListConfirmedResponse },
					expected: {
						result: {
							data: transactionListConfirmed,
							pageNumber: 1
						}
					}
				},
				{
					description: 'maps the unconfirmed transactions when the unconfirmed "group" is provided',
					config: {
						params: { group: TRANSACTION_GROUP.UNCONFIRMED },
						response: transactionListUnconfirmedResponse
					},
					expected: {
						result: {
							data: transactionListUnconfirmed,
							pageNumber: 1
						}
					}
				},
				{
					description: 'marks a transfer as incoming when the recipient "address" is provided',
					config: {
						params: { address: recipientAddress },
						response: [transferConfirmedTransactionResponse]
					},
					expected: {
						result: {
							data: [
								{
									...transferConfirmedListItem,
									account: senderAddress,
									direction: TRANSACTION_DIRECTION.INCOMING
								}
							],
							pageNumber: 1
						}
					}
				},
				{
					description: 'marks a transfer as outgoing when the sender "address" is provided',
					config: {
						params: { address: senderAddress },
						response: [transferConfirmedTransactionResponse]
					},
					expected: {
						result: {
							data: [
								{
									...transferConfirmedListItem,
									account: recipientAddress,
									direction: TRANSACTION_DIRECTION.OUTGOING
								}
							],
							pageNumber: 1
						}
					}
				},
				{
					description: 'puts the mosaic first when "mosaic" is provided',
					config: {
						params: { mosaic: customMosaic.id },
						response: [transferMultipleMosaicsConfirmedTransactionResponse]
					},
					expected: {
						result: {
							data: [
								{
									...transferMultipleMosaicsListItem,
									value: [customMosaic, nativeMosaic],
									body: [
										{
											...transferMultipleMosaicsListItem.body[0],
											mosaics: [customMosaic, nativeMosaic]
										}
									]
								}
							],
							pageNumber: 1
						}
					}
				}
			];

			runApiResultTests({ functionToTest: fetchTransactionPage, cases: resultCases });
		});
	});

	describe('fetchTransactionInfo', () => {
		describe('request', () => {
			const requestCases = [
				{
					description: 'requests the transaction by hash',
					config: { params: transferConfirmedTransactionResponse.transactionHash },
					expected: { url: `${transactionURL}/${transferConfirmedTransactionResponse.transactionHash}` }
				}
			];

			runApiRequestTests({
				functionToTest: fetchTransactionInfo,
				response: transferConfirmedTransactionResponse,
				cases: requestCases
			});
		});

		describe('result', () => {
			const resultCases = [
				{
					description: 'maps a transfer',
					config: { response: transferConfirmedTransactionResponse },
					expected: { result: transferConfirmedTransaction }
				},
				{
					description: 'maps a transfer without a message',
					config: { response: transferNoMessageConfirmedTransactionResponse },
					expected: { result: transferNoMessageConfirmedTransaction }
				},
				{
					description: 'maps a transfer with an encrypted message',
					config: { response: transferEncryptedMessageConfirmedTransactionResponse },
					expected: { result: transferEncryptedMessageConfirmedTransaction }
				},
				{
					description: 'maps a transfer with multiple mosaics',
					config: { response: transferMultipleMosaicsConfirmedTransactionResponse },
					expected: { result: transferMultipleMosaicsConfirmedTransaction }
				},
				{
					description: 'maps a transfer with a custom mosaic only',
					config: { response: transferCustomMosaicOnlyConfirmedTransactionResponse },
					expected: { result: transferCustomMosaicOnlyConfirmedTransaction }
				},
				{
					description: 'maps a transfer with a decimal amount',
					config: { response: transferDecimalAmountConfirmedTransactionResponse },
					expected: { result: transferDecimalAmountConfirmedTransaction }
				},
				{
					description: 'maps a mosaic definition',
					config: { response: mosaicDefinitionConfirmedTransactionResponse },
					expected: { result: mosaicDefinitionConfirmedTransaction }
				},
				{
					description: 'maps a mosaic supply change',
					config: { response: mosaicSupplyChangeConfirmedTransactionResponse },
					expected: { result: mosaicSupplyChangeConfirmedTransaction }
				},
				{
					description: 'maps a namespace registration',
					config: { response: namespaceRegistrationConfirmedTransactionResponse },
					expected: { result: namespaceRegistrationConfirmedTransaction }
				},
				{
					description: 'maps a multisig account modification',
					config: { response: multisigAccountModificationConfirmedTransactionResponse },
					expected: { result: multisigAccountModificationConfirmedTransaction }
				},
				{
					description: 'maps an account key link',
					config: { response: accountKeyLinkConfirmedTransactionResponse },
					expected: { result: accountKeyLinkConfirmedTransaction }
				},
				{
					description: 'maps a multisig with an embedded transfer',
					config: { response: multisigConfirmedTransactionResponse },
					expected: { result: multisigConfirmedTransaction }
				},
				{
					description: 'maps a multisig with an embedded namespace registration',
					config: { response: multisigNamespaceRegistrationConfirmedTransactionResponse },
					expected: { result: multisigNamespaceRegistrationConfirmedTransaction }
				},
				{
					description: 'maps a multisig with an embedded multisig account modification',
					config: { response: multisigMultisigAccountModificationConfirmedTransactionResponse },
					expected: { result: multisigMultisigAccountModificationConfirmedTransaction }
				},
				{
					description: 'maps an unsupported transaction type to the base fields',
					config: { response: unsupportedTransactionResponse },
					expected: { result: unsupportedTransaction }
				},
				{
					description: 'returns null when the transaction does not exist',
					config: { error: error404Response },
					expected: { result: null }
				}
			];

			runApiResultTests({ functionToTest: fetchTransactionInfo, cases: resultCases });
		});
	});
});
