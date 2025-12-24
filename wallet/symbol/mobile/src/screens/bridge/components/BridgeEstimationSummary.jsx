import { FormItem, StyledText, Widget } from '@/app/components';
import { useDataManager, useDebounce } from '@/app/hooks';
import { $t } from '@/app/localization';
import { colors, spacings } from '@/app/styles';
import { handleError } from '@/app/utils';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, } from 'react-native-reanimated';

/**
 * Estimation summary component for bridge swap screen
 * @param {object} props
 * @param {string} props.transactionFee - Transaction fee amount
 * @param {import('wallet-common-core/src/types/Token').Token} props.sourceToken - Source token object
 * @param {import('wallet-common-core/src/types/Token').Token} props.targetToken - Target token object
 * @param {import('wallet-common-core/src/types/Token').Token} props.sourceNetworkCurrency - Source network currency token object
 * @param {object|null} props.estimation - Estimation object
 * @param {string} props.sendAmount - Amount to send in source token
 * @param {string} props.estimation.receiveAmount - Estimated receive amount
 * @param {string} props.estimation.bridgeFee - Estimated bridge fee amount
 * @param {boolean} props.isLoading - Loading state
 */
export const BridgeEstimationSummary = ({ sendAmount, transactionFee, estimation, sourceToken, targetToken, sourceNetworkCurrency, isLoading }) => {
    const summary = {
        sendAmount: {
            isShown: !!sourceToken,
            amount: sourceToken ? sendAmount : '-',
            units: sourceToken ? sourceToken.name : '',
        },
        bridgeFee: {
            isShown: !!estimation && !!targetToken,
            amount: estimation?.bridgeFee ?? '-',
            units: targetToken ? targetToken.name : '',
        },
        receiveAmount: {
            isShown: !!estimation && !!targetToken,
            amount: estimation?.receiveAmount,
            units: targetToken ? targetToken.name : '',
        },
        transactionFee: {
            isShown: !!transactionFee && !!sourceNetworkCurrency,
            amount: transactionFee,
            units: sourceNetworkCurrency ? sourceNetworkCurrency.name : '',
        }
    };

    return (
        <FormItem>
            <Widget color={colors.bgForm}>
                <FormItem>
                    <View style={styles.summaryRow}>
                        <StyledText type="label">{$t('s_bridge_summary_title')}</StyledText>
                        {isLoading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
                    </View>
                    <Animated.View
                        entering={FadeIn}
                        exiting={FadeOut}
                        key={`summary-${targetToken?.id}`}
                        style={styles.summaryBody}
                    >
                        <View style={styles.summaryRow}>
                            <StyledText>{$t('s_bridge_summary_amountSend')}</StyledText>
                            {summary.sendAmount.isShown && <StyledText>{summary.sendAmount.amount} {summary.sendAmount.units}</StyledText>}
                        </View>
                        <View style={styles.summaryRow}>
                            <StyledText>{$t('s_bridge_summary_transactionFee')}</StyledText>
                            {summary.transactionFee.isShown && <StyledText>{summary.transactionFee.amount} {summary.transactionFee.units}</StyledText>}
                        </View>
                        <View style={styles.summaryRow}>
                            <StyledText>{$t('s_bridge_summary_bridgeFee')}</StyledText>
                            {summary.bridgeFee.isShown && <StyledText>{summary.bridgeFee.amount} {summary.bridgeFee.units}</StyledText>}
                        </View>
                        <View style={styles.summaryRow}>
                            <StyledText>{$t('s_bridge_summary_amountReceive')}</StyledText>
                            {summary.receiveAmount.isShown && <StyledText>{summary.receiveAmount.amount} {summary.receiveAmount.units}</StyledText>}
                        </View>
                    </Animated.View>
                </FormItem>
            </Widget>
        </FormItem>
    );
};

const styles = StyleSheet.create({
    summaryBody: {
        marginTop: spacings.margin,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    loadingIndicator: {
        position: 'absolute',
        top: 0,
        right: 0,
    },
});
