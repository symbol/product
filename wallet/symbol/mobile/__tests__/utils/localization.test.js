import { EthereumTransactionType, ReceiptType, SymbolTransactionType, TransactionDirection } from '@/app/constants';
import en from '@/app/localization/locales/en.json';
import { getErrorMessageLocaleKey, getReceiptTypeLocaleKey, getTransactionTypeLocaleKey } from '@/app/utils';
import { constants } from 'wallet-common-core';

const { ErrorCode } = constants;

// Constants

const CHAIN_NAME_SYMBOL = 'symbol';
const CHAIN_NAME_ETHEREUM = 'ethereum';
const UNKNOWN_ERROR_MESSAGE_KEY = 'errorMessage_unknown';
const UNKNOWN_TRANSACTION_TYPE_KEY = 'transactionType_unknown';
const UNKNOWN_RECEIPT_TYPE_KEY = 'receiptType_unknown';

const enKeys = Object.keys(en);

// Asserts the mapper returns exactly the expected locale key for every input,
// that every required input has an expected pair, and that every locale key exists in en.json.
const expectMappedLocaleKeys = (expectedLocaleKeys, getLocaleKey, requiredInputs) => {
	const inputs = Object.keys(expectedLocaleKeys);
	const localeKeys = Object.values(expectedLocaleKeys);
	const result = Object.fromEntries(inputs.map(input => [input, getLocaleKey(input)]));
	const uncoveredInputs = requiredInputs.filter(input => !(input in expectedLocaleKeys));
	const missingEnKeys = localeKeys.filter(key => !enKeys.includes(key));

	expect(result).toEqual(expectedLocaleKeys);
	expect(uncoveredInputs).toEqual([]);
	expect(missingEnKeys).toEqual([]);
};

describe('utils/localization', () => {
	describe('getErrorMessageLocaleKey()', () => {
		const errorCodeLocaleKeys = {
			[ErrorCode.FAILED_ACCESS_KEYSTORE]: 'errorMessage_keystoreAccess',
			[ErrorCode.WALLET_SELECTED_ACCOUNT_MISSING]: 'errorMessage_selectedAccountMissing',
			[ErrorCode.WALLET_ADD_ACCOUNT_ALREADY_EXISTS]: 'errorMessage_accountAlreadyExists',
			[ErrorCode.WALLET_REMOVE_CURRENT_ACCOUNT]: 'errorMessage_removeCurrentAccount',
			[ErrorCode.WALLET_ACCOUNT_NOT_FOUND]: 'errorMessage_accountNotFound',
			[ErrorCode.WALLET_NETWORK_NOT_SUPPORTED]: 'errorMessage_networkNotSupported',
			[ErrorCode.FETCH_INVALID_REQUEST]: 'errorMessage_invalidRequest',
			[ErrorCode.FETCH_UNAUTHORIZED]: 'errorMessage_unauthorized',
			[ErrorCode.FETCH_NOT_FOUND]: 'errorMessage_notFound',
			[ErrorCode.FETCH_RATE_LIMIT]: 'errorMessage_rateLimit',
			[ErrorCode.FETCH_SERVER_ERROR]: 'errorMessage_serverError',
			[ErrorCode.NETWORK_REQUEST_ERROR]: 'errorMessage_networkRequest',
			[ErrorCode.NETWORK_LISTENER_START_ERROR]: 'errorMessage_chainListenerStart',
			[ErrorCode.NETWORK_PROPERTIES_WRONG_NETWORK]: 'errorMessage_wrongNetwork',
			[ErrorCode.ADDRESS_BOOK_ADD_CONTACT_ALREADY_EXISTS]: 'errorMessage_contactAlreadyExists',
			[ErrorCode.ADDRESS_BOOK_REMOVE_CONTACT_NOT_FOUND]: 'errorMessage_contactNotFound',
			[ErrorCode.ADDRESS_BOOK_UPDATE_CONTACT_NOT_FOUND]: 'errorMessage_contactNotFound',
			[ErrorCode.KEYSTORE_ERROR]: 'errorMessage_keystore',
			[ErrorCode.API_ERROR]: 'errorMessage_api',
			[ErrorCode.SDK_ERROR]: 'errorMessage_sdk',
			[ErrorCode.CONTROLLER_ERROR]: 'errorMessage_controller',

			// Codes thrown as string literals in wallet/common, not members of ErrorCode.
			error_failed_decrypt_message_invalid_transaction_type: 'errorMessage_decryptMessageInvalidTransactionType',
			error_failed_decrypt_message_not_related: 'errorMessage_decryptMessageNotRelated',
			error_harvesting_account_no_activity: 'errorMessage_harvestingAccountNoActivity',
			error_harvesting_no_keys_to_unlink: 'errorMessage_harvestingNoKeysToUnlink',
			error_transfer_encrypted_message_no_recipient_public_key: 'errorMessage_transferNoRecipientPublicKey',
			error_transfer_unknown_recipient: 'errorMessage_transferUnknownRecipient',
			error_unknown_account_name: 'errorMessage_unknownAccountName'
		};

		it('maps every error code to its dedicated en.json key', () => {
			expectMappedLocaleKeys(errorCodeLocaleKeys, getErrorMessageLocaleKey, Object.values(ErrorCode));
		});

		it('returns the unknown-error key for an unmapped code', () => {
			expect(getErrorMessageLocaleKey('error_some_unknown_code')).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
		});

		it('returns the unknown-error key when the code is undefined', () => {
			expect(getErrorMessageLocaleKey(undefined)).toBe(UNKNOWN_ERROR_MESSAGE_KEY);
		});
	});

	describe('getTransactionTypeLocaleKey()', () => {
		const transactionTypeLocaleKeys = {
			symbol: {
				[SymbolTransactionType.TRANSFER]: 'transactionType_transfer',
				[SymbolTransactionType.NAMESPACE_REGISTRATION]: 'transactionType_namespaceRegistration',
				[SymbolTransactionType.ADDRESS_ALIAS]: 'transactionType_addressAlias',
				[SymbolTransactionType.MOSAIC_ALIAS]: 'transactionType_mosaicAlias',
				[SymbolTransactionType.MOSAIC_DEFINITION]: 'transactionType_mosaicDefinition',
				[SymbolTransactionType.MOSAIC_SUPPLY_CHANGE]: 'transactionType_mosaicSupplyChange',
				[SymbolTransactionType.MOSAIC_SUPPLY_REVOCATION]: 'transactionType_mosaicSupplyRevocation',
				[SymbolTransactionType.MULTISIG_ACCOUNT_MODIFICATION]: 'transactionType_multisigAccountModification',
				[SymbolTransactionType.AGGREGATE_COMPLETE]: 'transactionType_aggregateComplete',
				[SymbolTransactionType.AGGREGATE_BONDED]: 'transactionType_aggregateBonded',
				[SymbolTransactionType.HASH_LOCK]: 'transactionType_hashLock',
				[SymbolTransactionType.SECRET_LOCK]: 'transactionType_secretLock',
				[SymbolTransactionType.SECRET_PROOF]: 'transactionType_secretProof',
				[SymbolTransactionType.ACCOUNT_ADDRESS_RESTRICTION]: 'transactionType_accountAddressRestriction',
				[SymbolTransactionType.ACCOUNT_MOSAIC_RESTRICTION]: 'transactionType_accountMosaicRestriction',
				[SymbolTransactionType.ACCOUNT_OPERATION_RESTRICTION]: 'transactionType_accountOperationRestriction',
				[SymbolTransactionType.ACCOUNT_KEY_LINK]: 'transactionType_accountKeyLink',
				[SymbolTransactionType.MOSAIC_ADDRESS_RESTRICTION]: 'transactionType_mosaicAddressRestriction',
				[SymbolTransactionType.MOSAIC_GLOBAL_RESTRICTION]: 'transactionType_mosaicGlobalRestriction',
				[SymbolTransactionType.ACCOUNT_METADATA]: 'transactionType_accountMetadata',
				[SymbolTransactionType.MOSAIC_METADATA]: 'transactionType_mosaicMetadata',
				[SymbolTransactionType.NAMESPACE_METADATA]: 'transactionType_namespaceMetadata',
				[SymbolTransactionType.VRF_KEY_LINK]: 'transactionType_vrfKeyLink',
				[SymbolTransactionType.VOTING_KEY_LINK]: 'transactionType_votingKeyLink',
				[SymbolTransactionType.NODE_KEY_LINK]: 'transactionType_nodeKeyLink'
			},
			ethereum: {
				[EthereumTransactionType.TRANSFER]: 'transactionType_transfer',
				[EthereumTransactionType.ERC_20_TRANSFER]: 'transactionType_erc20Transfer',
				[EthereumTransactionType.ERC_20_BRIDGE_TRANSFER]: 'transactionType_erc20BridgeTransfer',
				[EthereumTransactionType.UNISWAP_SWAP]: 'transactionType_uniswapSwap',
				[EthereumTransactionType.ERC_20_APPROVE]: 'transactionType_erc20Approve'
			}
		};
		const transferDirectionLocaleKeys = {
			[TransactionDirection.INCOMING]: 'transactionType_transferIncoming',
			[TransactionDirection.OUTGOING]: 'transactionType_transferOutgoing'
		};

		it('maps every transaction type and direction to its dedicated en.json key', () => {
			// Arrange:
			// RESERVED is not used, so filter it out.
			const symbolTypes = Object.values(SymbolTransactionType)
				.filter(type => type !== SymbolTransactionType.RESERVED);
			const ethereumTypes = Object.values(EthereumTransactionType)
				.filter(type => type !== EthereumTransactionType.RESERVED);

			// Act & Assert:
			expectMappedLocaleKeys(
				transactionTypeLocaleKeys.symbol,
				type => getTransactionTypeLocaleKey(type, CHAIN_NAME_SYMBOL),
				symbolTypes
			);
			expectMappedLocaleKeys(
				transactionTypeLocaleKeys.ethereum,
				type => getTransactionTypeLocaleKey(type, CHAIN_NAME_ETHEREUM),
				ethereumTypes
			);
			expectMappedLocaleKeys(
				transferDirectionLocaleKeys,
				direction => getTransactionTypeLocaleKey(SymbolTransactionType.TRANSFER, CHAIN_NAME_SYMBOL, direction),
				Object.values(TransactionDirection)
			);
		});

		const runGetTransactionTypeLocaleKeyTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				const result = getTransactionTypeLocaleKey(config.type, config.chainName, config.direction);

				// Assert:
				expect(result).toBe(expected.result);
			});
		};

		const getTransactionTypeLocaleKeyTests = [
			{
				description: 'returns the plain transfer key for a transfer without direction',
				config: { type: SymbolTransactionType.TRANSFER, chainName: CHAIN_NAME_SYMBOL },
				expected: { result: 'transactionType_transfer' }
			},
			{
				description: 'returns the plain transfer key when the direction is unknown',
				config: { type: SymbolTransactionType.TRANSFER, chainName: CHAIN_NAME_SYMBOL, direction: 'sideways' },
				expected: { result: 'transactionType_transfer' }
			},
			{
				description: 'ignores the direction for a non-transfer type',
				config: { type: SymbolTransactionType.HASH_LOCK, chainName: CHAIN_NAME_SYMBOL, direction: TransactionDirection.INCOMING },
				expected: { result: 'transactionType_hashLock' }
			},
			{
				description: 'returns the unknown-type key for an unmapped type',
				config: { type: 999999, chainName: CHAIN_NAME_SYMBOL },
				expected: { result: UNKNOWN_TRANSACTION_TYPE_KEY }
			},
			{
				description: 'returns the unknown-type key for an unknown chain',
				config: { type: SymbolTransactionType.TRANSFER, chainName: 'unknownChain' },
				expected: { result: UNKNOWN_TRANSACTION_TYPE_KEY }
			}
		];

		getTransactionTypeLocaleKeyTests.forEach(test => {
			runGetTransactionTypeLocaleKeyTest(test.description, test.config, test.expected);
		});
	});

	describe('getReceiptTypeLocaleKey()', () => {
		const receiptTypeLocaleKeys = {
			[ReceiptType.HARVESTING_REWARD]: 'receiptType_harvestingReward'
		};

		it('maps every receipt type to its dedicated en.json key', () => {
			expectMappedLocaleKeys(receiptTypeLocaleKeys, getReceiptTypeLocaleKey, Object.values(ReceiptType));
		});

		it('returns the unknown-receipt key for an unmapped type', () => {
			expect(getReceiptTypeLocaleKey('unknownReceiptType')).toBe(UNKNOWN_RECEIPT_TYPE_KEY);
		});

		it('returns the unknown-receipt key when the type is undefined', () => {
			expect(getReceiptTypeLocaleKey(undefined)).toBe(UNKNOWN_RECEIPT_TYPE_KEY);
		});
	});
});
