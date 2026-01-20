import { Router } from '@/app/Router';
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
import { MessageType } from '@/app/constants';
import { useAsyncManager, useDebounce, useProp, useToggle, useTransactionFees, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { formatAmountInput, getAddressName, getAvailableBalance, handleError, objectToTableData } from '@/app/utils';
import React, { useEffect, useMemo, useState } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { constants as symbolConstants } from 'wallet-common-symbol';

const CHAINS_THAT_HAVE_MESSAGE_FIELD = ['symbol', 'nem'];

/**
 * Send screen component. This screen allows users to send tokens to recipient addresses,
 * supporting multisig accounts, message attachments with encryption options, and dynamic fee
 * selection for efficient transaction processing.
 */
export const Send = props => {
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
	const hasMessageField = CHAINS_THAT_HAVE_MESSAGE_FIELD.includes(walletController.chainName);

	// UI state
	const [senderOptions, setSenderOptions] = useState([]);
	const [senderTokenList, setSenderTokenList] = useState([]);
	const [isAmountValid, setAmountValid] = useState(false);
	const [isRecipientValid, setRecipientValid] = useState(false);

	// Form inputs
	const [senderAddress, setSenderAddress] = useProp(currentAccount.address);
	const [recipientAddress, setRecipientAddress] = useProp(route.params?.recipientAddress, '');
	const [selectedTokenId, setSelectedTokenId] = useProp(route.params?.tokenId ?? route.params?.mosaicId, null);
	const [amount, setAmount] = useProp(route.params?.amount, '0');
	const [messageText, setMessageText] = useProp(route.params?.message?.text, '');
	const [isMessageEncryptedCheckboxValue, toggleMessageEncrypted] = useToggle(false);
	const [speed, setSpeed] = useState('medium');

	// Derived properties
	const isAccountCosignatoryOfMultisig = currentAccountInfo.multisigAddresses?.length > 0;
	const isMultisigTransfer = senderAddress !== currentAccount.address;
	const nativeTokenId = networkProperties?.networkCurrency?.id || networkProperties?.networkCurrency?.mosaicId;
	const tokenListFiltered = senderTokenList.filter(item => item.endHeight > chainHeight || !item.duration);

	// Form fields
	const [senderPublicKey, setSenderPublicKey] = useProp(currentAccount.publicKey);
	const selectedToken = senderTokenList.find(token => token.id === selectedTokenId) || senderTokenList[0];
	const tokens = selectedToken
		? [{
			...selectedToken,
			amount: formatAmountInput(amount, selectedToken.divisibility)
		}]
		: [];
	const isMessageEncrypted = isMultisigTransfer ? false : isMessageEncryptedCheckboxValue;

	// Create transaction
	const createTransaction = async () => {
		const transactionBundle = await walletController.modules.transfer.createTransaction({
			senderAddress,
			senderPublicKey,
			recipientAddress,
			tokens,
			mosaics: tokens,
			messageText,
			isMessageEncrypted
		});

		return transactionBundle;
	};

	// Calculate transaction fees
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

	// Get transaction preview data for confirmation dialog
	const getTransactionPreviewTable = transaction => {
		if (symbolConstants.TransactionType.HASH_LOCK === transaction.type) {
			return {
				type: transaction.type,
				description: $t('form_transfer_hash_lock_description', {
					lockedAmount: transaction.lockedAmount,
					duration: transaction.duration
				}),
				fee: transaction.fee
			};
		}

		const transfer = transaction.innerTransactions ? transaction.innerTransactions[0] : transaction;

		const data = {
			type: transfer.type,
			sender: transfer.signerAddress,
			recipientAddress: transfer.recipientAddress,
			mosaics: transfer.mosaics ?? transfer.tokens
		};

		if (transfer.message) {
			data.messageText = transfer.message.text;
			data.isMessageEncrypted = transfer.message.type === MessageType.ENCRYPTED_TEXT;
		}

		data.fee = transaction.fee;

		return objectToTableData(data);
	};

	// Max amount for input field
	const availableBalance = useMemo(() => {
		if (!selectedTokenId || !selectedToken?.amount)
			return '0';

		if (!transactionFees)
			return selectedToken.amount;

		return getAvailableBalance(
			selectedToken,
			nativeTokenId,
			transactionFees,
			speed
		);
	}, [selectedTokenId, selectedToken?.amount, transactionFees, speed]);

	// Token price for input field
	const getTokenPrice = () => {
		const isSelectedNativeToken = selectedTokenId === nativeTokenId;
		return isSelectedNativeToken ? price : null;
	};

	// Update sender address list when wallet is ready
	useEffect(() => {
		if (isAccountCosignatoryOfMultisig) {
			const senderAddresses = [currentAccount.address, ...currentAccountInfo.multisigAddresses];
			const senderAddressOptions = senderAddresses.map(address => ({
				value: address,
				label: getAddressName(address, currentAccount, walletAccounts, addressBook)
			}));
			setSenderOptions(senderAddressOptions);
		}
	}, [isStateReady, currentAccount, currentAccountInfo.multisigAddresses]);

	// Update token list and sender public key when sender address changes
	const updateSenderInfo = (tokens, publicKey) => {
		setSenderTokenList(tokens);
		setSelectedTokenId(tokens[0]?.id || null);
		setSenderPublicKey(publicKey);
	};

	const senderInfoManager = useAsyncManager({
		callback: async sender => {
			const { mosaics, tokens, publicKey } = await walletController.networkApi.account.fetchAccountInfo(networkProperties, sender);
			const tokenList = (tokens && tokens.length) ? tokens : (mosaics || []);
			updateSenderInfo(tokenList, publicKey);
		},
		onError: e => {
			handleError(e);
			updateSenderInfo([], '');
		}
	});

	useEffect(() => {
		setSelectedTokenId(null);
		const currentTokens = (currentAccountInfo.tokens && currentAccountInfo.tokens.length)
			? currentAccountInfo.tokens
			: (currentAccountInfo.mosaics || []);

		if (currentAccount.address === senderAddress)
			updateSenderInfo(currentTokens, currentAccount.publicKey);
		else
			senderInfoManager.call(senderAddress);
	}, [currentAccount, currentAccountInfo.mosaics, currentAccountInfo.tokens, senderAddress]);

	// Loading and validation state
	const isLoading = !isWalletReady || senderInfoManager.isLoading;
	const isSendButtonDisabled = !isNetworkConnectionReady 
		|| !isRecipientValid 
		|| !isAmountValid
		|| !tokens.length 
		|| !transactionFees 
		|| transactionFeesManager.isLoading;

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
			transactionFeeTierLevel={speed}
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
							title={$t('input_sender')}
							value={senderAddress}
							list={senderOptions}
							onChange={setSenderAddress}
						/>
					)}
					<InputAddress
						label={$t('form_transfer_input_recipient')}
						value={recipientAddress}
						addressBook={walletController.modules.addressBook}
						accounts={walletAccounts}
						chainName={walletController.chainName}
						networkIdentifier={walletController.networkIdentifier}
						onChange={setRecipientAddress}
						onValidityChange={setRecipientValid}
					/>
					<SelectToken
						label={$t('form_transfer_input_mosaic')}
						value={selectedTokenId}
						tokens={tokenListFiltered}
						chainName={walletController.chainName}
						networkIdentifier={walletController.networkIdentifier}
						onChange={setSelectedTokenId}
					/>
					<InputAmount
						label={$t('form_transfer_input_amount')}
						availableBalance={availableBalance}
						price={getTokenPrice()}
						networkIdentifier={networkIdentifier}
						value={amount}
						onChange={setAmount}
						onValidityChange={setAmountValid}
					/>
					{hasMessageField && (
						<TextBox
							label={$t('form_transfer_input_message')}
							value={messageText}
							onChange={setMessageText}
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
								value={speed}
								feeTiers={transactionFees}
								ticker={ticker}
								onChange={setSpeed}
							/>
						</Animated.View>
					)}
				</Stack>
			</Spacer>
		</TransactionScreenTemplate>
	);
};
