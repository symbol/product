import { useAsyncManager } from '@/app/hooks';
import { handleError } from '@/app/utils';
import { useState } from 'react';

/** @typedef {import('wallet-common-core/src/lib/models/TransactionBundle').TransactionBundle} TransactionBundle */

/** @typedef {import('@/app/types/AsyncManager').AsyncManager} AsyncManager */

/** @typedef {function(): Promise<TransactionBundle>} CreateTransactionCallback */

/** @typedef {function(Error): void} ErrorCallback */

/** @typedef {function(): void} SuccessCallback */

/** @typedef {import('wallet-common-core/src/lib/controllers/WalletController').WalletController} WalletController */

/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */

/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/**
 * @typedef {Object} TransactionWorkflow
 * @property {TransactionBundle|null} transactionBundle - The current transaction bundle being processed, null if not yet created
 * @property {string[]} signedTransactionHashes - Array of hashes of signed transactions in the bundle
 * @property {AsyncManager<TransactionBundle>} createManager - Manager for handling transaction creation operations
 * @property {AsyncManager<TransactionBundle>} signManager - Manager for handling transaction signing operations
 * @property {AsyncManager<void>} announceManager - Manager for handling transaction announcement operations
 * @property {function(): void} reset - Resets the workflow state, clearing transaction bundle and resetting all managers
 * @property {function(): Promise<void>} executeSignAndAnnounce - Executes the sign and announce workflow for the current transaction bundle
 * @property {function(): Promise<TransactionBundle>} createTransaction - Creates a new transaction bundle using the provided callback
 */

/**
 * Hook for managing the transaction send workflow (create -> sign -> announce)
 * 
 * @param {Object} params - The parameters object
 * @param {CreateTransactionCallback} params.createTransactionCallback - Callback to create the transaction bundle
 * @param {WalletController} params.walletController - The wallet controller instance
 * @param {TransactionFeeTiers[]} [params.transactionFeeTiers] - Optional array of fee tiers for each transaction
 * @param {TransactionFeeTierLevel} [params.transactionFeeTierLevel] - Optional fee tier level to apply
 * @param {ErrorCallback} [params.onCreateTransactionError] - Optional error callback for transaction creation
 * @param {SuccessCallback} [params.onSendSuccess] - Optional success callback after sign and announce
 * @param {ErrorCallback} [params.onSendError] - Optional error callback for sign and announce
 * 
 * @returns {TransactionWorkflow} The transaction workflow state and functions
 */
export const useTransactionWorkflow = ({
	createTransactionCallback,
	walletController,
	transactionFeeTiers,
	transactionFeeTierLevel,
	onCreateTransactionError,
	onSendSuccess,
	onSendError
}) => {
	const [transactionBundle, setTransactionBundle] = useState(null);
	const [signedTransactionHashes, setSignedTransactionHashes] = useState([]);

	// Create transaction manager
	const createManager = useAsyncManager({
		callback: async () => {
			const bundle = await createTransactionCallback();
            
			if (transactionFeeTiers) 
				bundle.applyFeeTier(transactionFeeTiers, transactionFeeTierLevel);
            
			setTransactionBundle(bundle);
            
			return bundle;
		},
		onError: onCreateTransactionError ?? handleError
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

	// Interface methods
	const reset = () => {
		setTransactionBundle(null);
		setSignedTransactionHashes([]);
		createManager.reset();
		signManager.reset();
		announceManager.reset();
	};
	const createTransaction = createManager.call; 
	const executeSignAndAnnounce = async () => {
		try {
			const signedBundle = await signManager.call(transactionBundle);
			await announceManager.call(signedBundle);
			onSendSuccess?.();
		} catch (error) {
			(onSendError ?? handleError)(error);
		}
	};

	return {
		transactionBundle,
		signedTransactionHashes,
		createManager,
		signManager,
		announceManager,
		reset,
		createTransaction,
		executeSignAndAnnounce
	};
};
