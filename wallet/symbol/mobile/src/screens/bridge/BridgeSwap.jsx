import { Router } from '@/app/Router';
import {
    Button,
    FormItem,
    InputAmount,
    Screen,
    StyledText,
    TransactionSendScreen,
} from '@/app/components';
import { useDataManager, useDebounce, useTransactionFees } from '@/app/hooks';
import { $t } from '@/app/localization';
import { BridgeEstimationSummary } from '@/app/screens/bridge/components/BridgeEstimationSummary';
import { BridgeHistory } from '@/app/screens/bridge/components/BridgeHistory';
import { BridgeTokenSelector } from '@/app/screens/bridge/components/BridgeTokenSelector';
import { useBridgeAccounts } from '@/app/screens/bridge/useBridgeAccounts';
import { validateEstimation } from '@/app/screens/bridge/utils';
import { formatAmountInput, handleError } from '@/app/utils';
import React, { useEffect, useMemo, useState } from 'react';
import { WalletController } from 'wallet-common-core';

/**
 * @typedef {object} BridgeTokenItem
 * @property {string} type - 'native' or 'wrapped'
 * @property {WalletController} controller - Wallet controller that owns the token
 * @property {import('wallet-common-core/src/types/Token').Token} token - Token object
 * @property {import('wallet-common-core/src/lib/bridge/BridgeManager').BridgeManager} bridge - Bridge manager instance the token belongs to
 */

const BridgeMode = {
    WRAP: 'wrap',
    UNWRAP: 'unwrap',
}

/**
 * Get BridgeTokenItem from bridge manager
 * @param {import('wallet-common-core/src/lib/bridge/BridgeManager').BridgeManager} bridge 
 * @param {'native'|'wrapped'} type 
 * @returns {BridgeTokenItem|null}
 */
const getBridgeTokenItemFromBridge = (bridge, type = 'native') => {
    const tokenInfo = type === 'native'
        ? bridge.nativeTokenInfo
        : bridge.wrappedTokenInfo;

    const controller = type === 'native'
        ? bridge.nativeWalletController
        : bridge.wrappedWalletController;

    const controllerBridgeTokens = controller.modules.bridge.tokens;

    if (!tokenInfo || !controllerBridgeTokens.length)
        return null;

    const token = controllerBridgeTokens.find(t => t.id === tokenInfo.id);

    if (!token)
        return null;

    return {
        type,
        controller,
        token,
        bridge,
    };
}

export const BridgeSwap = (props) => {
    const { chainName } = props.route.params;
    const [mode, setMode] = useState(BridgeMode.WRAP);

    // Bridges related to selected chain.
    const bridgeManager = useBridgeAccounts();
    const bridgeList = useMemo(() => bridgeManager.bridges.filter(bridge =>
        bridge.wrappedWalletController.chainName === chainName
    ), [chainName]);

    // List of source and target tokens extracted from bridges depending on the mode (WRAP/UNWRAP)
    /** @type {[BridgeTokenItem[], BridgeTokenItem[]]} */
    const [sourceTokenList, targetTokenList] = useMemo(() => {
        const sourceTokens = [];
        const targetTokens = [];

        bridgeList.forEach(bridge => {
            const sourceTokenItem = getBridgeTokenItemFromBridge(
                bridge,
                mode === BridgeMode.WRAP ? 'native' : 'wrapped'
            );
            const targetTokenItem = getBridgeTokenItemFromBridge(
                bridge,
                mode === BridgeMode.WRAP ? 'wrapped' : 'native'
            );

            if (sourceTokenItem)
                sourceTokens.push(sourceTokenItem);

            if (targetTokenItem)
                targetTokens.push(targetTokenItem);
        });

        return [sourceTokens, targetTokens];
    }, [mode, bridgeList]);


    // UI
    const [sourceTokenItem, setSourceTokenItem] = useState(sourceTokenList[0]);
    const [targetTokenItem, setTargetTokenItem] = useState(targetTokenList[0]);
    const [isAmountValid, setAmountValid] = useState(false);

    // Inputs
    const [amountInput, setAmountInput] = useState('0');
    const amount = amountInput && sourceTokenItem
        ? formatAmountInput(amountInput, sourceTokenItem?.token.divisibility)
        : '0';

    // Bridge
    const currentBridge = useMemo(() => bridgeList.find(bridge =>
        (bridge.nativeWalletController.chainName === sourceTokenItem?.controller.chainName
            && bridge.wrappedWalletController.chainName === targetTokenItem?.controller.chainName)
        || (bridge.wrappedWalletController.chainName === sourceTokenItem?.controller.chainName
            && bridge.nativeWalletController.chainName === targetTokenItem?.controller.chainName)
    ), [sourceTokenItem, targetTokenItem]);

    // Estimation
    const [fetchEstimation, isEstimationFetching, estimation] = useDataManager(
        () => currentBridge.estimateRequest(mode, amount),
        null,
        handleError,
        { shouldClearDataOnCall: true }
    );
    const fetchEstimationSafely = useDebounce(fetchEstimation, 500);

    // Create transaction
    const createTransaction = async () => {
        const sourceController = sourceTokenItem?.controller;
        const targetController = targetTokenItem?.controller;

        const transactionData = {
            bridgeId: currentBridge.id,
            recipientAddress: targetController.currentAccount.address,
            amount
        };
        const transaction = await sourceController.modules.bridge.createTransaction(transactionData);

        return transaction;
    };

    // Calculate transaction fees
    const speed = 'medium';
    const transactionFeesManager = useTransactionFees(createTransaction, sourceTokenItem?.controller);
    const transactionFees = transactionFeesManager.data;
    const transactionFeeAmount = transactionFees?.[0]?.[speed] 
        ? transactionFees[0][speed].token.amount 
        : '0';
    const calculateTransactionFeesSafely = useDebounce(transactionFeesManager.load, 500);

    const getTransactionPreviewTable = transaction => {
        return {
            signerAddress: transaction.signerAddress,
            recipientAddress: transaction.message.text,
            mosaics: transaction.mosaics || transaction.tokens,
            fee: transaction.fee,
        }
    }

    // History
    const [fetchHistory, isHistoryFetching, history] = useDataManager(
        () => currentBridge.fetchRecentHistory(5),
        [],
        handleError
    );
    const refreshBalances = async () => {
        await Promise.all([
            sourceTokenItem?.controller.fetchAccountInfo(),
            targetTokenItem?.controller.fetchAccountInfo(),
        ]);
    };

    // Handlers
    const reverseTokens = () => {
        const oldSource = sourceTokenItem;
        setSourceTokenItem(targetTokenItem);
        setTargetTokenItem(oldSource);
        setMode(mode === BridgeMode.WRAP ? BridgeMode.UNWRAP : BridgeMode.WRAP);
        setAmountInput('0');
    };
    const getAvailableBalance = () => sourceTokenItem ? sourceTokenItem.token.amount : '0';
    const handleTransactionSendComplete = () => {
        setAmountInput('0');
    }

    const isLoading = !sourceTokenItem || !targetTokenItem;
    const isButtonDisabled = !isAmountValid || !!estimation?.error || amount === '0' || isEstimationFetching || !estimation;

    useEffect(() => {
        if (sourceTokenItem && targetTokenItem && currentBridge?.isReady && !bridgeManager.isLoading) {
            fetchHistory();
            refreshBalances();
        }
    }, [
        bridgeManager.isLoading,
        targetTokenItem?.token.id,
        sourceTokenItem?.token.id,
        currentBridge?.isReady,
        currentBridge?.nativeWalletController.networkProperties.chainHeight,
        currentBridge?.wrappedWalletController.networkProperties.chainHeight
    ]);

    useEffect(() => {
        if (currentBridge?.isReady && !bridgeManager.isLoading) {
            fetchEstimationSafely();
            calculateTransactionFeesSafely();
        }
    }, [mode, amount, targetTokenItem?.token.id, sourceTokenItem?.token.id], currentBridge?.isReady, bridgeManager.isLoading);

    return (
        <TransactionSendScreen
            isSendButtonDisabled={isButtonDisabled}
            isLoading={isLoading}
            createTransaction={createTransaction}
            getConfirmationPreview={getTransactionPreviewTable}
            onComplete={handleTransactionSendComplete}
            walletController={sourceTokenItem?.controller}
            isCustomSendButtonUsed={true}
            confirmDialogTitle="Swap tokens?"
            confirmDialogText={`You are about to swap ${sourceTokenItem?.token.name} to ${targetTokenItem?.token.name}`}
            transactionFeeTiers={transactionFees}
            transactionFeeTierLevel={'medium'}
        >
            {(buttonProps) => (<>
                <FormItem>
                    <StyledText type="title">{$t('s_bridge_title')}</StyledText>
                    <StyledText type="body">{$t('s_bridge_description')}</StyledText>
                </FormItem>
                {!isLoading && (
                    <BridgeTokenSelector
                        sourceTokenItem={sourceTokenItem}
                        targetTokenItem={targetTokenItem}
                        onReversePress={reverseTokens}
                    />
                )}
                <FormItem>
                    <InputAmount
                        title={$t('form_transfer_input_amount')}
                        availableBalance={getAvailableBalance()}
                        value={amountInput}
                        extraValidators={[validateEstimation(estimation)]}
                        onChange={setAmountInput}
                        onValidityChange={setAmountValid}
                    />
                </FormItem>
                <BridgeEstimationSummary
                    sendAmount={amount}
                    estimation={estimation}
                    transactionFee={transactionFeeAmount}
                    sourceToken={sourceTokenItem?.token}
                    targetToken={targetTokenItem?.token}
                    sourceNetworkCurrency={sourceTokenItem?.controller.networkProperties.networkCurrency}
                    isLoading={isEstimationFetching}
                />
                <FormItem>
                    <Button {...buttonProps} title={$t('button_send')} />
                </FormItem>
                <FormItem>
                    <StyledText type="title">{$t('s_bridge_history_title')}</StyledText>
                    <StyledText type="body">{$t('s_bridge_history_description')}</StyledText>
                </FormItem>
                {!!currentBridge && (
                    <BridgeHistory
                        history={history}
                        isLoading={isHistoryFetching}
                    />
                )}
            </>)}
        </TransactionSendScreen>
    );
};
