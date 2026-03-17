import { useAsyncManager, usePasscode, useToggle } from '@/app/hooks';
import { TransactionAnnounceGroup } from '@/app/types/Transaction';
import { handleError } from '@/app/utils';
import { useCallback, useState } from 'react';

/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */

/**
 * @typedef {Object} ConfirmationDialogProps
 * @property {boolean} isVisible - Whether the confirmation dialog is visible.
 * @property {function(): void} onConfirm - Handler for confirm action.
 * @property {function(): void} onCancel - Handler for cancel action.
 */

/**
 * @typedef {Object} SuccessDialogProps
 * @property {boolean} isVisible - Whether the success dialog is visible.
 * @property {function(): void} onSuccess - Handler for success acknowledgment.
 */

/**
 * @typedef {Object} UseCosignFlowResult
 * @property {boolean} isLoading - Whether a cosign operation is in progress.
 * @property {function(): void} startCosignFlow - Initiates the cosign flow.
 * @property {ConfirmationDialogProps} confirmationDialogProps - Props for confirmation dialog.
 * @property {SuccessDialogProps} successDialogProps - Props for success dialog.
 * @property {Object} passcodeProps - Props for the PasscodeView component.
 * @property {function(): void} reset - Resets the cosign flow to initial state.
 */

/**
 * React hook for managing the transaction cosignature flow.
 * Handles the complete flow: button press → confirmation dialog → passcode → cosign → success dialog.
 *
 * @param {Object} params - Hook parameters.
 * @param {Transaction} params.transaction - The transaction to cosign.
 * @param {WalletController} params.walletController - Wallet controller instance.
 * @param {function(): void} [params.onSuccess] - Callback invoked after successful cosign.
 * @param {function(Error): void} [params.onError] - Callback invoked on cosign error.
 * @returns {UseCosignFlowResult} Cosign flow state and controls.
 */
export const useCosignFlow = ({ transaction, walletController, onSuccess, onError }) => {
	// Dialog visibility
	const [isConfirmationDialogVisible, toggleConfirmationDialog] = useToggle(false);
	const [isSuccessDialogVisible, setIsSuccessDialogVisible] = useState(false);

	// Async manager for cosign operation
	const cosignManager = useAsyncManager({
		callback: async () => {
			const cosignedTransaction = await walletController.cosignTransaction(transaction);
			await walletController.announceSignedTransaction(cosignedTransaction, TransactionAnnounceGroup.COSIGNATURE);

			return cosignedTransaction;
		},
		onSuccess: () => {
			setIsSuccessDialogVisible(true);
			onSuccess?.();
		},
		onError: error => {
			(onError ?? handleError)(error);
		}
	});

	// Execute cosign after passcode verification
	const executeCosign = useCallback(() => {
		cosignManager.call();
	}, [cosignManager]);

	// Passcode handling
	const passcode = usePasscode({
		onSuccess: executeCosign
	});

	const startCosignFlow = useCallback(() => {
		toggleConfirmationDialog();
	}, [toggleConfirmationDialog]);

	const handleConfirm = useCallback(() => {
		toggleConfirmationDialog();
		passcode.show();
	}, [toggleConfirmationDialog, passcode]);

	const handleCancel = useCallback(() => {
		toggleConfirmationDialog();
	}, [toggleConfirmationDialog]);

	const handleComplete = useCallback(() => {
		setIsSuccessDialogVisible(false);
	}, []);

	const reset = useCallback(() => {
		setIsSuccessDialogVisible(false);
		cosignManager.reset();

		if (isConfirmationDialogVisible)
			toggleConfirmationDialog();
	}, [cosignManager, isConfirmationDialogVisible, toggleConfirmationDialog]);

	// Dialog props
	const confirmationDialogProps = {
		isVisible: isConfirmationDialogVisible,
		onConfirm: handleConfirm,
		onCancel: handleCancel
	};

	const successDialogProps = {
		isVisible: isSuccessDialogVisible,
		onSuccess: handleComplete
	};

	return {
		isLoading: cosignManager.isLoading,
		startCosignFlow,
		confirmationDialogProps,
		successDialogProps,
		passcodeProps: passcode.props,
		reset
	};
};
