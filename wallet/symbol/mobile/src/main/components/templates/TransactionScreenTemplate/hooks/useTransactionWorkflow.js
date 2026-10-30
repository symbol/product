import { useTransactionConfirmationPolling } from './useTransactionConfirmationPolling';
import { TransactionWorkflowStatus } from '../constants';
import { useAsyncManager } from '@/app/hooks';
import { showError } from '@/app/utils';
import { useRef, useState } from 'react';

/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('../types/Workflow').StandardTransactionWorkflow} StandardTransactionWorkflow */

/** @typedef {function(): Promise<TransactionBundle>} CreateTransactionCallback */
/** @typedef {function(Error): void} ErrorCallback */
/** @typedef {function(): void} SuccessCallback */

/**
 * React hook for managing the full transaction send workflow (create → sign → announce → confirm).
 * Includes built-in confirmation polling and derives a single status value for UI consumption.
 * @param {object} params - The parameters object.
 * @param {CreateTransactionCallback} params.createTransaction - Callback to create the transaction bundle.
 * @param {WalletController} params.walletController - The wallet controller instance.
 * @param {TransactionFeeTiers[]} [params.transactionFeeTiers] - Optional fee tiers per transaction.
 * @param {TransactionFeeTierLevel} [params.transactionFeeTierLevel] - Optional fee tier level to apply.
 * @param {SuccessCallback} [params.onSendSuccess] - Called after successful announce.
 * @param {ErrorCallback} [params.onSendError] - Called when sign or announce fails.
 * @returns {StandardTransactionWorkflow} The workflow state and functions.
 */
export const useStandardTransactionWorkflow = ({
	createTransaction: createTransactionCallback,
	walletController,
	transactionFeeTiers,
	transactionFeeTierLevel,
	onSendSuccess,
	onSendError
}) => {
	const [transactionBundle, setTransactionBundle] = useState(null);
	const transactionBundleRef = useRef(null);
	const [signedTransactionHashes, setSignedTransactionHashes] = useState([]);

	// Create transaction manager
	const createManager = useAsyncManager({
		callback: async () => {
			const bundle = await createTransactionCallback();

			if (transactionFeeTiers)
				bundle.applyFeeTier(transactionFeeTiers, transactionFeeTierLevel);

			transactionBundleRef.current = bundle;
			setTransactionBundle(bundle);

			return bundle;
		}
	});

	// Sign transaction manager
	const signManager = useAsyncManager({
		callback: async bundle => {
			const signedBundle = await walletController.signTransactionBundle(bundle);
			setSignedTransactionHashes(signedBundle.transactions.map(tx => tx.hash));

			return signedBundle;
		}
	});

	// Announce transaction manager
	const announceManager = useAsyncManager({
		callback: async signedBundle => {
			return walletController.announceSignedTransactionBundle(signedBundle);
		}
	});

	// Transaction Confirmation Polling
	const confirmationPolling = useTransactionConfirmationPolling({
		walletController,
		signedTransactionHashes,
		isActive: announceManager.isCompleted
	});

	// Interface methods
	const reset = () => {
		transactionBundleRef.current = null;
		setTransactionBundle(null);
		setSignedTransactionHashes([]);
		createManager.reset();
		signManager.reset();
		announceManager.reset();
		confirmationPolling.reset();
	};
	const createTransaction = createManager.call;
	const executeSignAndAnnounce = async () => {
		try {
			const signedBundle = await signManager.call(transactionBundleRef.current);
			await announceManager.call(signedBundle);
			onSendSuccess?.();
		} catch (error) {
			(onSendError ?? showError)(error);
		}
	};

	// Status
	const status = createStatus({
		createManager,
		signManager,
		announceManager,
		confirmationPolling,
		signedTransactionHashes
	});

	const managersList = [createManager, signManager, announceManager];

	return {
		isSending: managersList.some(manager => manager.isLoading),
		isFailed: managersList.some(manager => manager.error),
		isSent: managersList.every(manager => manager.isCompleted),
		transaction: transactionBundle,
		status,
		managers: {
			createManager,
			signManager,
			announceManager
		},
		hashes: {
			signed: signedTransactionHashes,
			confirmed: confirmationPolling.confirmedTransactionHashes,
			failed: confirmationPolling.failedTransactionHashes,
			partial: confirmationPolling.partialTransactionHashes
		},
		createTransaction,
		executeSignAndAnnounce,
		reset
	};
};

const createStatus = ({ 
	createManager, 
	signManager, 
	announceManager, 
	confirmationPolling, 
	signedTransactionHashes 
}) => {
	const isAllConfirmed = signedTransactionHashes.length > 0
		&& confirmationPolling.confirmedTransactionHashes.length === signedTransactionHashes.length;
	const hasFailedTxs = confirmationPolling.failedTransactionHashes.length > 0;
	const isPartialTxs = confirmationPolling.partialTransactionHashes.length > 0;

	let status;

	// create
	if (createManager.isLoading)
		status = TransactionWorkflowStatus.CREATING;
	else if (createManager.error)
		status = TransactionWorkflowStatus.CREATE_ERROR;
	else if (createManager.isCompleted && !signManager.isLoading && !signManager.isCompleted && !signManager.error)
		status = TransactionWorkflowStatus.CREATED;

	// sign
	else if (signManager.isLoading)
		status = TransactionWorkflowStatus.SIGNING;
	else if (signManager.error)
		status = TransactionWorkflowStatus.SIGN_ERROR;
	else if (signManager.isCompleted && !announceManager.isLoading && !announceManager.isCompleted && !announceManager.error)
		status = TransactionWorkflowStatus.SIGNED;

	// announce
	else if (announceManager.isLoading)
		status = TransactionWorkflowStatus.ANNOUNCING;
	else if (announceManager.error)
		status = TransactionWorkflowStatus.ANNOUNCE_ERROR;
	else if (announceManager.isCompleted && !isAllConfirmed && !hasFailedTxs && !isPartialTxs)
		status = TransactionWorkflowStatus.ANNOUNCED;

	// post-announce states
	else if (isAllConfirmed)
		status = TransactionWorkflowStatus.CONFIRMED;
	else if (hasFailedTxs)
		status = TransactionWorkflowStatus.FAILED_TRANSACTIONS;
	else if (isPartialTxs)
		status = TransactionWorkflowStatus.PARTIAL;

	// default to idle if nothing has started yet
	else
		status = TransactionWorkflowStatus.IDLE;

	return status;
};
