import { Button, FeeSelector, FormItem, StyledText, TextBox, TransactionSendScreen, Widget } from '@/app/components';
import { HarvestingStatus } from '@/app/constants';
import { useDataManager, useDebounce, useLoading, useTransactionFees, useWalletController } from '@/app/hooks';
import { AppError } from '@/app/lib/error';
import { api } from '@/app/lib/api';
import { $t } from '@/app/localization';
import { colors, fonts, layout, spacings } from '@/app/styles';
import { formatDate, handleError, promiseAllSettled } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { config } from '@/app/config';
import { constants } from 'wallet-common-core';

export const Harvesting = () => {
	const WalletController = useWalletController();
	const { ticker, currentAccountInfo, isWalletReady, networkIdentifier } = WalletController;
	const isAccountReady = !!WalletController.currentAccountInfo.fetchedAt;
	const { importance, balance } = currentAccountInfo;

	const [isActionMade, setIsActionMade] = useState(false);

	const [nodeUrl, setNodeUrl] = useState('');
	const [speed, setSpeed] = useState('medium');

	// Harvesting status and node url
	const [fetchStatus, isStatusLoading, status] = useDataManager(
		WalletController.modules.harvesting.fetchStatus,
		{},
		handleError
	);

	// Summary
	const defaultSummary = {
		latestAmount: 0,
		latestHeight: null,
		latestDate: null,
		amountPer30Days: 0,
		blocksHarvestedPer30Days: 0
	};
	const [fetchHarvestedBlocks, isSummaryLoading, summary] = useDataManager(
		WalletController.modules.harvesting.fetchSummary,
		defaultSummary,
		handleError
	);

	// Node list to choose from
	const [fetchNodeList, isNodeListLoading, nodeList] = useDataManager(
		WalletController.modules.harvesting.fetchNodeList,
		[],
		handleError
	);
	// Set default node url when node list is loaded
	useEffect(() => {
		if (nodeList.length)
			setNodeUrl(nodeList[0]);
	}, [nodeList]);

	const loadData = async () => {
		if (!isWalletReady)
			return;

		await promiseAllSettled([
			WalletController.fetchAccountInfo(),
			fetchHarvestedBlocks(),
			fetchNodeList(),
			fetchStatus()
		]);
		setIsActionMade(false);
	};

	// UI
	const isButtonDisabled = isNodeListLoading || isStatusLoading || isSummaryLoading;
	const latestAmountText = summary.latestAmount ? `+ ${summary.latestAmount} ${ticker}` : `0 ${ticker}`;
	const latestHeightText = summary.latestHeight ? `#${summary.latestHeight}` : $t('s_harvesting_harvested_nothing_to_show');
	const latestDateText = summary.latestDate ? formatDate(summary.latestDate, $t, true) : ' ';
	const amountPer30DaysText = summary.amountPer30Days ? `+ ${summary.amountPer30Days} ${ticker}` : `0 ${ticker}`;
	const blocksHarvestedPer30DaysText = $t('s_harvesting_harvested_blocks', { count: summary.blocksHarvestedPer30Days });
	const isEnoughBalance = balance > 10000;
	const isEnoughImportance = importance > 0;
	const isAccountEligibleForHarvesting = isEnoughBalance && isEnoughImportance;
	const confirmDialogTextVariants = {
		start: {
			title: $t('s_harvesting_confirm_start_title'),
			text: $t('s_harvesting_confirm_start_description')
		},
		stop: {
			title: $t('s_harvesting_confirm_stop_title'),
			text: null
		}
	};
	const buttonTextVariants = {
		start: $t('button_start'),
		stop: $t('button_stop')
	};
	let warningText;
	let isNodeSelectorVisible;
	let isButtonVisible;
	let statusIconSrc;
	let statusText;
	let buttonText;
	let statusColor;
	let action;
	let confirmDialogText;

	switch (status.status) {
		case HarvestingStatus.NODE_UNKNOWN:
		case HarvestingStatus.INACTIVE:
			statusIconSrc = require('@/app/assets/images/icon-dark-inactive.png');
			statusText = $t('s_harvesting_status_inactive');
			isNodeSelectorVisible = isAccountEligibleForHarvesting;
			isButtonVisible = isAccountEligibleForHarvesting;
			buttonText = buttonTextVariants.start;
			statusColor = colors.neutral;
			confirmDialogText = confirmDialogTextVariants.start;
			action = 'start';
			break;
		case HarvestingStatus.PENDING:
			statusIconSrc = require('@/app/assets/images/icon-dark-pending.png');
			statusText = $t('s_harvesting_status_pending');
			isNodeSelectorVisible = false;
			isButtonVisible = true;
			buttonText = buttonTextVariants.stop;
			statusColor = colors.warning;
			confirmDialogText = confirmDialogTextVariants.stop;
			action = 'stop';
			break;
		case HarvestingStatus.ACTIVE:
			statusIconSrc = require('@/app/assets/images/icon-dark-success.png');
			statusText = $t('s_harvesting_status_active');
			isNodeSelectorVisible = false;
			isButtonVisible = true;
			buttonText = buttonTextVariants.stop;
			statusColor = colors.success;
			confirmDialogText = confirmDialogTextVariants.stop;
			action = 'stop';
			break;
		case HarvestingStatus.OPERATOR:
			statusIconSrc = require('@/app/assets/images/icon-dark-success.png');
			statusText = $t('s_harvesting_status_operator');
			isNodeSelectorVisible = false;
			isButtonVisible = false;
			statusColor = colors.success;
			break;
		default:
			statusIconSrc = require('@/app/assets/images/icon-dark-unknown.png');
			statusText = $t('s_harvesting_status_unknown');
			isNodeSelectorVisible = false;
			isButtonVisible = false;
			statusColor = colors.neutral;
			confirmDialogText = { title: '', text: '' };
	}

	if (isActionMade) {
		statusIconSrc = require('@/app/assets/images/icon-dark-pending.png');
		statusText = $t('s_harvesting_status_pending');
		isNodeSelectorVisible = false;
		isButtonVisible = false;
		statusColor = colors.warning;
	}

	if (status.status === HarvestingStatus.INACTIVE && !isEnoughBalance)
		warningText = $t('s_harvesting_warning_balance');
	else if (status.status === HarvestingStatus.INACTIVE && !isEnoughImportance)
		warningText = $t('s_harvesting_warning_importance');
	else if (status.status === HarvestingStatus.NODE_UNKNOWN)
		warningText = $t('s_harvesting_warning_node_down');

	const isManageSectionVisible = isNodeSelectorVisible || isButtonVisible;


	// Create transaction
	const createStartTransaction = async () => {
		const { nodePublicKey, networkIdentifier: nodeNetworkIdentifier } = await api.harvesting.fetchNodeInfo(nodeUrl);

		if (nodeNetworkIdentifier !== networkIdentifier) {
			throw new AppError(
				'error_failed_harvesting_wrong_node_network',
				`Node network identifier "${nodeNetworkIdentifier}" does not match the current "${networkIdentifier}"`
			);
		}

		return WalletController.modules.harvesting.createStartHarvestingTransaction({ nodePublicKey });
	};
	const createStopTransaction = async () => {
		return WalletController.modules.harvesting.createStopHarvestingTransaction();
	};
	const createTransaction = async () => {
		let transaction = null;
		if (action === 'start')
			transaction = await createStartTransaction();
		if (action === 'stop') 
			transaction = await createStopTransaction();

		return transaction;
	};

	// Load data on mount and on new transaction (possible status change)
	useEffect(() => {
		const leadWithDelay = () => {
			setTimeout(loadData, 1000);
		}
		WalletController.on(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, leadWithDelay);
		loadData();

		return () => {
			WalletController.removeListener(constants.ControllerEventName.NEW_TRANSACTION_CONFIRMED, leadWithDelay);
		};
	}, [isAccountReady, isWalletReady]);

	// Calculate transaction fees
	const transactionFeesManager = useTransactionFees(createTransaction, WalletController);
	const transactionFees = transactionFeesManager.data;
	const calculateTransactionFeesSafely = useDebounce(transactionFeesManager.load, 1000);
	useEffect(() => {
		if (isWalletReady && action)
			calculateTransactionFeesSafely();
	}, [isWalletReady, action]);

	const handleTransactionSendComplete = () => {
		setIsActionMade(true);
	}

	const getTransactionPreviewTable = (transaction) => {
		return {
			nodeUrl: status.nodeUrl,
			fee: transaction.fee
		}
	}

	const [isLoading, isRefreshing] = useLoading(isStatusLoading || isSummaryLoading);

	return (
		<TransactionSendScreen
			isSendButtonDisabled={isButtonDisabled}
			isMultisigAccount={currentAccountInfo.isMultisig}
			accountCosignatories={currentAccountInfo.cosignatories}
			createTransaction={createTransaction}
			getConfirmationPreview={getTransactionPreviewTable}
			onSendSuccess={handleTransactionSendComplete}
			walletController={WalletController}
			isCustomSendButtonUsed={true}
			refresh={{
				color: colors.primary,
				isRefreshing,
				onRefresh: loadData
			}}
			confirmDialogTitle={confirmDialogText.title}
			confirmDialogText={confirmDialogText.text}
			transactionFeeTiers={transactionFees}
            transactionFeeTierLevel={speed}
		>
			{(buttonProps) => (<>
				<FormItem>
					<StyledText type="title">{$t('s_harvesting_title')}</StyledText>
					<StyledText type="body">{$t('s_harvesting_description')}</StyledText>
				</FormItem>
				<FormItem>
					<StyledText type="title">{$t('data_status')}</StyledText>
					<Widget color={statusColor}>
						<FormItem style={[layout.row, layout.alignCenter]}>
							{!isLoading && <Image source={statusIconSrc} style={styles.statusIcon} />}
							{isLoading && <ActivityIndicator style={styles.statusIcon} size="small" color={colors.bgForm} />}
							<StyledText type="body" style={[styles.statusTextColor, styles.statusTextLabel]}>
								{statusText}
							</StyledText>
						</FormItem>
						{status.nodeUrl && (
							<Animated.View entering={FadeIn} exiting={FadeOut}>
								<FormItem clear="top">
									<StyledText type="label" style={styles.statusTextColor}>
										Node
									</StyledText>
									<StyledText type="body" style={styles.statusTextColor}>
										{status.nodeUrl}
									</StyledText>
								</FormItem>
							</Animated.View>
						)}
						{!isActionMade && !!warningText && (
							<Animated.View entering={FadeIn} exiting={FadeOut}>
								<FormItem clear="top">
									<StyledText type="body" style={styles.statusTextColor}>
										{warningText}
									</StyledText>
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
									<StyledText type="regular" style={styles.date}>
										{latestDateText}
									</StyledText>
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
							{isNodeSelectorVisible && <TextBox title={$t('input_nodeUrl')} value={nodeUrl} onChange={setNodeUrl} />}
						</FormItem>
						{isButtonVisible && transactionFees && (
							<>
								<FormItem clear="bottom">
									<FeeSelector
										title={$t('input_transactionFee')}
										value={speed}
										feeTiers={transactionFees}
										ticker={ticker}
										onChange={setSpeed}
									/>
								</FormItem>
								<FormItem>
									<Button {...buttonProps} title={buttonText} />
								</FormItem>
							</>
						)}
					</Animated.View>
				)}
			</>)}
		</TransactionSendScreen>
	);
};

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
		...fonts.amount
	},
	statusIcon: {
		width: fonts.amount.fontSize,
		height: fonts.amount.fontSize,
		marginRight: spacings.margin / 2
	},
	date: {
		...fonts.body,
		fontSize: 10,
		opacity: 0.7
	}
});
