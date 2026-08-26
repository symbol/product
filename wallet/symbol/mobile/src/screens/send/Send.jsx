import {
	Checkbox,
	FeeSelector,
	InputAddress,
	InputAmount,
	SelectToken,
	SelectTransactionSender,
	Spacer,
	Stack,
	StyledText,
	TextBox,
	TransactionScreenTemplate
} from '@/app/components';
import { useStandardTransactionWorkflow } from '@/app/components/templates/TransactionScreenTemplate/hooks';
import {
	useDebounce,
	useInit,
	useTransactionFees,
	useTransactionSender,
	useWalletController,
	useWalletRefreshLifecycle
} from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { useSendFormState, useSendTransaction, useSenderInfo } from '@/app/screens/send/hooks';
import {
	calculateTokenAvailableBalance,
	filterActiveTokens,
	getSelectedTokenPrice
} from '@/app/screens/send/utils';
import { formatAmountInput, validateRecipient } from '@/app/utils';
import React, { useEffect, useMemo } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/send/types/Send').SendRouteParams} SendRouteParams */
/** @typedef {import('@/app/types/Token').Token} Token */

const CHAINS_WITH_MESSAGE_SUPPORT = ['symbol', 'nem'];

/**
 * Send screen component. Allows users to send tokens to recipient addresses,
 * supporting multisig accounts, message attachments with encryption options, and dynamic fee
 * selection for efficient transaction processing.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {SendRouteParams} [props.route.params] - Route parameters.
 * @returns {React.ReactNode} Send component.
 */
export const Send = props => {
	// Route & Controller Setup
	const { route } = props;
	const walletController = useWalletController(route.params?.chainName);
	const {
		isWalletReady,
		isNetworkConnectionReady,
		networkProperties,
		networkIdentifier,
		chainHeight,
		ticker,
		price
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};
	const hasMessageField = CHAINS_WITH_MESSAGE_SUPPORT.includes(walletController.chainName);

	// Sender selection (current or multisig)
	const {
		options: senderOptions,
		value: senderAddress,
		changeValue: changeSenderAddress,
		isMultisigSelected: isMultisigTransfer,
		load: loadSenderOptions,
		reset: resetSenderOptions
	} = useTransactionSender(walletController, { initialAddress: route.params?.senderAddress });
	useWalletRefreshLifecycle({ walletController, onRefresh: loadSenderOptions, onClear: resetSenderOptions });
	useInit(loadSenderOptions, isWalletReady);

	// Form State
	const {
		recipientAddress,
		selectedTokenId,
		amount,
		messageText,
		isMessageEncrypted: isMessageEncryptedValue,
		transactionSpeed,
		isAmountValid,
		isRecipientValid,
		changeRecipientAddress,
		changeSelectedTokenId,
		changeAmount,
		changeMessageText,
		toggleMessageEncrypted,
		changeTransactionSpeed,
		changeAmountValidity,
		changeRecipientValidity
	} = useSendFormState({
		routeParams: route.params
	});

	// Sender Info Management
	const {
		senderTokenList,
		senderPublicKey,
		isLoading: isSenderInfoLoading
	} = useSenderInfo({
		walletController,
		senderAddress,
		selectedTokenId,
		onTokenIdChange: changeSelectedTokenId
	});

	// Derived Token Data
	const nativeTokenId = networkProperties?.networkCurrency?.id || networkProperties?.networkCurrency?.mosaicId;
	const tokenListFiltered = filterActiveTokens(senderTokenList, chainHeight);
	const selectedToken = senderTokenList.find(token => token.id === selectedTokenId) || senderTokenList[0];
	const isMessageEncrypted = isMultisigTransfer ? false : isMessageEncryptedValue;

	/** @type {Token[]} */
	const tokens = useMemo(() => {
		if (!selectedToken)
			return [];

		return [{
			...selectedToken,
			amount: formatAmountInput(amount, selectedToken.divisibility)
		}];
	}, [selectedToken, amount]);

	// Transaction Creation
	const {
		createTransaction,
		getConfirmationPreview
	} = useSendTransaction({
		walletController,
		senderAddress,
		senderPublicKey,
		recipientAddress,
		tokens,
		messageText,
		isMessageEncrypted
	});

	// Transaction Fees
	const transactionFeesManager = useTransactionFees(createTransaction, walletController);
	const transactionFees = transactionFeesManager.data;
	const calculateTransactionFeesSafely = useDebounce(transactionFeesManager.call, 2000);

	useEffect(() => {
		if (isRecipientValid && isAmountValid && selectedTokenId && isWalletReady)
			calculateTransactionFeesSafely();
	}, [
		isWalletReady,
		recipientAddress,
		isRecipientValid,
		isAmountValid,
		selectedTokenId,
		amount,
		messageText,
		isMessageEncrypted,
		senderPublicKey
	]);

	// Display Data
	const availableBalance = useMemo(
		() => calculateTokenAvailableBalance(selectedToken, nativeTokenId, transactionFees, transactionSpeed),
		[selectedToken, nativeTokenId, transactionFees, transactionSpeed]
	);

	const tokenPrice = getSelectedTokenPrice(selectedTokenId, nativeTokenId, price);

	// Transaction Workflow
	const workflow = useStandardTransactionWorkflow({
		createTransaction,
		walletController,
		transactionFeeTiers: transactionFees,
		transactionFeeTierLevel: transactionSpeed
	});

	// Derived State
	const isLoading = !isWalletReady || isSenderInfoLoading;
	const isSendButtonDisabled = !isNetworkConnectionReady
		|| !isRecipientValid
		|| !isAmountValid
		|| !tokens.length
		|| !transactionFees
		|| transactionFeesManager.isLoading;

	// Render
	return (
		<TransactionScreenTemplate
			isLoading={isLoading}
			isSendButtonDisabled={isSendButtonDisabled}
			isMultisigAccount={currentAccountInfo.isMultisig}
			accountCosignatories={currentAccountInfo.cosignatories}
			getConfirmationPreview={getConfirmationPreview}
			onComplete={Router.goBack}
			walletController={walletController}
			workflow={workflow}
		>
			<Spacer>
				<Stack gap="l">
					<Stack gap="none">
						<StyledText type="title">{$t('s_send_title')}</StyledText>
						<StyledText type="body">{$t('s_send_description')}</StyledText>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_send_from_title')}</StyledText>
						<SelectTransactionSender
							value={senderAddress}
							options={senderOptions}
							chainName={walletController.chainName}
							onChange={changeSenderAddress}
						/>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_send_to_title')}</StyledText>
						<InputAddress
							label={$t('input_recipient')}
							value={recipientAddress}
							chainName={walletController.chainName}
							extraValidators={[validateRecipient(walletController.chainName)]}
							onChange={changeRecipientAddress}
							onValidityChange={changeRecipientValidity}
						/>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_send_token_title')}</StyledText>
						<Stack gap="s">
							<SelectToken
								label={$t('input_mosaic')}
								value={selectedTokenId}
								tokens={tokenListFiltered}
								chainName={walletController.chainName}
								onChange={changeSelectedTokenId}
							/>
							<InputAmount
								label={$t('input_amount')}
								availableBalance={availableBalance}
								price={tokenPrice}
								networkIdentifier={networkIdentifier}
								value={amount}
								onChange={changeAmount}
								onValidityChange={changeAmountValidity}
							/>
						</Stack>
					</Stack>
					
					{hasMessageField && (
						<Stack gap="none">
							<StyledText type="title" size="s">{$t('s_send_message_title')}</StyledText>
							<Stack gap="s">
								<TextBox
									label={$t('input_message')}
									value={messageText}
									onChange={changeMessageText}
								/>
								{!isMultisigTransfer && (
									<Checkbox
										text={$t('input_encrypted')}
										value={isMessageEncrypted}
										onChange={toggleMessageEncrypted}
									/>
								)}
							</Stack>
						</Stack>
					)}

					{!!transactionFees && (
						<Animated.View entering={FadeInDown} exiting={FadeOut}>
							<FeeSelector
								title={$t('input_feeSpeed')}
								value={transactionSpeed}
								feeTiers={transactionFees}
								ticker={ticker}
								onChange={changeTransactionSpeed}
							/>
						</Animated.View>
					)}
				</Stack>
			</Spacer>
		</TransactionScreenTemplate>
	);
};
