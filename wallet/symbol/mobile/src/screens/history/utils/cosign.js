import { $t } from '@/app/localization';
import { CosignStatus } from '@/app/screens/history/types/Cosignature';
import { SemanticRoleColorVariant } from '@/app/types/ColorVariants';
import { TransactionGroup } from '@/app/types/Transaction';
import { 
	isTransactionAwaitingSignatureByAccount as isTransactionAwaitingSignatureByAccountSdk 
} from 'wallet-common-symbol/src/utils/transaction';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/screens/history/types/Cosignature').CosignStatusValue} CosignStatusValue */

/**
 * Cosign alert display data.
 * @typedef {Object} CosignAlertData
 * @property {boolean} isVisible - Whether the alert should be displayed.
 * @property {string} [text] - Alert message text.
 * @property {string} [variant] - Semantic color variant for styling.
 * @property {string} [icon] - Icon name for the alert.
 */

/**
 * Options for determining transaction cosign status.
 * @typedef {Object} CosignStatusOptions
 * @property {string} transactionGroup - Transaction group from TransactionGroup enum.
 * @property {WalletAccount} currentAccount - Current wallet account.
 * @property {Object} addressBook - Address book instance with whitelist and blacklist.
 * @property {WalletAccount[]} [walletAccounts] - All wallet accounts.
 * @property {WalletAccount[]} [multisigCosigners] - Multisig cosigner accounts.
 */

/**
 * Re-export of SDK function that checks if transaction awaits signature by account.
 */
export const isTransactionAwaitingSignatureByAccount = isTransactionAwaitingSignatureByAccountSdk;

/**
 * Determines the cosign status of a transaction for the current account.
 * @param {Transaction} transaction - Transaction to check.
 * @param {CosignStatusOptions} options - Options containing account and context data.
 * @returns {CosignStatusValue} Cosign status value.
 */
export const getTransactionCosignStatus = (transaction, options) => {
	const { transactionGroup, currentAccount, addressBook, walletAccounts, multisigCosigners } = options;

	if (transactionGroup !== TransactionGroup.PARTIAL)
		return CosignStatus.NOT_AWAITING;

	const isSignedByCurrentAccount = transaction.signerAddress === currentAccount.address
        || transaction.receivedCosignatures?.some(address => address === currentAccount.address);

	if (isSignedByCurrentAccount)
		return CosignStatus.SIGNED_AND_AWAITING_OTHER_ACCOUNT;

	const isAwaitingCurrentAccountSignature = isTransactionAwaitingSignatureByAccount(transaction, currentAccount);

	if (!isAwaitingCurrentAccountSignature) 
		return CosignStatus.AWAITING_OTHER_ACCOUNT;

	const initiator = transaction.signerAddress;
	const isInitiatorBlocked = addressBook.blacklist?.some(contact => contact.address === initiator);

	if (isInitiatorBlocked)
		return CosignStatus.INITIATED_BY_BLOCKED_ACCOUNT;

	const isInitiatorWalletAccount = walletAccounts?.some(account => account.address === initiator);
	const isInitiatorInContacts = addressBook.whiteList?.some(contact => contact.address === initiator);
	const isInitiatorMultisigCosigner = multisigCosigners?.some(cosigner => cosigner.address === initiator);
	const isInitiatorKnown = isInitiatorWalletAccount || isInitiatorInContacts || isInitiatorMultisigCosigner;

	if (!isInitiatorKnown)
		return CosignStatus.INITIATED_BY_UNKNOWN_ACCOUNT;

	return CosignStatus.AWAITING_CURRENT_ACCOUNT;
};

/**
 * Creates alert display data based on cosign status.
 * @param {CosignStatusValue} cosignStatus - Cosign status to create alert for.
 * @returns {CosignAlertData} Alert display data.
 */
export const createCosignAlertData = cosignStatus => {
	const alertDataMap = {
		[CosignStatus.AWAITING_CURRENT_ACCOUNT]: {
			text: $t('s_transactionDetails_cosignAlert_trustedAccount'),
			variant: SemanticRoleColorVariant.INFO,
			icon: 'sign'
		},
		[CosignStatus.AWAITING_OTHER_ACCOUNT]: {
			text: $t('s_transactionDetails_cosignAlert_awaitingOtherSignatures'),
			variant: SemanticRoleColorVariant.NEUTRAL,
			icon: 'info-circle'
		},
		[CosignStatus.SIGNED_AND_AWAITING_OTHER_ACCOUNT]: {
			text: $t('s_transactionDetails_cosignAlert_signed'),
			variant: SemanticRoleColorVariant.NEUTRAL,
			icon: 'info-circle'
		},
		[CosignStatus.INITIATED_BY_BLOCKED_ACCOUNT]: {
			text: $t('s_transactionDetails_cosignAlert_blockedAccount'),
			variant: SemanticRoleColorVariant.DANGER,
			icon: 'alert-danger'
		},
		[CosignStatus.INITIATED_BY_UNKNOWN_ACCOUNT]: {
			text: $t('s_transactionDetails_cosignAlert_unknownAccount'),
			variant: SemanticRoleColorVariant.WARNING,
			icon: 'alert-warning'
		},
		[CosignStatus.NOT_AWAITING]: null
	};

	const alertBaseData = alertDataMap[cosignStatus];

	if (!alertBaseData)
		return { isVisible: false };
    
	return {
		isVisible: true,
		...alertBaseData
	};
};
