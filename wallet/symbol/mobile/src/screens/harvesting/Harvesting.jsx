import {
	Button,
	SelectTransactionSender,
	Spacer,
	Stack,
	StyledText,
	TransactionScreenTemplate
} from '@/app/components';
import { useStandardTransactionWorkflow } from '@/app/components/templates/TransactionScreenTemplate/hooks';
import {
	useDebounce,
	useInit,
	useRefresh,
	useTransactionFees,
	useTransactionSender,
	useWalletController,
	useWalletRefreshLifecycle
} from '@/app/hooks';
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

/**
 * Harvesting screen component. Provides the interface for viewing and managing
 * delegated harvesting including status, summary, and start/stop controls.
 * @returns {React.ReactNode} Harvesting component.
 */
export const Harvesting = () => {
	const walletController = useWalletController();
	const { ticker, isWalletReady, networkIdentifier, chainName } = walletController;
	const walletAccounts = walletController.accounts[networkIdentifier];

	// Custom status to feedback pending state after sending start/stop transaction until next status load
	const [isPendingTransaction, setIsPendingTransaction] = useState(false);

	// Sender selection (current or multisig)
	const {
		options: senderOptions,
		value: senderAddress,
		changeValue: setSenderAddress,
		selectedAccount,
		isMultisigSelected: isMultisigSender,
		load: loadSenderOptions,
		reset: resetSenderOptions
	} = useTransactionSender(walletController);

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

	// When harvesting from a multisig account, that account is the harvester the inner transactions act on
	const harvesterAccountInfo = isMultisigSender ? selectedAccount : undefined;

	// Account harvesting info
	const {
		load: loadAccountInfo,
		isLoading: isAccountInfoLoading,
		harvestingStatus,
		isEligible,
		isAccountBalanceSufficient,
		isAccountImportanceSufficient,
		reset: resetAccountInfo
	} = useHarvestingAccountInfo(walletController, selectedAccount);

	// Summary
	const {
		summaryViewModel,
		isLoading: isSummaryLoading,
		load: loadSummary,
		reset: resetSummary
	} = useHarvestingSummary(walletController, senderAddress);

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
		getConfirmationPreview
	} = useHarvestingTransaction({ walletController, selectedNodeUrl: nodeUrl, actionType, harvesterAccountInfo });
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
		|| (actionType === HarvestingAction.START
			&& !nodeUrl);

	// Initialization and loading subscription
	const loadAll = useCallback(() => {
		setIsPendingTransaction(false);
		loadSenderOptions();
		loadAccountInfo();
		loadSummary();
		loadNodes();
	}, [loadSenderOptions, loadAccountInfo, loadSummary, loadNodes]);
	const clearAll = useCallback(() => {
		setIsPendingTransaction(false);
		resetSenderOptions();
		resetAccountInfo();
		resetSummary();
		resetNodes();
	}, [resetSenderOptions, resetAccountInfo, resetSummary, resetNodes]);
	useWalletRefreshLifecycle({ 
		walletController,
		onRefresh: loadAll,
		onClear: clearAll
	});
	const { refresh, isRefreshing } = useRefresh(loadAll, isLoading);
	useInit(loadAll, isWalletReady);

	// Reload account-scoped data when the selected sender changes (skip the initial mount handled by loadAll)
	const isInitialSenderRender = useRef(true);
	useEffect(() => {
		if (isInitialSenderRender.current) {
			isInitialSenderRender.current = false;

			return;
		}

		if (!isWalletReady)
			return;

		setIsPendingTransaction(false);
		loadAccountInfo();
		loadSummary();
	}, [senderAddress]);

	// Handlers
	const handleTransactionSendSuccess = useCallback(() => {
		setIsPendingTransaction(true);
	}, []);

	// Transaction Workflow
	const workflow = useStandardTransactionWorkflow({
		createTransaction,
		walletController,
		transactionFeeTiers: transactionFees,
		transactionFeeTierLevel: feeLevel,
		onSendSuccess: handleTransactionSendSuccess
	});

	return (
		<TransactionScreenTemplate
			isSendButtonDisabled={isButtonDisabled}
			isLoading={false}
			getConfirmationPreview={getConfirmationPreview}
			walletController={walletController}
			workflow={workflow}
			isCustomSendButtonUsed={true}
			confirmDialogTitle={confirmDialogData.title}
			confirmDialogText={confirmDialogData.text}
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

						{/* Sender section */}
						<Stack gap="none">
							<StyledText type="title">{$t('s_harvesting_account_title')}</StyledText>
							<SelectTransactionSender
								value={senderAddress}
								options={senderOptions}
								ticker={ticker}
								chainName={chainName}
								networkIdentifier={networkIdentifier}
								walletAccounts={walletAccounts}
								addressBook={walletController.modules.addressBook}
								onChange={setSenderAddress}
							/>
						</Stack>

						{/* Status section */}
						<Stack gap="none">
							<StyledText type="title">
								{$t('s_harvesting_status_title')}
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
