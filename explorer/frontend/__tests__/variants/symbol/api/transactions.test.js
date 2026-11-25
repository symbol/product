import {
	accountAddressRestrictionConfirmedTransactionResponse,
	accountKeyLinkConfirmedTransactionResponse,
	accountMosaicRestrictionConfirmedTransactionResponse,
	accountOperationRestrictionConfirmedTransactionResponse,
	addressAliasConfirmedTransactionResponse,
	aggregateAccountMetadataConfirmedTransactionResponse,
	aggregateBondedConfirmedTransactionResponse,
	aggregateCompleteConfirmedTransactionResponse,
	aggregateKeyLinkConfirmedTransactionResponse,
	aggregateMosaicMetadataConfirmedTransactionResponse,
	aggregateMosaicSupplyRevocationConfirmedTransactionResponse,
	aggregateNamespaceMetadataConfirmedTransactionResponse,
	hashLockConfirmedTransactionResponse,
	mosaicAddressRestrictionConfirmedTransactionResponse,
	mosaicAliasConfirmedTransactionResponse,
	mosaicDefinitionConfirmedTransactionResponse,
	mosaicGlobalRestrictionConfirmedTransactionResponse,
	mosaicGlobalRestrictionWithReferenceConfirmedTransactionResponse,
	mosaicSupplyChangeConfirmedTransactionResponse,
	mosaicSupplyDecreaseConfirmedTransactionResponse,
	mosaicSupplyRevocationConfirmedTransactionResponse,
	namespaceRegistrationConfirmedTransactionResponse,
	nodeKeyLinkConfirmedTransactionResponse,
	secretLockConfirmedTransactionResponse,
	secretProofConfirmedTransactionResponse,
	subNamespaceRegistrationConfirmedTransactionResponse,
	transferConfirmedTransactionResponse,
	transferCustomMosaicOnlyConfirmedTransactionResponse,
	transferDelegatedHarvestingMessageConfirmedTransactionResponse,
	transferEncryptedMessageConfirmedTransactionResponse,
	transferRawMessageConfirmedTransactionResponse,
	transferUnconfirmedTransactionResponse,
	votingKeyLinkConfirmedTransactionResponse
} from '../../../../__fixtures__/api/symbol/transaction-info';
import {
	transactionListConfirmedResponse,
	transferConfirmedListItemResponse
} from '../../../../__fixtures__/api/symbol/transaction-list-confirmed';
import { transactionListUnconfirmedResponse } from '../../../../__fixtures__/api/symbol/transaction-list-unconfirmed';
import {
	accountAddressRestrictionConfirmedTransaction,
	accountKeyLinkConfirmedTransaction,
	accountMosaicRestrictionConfirmedTransaction,
	accountOperationRestrictionConfirmedTransaction,
	addressAliasConfirmedTransaction,
	aggregateAccountMetadataConfirmedTransaction,
	aggregateBondedConfirmedTransaction,
	aggregateCompleteConfirmedTransaction,
	aggregateKeyLinkConfirmedTransaction,
	aggregateMosaicMetadataConfirmedTransaction,
	aggregateMosaicSupplyRevocationConfirmedTransaction,
	aggregateNamespaceMetadataConfirmedTransaction,
	hashLockConfirmedTransaction,
	mosaicAddressRestrictionConfirmedTransaction,
	mosaicAliasConfirmedTransaction,
	mosaicDefinitionConfirmedTransaction,
	mosaicGlobalRestrictionConfirmedTransaction,
	mosaicGlobalRestrictionWithReferenceConfirmedTransaction,
	mosaicSupplyChangeConfirmedTransaction,
	mosaicSupplyDecreaseConfirmedTransaction,
	mosaicSupplyRevocationConfirmedTransaction,
	namespaceRegistrationConfirmedTransaction,
	nodeKeyLinkConfirmedTransaction,
	secretLockConfirmedTransaction,
	secretProofConfirmedTransaction,
	subNamespaceRegistrationConfirmedTransaction,
	transferConfirmedTransaction,
	transferCustomMosaicOnlyConfirmedTransaction,
	transferDelegatedHarvestingMessageConfirmedTransaction,
	transferEncryptedMessageConfirmedTransaction,
	transferRawMessageConfirmedTransaction,
	transferUnconfirmedTransaction,
	votingKeyLinkConfirmedTransaction
} from '../../../../__fixtures__/local/symbol/transaction';
import { transactionListConfirmed, transferConfirmedListItem } from '../../../../__fixtures__/local/symbol/transaction-list-confirmed';
import {
	aggregateCompleteUnconfirmedListItem,
	transactionListUnconfirmed
} from '../../../../__fixtures__/local/symbol/transaction-list-unconfirmed';
import { error404Response, runApiRequestTests, runApiResultTests } from '../../../test-utils/api';
import config from '@/app/config';
import { TRANSACTION_DIRECTION, TRANSACTION_GROUP } from '@/app/constants';
import * as utils from '@/app/utils/server';
import { fetchTransactionInfo, fetchTransactionPage } from '@/app/variants/symbol/api/transactions';
import { TRANSACTION_TYPE } from '@/app/variants/symbol/transaction/transaction-types';

// Mocks

jest.mock('@/app/utils/server', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils/server')
	};
});

beforeEach(() => {
	config.PUBLIC_NATIVE_MOSAIC_ID = nativeMosaicId;
});

// Constants

const transactionsURL = 'https://explorer.backend/transactions';
const firstPageURL = `${transactionsURL}?limit=10&offset=0`;
const unconfirmedTransactionsURL = 'https://explorer.backend/transactions/unconfirmed';
const transactionURL = 'https://explorer.backend/transaction';
const emptyPageResponse = [];
const nativeMosaicId = '72C0212E67A08BCE';
const blockHeight = 3912970;
const senderAddress = transferConfirmedTransaction.sender;
const recipientAddress = transferConfirmedTransaction.recipient;
const error400Response = {
	response: {
		data: {
			status: 400
		}
	}
};
const error503Response = {
	response: {
		data: {
			status: 503
		}
	}
};

// Tests

describe('variants/symbol/api/transactions', () => {
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
					description: 'requests the first page without the group when the confirmed "group" is provided',
					config: {
						params: { group: TRANSACTION_GROUP.CONFIRMED }
					},
					expected: { url: firstPageURL }
				},
				{
					description: 'requests all unconfirmed transactions when the unconfirmed "group" and "pageSize" are provided',
					config: {
						params: {
							group: TRANSACTION_GROUP.UNCONFIRMED,
							pageSize: 5
						}
					},
					expected: { url: unconfirmedTransactionsURL }
				},
				{
					description: 'requests the address as is when "address" is provided',
					config: {
						params: { address: senderAddress }
					},
					expected: { url: `${firstPageURL}&address=${senderAddress}` }
				},
				{
					description: 'requests the sender address when "from" is provided',
					config: {
						params: { from: senderAddress }
					},
					expected: { url: `${firstPageURL}&senderAddress=${senderAddress}` }
				},
				{
					description: 'requests the recipient address with embedded transactions when "to" is provided',
					config: {
						params: { to: recipientAddress }
					},
					expected: { url: `${firstPageURL}&recipientAddress=${recipientAddress}&embedded=true` }
				},
				{
					description: 'requests the address as the recipient with embedded transactions when "address" and "from" are provided',
					config: {
						params: {
							address: recipientAddress,
							from: senderAddress
						}
					},
					expected: {
						url: `${firstPageURL}&senderAddress=${senderAddress}&recipientAddress=${recipientAddress}&embedded=true`
					}
				},
				{
					description: 'requests the address as the sender with embedded transactions when "address" and "to" are provided',
					config: {
						params: {
							address: senderAddress,
							to: recipientAddress
						}
					},
					expected: {
						url: `${firstPageURL}&senderAddress=${senderAddress}&recipientAddress=${recipientAddress}&embedded=true`
					}
				},
				{
					description: 'requests the transaction types with embedded transactions when "types" is provided',
					config: {
						params: { types: TRANSACTION_TYPE.TRANSFER }
					},
					expected: { url: `${firstPageURL}&transactionTypes=${TRANSACTION_TYPE.TRANSFER}&embedded=true` }
				},
				{
					description: 'requests the mosaic with embedded transactions when "mosaic" is provided',
					config: {
						params: { mosaic: nativeMosaicId }
					},
					expected: { url: `${firstPageURL}&mosaic=${nativeMosaicId}&embedded=true` }
				},
				{
					description: 'requests the block height when "height" is provided',
					config: {
						params: { height: blockHeight }
					},
					expected: { url: `${firstPageURL}&height=${blockHeight}` }
				},
				{
					description: 'requests the first page without the param when the unsupported "sort" is provided',
					config: {
						params: { sort: 'DESC' }
					},
					expected: { url: firstPageURL }
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
					description: 'maps the given unconfirmed page when the unconfirmed "group", "pageNumber" and "pageSize" are provided',
					config: {
						params: {
							group: TRANSACTION_GROUP.UNCONFIRMED,
							pageNumber: 2,
							pageSize: 2
						},
						response: transactionListUnconfirmedResponse
					},
					expected: {
						result: {
							data: [aggregateCompleteUnconfirmedListItem],
							pageNumber: 2
						}
					}
				},
				{
					description: 'marks a transfer as incoming when the recipient "address" is provided',
					config: {
						params: { address: recipientAddress },
						response: [transferConfirmedListItemResponse]
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
						response: [transferConfirmedListItemResponse]
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
					description: 'returns an empty page when there are no transactions',
					config: { response: emptyPageResponse },
					expected: {
						result: {
							data: [],
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
					config: { params: transferConfirmedTransactionResponse.hash },
					expected: { url: `${transactionURL}/${transferConfirmedTransactionResponse.hash}` }
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
					description: 'maps a transfer with an encrypted message',
					config: { response: transferEncryptedMessageConfirmedTransactionResponse },
					expected: { result: transferEncryptedMessageConfirmedTransaction }
				},
				{
					description: 'maps a transfer with a delegated harvesting message',
					config: { response: transferDelegatedHarvestingMessageConfirmedTransactionResponse },
					expected: { result: transferDelegatedHarvestingMessageConfirmedTransaction }
				},
				{
					description: 'maps a transfer with a raw message',
					config: { response: transferRawMessageConfirmedTransactionResponse },
					expected: { result: transferRawMessageConfirmedTransaction }
				},
				{
					description: 'maps a transfer with a custom mosaic only',
					config: { response: transferCustomMosaicOnlyConfirmedTransactionResponse },
					expected: { result: transferCustomMosaicOnlyConfirmedTransaction }
				},
				{
					description: 'maps an unconfirmed transfer',
					config: { response: transferUnconfirmedTransactionResponse },
					expected: { result: transferUnconfirmedTransaction }
				},
				{
					description: 'maps a root namespace registration',
					config: { response: namespaceRegistrationConfirmedTransactionResponse },
					expected: { result: namespaceRegistrationConfirmedTransaction }
				},
				{
					description: 'maps a sub namespace registration',
					config: { response: subNamespaceRegistrationConfirmedTransactionResponse },
					expected: { result: subNamespaceRegistrationConfirmedTransaction }
				},
				{
					description: 'maps an address alias',
					config: { response: addressAliasConfirmedTransactionResponse },
					expected: { result: addressAliasConfirmedTransaction }
				},
				{
					description: 'maps a mosaic alias',
					config: { response: mosaicAliasConfirmedTransactionResponse },
					expected: { result: mosaicAliasConfirmedTransaction }
				},
				{
					description: 'maps a mosaic definition',
					config: { response: mosaicDefinitionConfirmedTransactionResponse },
					expected: { result: mosaicDefinitionConfirmedTransaction }
				},
				{
					description: 'maps a mosaic supply increase',
					config: { response: mosaicSupplyChangeConfirmedTransactionResponse },
					expected: { result: mosaicSupplyChangeConfirmedTransaction }
				},
				{
					description: 'maps a mosaic supply decrease',
					config: { response: mosaicSupplyDecreaseConfirmedTransactionResponse },
					expected: { result: mosaicSupplyDecreaseConfirmedTransaction }
				},
				{
					description: 'maps a mosaic supply revocation',
					config: { response: mosaicSupplyRevocationConfirmedTransactionResponse },
					expected: { result: mosaicSupplyRevocationConfirmedTransaction }
				},
				{
					description: 'maps a hash lock',
					config: { response: hashLockConfirmedTransactionResponse },
					expected: { result: hashLockConfirmedTransaction }
				},
				{
					description: 'maps a secret lock',
					config: { response: secretLockConfirmedTransactionResponse },
					expected: { result: secretLockConfirmedTransaction }
				},
				{
					description: 'maps a secret proof',
					config: { response: secretProofConfirmedTransactionResponse },
					expected: { result: secretProofConfirmedTransaction }
				},
				{
					description: 'maps an account address restriction',
					config: { response: accountAddressRestrictionConfirmedTransactionResponse },
					expected: { result: accountAddressRestrictionConfirmedTransaction }
				},
				{
					description: 'maps an account mosaic restriction',
					config: { response: accountMosaicRestrictionConfirmedTransactionResponse },
					expected: { result: accountMosaicRestrictionConfirmedTransaction }
				},
				{
					description: 'maps an account operation restriction',
					config: { response: accountOperationRestrictionConfirmedTransactionResponse },
					expected: { result: accountOperationRestrictionConfirmedTransaction }
				},
				{
					description: 'maps an account key link',
					config: { response: accountKeyLinkConfirmedTransactionResponse },
					expected: { result: accountKeyLinkConfirmedTransaction }
				},
				{
					description: 'maps a voting key link',
					config: { response: votingKeyLinkConfirmedTransactionResponse },
					expected: { result: votingKeyLinkConfirmedTransaction }
				},
				{
					description: 'maps a node key link',
					config: { response: nodeKeyLinkConfirmedTransactionResponse },
					expected: { result: nodeKeyLinkConfirmedTransaction }
				},
				{
					description: 'maps a mosaic address restriction',
					config: { response: mosaicAddressRestrictionConfirmedTransactionResponse },
					expected: { result: mosaicAddressRestrictionConfirmedTransaction }
				},
				{
					description: 'maps a mosaic global restriction without a reference mosaic',
					config: { response: mosaicGlobalRestrictionConfirmedTransactionResponse },
					expected: { result: mosaicGlobalRestrictionConfirmedTransaction }
				},
				{
					description: 'maps a mosaic global restriction with a reference mosaic',
					config: { response: mosaicGlobalRestrictionWithReferenceConfirmedTransactionResponse },
					expected: { result: mosaicGlobalRestrictionWithReferenceConfirmedTransaction }
				},
				{
					description: 'maps an aggregate complete with an embedded multisig account modification and transfer',
					config: { response: aggregateCompleteConfirmedTransactionResponse },
					expected: { result: aggregateCompleteConfirmedTransaction }
				},
				{
					description: 'maps an aggregate bonded with an embedded multisig account modification',
					config: { response: aggregateBondedConfirmedTransactionResponse },
					expected: { result: aggregateBondedConfirmedTransaction }
				},
				{
					description: 'maps an aggregate with the embedded VRF, account and node key links',
					config: { response: aggregateKeyLinkConfirmedTransactionResponse },
					expected: { result: aggregateKeyLinkConfirmedTransaction }
				},
				{
					description: 'maps an aggregate with an embedded mosaic supply revocation and transfer',
					config: { response: aggregateMosaicSupplyRevocationConfirmedTransactionResponse },
					expected: { result: aggregateMosaicSupplyRevocationConfirmedTransaction }
				},
				{
					description: 'maps an aggregate with an embedded account metadata',
					config: { response: aggregateAccountMetadataConfirmedTransactionResponse },
					expected: { result: aggregateAccountMetadataConfirmedTransaction }
				},
				{
					description: 'maps an aggregate with an embedded mosaic metadata',
					config: { response: aggregateMosaicMetadataConfirmedTransactionResponse },
					expected: { result: aggregateMosaicMetadataConfirmedTransaction }
				},
				{
					description: 'maps an aggregate with an embedded namespace metadata',
					config: { response: aggregateNamespaceMetadataConfirmedTransactionResponse },
					expected: { result: aggregateNamespaceMetadataConfirmedTransaction }
				},
				{
					description: 'returns null when the transaction does not exist',
					config: { error: error404Response },
					expected: { result: null }
				},
				{
					description: 'returns null when the hash is invalid',
					config: { error: error400Response },
					expected: { result: null }
				}
			];

			runApiResultTests({ functionToTest: fetchTransactionInfo, cases: resultCases });

			it('throws when the backend is unavailable', async () => {
				// Arrange:
				jest.spyOn(utils, 'makeRequest').mockRejectedValue(error503Response);

				// Act & Assert:
				await expect(fetchTransactionInfo(transferConfirmedTransactionResponse.hash)).rejects.toBe(error503Response);
			});
		});
	});
});
