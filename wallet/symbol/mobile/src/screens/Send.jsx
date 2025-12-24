import { Router } from '@/app/Router';
import {
    Checkbox,
    Dropdown,
    FeeSelector,
    FormItem,
    InputAddress,
    InputAmount,
    SelectMosaic,
    StyledText,
    TextBox,
    TransactionSendScreen
} from '@/app/components';
import { MessageType } from '@/app/constants';
import { useDataManager, useDebounce, useProp, useToggle, useTransactionFees, useWalletController } from '@/app/hooks';
import { controllers } from '@/app/lib/controller';
import { $t } from '@/app/localization';
import {
    formatAmountInput,
    getAddressName,
    handleError,
    toFixedNumber
} from '@/app/utils';
import React, { useEffect, useMemo, useState } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';
import { constants as symbolConstants } from 'wallet-common-symbol';

export const Send = props => {
    const { route } = props;
    const WalletController = useWalletController(route.params?.chainName);
    const {
        accounts,
        modules: { addressBook },
        currentAccount,
        isStateReady,
        isWalletReady,
        isNetworkConnectionReady,
        networkProperties,
        networkIdentifier,
        ticker,
        chainHeight,
        price
    } = WalletController;
    const currentAccountInfo = WalletController.currentAccountInfo || {};
    const walletAccounts = accounts[networkIdentifier];
    const hasMessageField = WalletController.chainName === controllers.main.chainName;

    // UI
    const [senderOptions, setSenderOptions] = useState([]);
    const [senderTokenList, setSenderTokenList] = useState([]);
    const senderTokenOptions = senderTokenList.map(token => ({
        label: token.name,
        value: token.id,
        tokenInfo: token
    }));
    const [isAmountValid, setAmountValid] = useState(false);
    const [isRecipientValid, setRecipientValid] = useState(false);

    // Inputs
    const [senderAddress, setSenderAddress] = useProp(currentAccount.address);
    const [recipientAddress, setRecipientAddress] = useProp(route.params?.recipientAddress, '');
    const [selectedTokenId, setSelectedTokenId] = useProp(route.params?.tokenId ?? route.params?.mosaicId, null);
    const [amount, setAmount] = useProp(route.params?.amount, '0');
    const [messageText, setMessageText] = useProp(route.params?.message?.text, '');
    const [isMessageEncryptedCheckboxValue, toggleMessageEncrypted] = useToggle(false);
    const [speed, setSpeed] = useState('medium');

    // Other properties
    const isAccountCosignatoryOfMultisig = currentAccountInfo.multisigAddresses?.length > 0;
    const isMultisigTransfer = senderAddress !== currentAccount.address;

    // Fields
    const [senderPublicKey, setSenderPublicKey] = useProp(currentAccount.publicKey);
    const selectedToken = senderTokenList.find(token => token.id === selectedTokenId) || senderTokenList[0];
    const tokens = selectedToken
        ? [{
            ...selectedToken,
            amount: formatAmountInput(amount, selectedToken.divisibility)
        }]
        : [];
    const isMessageEncrypted = isMultisigTransfer ? false : isMessageEncryptedCheckboxValue;

    const nativeTokenId = networkProperties?.networkCurrency?.id || networkProperties?.networkCurrency?.mosaicId;

    // Create transaction
    const createTransaction = async () => {
        const transactionBundle = await WalletController.modules.transfer.createTransaction({
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
    const transactionFeesManager = useTransactionFees(createTransaction, WalletController);
    const transactionFees = transactionFeesManager.data;
    const calculateTransactionFeesSafely = useDebounce(transactionFeesManager.load, 2000);
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
    const getTransactionPreviewTable = (transaction) => {
        if (symbolConstants.TransactionType.HASH_LOCK === transaction.type) {
            return {
                type: transaction.type,
                description: $t('form_transfer_hash_lock_description', {
                    lockedAmount: transaction.lockedAmount,
                    duration: transaction.duration
                }),
                fee: transaction.fee,
            };
        }

		const transfer = transaction.innerTransactions ? transaction.innerTransactions[0] : transaction;

		const data = {
			type: transfer.type,
			sender: transfer.signerAddress,
			recipientAddress: transfer.recipientAddress,
			mosaics: transfer.mosaics ?? transfer.tokens,
		};

        if (transfer.message) {
            data.messageText = transfer.message.text;
            data.isMessageEncrypted = transfer.message.type === MessageType.EncryptedText;
        }

        data.fee = transaction.fee;

        return data;
    };

    // Max amount for input field
    const getAvailableBalance = () => {
        const isSelectedNativeToken = selectedToken?.id === nativeTokenId;
        const selectedTokenBalance = selectedToken?.amount || '0';

        // For non-native token do not need to deduct fees 
        if (!isSelectedNativeToken || !transactionFees)
            return selectedTokenBalance;

        const divisibility = selectedToken?.divisibility || 0;
		const totalFee = safeOperationWithRelativeAmounts(
			divisibility,
			transactionFees.map(feeTier => feeTier[speed].token.amount),
			(...args) => args.reduce((a, b) => a + b, 0n)
		);

        return safeOperationWithRelativeAmounts(
            divisibility,
            [selectedTokenBalance, totalFee],
            (a, b) => a - b
        );
    };
    const availableBalance = useMemo(getAvailableBalance, [selectedTokenId, selectedToken?.amount, transactionFees, speed]);

    // Token price for input field
    const getTokenPrice = () => {
        const isSelectedNativeToken = selectedTokenId === nativeTokenId;
        return isSelectedNativeToken ? price : null;
    };

    // Update the sender address list after the wallet is ready
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

    // Update the token list and sender public key after sender's address changed
    const updateSenderInfo = (tokens, publicKey) => {
        setSenderTokenList(tokens);
        setSelectedTokenId(tokens[0]?.id || null);
        setSenderPublicKey(publicKey);
    };
    const [fetchSenderInfo, isSenderInfoLoading] = useDataManager(
        async sender => {
            const { mosaics, tokens, publicKey } = await WalletController.networkApi.account.fetchAccountInfo(networkProperties, sender);
            const tokenList = (tokens && tokens.length) ? tokens : (mosaics || []);
            updateSenderInfo(tokenList, publicKey);
        },
        null,
        e => {
            handleError(e);
            updateSenderInfo([], '');
        }
    );
    useEffect(() => {
        setSelectedTokenId(null);
        const currentTokens = (currentAccountInfo.tokens && currentAccountInfo.tokens.length)
            ? currentAccountInfo.tokens
            : (currentAccountInfo.mosaics || []);

        if (currentAccount.address === senderAddress)
            updateSenderInfo(currentTokens, currentAccount.publicKey);
        else
            fetchSenderInfo(senderAddress);
    }, [currentAccount, currentAccountInfo.mosaics, currentAccountInfo.tokens, senderAddress]);

    const isLoading = !isWalletReady || isSenderInfoLoading;
    const isSendButtonDisabled = !isNetworkConnectionReady || !isRecipientValid || !isAmountValid || !tokens.length || !transactionFees || transactionFeesManager.isLoading;

    return (
        <TransactionSendScreen
            isLoading={isLoading}
            isSendButtonDisabled={isSendButtonDisabled}
            isMultisigAccount={currentAccountInfo.isMultisig}
            accountCosignatories={currentAccountInfo.cosignatories}
            createTransaction={createTransaction}
            getConfirmationPreview={getTransactionPreviewTable}
            onComplete={Router.goBack}
            walletController={WalletController}
            transactionFeeTiers={transactionFees}
            transactionFeeTierLevel={speed}
        >
            <FormItem>
                <StyledText type="title">{$t('form_transfer_title')}</StyledText>
                <StyledText type="body">{$t('s_send_description')}</StyledText>
            </FormItem>
            {isAccountCosignatoryOfMultisig && (
                <FormItem>
                    <StyledText type="body">{$t('s_send_multisig_description')}</StyledText>
                </FormItem>
            )}
            {isAccountCosignatoryOfMultisig && (
                <FormItem>
                    <Dropdown
                        title={$t('input_sender')}
                        value={senderAddress}
                        list={senderOptions}
                        onChange={setSenderAddress}
                    />
                </FormItem>
            )}
            <FormItem>
                <InputAddress
                    title={$t('form_transfer_input_recipient')}
                    value={recipientAddress}
                    addressBook={WalletController.modules.addressBook}
                    accounts={walletAccounts}
                    onChange={setRecipientAddress}
                    onValidityChange={setRecipientValid}
                />
            </FormItem>
            <FormItem>
                <SelectMosaic
                    title={$t('form_transfer_input_mosaic')}
                    value={selectedTokenId}
                    list={senderTokenOptions}
                    chainHeight={chainHeight}
                    onChange={setSelectedTokenId}
                />
            </FormItem>
            <FormItem>
                <InputAmount
                    title={$t('form_transfer_input_amount')}
                    availableBalance={availableBalance}
                    price={getTokenPrice()}
                    networkIdentifier={networkIdentifier}
                    value={amount}
                    onChange={setAmount}
                    onValidityChange={setAmountValid}
                />
            </FormItem>
            {hasMessageField && (
                <FormItem>
                    <TextBox title={$t('form_transfer_input_message')} value={messageText} onChange={setMessageText} />
                </FormItem>
            )}
            {!isMultisigTransfer && hasMessageField && (
                <FormItem>
                    <Checkbox
                        title={$t('form_transfer_input_encrypted')}
                        value={isMessageEncrypted}
                        onChange={toggleMessageEncrypted}
                    />
                </FormItem>
            )}
            {!!transactionFees && (
                <Animated.View entering={FadeInDown} exiting={FadeOut}>
                    <FormItem>
                        <FeeSelector
                            title={$t('form_transfer_input_fee')}
                            value={speed}
                            feeTiers={transactionFees}
                            ticker={ticker}
                            onChange={setSpeed}
                        />
                    </FormItem>
                </Animated.View>
            )}
        </TransactionSendScreen>
    );
};
