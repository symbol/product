import { ReceiptType } from '@/app/constants';
import { constants } from 'wallet-common-core';

const { ErrorCode } = constants;

const UNKNOWN_ERROR_MESSAGE_KEY = 'errorMessage_unknown';
const UNKNOWN_RECEIPT_TYPE_KEY = 'receiptType_unknown';

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
 * Gets the key of a receipt type text, falling back to the generic text for an unknown type.
 * @param {string} type - Receipt type, a member of ReceiptType.
 * @returns {string} Localization key.
 */
export const getReceiptTypeLocaleKey = type => receiptTypeKeyMap[type] ?? UNKNOWN_RECEIPT_TYPE_KEY;
