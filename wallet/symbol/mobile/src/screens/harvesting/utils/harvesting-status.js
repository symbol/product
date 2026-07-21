import { $t } from '@/app/localization';
import { HARVESTING_ELIGIBILITY_MIN_BALANCE, HARVESTING_ELIGIBILITY_MIN_IMPORTANCE } from '@/app/screens/harvesting/constants';
import { HarvestingStatus } from '@/app/screens/harvesting/types/Harvesting';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('wallet-common-symbol').HarvestingStatus} HarvestingStatusData */
/** @typedef {import('@/app/types/Account').SymbolAccountInfo} SymbolAccountInfo */
/** @typedef {import('../types/Harvesting').StatusDisplayConfig} StatusDisplayConfig */
/** @typedef {import('../types/Harvesting').WarningConfig} WarningConfig */
/** @typedef {import('../types/Harvesting').HarvestingEligibility} HarvestingEligibility */
/** @typedef {import('../types/Harvesting').HarvestingStatusViewModel} HarvestingStatusViewModel */

/**
 * Checks if account balance is sufficient for harvesting.
 * @param {string} balance - Account balance as string.
 * @param {number} divisibility - Token divisibility.
 * @returns {boolean} True if balance is sufficient.
 */
export const isBalanceSufficient = (balance, divisibility) => {
	const isGreaterThan = safeOperationWithRelativeAmounts(
		divisibility,
		[balance, HARVESTING_ELIGIBILITY_MIN_BALANCE],
		(balanceAbs, minBalanceAbs) => balanceAbs >= minBalanceAbs ? 1n : 0n
	);

	return isGreaterThan !== '0';
};

/**
 * Checks if account importance is sufficient for harvesting.
 * @param {number} importance - Account importance score.
 * @returns {boolean} True if importance is sufficient.
 */
export const isImportanceSufficient = importance => importance > HARVESTING_ELIGIBILITY_MIN_IMPORTANCE;

/**
 * Checks which harvesting requirements an account meets. The account info is absent while the
 * selected account is still being resolved, which counts as not eligible.
 * @param {SymbolAccountInfo} [accountInfo] - Account info of the harvester (current or multisig).
 * @param {number} divisibility - Token divisibility.
 * @returns {HarvestingEligibility} Eligibility of the account.
 */
export const getHarvestingEligibility = (accountInfo, divisibility) => {
	const isAccountBalanceSufficient = isBalanceSufficient(accountInfo?.balance ?? '0', divisibility);
	const isAccountImportanceSufficient = isImportanceSufficient(accountInfo?.importance ?? 0);
	const isEligible = isAccountBalanceSufficient && isAccountImportanceSufficient;

	return {
		isBalanceSufficient: isAccountBalanceSufficient,
		isImportanceSufficient: isAccountImportanceSufficient,
		isEligible
	};
};

/**
 * Creates warning configuration based on account eligibility.
 * @param {object} params - Parameters.
 * @param {string} params.status - Harvesting status.
 * @param {HarvestingEligibility} params.eligibility - Eligibility of the account.
 * @returns {WarningConfig} Warning configuration.
 */
const createEligibilityWarning = ({ status, eligibility }) => {
	if (status === HarvestingStatus.NODE_UNKNOWN)
		return { isVisible: true, text: $t('s_harvesting_warning_node_down') };

	const activeStatuses = [HarvestingStatus.ACTIVE, HarvestingStatus.OPERATOR, HarvestingStatus.PENDING];
	if (activeStatuses.includes(status))
		return { isVisible: false };

	if (!eligibility.isBalanceSufficient)
		return { isVisible: true, text: $t('s_harvesting_warning_balance') };

	if (!eligibility.isImportanceSufficient)
		return { isVisible: true, text: $t('s_harvesting_warning_importance') };

	return { isVisible: false };
};


/**
 * Creates harvesting status view model from API response and account info.
 * @param {object} params - Parameters.
 * @param {HarvestingStatusData|null} params.harvestingStatus - Harvesting status of the account.
 * @param {HarvestingEligibility} params.eligibility - Eligibility of the account.
 * @param {boolean} [params.isPendingTransaction=false] - Whether a transaction is pending.
 * @returns {HarvestingStatusViewModel} View model for rendering.
 */
export const createHarvestingStatusViewModel = ({
	harvestingStatus,
	eligibility,
	isPendingTransaction = false
}) => {
	const statusDisplayConfigMap = {
		[HarvestingStatus.ACTIVE]: {
			statusText: $t('s_harvesting_status_active'),
			icon: 'check-circle-big',
			variant: 'success'
		},
		[HarvestingStatus.PENDING]: {
			statusText: $t('s_harvesting_status_pending'),
			icon: 'pending',
			variant: 'warning'
		},
		[HarvestingStatus.INACTIVE]: {
			statusText: $t('s_harvesting_status_inactive'),
			icon: 'cross-circle',
			variant: 'neutral'
		},
		[HarvestingStatus.OPERATOR]: {
			statusText: $t('s_harvesting_status_operator'),
			icon: 'account',
			variant: 'success'
		},
		[HarvestingStatus.NODE_UNKNOWN]: {
			statusText: $t('s_harvesting_status_unknown'),
			icon: 'question-circle',
			variant: 'neutral'
		}
	};

	// Force pending state during transaction
	if (isPendingTransaction) {
		return {
			statusDisplay: statusDisplayConfigMap[HarvestingStatus.PENDING],
			warning: { isVisible: false },
			nodeUrl: null
		};
	}

	if (!harvestingStatus) {
		return {
			statusDisplay: statusDisplayConfigMap[HarvestingStatus.NODE_UNKNOWN],
			warning: { isVisible: false },
			nodeUrl: null
		};
	}

	const { status } = harvestingStatus;
	const nodeUrl = harvestingStatus.nodeUrl ?? null;
	const statusDisplay = statusDisplayConfigMap[status] ?? statusDisplayConfigMap[HarvestingStatus.NODE_UNKNOWN];
	const warning = createEligibilityWarning({ status, eligibility });

	return {
		statusDisplay,
		warning,
		nodeUrl
	};
};
