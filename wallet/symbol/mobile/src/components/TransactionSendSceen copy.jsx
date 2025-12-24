import {
    Alert,
    Button,
    DialogBox,
    FormItem,
    Screen,
    TableView,
} from '@/app/components';
import { useDataManager, usePasscode, useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { handleError } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';

/**
 * A reusable component for sending transactions with confirmation and success alert.
 * Used as a wrapper in transaction send screens.
 * @param {object} props - The component props.
 * @param {boolean} props.isLoading - Loading state for the entire screen. Blocks the UI with spinner when true.
 * @param {boolean} props.isSendButtonDisabled - Whether the send button is disabled.
 * @param {boolean} props.isMultisigAccount - Whether the current account is a multisig account.
 * @param {string[]} props.accountCosignatories - List of cosignatories of current account if multisig.
 * @param {React.ReactNode} props.children - The form fields to render inside the screen.
 * @param {function} props.createTransaction - Callback function to create the transaction object.
 * @param {function} props.getConfirmationPreview - Function that returns data for the confirmation preview table.
 * @param {function} [props.onCreateTransactionError] - Optional callback for handling transaction creation errors.
 * @param {function} [props.onSendSuccess] - Optional callback for handling successful transaction send.
 * @param {function} [props.onSendError] - Optional callback for handling transaction send errors.
 * @param {function} props.onComplete - Callback function called when the process is complete (after success alert closed by user).
 * @param {import('wallet-common-core/src/lib/controller/WalletController').WalletController} props.walletController - The wallet controller instance.
 * @param {boolean} [props.isCustomSendButtonUsed] - Whether a custom send button is used (via useSendButton hook).
 * @param {function} [props.updateSendButtonProps] - Function to update props of the custom send button.
 * @param {object} [props.refresh] - Optional refresh control props: { isRefreshing: boolean, onRefresh: function, color: string }.
 * @param {string} [props.confirmDialogTitle] - Optional title for the confirmation dialog.
 * @param {string} [props.confirmDialogText] - Optional text for the confirmation dialog body above the preview table.
 * @param {string} [props.successDialogTitle] - Optional title for the success alert dialog.
 * @param {string} [props.successDialogText] - Optional text for the success alert dialog body.
 * @returns {React.ReactElement} The rendered component.
 */
export const TransactionSendScreen = props => {
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
        isCustomSendButtonUsed,
        refresh,
        confirmDialogTitle,
        confirmDialogText,
        successDialogTitle,
        successDialogText,
    } = props;

    // UI
    const [transaction, setTransaction] = useState(null);
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const [isSuccessAlertVisible, toggleSuccessAlert] = useToggle(false);
    const cosignatoryListTable = { cosignatories: accountCosignatories };

    // Sign and send transaction using wallet controller
    const [send, isSending] = useDataManager(
        async () => {
            const signedTransaction = await walletController.signTransaction(transaction);
            await walletController.announceSignedTransaction(signedTransaction);
            toggleSuccessAlert();
            onSendSuccess?.();
        },
        null,
        onSendError || handleError
    );

    // Create transaction using callback
    const [createTransaction, isTransactionCreating] = useDataManager(
        async () => {
            const transaction = await createTransactionCallback();
            setTransaction(transaction);
            toggleConfirm();
        },
        null,
        onCreateTransactionError || handleError
    );

    // Button handlers
    const handleSendButtonPress = () => {
        createTransaction();
    };
    const handleConfirmPress = () => {
        toggleConfirm();
        confirmSend?.();
    };
    const confirmSend = usePasscode('enter', send);
    const handleSuccessClosePress = () => {
        toggleSuccessAlert();
        onComplete?.();
    };

    // Send button
    const buttonProps = {
        title: $t('button_send'),
        isDisabled: isSendButtonDisabled || isConfirmVisible,
        onPress: handleSendButtonPress,
    }
    const renderChildren = () => typeof children === 'function'
        ? children(buttonProps)
        : children;

    return (
        <Screen
            isLoading={isLoading || isSending || isTransactionCreating}
            bottomComponent={isCustomSendButtonUsed ? null :
                <FormItem>
                    <Button {...buttonProps} />
                </FormItem>
            }
        >
            <ScrollView 
                refreshControl={refresh ? (
                    <RefreshControl 
                        tintColor={refresh.color} 
                        refreshing={refresh.isRefreshing} 
                        onRefresh={refresh.onRefresh} 
                    />
                ) : null}
            >
                {isMultisigAccount && (
                    <>
                        <FormItem>
                            <Alert type="warning" title={$t('warning_multisig_title')} body={$t('warning_multisig_body')} />
                        </FormItem>
                        <FormItem>
                            <TableView data={cosignatoryListTable} />
                        </FormItem>
                    </>
                )}
                {!isMultisigAccount && renderChildren()}
            </ScrollView>
            <DialogBox
                type="confirm"
                title={confirmDialogTitle || $t('form_transfer_confirm_title')}
                text={confirmDialogText}
                body={
                    <ScrollView>
                        {isConfirmVisible && <TableView data={getConfirmationPreview(transaction)} />}
                    </ScrollView>
                }
                isVisible={isConfirmVisible}
                onSuccess={handleConfirmPress}
                onCancel={toggleConfirm}
            />
            <DialogBox
                type="alert"
                title={successDialogTitle || $t('form_transfer_success_title')}
                text={successDialogText || $t('form_transfer_success_text')}
                isVisible={isSuccessAlertVisible}
                onSuccess={handleSuccessClosePress}
            />
        </Screen>
    );
};
