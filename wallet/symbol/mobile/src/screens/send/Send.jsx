import {
	Checkbox,
	Dropdown,
	FeeSelector,
	InputAddress,
	InputAmount,
	SelectToken,
	Spacer,
	Stack,
	StyledText,
	TextBox,
	TransactionScreenTemplate
} from '@/app/components';
import { useDebounce, useTransactionFees, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { useSendFormState, useSendTransaction, useSenderInfo } from '@/app/screens/send/hooks';
import {
	calculateTokenAvailableBalance,
	createSenderOptions,
	filterActiveTokens,
	getSelectedTokenPrice
} from '@/app/screens/send/utils';
import { formatAmountInput } from '@/app/utils';
import React, { useEffect, useMemo, useState } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/send/types/Send').SendRouteParams} SendRouteParams */
/** @typedef {import('@/app/screens/send/types/Send').SenderOption} SenderOption */
/** @typedef {import('@/app/types/Token').Token} Token */

const CHAINS_WITH_MESSAGE_SUPPORT = ['symbol', 'nem'];

/**
 * Send screen component. Allows users to send tokens to recipient addresses,
 * supporting multisig accounts, message attachments with encryption options, and dynamic fee
 * selection for efficient transaction processing.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.route - React Navigation route object.
 * @param {SendRouteParams} [props.route.params] - Route parameters.
 * @returns {React.ReactNode} Send component
 */
export const Send = props => {
	// Route & Controller Setup
	const { route } = props;
	const walletController = useWalletController(route.params?.chainName);
	const {
		accounts,
		modules: { addressBook },
		currentAccount,
		isStateReady,
		isWalletReady,
		isNetworkConnectionReady,
		networkProperties,
		networkIdentifier,
		chainHeight,
		ticker,
		price
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};
	const walletAccounts = accounts[networkIdentifier];
	const hasMessageField = CHAINS_WITH_MESSAGE_SUPPORT.includes(walletController.chainName);

	// Form State
	const {
		senderAddress,
		recipientAddress,
		selectedTokenId,
		amount,
		messageText,
		isMessageEncrypted: isMessageEncryptedValue,
		transactionSpeed,
		isAmountValid,
		isRecipientValid,
		changeSenderAddress,
		changeRecipientAddress,
		changeSelectedTokenId,
		changeAmount,
		changeMessageText,
		toggleMessageEncrypted,
		changeTransactionSpeed,
		changeAmountValidity,
		changeRecipientValidity
	} = useSendFormState({
		defaultSenderAddress: currentAccount.address,
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

	// Sender Options (for multisig)
	const [senderOptions, setSenderOptions] = useState(/** @type {SenderOption[]} */ ([]));
	const isAccountCosignatoryOfMultisig = currentAccountInfo.multisigAddresses?.length > 0;

	useEffect(() => {
		if (isAccountCosignatoryOfMultisig) {
			const senderAddresses = [currentAccount.address, ...currentAccountInfo.multisigAddresses];
			const options = createSenderOptions(senderAddresses, {
				walletAccounts,
				addressBook,
				chainName: walletController.chainName,
				networkIdentifier: walletController.networkIdentifier
			});

			setSenderOptions(options);
		}
	}, [isStateReady, currentAccount, currentAccountInfo.multisigAddresses]);

	// Derived Token Data
	const nativeTokenId = networkProperties?.networkCurrency?.id || networkProperties?.networkCurrency?.mosaicId;
	const tokenListFiltered = filterActiveTokens(senderTokenList, chainHeight);
	const selectedToken = senderTokenList.find(token => token.id === selectedTokenId) || senderTokenList[0];
	const isMultisigTransfer = senderAddress !== currentAccount.address;
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
		getTransactionPreviewTable
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
			createTransaction={createTransaction}
			getConfirmationPreview={getTransactionPreviewTable}
			onComplete={Router.goBack}
			walletController={walletController}
			transactionFeeTiers={transactionFees}
			transactionFeeTierLevel={transactionSpeed}
		>
			<Spacer>
				<Stack>
					<StyledText type="title">{$t('form_transfer_title')}</StyledText>
					<StyledText type="body">{$t('s_send_description')}</StyledText>
					{isAccountCosignatoryOfMultisig && (
						<StyledText type="body">{$t('s_send_multisig_description')}</StyledText>
					)}
					{isAccountCosignatoryOfMultisig && (
						<Dropdown
							label={$t('input_sender')}
							value={senderAddress}
							list={senderOptions}
							onChange={changeSenderAddress}
						/>
					)}
					<InputAddress
						label={$t('form_transfer_input_recipient')}
						value={recipientAddress}
						addressBook={walletController.modules.addressBook}
						accounts={walletAccounts}
						chainName={walletController.chainName}
						networkIdentifier={walletController.networkIdentifier}
						onChange={changeRecipientAddress}
						onValidityChange={changeRecipientValidity}
					/>
					<SelectToken
						label={$t('form_transfer_input_mosaic')}
						value={selectedTokenId}
						tokens={tokenListFiltered}
						chainName={walletController.chainName}
						networkIdentifier={walletController.networkIdentifier}
						onChange={changeSelectedTokenId}
					/>
					<InputAmount
						label={$t('form_transfer_input_amount')}
						availableBalance={availableBalance}
						price={tokenPrice}
						networkIdentifier={networkIdentifier}
						value={amount}
						onChange={changeAmount}
						onValidityChange={changeAmountValidity}
					/>
					{hasMessageField && (
						<TextBox
							label={$t('form_transfer_input_message')}
							value={messageText}
							onChange={changeMessageText}
						/>
					)}
					{!isMultisigTransfer && hasMessageField && (
						<Checkbox
							text={$t('form_transfer_input_encrypted')}
							value={isMessageEncrypted}
							onChange={toggleMessageEncrypted}
						/>
					)}
					{!!transactionFees && (
						<Animated.View entering={FadeInDown} exiting={FadeOut}>
							<FeeSelector
								title={$t('form_transfer_input_fee')}
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
