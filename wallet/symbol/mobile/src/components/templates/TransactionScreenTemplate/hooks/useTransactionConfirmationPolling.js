import { useTimer } from '@/app/hooks';
import { useState } from 'react';
import { TransactionGroup } from 'wallet-common-core/src/constants';

const TRANSACTION_POLLING_INTERVAL_MS = 1000;

/** @typedef {import('wallet-common-core/src/lib/controllers/WalletController').WalletController} WalletController */

/**
 * Return type of the useTransactionConfirmationPolling hook.
 * @typedef {object} TransactionPolling
 * @property {string[]} confirmedTransactionHashes - Array of confirmed transaction hashes.
 * @property {string[]} failedTransactionHashes - Array of failed transaction hashes.
 * @property {string[]} partialTransactionHashes - Array of partial transaction hashes.
 * @property {function(): void} reset - Function to reset the confirmation state.
 */

/**
 * React hook for managing transaction confirmation status polling.
 * @param {object} params - The parameters object.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {string[]} params.signedTransactionHashes - Array of signed transaction hashes to poll.
 * @param {boolean} params.isActive - Whether the polling is active.
 * @returns {TransactionPolling} The transaction confirmation polling state and functions.
 */
export const useTransactionConfirmationPolling = ({
	walletController,
	signedTransactionHashes,
	isActive
}) => {
	const [confirmedTransactionHashes, setConfirmedTransactionHashes] = useState([]);
	const [failedTransactionHashes, setFailedTransactionHashes] = useState([]);
	const [partialTransactionHashes, setPartialTransactionHashes] = useState([]);

	const fetchTransactionsConfirmation = async () => {
		if (signedTransactionHashes.length === 0) 
			return;

		const statuses = await Promise.all(signedTransactionHashes.map(async hash => {
			try {
				const status = await walletController.fetchTransactionStatus(hash);
				
				return { hash, group: status.group };
			} catch {
				return { hash, group: null };
			}
		}));

		setConfirmedTransactionHashes(statuses
			.filter(item => item.group === TransactionGroup.CONFIRMED)
			.map(item => item.hash));
		setFailedTransactionHashes(statuses
			.filter(item => item.group === TransactionGroup.FAILED)
			.map(item => item.hash));
		setPartialTransactionHashes(statuses
			.filter(item => item.group === TransactionGroup.PARTIAL)
			.map(item => item.hash));
	};

	useTimer({
		callback: fetchTransactionsConfirmation,
		interval: TRANSACTION_POLLING_INTERVAL_MS,
		isActive,
		dependencies: [isActive, signedTransactionHashes]
	});

	// Interface methods
	const reset = () => {
		setConfirmedTransactionHashes([]);
		setFailedTransactionHashes([]);
		setPartialTransactionHashes([]);
	};

	return {
		confirmedTransactionHashes,
		failedTransactionHashes,
		partialTransactionHashes,
		reset
	};
};
