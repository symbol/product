import React, { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Image, StyleSheet, View } from 'react-native';
import { RefreshControl, ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import {
    Button,
    DialogBox,
    Dropdown,
    FeeSelector,
    FormItem,
    Screen,
    StyledText,
    TableView,
    Widget,
} from 'src/components';
import { Constants } from 'src/config';
import { $t } from 'src/localization';
import { Router } from 'src/Router';
import { AccountService, HarvestingService } from 'src/services';
import { connect } from 'src/store';
import { colors, fonts, layout, spacings } from 'src/styles';
import { formatDate, getTransactionFees, handleError, useDataManager, usePasscode, useToggle } from 'src/utils';

export const Harvesting = connect((state) => ({
    balances: state.wallet.balances,
    currentAccount: state.account.current,
    isAccountReady: state.account.isReady,
    isWalletReady: state.wallet.isReady,
    networkIdentifier: state.network.networkIdentifier,
    networkProperties: state.network.networkProperties,
    chainHeight: state.network.chainHeight,
    nodeUrls: state.network.nodeUrls,
    ticker: state.network.ticker,
}))(function Harvesting(props) {
    const {
        balances,
        currentAccount,
        isAccountReady,
        isWalletReady,
        networkIdentifier,
        networkProperties,
        chainHeight,
        nodeUrls,
        ticker
    } = props;
    const accountBalance = currentAccount ? balances[currentAccount.address] : 0
    const nodeList = nodeUrls[networkIdentifier].map(el => ({label: el, value: el}));
    const [isActionMade, setIsActionMade] = useState(false);
    const [nodeUrl, setNodeUrl] = useState(nodeList[0].value);
    const [isStartConfirmVisible, toggleStartConfirm] = useToggle(false);
    const [isStopConfirmVisible, toggleStopConfirm] = useToggle(false);
    const [fee, setFee] = useState(0);
    const [speed, setSpeed] = useState('medium');
    const transactionSize = 700;
    const transactionFees = useMemo(() => getTransactionFees({}, networkProperties, transactionSize), [])
    const confirmTableData = { nodeUrl, fee };

    const [fetchStatus, isStatusLoading, status] = useDataManager(
        async () => {
            const { linkedKeys, importance } = await AccountService.fetchAccountInfo(networkProperties, currentAccount.address);
            const status = await HarvestingService.fetchStatus(networkProperties, currentAccount, linkedKeys);
            setIsActionMade(false);

            return { ...status, linkedKeys, importance };
        },
        {},
        handleError
    );
    const { linkedKeys, importance } = status;
    const [fetchHarvestedBlocks, isSummaryLoading, summary] = useDataManager(
        () => HarvestingService.fetchSummary(networkProperties, currentAccount.address, chainHeight),
        {
            latestAmount: 0,
            latestHeight: null,
            latestDate: null,
            amountPer30Days: 0,
            blocksHarvestedPer30Days: 0
        },
        handleError
    );
    const [start, isStarting] = useDataManager(
        async () => {
            await HarvestingService.start(networkProperties, currentAccount, nodeUrl, linkedKeys, fee);
            setIsActionMade(true);
        },
        null,
        handleError
    );
    const [stop, isStopping] = useDataManager(
        async () => {
            await HarvestingService.stop(networkProperties, currentAccount, linkedKeys, fee);
            setIsActionMade(true);
        },
        null,
        handleError
    );
    const loadData = () => {
        if (isWalletReady) {
            fetchStatus();
            fetchHarvestedBlocks();
        }
    }
    const confirmStart = usePasscode('enter', start);
    const confirmStop = usePasscode('enter', stop);
    const handleStartPress = () => {
        toggleStartConfirm();
        confirmStart();
    };
    const handleStopPress = () => {
        toggleStopConfirm();
        confirmStop();
    };

    const latestAmountText = summary.latestAmount ? `+ ${summary.latestAmount} ${ticker}` : `0 ${ticker}`;
    const latestHeightText = summary.latestHeight ? `#${summary.latestHeight}` : $t('s_harvesting_harvested_nothing_to_show');
    const latestDateText = summary.latestDate ? formatDate(summary.latestDate, $t, true) : ' ';
    const amountPer30DaysText = summary.amountPer30Days ? `+ ${summary.amountPer30Days} ${ticker}` : `0 ${ticker}`;
    const blocksHarvestedPer30DaysText = $t('s_harvesting_harvested_blocks', {count: summary.blocksHarvestedPer30Days});
    const isEnoughBalance = accountBalance > 10_000;
    const isEnoughImportance = importance > 0;
    const isAccountEligibleForHarvesting = isEnoughBalance && isEnoughImportance;
    let warningText;
    let isNodeSelectorVisible;
    let isButtonVisible;
    let statusIconSrc;
    let statusText;
    let buttonText;
    let buttonHandle;
    let statusColor;

    switch (status.status) {
        case 'inactive':
            statusIconSrc = require('src/assets/images/icon-dark-inactive.png');
            statusText = $t('s_harvesting_status_inactive');
            isNodeSelectorVisible = isAccountEligibleForHarvesting;
            isButtonVisible = isAccountEligibleForHarvesting;
            buttonHandle = toggleStartConfirm;
            buttonText = $t('button_start');;
            statusColor = colors.neutral;
            break;
        case 'pending':
            statusIconSrc = require('src/assets/images/icon-dark-pending.png');
            statusText = $t('s_harvesting_status_pending');
            isNodeSelectorVisible = false;
            isButtonVisible = true;
            buttonHandle = toggleStopConfirm;
            buttonText = $t('button_stop');
            statusColor = colors.warning;
            break;
        case 'active':
            statusIconSrc = require('src/assets/images/icon-dark-success.png');
            statusText = $t('s_harvesting_status_active');
            isNodeSelectorVisible = false;
            isButtonVisible = true;
            buttonHandle = toggleStopConfirm;
            buttonText = $t('button_stop');
            statusColor = colors.success;
            break;
        case 'operator':
            statusIconSrc = require('src/assets/images/icon-dark-success.png');
            statusText = $t('s_harvesting_status_operator');
            isNodeSelectorVisible = false;
            isButtonVisible = false;
            statusColor = colors.success;
            break;
        default:
            statusIconSrc = require('src/assets/images/icon-dark-unknown.png');
            statusText = $t('s_harvesting_status_unknown');
            isNodeSelectorVisible = false;
            isButtonVisible = false;
            statusColor = colors.neutral;
    }

    if (isActionMade) {
        statusIconSrc = require('src/assets/images/icon-dark-pending.png');
        statusText = $t('s_harvesting_status_pending');
        isNodeSelectorVisible = false;
        isButtonVisible = false;
        statusColor = colors.warning;
    }

    if (status.status === 'inactive' && !isEnoughBalance) {
        warningText = $t('s_harvesting_warning_balance');
    }
    else if (status.status === 'inactive' && !isEnoughImportance) {
        warningText = $t('s_harvesting_warning_importance');
    }
    else if (status.status === 'inactive' && linkedKeys.nodePublicKey) {
        warningText = $t('s_harvesting_warning_node_down');
    }

    const isManageSectionVisible = isNodeSelectorVisible || isButtonVisible;
    const isBlockedLoading = isStarting || isStopping;
    const isLoading = isStatusLoading || isSummaryLoading;

    useEffect(() => {
        DeviceEventEmitter.addListener(Constants.Events.CONFIRMED_TRANSACTION, loadData);
        loadData();

        () => {
            DeviceEventEmitter.removeAllListeners(Constants.Events.CONFIRMED_TRANSACTION);
        }
    }, [isAccountReady, isWalletReady]);

    useEffect(() => {
        if (transactionFees.medium) {
            setFee(transactionFees[speed]);
        }
    }, [transactionFees, speed]);

    return (
        <Screen isLoading={isBlockedLoading}>
            <ScrollView refreshControl={<RefreshControl tintColor={colors.primary} refreshing={isLoading} onRefresh={loadData} />}>
                <FormItem>
                    <StyledText type="title">{$t('s_harvesting_title')}</StyledText>
                    <StyledText type="body">{$t('s_harvesting_description')}</StyledText>
                </FormItem>
                <FormItem>
                    <StyledText type="title">Status</StyledText>
                    <Widget color={statusColor}>
                        <FormItem style={[layout.row, layout.alignCenter]}>
                            <Image source={statusIconSrc} style={styles.statusIcon} />
                            <StyledText type="body" style={[styles.statusTextColor, styles.statusTextLabel]}>{statusText}</StyledText>
                        </FormItem>
                        {status.nodeUrl && (
                            <Animated.View entering={FadeIn} exiting={FadeOut}>
                                <FormItem clear="top">
                                    <StyledText type="label" style={styles.statusTextColor}>Node</StyledText>
                                    <StyledText type="body" style={styles.statusTextColor}>{status.nodeUrl}</StyledText>
                                </FormItem>
                            </Animated.View>
                        )}
                        {!!warningText && (
                            <Animated.View entering={FadeIn} exiting={FadeOut}>
                                <FormItem clear="top">
                                    <StyledText type="body" style={styles.statusTextColor}>{warningText}</StyledText>
                                </FormItem>
                            </Animated.View>
                        )}
                    </Widget>
                </FormItem>
                <FormItem>
                    <StyledText type="title">{$t('s_harvesting_harvested_title')}</StyledText>
                    <Widget color={colors.bgForm}>
                        <FormItem>
                            <View style={[layout.row, layout.justifyBetween]}>
                                <StyledText type="body">{$t('s_harvesting_harvested_block_label')}</StyledText>
                                <Animated.View style={layout.alignEnd} entering={FadeIn} exiting={FadeOut} key={latestAmountText}>
                                    <StyledText type="subtitle">{latestAmountText}</StyledText>
                                    <StyledText type="regular">{latestHeightText}</StyledText>
                                    <StyledText type="regular" style={styles.date}>{latestDateText}</StyledText>
                                </Animated.View>
                            </View>
                            <View style={styles.separator} />
                            <View style={[layout.row, layout.justifyBetween]}>
                                <StyledText type="body">{$t('s_harvesting_harvested_30days_label')}</StyledText>
                                <Animated.View style={layout.alignEnd} entering={FadeIn} exiting={FadeOut} key={amountPer30DaysText}>
                                    <StyledText type="subtitle">{amountPer30DaysText}</StyledText>
                                    <StyledText type="regular">{blocksHarvestedPer30DaysText}</StyledText>
                                </Animated.View>
                            </View>
                        </FormItem>
                    </Widget>
                </FormItem>
                {isManageSectionVisible && (
                    <Animated.View entering={FadeInDown} exiting={FadeOut}>
                        <FormItem clear="bottom">
                            <StyledText type="title">{$t('s_harvesting_manage_title')}</StyledText>
                            {isNodeSelectorVisible && (
                                <Dropdown title={$t('input_nodeUrl')} value={nodeUrl} list={nodeList} onChange={setNodeUrl} />
                            )}
                        </FormItem>
                        {isButtonVisible && (<>
                            <FormItem clear="bottom">
                                <FeeSelector
                                    title={$t('input_transactionFee')}
                                    value={speed}
                                    fees={transactionFees}
                                    ticker={ticker}
                                    onChange={setSpeed}
                                />
                            </FormItem>
                            <FormItem>
                                <Button title={buttonText} onPress={buttonHandle} />
                            </FormItem>
                        </>)}
                    </Animated.View>
                )}
            </ScrollView>
            <DialogBox
                type="confirm"
                title={$t('s_harvesting_confirm_start_title')}
                text={$t('s_harvesting_confirm_start_description')}
                body={<TableView style={{marginTop: spacings.margin}} data={confirmTableData}/>} 
                isVisible={isStartConfirmVisible}
                onSuccess={handleStartPress}
                onCancel={toggleStartConfirm}
            />
            <DialogBox
                type="confirm"
                title={$t('s_harvesting_confirm_stop_title')}
                body={<TableView style={{marginTop: spacings.margin}} data={confirmTableData}/>} 
                isVisible={isStopConfirmVisible}
                onSuccess={handleStopPress}
                onCancel={toggleStopConfirm}
            />
        </Screen>
    );
});


const styles = StyleSheet.create({
    separator: {
        width: '100%',
        height: 2,
        marginVertical: spacings.margin,
        backgroundColor: colors.textBody,
        opacity: 0.4
    },
    statusTextColor: {
        color: colors.bgForm
    },
    statusTextLabel: {
        ...fonts.amount,
    },
    statusIcon: {
        width: fonts.amount.fontSize,
        height: fonts.amount.fontSize,
        marginRight: spacings.margin / 2,
    },
    date: {
        ...fonts.body,
        fontSize: 10,
        opacity: 0.7,
    },
});
