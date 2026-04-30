import { TransactionConfirmationDialog, TransactionStatusDialog } from './components';
import { useTransactionConfirmationPolling, useTransactionWorkflow } from './hooks';
import { getActionStatusFromAsyncManager } from './utils';
import {
	Button,
	MultisigAccountWarning,
	PasscodeView,
	Screen,
	Spacer
} from '@/app/components';
import { usePasscode, useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { createSafeInteraction } from '@/app/utils';
import React, { useState } from 'react';

const TRANSACTION_SEND_EXECUTION_DELAY_MS = 2000;

/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/RefreshConfig').RefreshConfig} RefreshConfig */

/**
 * TransactionScreenTemplate component. A reusable template component for sending transactions,
 * featuring confirmation dialogs, status tracking, and multisig account warnings.
 * @param {object} props - The component props.
 * @param {boolean} props.isLoading - Loading state for the entire screen.
 * @param {boolean} props.isSendButtonDisabled - Whether the send button is disabled.
 * @param {boolean} props.isMultisigAccount - Whether the current account is a multisig account.
 * @param {string[]} props.accountCosignatories - List of cosignatories if multisig.
 * @param {React.ReactNode} props.children - The form fields to render inside the screen.
 * @param {function(): Promise<TransactionBundle>} props.createTransaction - Callback to create the transaction object.
 * @param {function(): Array} props.getConfirmationPreview - Returns data for confirmation preview table.
 * @param {function(Error): void} [props.onCreateTransactionError] - Handler for transaction creation errors.
 * @param {function(): void} [props.onSendSuccess] - Handler for successful transaction send.
 * @param {function(Error): void} [props.onSendError] - Handler for transaction send errors.
 * @param {function(): void} props.onComplete - Called when the process is complete.
 * @param {WalletController} props.walletController - The wallet controller instance.
 * @param {boolean} [props.isCustomSendButtonUsed] - Whether a custom send button is used.
 * @param {RefreshConfig} [props.refresh] - Refresh control.
 * @param {string} [props.confirmDialogTitle] - Title for the confirmation dialog.
 * @param {string} [props.confirmDialogText] - Text for the confirmation dialog body.
 * @param {React.Node} [props.modals] - Additional modals to be rendered.
 * @returns {React.Node} Rendered TransactionScreenTemplate component.
 */
export const TransactionScreenTemplate = props => {
	const {
		isLoading,
		isSendButtonDisabled,
		isMultisigAccount,
		accountCosignatories,
		children,
		createTransaction: createTransactionCallback,
		getConfirmationPreview,
		onCreateTransactionError,
		onSendSuccess,
		onSendError,
		onComplete,
		walletController,
		transactionFeeTiers,
		transactionFeeTierLevel,
		isCustomSendButtonUsed,
		refresh,
		confirmDialogTitle,
		confirmDialogText,
		modals
	} = props;

	// UI State
	const [isConfirmationDialogVisible, toggleConfirmationDialog] = useToggle(false);
	const [isStatusDialogVisible, setIsStatusDialogVisible] = useState(false);
	const [activityKey, setActivityKey] = useState(0);

	// Transaction Workflow
	const workflow = useTransactionWorkflow({
		createTransactionCallback,
		walletController,
		transactionFeeTiers,
		transactionFeeTierLevel,
		onCreateTransactionError,
		onSendSuccess,
		onSendError
	});

	const transactionCount = workflow.transactionBundle?.transactions.length || 0;

	// Transaction Confirmation Polling
	const confirmationPolling = useTransactionConfirmationPolling({
		walletController,
		signedTransactionHashes: workflow.signedTransactionHashes,
		isActive: isStatusDialogVisible && workflow.announceManager.isCompleted
	});

	// Action Statuses (derived from AsyncManager states)
	const createStatus = getActionStatusFromAsyncManager(workflow.createManager);
	const signStatus = getActionStatusFromAsyncManager(workflow.signManager);
	const announceStatus = getActionStatusFromAsyncManager(workflow.announceManager);

	// Handlers
	const resetAll = () => {
		workflow.reset();
		confirmationPolling.reset();
	};
	const openActivityLog = createSafeInteraction(() => {
		setIsStatusDialogVisible(true);
	});
	const handleSendButtonPress = () => {
		resetAll();
		workflow.createTransaction().then(() => {
			setActivityKey(prev => prev + 1);
			toggleConfirmationDialog();
		});
	};
	const executeSend = () => {
		openActivityLog();
		setTimeout(() => {
			workflow.executeSignAndAnnounce();
		}, TRANSACTION_SEND_EXECUTION_DELAY_MS);
	};
	const confirmSendPasscode = usePasscode({ onSuccess: executeSend });
	const showConfirmSendPasscode = createSafeInteraction(() => confirmSendPasscode.show());
	const handleConfirmPress = () => {
		toggleConfirmationDialog();
		showConfirmSendPasscode();
	};
	const handleActivityClose = () => {
		setIsStatusDialogVisible(false);
		resetAll();
		onComplete?.();
	};

	// Send Button Props
	const buttonProps = {
		text: $t('button_send'),
		isDisabled: isSendButtonDisabled || isConfirmationDialogVisible,
		onPress: handleSendButtonPress
	};

	const renderChildren = () =>
		typeof children === 'function' ? children(buttonProps) : children;

	return (
		<Screen
			isLoading={isLoading || workflow.createManager.isLoading}
			refresh={refresh}
		>
			{isMultisigAccount ? (
				<Screen.Upper>
					<Spacer>
						<MultisigAccountWarning
							cosignatories={accountCosignatories}
							addressBook={walletController.modules.addressBook}
							accounts={walletController.accounts[walletController.networkIdentifier]}
							chainName={walletController.chainName}
							networkIdentifier={walletController.networkIdentifier}
						/>
					</Spacer>
				</Screen.Upper>
			) : (
				<Screen.Upper>{renderChildren()}</Screen.Upper>
			)}
			{!isCustomSendButtonUsed && (
				<Screen.Bottom>
					<Spacer>
						<Button {...buttonProps} />
					</Spacer>
				</Screen.Bottom>
			)}
			<Screen.Modals>
				{modals}
				<TransactionConfirmationDialog
					isVisible={isConfirmationDialogVisible}
					title={confirmDialogTitle}
					text={confirmDialogText}
					transactionBundle={workflow.transactionBundle}
					getConfirmationPreview={getConfirmationPreview}
					walletController={walletController}
					onConfirm={handleConfirmPress}
					onCancel={toggleConfirmationDialog}
				/>
				<TransactionStatusDialog
					key={`transaction_send_activity_${activityKey}`}
					isVisible={isStatusDialogVisible}
					createStatus={createStatus}
					signStatus={signStatus}
					announceStatus={announceStatus}
					transactionCount={transactionCount}
					signedTransactionHashes={workflow.signedTransactionHashes}
					confirmedTransactionHashes={confirmationPolling.confirmedTransactionHashes}
					failedTransactionHashes={confirmationPolling.failedTransactionHashes}
					partialTransactionHashes={confirmationPolling.partialTransactionHashes}
					chainName={walletController.chainName}
					networkIdentifier={walletController.networkIdentifier}
					onClose={handleActivityClose}
				/>
				<PasscodeView {...confirmSendPasscode.props} />
			</Screen.Modals>
		</Screen>
	);
};
