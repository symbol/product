import {
    Alert,
    Button,
    DialogBox,
    FormItem,
    Screen,
    StyledText,
    TableView,
} from '@/app/components';
import { TransactionSendActivity } from '@/app/components/TransactionSendActivity';
import { MessageType } from '@/app/constants';
import { useDataManager, usePasscode, useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { spacings } from '@/app/styles';
import { handleError } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import { InteractionManager, Platform, View } from 'react-native';
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
        transactionFeeTiers,
        transactionFeeTierLevel,
        isCustomSendButtonUsed,
        refresh,
        confirmDialogTitle,
        confirmDialogText,
    } = props;

    // UI
    const [transactionBundle, setTransactionBundle] = useState(null);
    const [isConfirmVisible, toggleConfirm] = useToggle(false);
    const cosignatoryListTable = { cosignatories: accountCosignatories };
    const isTransactionCounterShown = transactionBundle?.isComposite;

    // Activity Log
    const transactionCount = transactionBundle?.transactions.length || 0;
    const [signedTransactionHashes, setSignedTransactionHashes] = useState([]);
    const [activityKey, setActivityKey] = useState(0);
    const [signErrorMessage, setSignErrorMessage] = useState('');
    const [announceErrorMessage, setAnnounceErrorMessage] = useState('');
    const [isActivityLogVisible, setIsActivityLogVisible] = useState(false);
    const openActivityLog = () => {
        if (Platform.OS === 'android') {
            InteractionManager.runAfterInteractions(() => {
                setTimeout(() => setIsActivityLogVisible(true), 50);
            });
        } else {
            setIsActivityLogVisible(true);
        }
    }

    // Sign and send transaction using wallet controller
    const [sign, isSigning] = useDataManager(
        async transactionBundle => {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const signedTransactionBundle = await walletController.signTransactionBundle(transactionBundle);
            setSignedTransactionHashes(signedTransactionBundle.transactions.map(tx => tx.hash));

            return signedTransactionBundle;
        },
        null,
        error => setSignErrorMessage(error.message)
    );
    const [announce, isAnnouncing] = useDataManager(
        async signedTransactionBundle => walletController.announceSignedTransactionBundle(signedTransactionBundle),
        null,
        error => setAnnounceErrorMessage(error.message)
    );

    // Create transaction using callback
    const [createTransaction, isTransactionCreating] = useDataManager(
        async () => {
            const transactionBundle = await createTransactionCallback();

            if (transactionFeeTiers)
                transactionBundle.applyFeeTier(transactionFeeTiers, transactionFeeTierLevel);

            setTransactionBundle(transactionBundle);
            setActivityKey(oldKey => oldKey + 1);
            toggleConfirm();
        },
        null,
        onCreateTransactionError || handleError
    );

    // Button handlers
    const handleSendButtonPress = () => {
        setSignedTransactionHashes([]);
        createTransaction();
    };
    const handleConfirmPress = () => {
        toggleConfirm();
        confirmSend();
    };
    const send = () => {
        openActivityLog();
        sign(transactionBundle)
            .then(signedTransactionBundle => announce(signedTransactionBundle))
            .then(() => onSendSuccess?.())
            .catch(onSendError || handleError);
    };
    const confirmSend = usePasscode('enter', send);
    const handleSuccessClosePress = () => {
        setIsActivityLogVisible(false);
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
            isLoading={isLoading || isTransactionCreating}
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
                        {isConfirmVisible && transactionBundle.transactions.map((transaction, index) => (
                            <View key={`t_preview_${index}`}>
                                {isTransactionCounterShown && (
                                    <StyledText type="subtitle" style={{ marginTop: spacings.margin }}>
                                        {$t('form_transfer_transaction_preview_title', { index: index + 1 })}
                                    </StyledText>
                                )}
                                <TableView data={getConfirmationPreview(transaction)} />
                            </View>
                        ))}
                    </ScrollView>
                }
                isVisible={isConfirmVisible}
                onSuccess={handleConfirmPress}
                onCancel={toggleConfirm}
            />
            <TransactionSendActivity
                walletController={walletController}
                isVisible={isActivityLogVisible}
                isSigning={isSigning}
                isAnnouncing={isAnnouncing}
                signErrorMessage={signErrorMessage}
                announceErrorMessage={announceErrorMessage}
                transactionCount={transactionCount}
                signedTransactionHashes={signedTransactionHashes}
                onClose={handleSuccessClosePress}//() => setActivityKey(k => k + 1)}//
                key={`transaction_send_activity_${activityKey}`}
            />
        </Screen>
    );
};
