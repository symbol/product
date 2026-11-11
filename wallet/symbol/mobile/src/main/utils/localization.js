import { EthereumTransactionType, ReceiptType, SymbolTransactionType, TransactionDirection } from '@/app/constants';
import { constants } from 'wallet-common-core';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

const { ErrorCode } = constants;

const UNKNOWN_ERROR_MESSAGE_KEY = 'errorMessage_unknown';
const UNKNOWN_TRANSACTION_TYPE_KEY = 'transactionType_unknown';
const UNKNOWN_RECEIPT_TYPE_KEY = 'receiptType_unknown';
const TRANSFER_TYPE_KEY = 'transactionType_transfer';

const errorMessageKeyMap = {
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

const transactionTypeKeyMap = {
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

const transferDirectionKeyMap = {
	[TransactionDirection.INCOMING]: 'transactionType_transferIncoming',
	[TransactionDirection.OUTGOING]: 'transactionType_transferOutgoing'
};

const receiptTypeKeyMap = {
	[ReceiptType.HARVESTING_REWARD]: 'receiptType_harvestingReward'
};

/**
 * Gets the message key of an error code, falling back to the generic text for an unknown code.
 * @param {string} code - Error code thrown by a wallet package.
 * @returns {string} Localization key.
 */
export const getErrorMessageLocaleKey = code => errorMessageKeyMap[code] ?? UNKNOWN_ERROR_MESSAGE_KEY;

/**
 * Gets the key of a transaction type text, falling back to the generic text for an unknown type.
 * @param {number|string} type - The chain-specific transaction type enum value.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @param {string} [direction] - Direction of the transfer text, a member of TransactionDirection.
 * @returns {string} Localization key, e.g. 'transactionType_transferIncoming'.
 */
export const getTransactionTypeLocaleKey = (type, chainName, direction) => {
	const key = transactionTypeKeyMap[chainName]?.[type];
	if (!key)
		return UNKNOWN_TRANSACTION_TYPE_KEY;
	if (direction && key === TRANSFER_TYPE_KEY)
		return transferDirectionKeyMap[direction] ?? key;

	return key;
};

/**
 * Gets the key of a receipt type text, falling back to the generic text for an unknown type.
 * @param {string} type - Receipt type, a member of ReceiptType.
 * @returns {string} Localization key.
 */
export const getReceiptTypeLocaleKey = type => receiptTypeKeyMap[type] ?? UNKNOWN_RECEIPT_TYPE_KEY;
