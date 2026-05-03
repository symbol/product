
import { $t } from '@/app/localization';
import { TransactionGroup } from '@/app/types/Transaction';
import { formatDate } from '@/app/utils';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

/**
 * Gets the date or status text for a transaction.
 * @param {Transaction} transaction - Transaction object.
 * @param {string} group - Transaction group.
 * @returns {string} Formatted date or status text.
 */
export const getTransactionDateText = (transaction, group) => {
	const { deadline, timestamp } = transaction;

	if (group === TransactionGroup.UNCONFIRMED || group === TransactionGroup.PARTIAL) {
		const deadlineText = formatDate(deadline?.timestamp, $t, true);
        
		return $t('transaction_awaitingConfirmation', { deadline: deadlineText });
	}

	const dateValue = timestamp ?? deadline?.timestamp;

	if (!dateValue) 
		return $t('data_na');

	return formatDate(dateValue, $t, true);
};
