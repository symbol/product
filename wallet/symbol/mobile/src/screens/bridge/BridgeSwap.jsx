import { BridgeHistory, EstimationSummary, SwapSelector } from './components';
import {
	useBridge,
	useBridgeAmount,
	useBridgeHistory,
	useBridgeNoPairsDialog,
	useBridgeTransaction,
	useEstimation,
	useSwapSelector
} from './hooks';
import { validateEstimation } from './utils';
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
import { useTransactionFees, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { getTotalFeeAmount } from '@/app/utils';
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
	// Ref to hold createTransaction for use in useTransactionFees before it's defined
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
		mode,
		source,
		target,
		sourceList,
		targetList,
		changeSource,
		changeTarget,
		reverse
	} = useSwapSelector({ pairs, defaultSourceChainName: props.route.params.chainName });

	const sourceWalletController = useWalletController(source?.chainName);

	// Transaction fees (moved before useBridgeAmount to avoid undefined reference)
	const {
		data: transactionFees,
		isLoading: isFeesLoading,
		call: fetchFees
	} = useTransactionFees(() => createTransactionRef.current(), sourceWalletController);
	const transactionFeeAmount = transactionFees
		? getTotalFeeAmount(transactionFees, TRANSACTION_SPEED)
		: '0';

	// Amount and validation
	const {
		amount,
		isAmountValid,
		availableBalance,
		changeAmount,
		changeAmountValidity,
		reset
	} = useBridgeAmount({ source, transactionFees, transactionFeeTierLevel: TRANSACTION_SPEED });

	// Transaction creation and preview
	const {
		createTransaction,
		getTransactionPreviewTable
	} = useBridgeTransaction({ bridgeId: bridge?.id, source, target, amount });

	// Update ref to point to actual createTransaction
	createTransactionRef.current = createTransaction;

	// Estimation summary
	const {
		estimation,
		estimate,
		clearEstimation,
		isLoading:
        isEstimationLoading
	} = useEstimation({ bridge, mode, amount });

	// Recent history
	const { history } = useBridgeHistory({ bridge });

	// No pairs popup
	const noPairsDialogManager = useBridgeNoPairsDialog({ pairsStatus });

	// Reload data on tokens or amount change
	const fetchSwapData = useCallback(() => {
		if (isReady)
			fetchFees();

		if (isReady && amount && amount !== '0')
			estimate();
		else
			clearEstimation();
	}, [amount, source, target, isReady]);
	useEffect(() => {
		fetchSwapData();
	}, [fetchSwapData]);

	const init = useCallback(() => {
		(async () => {
			reset();
			clearEstimation();

			await loadWalletControllers();
			await loadBridges();
			noPairsDialogManager.onScreenFocus();
			await fetchBalances();
		})();
	}, []);
	useFocusEffect(init);

	const isScreenLoading = !isReady;
	const isButtonDisabled = isEstimationLoading || isFeesLoading || !isAmountValid || amount === '0';

	const handleTransactionSendComplete = () => reset();

	const handleHistoryItemPress = data => {
		Router.goToBridgeSwapDetails({
			params: {
				bridgeId: bridge.id,
				requestTransactionHash: data.requestTransaction.hash,
				preloadedData: data
			}
		});
	};

	return (
		<TransactionScreenTemplate
			isSendButtonDisabled={isButtonDisabled}
			isLoading={false}
			createTransaction={createTransaction}
			getConfirmationPreview={getTransactionPreviewTable}
			onComplete={handleTransactionSendComplete}
			walletController={sourceWalletController}
			isCustomSendButtonUsed={true}
			confirmDialogTitle={$t('s_bridge_swap_dialog_confirm_title')}
			confirmDialogText={$t('s_bridge_swap_dialog_confirm_text', {
				amount,
				sourceToken: source?.token.name,
				sourceChain: source?.chainName,
				targetToken: target?.token.name,
				targetChain: target?.chainName
			})}
			transactionFeeTiers={transactionFees}
			transactionFeeTierLevel={TRANSACTION_SPEED}
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
							source={source}
							target={target}
							sourceList={sourceList}
							targetList={targetList}
							onSourceChange={changeSource}
							onTargetChange={changeTarget}
							reverse={reverse}
						/>
						<InputAmount
							label={$t('form_transfer_input_amount')}
							availableBalance={availableBalance}
							value={amount}
							extraValidators={[validateEstimation(estimation)]}
							onChange={changeAmount}
							onValidityChange={changeAmountValidity}
						/>
						<EstimationSummary
							sendAmount={amount}
							transactionFeeAmount={transactionFeeAmount}
							estimation={estimation}
							sourceToken={source?.token}
							targetToken={target?.token}
							sourceNetworkCurrency={sourceWalletController?.networkProperties?.networkCurrency}
							isLoading={isEstimationLoading || isFeesLoading}
						/>
						<Button {...buttonProps} />
						<Divider />
						<StyledText type="title">
							{$t('s_bridge_history_title')}
						</StyledText>
						<StyledText type="body">
							{$t('s_bridge_history_description')}
						</StyledText>
						<BridgeHistory
							history={history}
							networkIdentifier={sourceWalletController?.networkIdentifier}
							onItemPress={handleHistoryItemPress}
						/>
					</Stack>
				</Spacer>
			)}
		</TransactionScreenTemplate>
	);
};
