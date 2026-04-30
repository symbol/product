import {
	Button,
	Spacer,
	Stack,
	StyledText,
	TransactionScreenTemplate
} from '@/app/components';
import { useDebounce, useInit, useRefresh, useTransactionFees, useWalletController, useWalletRefreshLifecycle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { HarvestingForm, HarvestingStatus, HarvestingSummary } from '@/app/screens/harvesting/components';
import {
	useHarvestingAccountInfo,
	useHarvestingFormState,
	useHarvestingSummary,
	useHarvestingTransaction,
	useRandomNode
} from '@/app/screens/harvesting/hooks';
import { HarvestingAction } from '@/app/screens/harvesting/types/Harvesting';
import {
	createConfirmationDialogData,
	createHarvestingActionConfig,
	createHarvestingStatusViewModel,
	getActionButtonText
} from '@/app/screens/harvesting/utils';
import React, { useCallback, useEffect, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

/**
 * Harvesting screen component. Provides the interface for viewing and managing
 * delegated harvesting including status, summary, and start/stop controls.
 * @returns {React.ReactNode} Harvesting component.
 */
export const Harvesting = () => {
	const walletController = useWalletController();
	const { ticker, isWalletReady } = walletController;

	// Custom status to feedback pending state after sending start/stop transaction until next status load
	const [isPendingTransaction, setIsPendingTransaction] = useState(false);

	// Account harvesting info
	const {
		load: loadAccountInfo,
		isLoading: isAccountInfoLoading,
		harvestingStatus,
		isEligible,
		isAccountBalanceSufficient,
		isAccountImportanceSufficient,
		reset: resetAccountInfo
	} = useHarvestingAccountInfo(walletController);

	// Summary
	const {
		summaryViewModel,
		isLoading: isSummaryLoading,
		load: loadSummary,
		reset: resetSummary
	} = useHarvestingSummary(walletController);

	// Node list
	const {
		randomNodeUrl,
		load: loadNodes,
		reset: resetNodes
	} = useRandomNode(walletController);

	// Form State
	const {
		nodeUrl,
		feeLevel,
		setNodeUrl,
		setFeeLevel
	} = useHarvestingFormState({ nodeUrl: randomNodeUrl });

	// View Models
	const actionConfig = createHarvestingActionConfig(harvestingStatus, isEligible);
	const { actionType, isNodeSelectorVisible, isActionButtonVisible } = actionConfig;
	const statusViewModel = createHarvestingStatusViewModel({
		harvestingStatus,
		isBalanceSufficient: isAccountBalanceSufficient,
		isImportanceSufficient: isAccountImportanceSufficient,
		isPendingTransaction
	});
	const confirmDialogData = createConfirmationDialogData(actionType);
	const buttonText = getActionButtonText(actionType);

	// Transaction Creation
	const {
		createStartTransaction,
		createStopTransaction,
		getTransactionPreviewTable
	} = useHarvestingTransaction({ walletController, selectedNodeUrl: nodeUrl });
	const createTransaction = useCallback(async () => {
		if (actionType === HarvestingAction.START)
			return createStartTransaction();

		return createStopTransaction();
	}, [actionType, createStartTransaction, createStopTransaction]);

	// Transaction Fees
	const {
		data: transactionFees,
		isLoading: isFeesLoading,
		call: fetchFees
	} = useTransactionFees(createTransaction, walletController);
	const calculateFeesSafely = useDebounce(fetchFees, 1000);
	useEffect(() => {
		const isStartReady = actionType === HarvestingAction.START && nodeUrl;
		const isStopReady = actionType === HarvestingAction.STOP;

		if (isStartReady || isStopReady)
			calculateFeesSafely();
	}, [actionType, nodeUrl, calculateFeesSafely]);

	// Derived State
	const isManageSectionVisible = isActionButtonVisible && !isPendingTransaction && !!transactionFees;
	const isLoading = isAccountInfoLoading || isSummaryLoading;
	const isButtonDisabled = isFeesLoading
		|| isLoading
		|| isPendingTransaction
		|| (actionType === HarvestingAction.START && !nodeUrl);

	// Initialization and loading subscription
	const loadAll = useCallback(() => {
		setIsPendingTransaction(false);
		loadAccountInfo();
		loadSummary();
		loadNodes();
	}, [loadAccountInfo, loadSummary, loadNodes]);
	const clearAll = useCallback(() => {
		setIsPendingTransaction(false);
		resetAccountInfo();
		resetSummary();
		resetNodes();
	}, [resetAccountInfo, resetSummary, resetNodes]);
	useWalletRefreshLifecycle({ 
		walletController,
		onRefresh: loadAll,
		onClear: clearAll
	});
	const { refresh, isRefreshing } = useRefresh(loadAll, isLoading);
	useInit(loadAll, isWalletReady);

	// Handlers
	const handleTransactionSendSuccess = useCallback(() => {
		setIsPendingTransaction(true);
	}, []);

	return (
		<TransactionScreenTemplate
			isSendButtonDisabled={isButtonDisabled}
			isLoading={false}
			createTransaction={createTransaction}
			getConfirmationPreview={getTransactionPreviewTable}
			onSendSuccess={handleTransactionSendSuccess}
			walletController={walletController}
			isCustomSendButtonUsed={true}
			confirmDialogTitle={confirmDialogData.title}
			confirmDialogText={confirmDialogData.text}
			transactionFeeTiers={transactionFees}
			transactionFeeTierLevel={feeLevel}
			refresh={{ onRefresh: refresh, isRefreshing }}
		>
			{buttonProps => (
				<Spacer bottom="l">
					<Stack gap="l">
						{/* Title and description */}
						<Stack gap="none">
							<StyledText type="title">
								{$t('s_harvesting_title')}
							</StyledText>
							<StyledText type="body">
								{$t('s_harvesting_description')}
							</StyledText>
						</Stack>

						{/* Status section */}
						<Stack gap="none">
							<StyledText type="title">
								{$t('fieldTitle_status')}
							</StyledText>
							<HarvestingStatus
								statusViewModel={statusViewModel}
								isLoading={isLoading}
							/>
						</Stack>

						{/* Summary section */}
						<Stack gap="none">
							<StyledText type="title">
								{$t('s_harvesting_harvested_title')}
							</StyledText>
							<HarvestingSummary
								summaryViewModel={summaryViewModel}
								ticker={ticker}
							/>
						</Stack>

						{/* Manage section */}
						{isManageSectionVisible && (
							<Animated.View entering={FadeInDown}>
								<Stack>
									<Stack gap="none">
										<StyledText type="title">
											{$t('s_harvesting_manage_title')}
										</StyledText>
										<HarvestingForm
											nodeUrl={nodeUrl}
											onNodeUrlChange={setNodeUrl}
											feeTiers={transactionFees}
											feeLevel={feeLevel}
											onFeeLevelChange={setFeeLevel}
											ticker={ticker}
											isNodeSelectorVisible={isNodeSelectorVisible}
											isFeeSelectorVisible={Boolean(transactionFees)}
										/>
									</Stack>
									<Button
										{...buttonProps}
										text={buttonText}
									/>
								</Stack>
							</Animated.View>
						)}
					</Stack>
				</Spacer>
			)}
		</TransactionScreenTemplate>
	);
};
