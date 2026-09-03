import { BridgeHistory, EstimationSummary, SwapSelector } from './components';
import { PriceImpactSeverity } from './constants';
import {
	useBridge,
	useBridgeAmount,
	useBridgeDisabledDialog,
	useBridgeHistory,
	useBridgeNoPairsDialog,
	useBridgeTransaction,
	useBridgeTransactionWorkflow,
	useEstimation,
	useStepTransactionFees,
	useSwapSelector
} from './hooks';
import {
	createEstimationSummaryViewModel,
	createSwapConfirmationText,
	createSwapHistoryViewModel,
	createSwapSelectorViewModel,
	createTransactionProgressViewModel,
	formatPriceImpactText,
	getEstimationsPriceImpact,
	getPriceImpactSeverity,
	validateEstimation
} from './utils';
import {
	Button,
	ButtonCircle,
	DialogBox,
	Divider,
	InputAmount,
	Spacer,
	Stack,
	StyledText,
	TransactionScreenTemplate
} from '@/app/components';
import { config } from '@/app/config';
import { useToggle, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef } from 'react';

const TRANSACTION_SPEED = 'medium';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * BridgeSwap screen component. Provides the main interface for performing token swaps
 * between different blockchains. Users can select source and target tokens, enter amounts,
 * view fee estimations, and execute bridge transactions. Includes swap history display
 * and handles cases when no bridge pairs are available.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {object} props.route.params - Route parameters.
 * @param {ChainName} props.route.params.chainName - Default source chain name.
 * @returns {React.ReactNode} BridgeSwap component.
 */
export const BridgeSwap = props => {
	// Ref to break the createTransaction ↔ useStepTransactionFees ↔ useBridgeAmount circular dependency
	const createTransactionRef = useRef(() => Promise.resolve(null));

	// Load bridges and subscribe to changes
	const {
		pairs,
		pairsStatus,
		loadBridges,
		loadWalletControllers,
		fetchBalances
	} = useBridge();

	// Swap selector
	const {
		isReady,
		bridge,
		steps,
		source,
		target,
		sourceList,
		targetList,
		changeSource,
		changeTarget,
		reverse
	} = useSwapSelector({ pairs, defaultSourceChainName: props.route.params.chainName });

	// The transaction template and preview always need a controller; the main one stands in until a source is chosen.
	const sourceWalletController = useWalletController(source?.chainName);

	// Transaction fees of every route step
	const {
		stepFees,
		isLoading: isStepFeesLoading,
		fetchFirstStepFees,
		fetchRemainingStepFees,
		clearRemainingStepFees
	} = useStepTransactionFees({ steps, createTransaction: stepIndex => createTransactionRef.current(stepIndex) });

	// Amount and validation
	const {
		amount,
		amountInput,
		isAmountValid,
		availableBalance,
		changeAmount,
		changeAmountValidity,
		reset
	} = useBridgeAmount({ source, stepFees, transactionFeeTierLevel: TRANSACTION_SPEED });

	// Estimation summary
	const {
		estimations,
		estimate,
		clearEstimation,
		isLoading:
		isEstimationLoading,
		hasFailed: hasEstimationFailed
	} = useEstimation({ bridge, amount });

	// Transaction creation and preview
	const {
		createTransaction,
		getConfirmationPreview
	} = useBridgeTransaction({ steps, amount, estimations, walletController: sourceWalletController });

	// Update ref to break circular dependency with useStepTransactionFees
	createTransactionRef.current = createTransaction;

	// Transaction workflow
	const workflow = useBridgeTransactionWorkflow({
		steps,
		createTransaction,
		stepFees,
		transactionFeeTierLevel: TRANSACTION_SPEED
	});

	// Transaction progress view model
	const transactionProgressViewModel = createTransactionProgressViewModel(workflow);

	// Recent history
	const { history } = useBridgeHistory({ bridge });

	// No pairs popup
	const noPairsDialogManager = useBridgeNoPairsDialog({ pairsStatus });

	// Bridge turned off by its operator popup
	const disabledDialogManager = useBridgeDisabledDialog({ pairsStatus });

	// Price impact feeds the send gate, its dialog and the summary row. At the critical tier a warning
	// dialog gates the send; the ref carries the send action to that dialog.
	const priceImpact = getEstimationsPriceImpact(estimations);
	const priceImpactSeverity = getPriceImpactSeverity(priceImpact, config.bridge.priceImpact);
	const [isPriceImpactConfirmVisible, togglePriceImpactConfirm] = useToggle(false);
	const sendTransactionRef = useRef(() => {});

	const createSendPressHandler = sendTransaction => () => {
		if (priceImpactSeverity !== PriceImpactSeverity.CRITICAL) {
			sendTransaction();

			return;
		}

		sendTransactionRef.current = sendTransaction;
		togglePriceImpactConfirm();
	};

	const handlePriceImpactConfirm = () => {
		togglePriceImpactConfirm();
		sendTransactionRef.current();
	};

	const isAmountPositive = Number(amount) > 0;

	// Drop the estimation of the previous pair before the new one is fetched, so its values are never
	// shown against the newly selected tokens. Values are kept across amount changes on purpose.
	useEffect(() => {
		clearEstimation();
	}, [source, target]);

	// Reload data on tokens or amount change
	const fetchSwapData = useCallback(() => {
		if (isReady)
			fetchFirstStepFees();

		if (isReady && isAmountPositive)
			estimate();
		else
			clearEstimation();
	}, [amount, source, target, isReady]);
	useEffect(() => {
		fetchSwapData();
	}, [fetchSwapData]);

	// The later steps' amounts are the estimation output, so their fees follow the estimation
	useEffect(() => {
		if (estimations)
			fetchRemainingStepFees(estimations);
		else
			clearRemainingStepFees();
	}, [estimations]);

	// Estimation summary view model
	const estimationSummary = createEstimationSummaryViewModel({
		source,
		target,
		steps,
		amount,
		stepFees,
		estimations,
		priceImpact,
		priceImpactSeverity,
		transactionFeeTierLevel: TRANSACTION_SPEED
	});

	// Confirm dialog text
	const confirmationText = createSwapConfirmationText({ source, target, amount });

	// Selector and history view models
	const selector = createSwapSelectorViewModel({ source, target, sourceList, targetList });
	const swapHistory = createSwapHistoryViewModel({ history, networkIdentifier: source?.networkIdentifier });

	const init = useCallback(() => {
		(async () => {
			reset();
			clearEstimation();

			await loadWalletControllers();
			await loadBridges();
			noPairsDialogManager.onScreenFocus();
			disabledDialogManager.onScreenFocus();
			await fetchBalances();
		})();
	}, []);
	useFocusEffect(init);

	const isScreenLoading = !isReady;
	const isButtonDisabled = isEstimationLoading || isStepFeesLoading || !isAmountValid || !isAmountPositive;

	const handleTransactionSendComplete = () => reset();

	const handleHistoryItemPress = item => {
		Router.goToBridgeSwapDetails({
			params: {
				bridgeId: bridge.id,
				requestTransactionHash: item.key,
				preloadedData: item.request
			}
		});
	};

	return (
		<TransactionScreenTemplate
			isSendButtonDisabled={isButtonDisabled}
			isLoading={false}
			getConfirmationPreview={getConfirmationPreview}
			onComplete={handleTransactionSendComplete}
			walletController={sourceWalletController}
			workflow={workflow}
			transactionProgressViewModel={transactionProgressViewModel}
			isCustomSendButtonUsed={true}
			confirmDialogTitle={$t('s_bridge_swap_dialog_confirm_title')}
			confirmDialogText={confirmationText}
			modals={(
				<>
					<DialogBox
						isVisible={noPairsDialogManager.isVisible}
						title={$t('s_bridge_swap_dialog_noPairs_title')}
						text={$t('s_bridge_swap_dialog_noPairs_text')}
						type="confirm"
						onSuccess={noPairsDialogManager.onSuccess}
						onCancel={noPairsDialogManager.onCancel}
					/>
					<DialogBox
						isVisible={disabledDialogManager.isVisible}
						title={$t('s_bridge_swap_dialog_disabled_title')}
						text={$t('s_bridge_swap_dialog_disabled_text')}
						type="alert"
						onSuccess={disabledDialogManager.onClose}
					/>
					<DialogBox
						isVisible={isPriceImpactConfirmVisible}
						title={$t('s_bridge_swap_dialog_priceImpact_title')}
						text={$t('s_bridge_swap_dialog_priceImpact_text', { priceImpact: formatPriceImpactText(priceImpact) })}
						type="confirm"
						onSuccess={handlePriceImpactConfirm}
						onCancel={togglePriceImpactConfirm}
					/>
					<ButtonCircle isFloating onPress={Router.goToBridgeAccountList} icon="account" />
				</>
			)}
		>
			{buttonProps => (
				<Spacer bottom="l">
					<Stack>
						<StyledText type="title">
							{$t('s_bridge_title')}
						</StyledText>
						<StyledText type="body">
							{$t('s_bridge_description')}
						</StyledText>
						<SwapSelector
							isLoading={isScreenLoading}
							selector={selector}
							onSourceChange={changeSource}
							onTargetChange={changeTarget}
							onReverse={reverse}
						/>
						<InputAmount
							label={$t('form_transfer_input_amount')}
							availableBalance={availableBalance}
							value={amountInput}
							extraValidators={[validateEstimation(estimations, hasEstimationFailed)]}
							onChange={changeAmount}
							onValidityChange={changeAmountValidity}
						/>
						<EstimationSummary
							summary={estimationSummary}
							isLoading={isEstimationLoading || isStepFeesLoading}
						/>
						<Button {...buttonProps} onPress={createSendPressHandler(buttonProps.onPress)} />
						<Divider />
						<StyledText type="title">
							{$t('s_bridge_history_title')}
						</StyledText>
						<StyledText type="body">
							{$t('s_bridge_history_description')}
						</StyledText>
						<BridgeHistory
							history={swapHistory}
							onItemPress={handleHistoryItemPress}
						/>
					</Stack>
				</Spacer>
			)}
		</TransactionScreenTemplate>
	);
};
