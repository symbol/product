import {
    ButtonPlain,
    DialogBox,
    FormItem,
    StyledText,
    Widget,
} from '@/app/components';
import { $t } from '@/app/localization';
import { colors, fonts, layout, spacings } from '@/app/styles';
import { createExplorerTransactionUrl } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, Layout } from 'react-native-reanimated';
import { TransactionGroup } from 'wallet-common-core/src/constants';

const BASE_ANIMATION_DELAY = 750;

const ActivityTypes = {
    CREATE: 'create',
    SIGN: 'sign',
    SEND: 'send',
    CONFIRM: 'confirm',
};

const ActivityStatuses = {
    PENDING: 'pending',
    COMPLETE: 'complete',
    ERROR: 'error',
    LOADING: 'loading',
};

const ActivityIconMap = {
    [ActivityTypes.CREATE]: require('@/app/assets/images/transaction-log/create.png'),
    [ActivityTypes.SIGN]: require('@/app/assets/images/transaction-log/sign.png'),
    [ActivityTypes.SEND]: require('@/app/assets/images/transaction-log/send.png'),
    [ActivityTypes.CONFIRM]: require('@/app/assets/images/transaction-log/complete.png'),
};


/**

 */
export const TransactionSendActivity = props => {
    const {
        walletController,
        isVisible,
        isSigning,
        isAnnouncing,
        signErrorMessage,
        announceErrorMessage,
        transactionCount,
        signedTransactionHashes,
        onClose,
    } = props;
    const isCloseButtonDisabled = isSigning || isAnnouncing;
    const [confirmedTransactionHashes, setConfirmedTransactionHashes] = useState([]);
    const [failedTransactionHashes, setFailedTransactionHashes] = useState([]);
    const [partialTransactionHashes, setPartialTransactionHashes] = useState([]);

    const isAllTransactionsSigned = signedTransactionHashes?.length === transactionCount;
    const isAllTransactionsConfirmed = confirmedTransactionHashes?.length === transactionCount;

    const activityLog = [
        {
            type: ActivityTypes.CREATE,
            status: ActivityStatuses.COMPLETE,
            caption: '',
        },
        {
            type: ActivityTypes.SIGN,
            status: isSigning
                ? ActivityStatuses.LOADING
                : isAllTransactionsSigned
                    ? ActivityStatuses.COMPLETE
                    : signErrorMessage
                        ? ActivityStatuses.ERROR
                        : ActivityStatuses.PENDING,
            caption: signErrorMessage ?? '',
        },
        ...Array(transactionCount).fill().map((_, index) => {
            const hash = signedTransactionHashes[index];
            const isConfirmed = confirmedTransactionHashes.includes(hash);

            return {
                type: ActivityTypes.SEND,
                hash,
                status: !hash
                    ? ActivityStatuses.PENDING
                    : announceErrorMessage
                        ? ActivityStatuses.ERROR
                        : isConfirmed || !isAnnouncing
                            ? ActivityStatuses.COMPLETE
                            : ActivityStatuses.LOADING,
                caption: announceErrorMessage ?? '',
            };
        }),
        {
            type: ActivityTypes.CONFIRM,
            status: isAllTransactionsSigned && isAllTransactionsConfirmed && !isSigning && !isAnnouncing
                ? ActivityStatuses.COMPLETE
                : failedTransactionHashes.length > 0
                    ? ActivityStatuses.ERROR
                    : !isSigning && !isAnnouncing && !announceErrorMessage && !signErrorMessage
                        ? ActivityStatuses.LOADING
                        : ActivityStatuses.PENDING,
            caption: '',
        }
    ]

    // Fetch transaction confirmation statuses periodically
    const fetchTransactionsConfirmation = async () => {
        if (signedTransactionHashes.length === 0)
            return;

        const statuses = await Promise.all(
            signedTransactionHashes.map(async hash => {
                try {
                    const status = await walletController.fetchTransactionStatus(hash);
                    return { hash, group: status.group };
                } catch {
                    return { hash, group: null };
                }
            })
        );

        const confirmedHashes = statuses
            .filter(item => item.group === TransactionGroup.CONFIRMED)
            .map(item => item.hash);
        const failedHashes = statuses
            .filter(item => item.group === TransactionGroup.FAILED)
            .map(item => item.hash);
        const partialHashes = statuses
            .filter(item => item.group === TransactionGroup.PARTIAL)
            .map(item => item.hash);
        setConfirmedTransactionHashes(confirmedHashes);
        setFailedTransactionHashes(failedHashes);
        setPartialTransactionHashes(partialHashes);
    };

    useEffect(() => {
        let intervalId;

        if (isVisible && !isAllTransactionsConfirmed) {
            fetchTransactionsConfirmation();
            intervalId = setInterval(fetchTransactionsConfirmation, 1000);
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isVisible, isSigning, isAnnouncing, signedTransactionHashes]);


    //Status
    let statusText;
    let statusDescription;
    let statusColor;
    let statusIconSrc;

    if (isSigning || isAnnouncing) {
        statusIconSrc = require('@/app/assets/images/icon-dark-pending.png');
        statusText = 'Please Wait';
        statusDescription = 'Please do not close the app until the transaction has been sent.';
        statusColor = colors.warning;
    } else if (isAllTransactionsConfirmed) {
        statusIconSrc = require('@/app/assets/images/icon-dark-success.png');
        statusText = 'Success';
        statusDescription = 'Transaction confirmed!';
        statusColor = colors.success;
    } else if (signErrorMessage) {
        statusIconSrc = require('@/app/assets/images/icon-dark-inactive.png');
        statusText = 'Signing Failed';
        statusDescription = 'Transaction was not signed';
        statusColor = colors.danger;
    } else if (announceErrorMessage) {
        statusIconSrc = require('@/app/assets/images/icon-dark-inactive.png');
        statusText = 'Transaction Failed';
        statusDescription = 'Transaction was not broadcasted to the network'
        statusColor = colors.danger;
    } else if (failedTransactionHashes.length > 0) {
        statusIconSrc = require('@/app/assets/images/icon-dark-inactive.png');
        statusText = 'Transaction Failed';
        statusDescription = 'Transaction was rejected by the network';
        statusColor = colors.danger;
    } else if (partialTransactionHashes.length > 0) {
        statusIconSrc = require('@/app/assets/images/icon-dark-success.png');
        statusText = 'Transaction Sent';
        statusDescription = 'Waiting for signatures from other parties. You can close this window or keep it open to watch the progress.';
        statusColor = colors.neutral;
    } else {
        statusIconSrc = require('@/app/assets/images/icon-dark-success.png');
        statusText = 'Transaction Sent';
        statusDescription = 'Waiting for network confirmation. You can close this window or keep it open to watch the progress.';
        statusColor = colors.neutral;
    }

    // Block Explorer
    const openBlockExplorer = hash => Linking.openURL(createExplorerTransactionUrl(
        walletController.chainName,
        walletController.networkIdentifier,
        hash
    ));
    const blockExplorerButtonHashes = activityLog
        .filter(item => item.type === ActivityTypes.SEND && item.status === ActivityStatuses.COMPLETE)
        .map(item => item.hash);

    return (
        <DialogBox
            type="alert"
            title="Send Transaction"
            isDisabled={isCloseButtonDisabled}
            isVisible={isVisible}
            onSuccess={onClose}
        >
            <View style={styles.root}>
                <Widget color={statusColor}>
                    <FormItem style={[layout.row, layout.alignCenter]}>
                        <Image source={statusIconSrc} style={styles.statusIcon} />
                        <StyledText type="body" style={styles.statusText}>
                            {statusText}
                        </StyledText>
                    </FormItem>
                    <Animated.View entering={FadeIn} exiting={FadeOut} key={statusText}>
                        <FormItem clear="top">
                            <StyledText type="body" style={styles.statusDescription}>
                                {statusDescription}
                            </StyledText>
                        </FormItem>
                    </Animated.View>
                </Widget>
                <View style={styles.activityLog}>
                    {activityLog.map((item, index) => (
                        <ActivityItem
                            key={index}
                            item={item}
                            index={index}
                            nextItemStatus={index < activityLog.length - 1 ? activityLog[index + 1].status : null}
                            isLast={index === activityLog.length - 1}
                        />
                    ))}
                </View>
                {blockExplorerButtonHashes.map(hash => (
                    <Animated.View entering={FadeIn.delay(BASE_ANIMATION_DELAY)} key={hash}>
                        {blockExplorerButtonHashes.length > 1 && (
                            <StyledText type="label" style={styles.transactionCounter}>
                                {'Transaction ' + (blockExplorerButtonHashes.indexOf(hash) + 1)}
                            </StyledText>
                        )}
                        <ButtonPlain
                            icon={require('@/app/assets/images/icon-primary-explorer.png')}
                            title={$t('button_openTransactionInExplorer')}
                            onPress={() => openBlockExplorer(hash)}
                        />
                    </Animated.View>
                ))}
            </View>
        </DialogBox>
    );
};

const ActivityItem = ({ item, nextItemStatus, index, isLast }) => {
    const ActivityTitleMap = {
        [ActivityTypes.CREATE]: 'Create Transaction',
        [ActivityTypes.SIGN]: 'Sign Transaction',
        [ActivityTypes.SEND]: 'Send Transaction',
        [ActivityTypes.CONFIRM]: 'Confirmation',
    };
    const textColorStyle = item.status === ActivityStatuses.ERROR
        ? { color: colors.danger }
        : { color: colors.textBody };

    return (
        <View style={styles.activityLogItem}>
            <ActivityStep
                type={item.type}
                status={item.status}
                nextStatus={nextItemStatus}
                isLast={isLast}
                index={index}
            />
            <View style={styles.activityTextContainer}>
                <Animated.View entering={FadeIn.delay(BASE_ANIMATION_DELAY)}>
                    <StyledText type="body" style={textColorStyle}>{ActivityTitleMap[item.type]}</StyledText>
                </Animated.View>
                <StyledText type="body" style={[styles.activityCaption, textColorStyle]}>{item.caption}</StyledText>
            </View>
        </View>
    )
}

const ActivityStep = ({ type, status, nextStatus, isLast, index }) => {
    const colorStylePending = {
        backgroundColor: colors.secondary,
    };
    const colorStyleComplete = {
        backgroundColor: colors.primary,
    };
    const colorStyleError = {
        backgroundColor: colors.danger,
    };
    const iconContainerStyle = [
        styles.activityIconContainer,
        (status === 'pending' || status === 'loading') && colorStylePending,
        status === 'error' && colorStyleError,
        status === 'complete' && colorStyleComplete,
    ];
    const lineStyle = [
        styles.activityStepLine,
        (nextStatus === 'pending' || nextStatus === 'loading') && colorStylePending,
        nextStatus === 'error' && colorStylePending,
        nextStatus === 'complete' && colorStyleComplete,
    ];
    const isLoading = status === 'loading';

    return (
        <View style={styles.activityStep}>
            <Animated.View
                style={iconContainerStyle}
                entering={FadeInUp.delay(BASE_ANIMATION_DELAY + index * 100)}
            >
                {!isLoading && <Image source={ActivityIconMap[type]} style={styles.activityIcon} />}
                {isLoading && <ActivityIndicator style={styles.activityIcon} color={colors.primary} />}
            </Animated.View>
            {!isLast && (
                <Animated.View
                    style={lineStyle}
                    entering={FadeInUp.delay((BASE_ANIMATION_DELAY + 250) + index * 250)}
                    layout={Layout.springify()}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flexDirection: 'column',
        paddingVertical: spacings.margin,
        gap: spacings.margin,
        height: '100%',
    },
    activityLog: {
        flexDirection: 'column',
    },
    activityLogItem: {
        flexDirection: 'row',
        gap: spacings.margin,
        minHeight: 56,
        backgroundColor: 'transparent',
    },
    activityStep: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    activityIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activityIcon: {
        width: 16,
        height: 16,
    },
    activityStepLine: {
        width: 2,
        flex: 2,
    },
    activityTextContainer: {
        paddingVertical: spacings.margin / 2,
        flex: 1,
        flexDirection: 'column'
    },
    activityCaption: {
        ...fonts.body,
        color: colors.textBody,
        fontSize: 10,
        opacity: 0.7
    },
    statusText: {
        ...fonts.amount,
        color: colors.bgForm
    },
    statusDescription: {
        color: colors.bgForm,
    },
    statusIcon: {
        width: fonts.amount.fontSize,
        height: fonts.amount.fontSize,
        marginRight: spacings.margin / 2
    },
    transactionCounter: {
        ...fonts.body,
        color: colors.textBody,
        fontSize: 10,
        opacity: 0.7
    },
});
