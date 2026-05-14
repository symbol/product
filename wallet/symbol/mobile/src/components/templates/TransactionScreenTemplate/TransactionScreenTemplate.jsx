import { TransactionConfirmationDialog, TransactionProgressDialog } from './components';
import { createTransactionProgressViewModel } from './utils';
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
import React, { useMemo, useState } from 'react';

const TRANSACTION_SEND_EXECUTION_DELAY_MS = 2000;

/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Wallet').WalletController} WalletController */
/** @typedef {import('@/app/types/RefreshConfig').RefreshConfig} RefreshConfig */
/** @typedef {import('./types/Workflow').TransactionWorkflow} TransactionWorkflow */
/** @typedef {import('./types/ConfirmationDialog').ConfirmationDialogSection} ConfirmationDialogSection */
/** @typedef {import('./types/TransactionProgress').TransactionProgressViewModel} TransactionProgressViewModel */

/**
 * TransactionScreenTemplate component. A reusable template component for sending transactions,
 * featuring confirmation dialogs, status tracking, and multisig account warnings.
 * @param {object} props - The component props.
 * @param {boolean} props.isLoading - Loading state for the entire screen.
 * @param {boolean} [props.isCustomSendButtonUsed=false] - Whether a custom send button is used.
 * @param {boolean} [props.isSendButtonDisabled=false] - Whether the send button is disabled.
 * @param {boolean} [props.isMultisigAccount=false] - Whether the current account is a multisig account.
 * @param {string[]} [props.accountCosignatories=[]] - List of cosignatories if multisig.
 * @param {string} [props.confirmDialogTitle] - Title for the confirmation dialog.
 * @param {string} [props.confirmDialogText] - Text for the confirmation dialog body.
 * @param {React.ReactNode} props.children - The form fields to render inside the screen.
 * @param {React.Node} [props.modals] - Additional modals to be rendered.
 * @param {RefreshConfig} [props.refresh] - Refresh control.
 * @param {function(TransactionBundle): ConfirmationDialogSection[]} props.getConfirmationPreview
 *   - Receives the full transaction bundle and returns confirmation sections.
 * @param {function(): void} props.onComplete - Called when the process is complete.
 * @param {WalletController} props.walletController - The wallet controller instance.
 * @param {TransactionWorkflow} props.workflow - The transaction workflow instance.
 * @param {TransactionProgressViewModel} [props.transactionProgressViewModel] - Optional custom data for the transaction progress dialog.
 * @returns {React.Node} Rendered TransactionScreenTemplate component.
 */
export const TransactionScreenTemplate = props => {
	const {
		isLoading = false,
		isCustomSendButtonUsed = false,
		isSendButtonDisabled = false,
		isMultisigAccount = false,
		accountCosignatories = [],
		confirmDialogTitle,
		confirmDialogText,
		children,
		modals,
		refresh,
		getConfirmationPreview,
		onComplete,
		walletController,
		workflow,
		transactionProgressViewModel: customTransactionProgressViewModel
	} = props;

	// UI State
	const [isConfirmationDialogVisible, toggleConfirmationDialog] = useToggle(false);
	const [isStatusDialogVisible, setIsStatusDialogVisible] = useState(false);
	const [activityKey, setActivityKey] = useState(0);

	// Confirmation view
	const confirmationSections = useMemo(() => {
		if (isConfirmationDialogVisible && workflow.transaction)
			return getConfirmationPreview(workflow.transaction);

		return null;
	}, [isConfirmationDialogVisible, workflow.transaction]);

	// Transaction Progress View Model
	const transactionProgressViewModel = customTransactionProgressViewModel ?? createTransactionProgressViewModel(
		workflow,
		walletController.chainName,
		walletController.networkIdentifier
	);

	// Handlers
	const resetAll = () => {
		workflow.reset();
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
			isLoading={isLoading || workflow.managers.createManager.isLoading}
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
					sections={confirmationSections}
					onConfirm={handleConfirmPress}
					onCancel={toggleConfirmationDialog}
				/>
				<TransactionProgressDialog
					key={`transaction_send_activity_${activityKey}`}
					isVisible={isStatusDialogVisible}
					transactionProgressViewModel={transactionProgressViewModel}
					onClose={handleActivityClose}
				/>
				<PasscodeView {...confirmSendPasscode.props} />
			</Screen.Modals>
		</Screen>
	);
};
