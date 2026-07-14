import {
	FeeSelector,
	InputAmount,
	SelectToken,
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
	useTransactionFees,
	useTransactionSender,
	useWalletController,
	useWalletRefreshLifecycle
} from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { SelectSourceAccount } from '@/app/screens/mosaic/components';
import { useMosaicInfo, useMosaicOwners, useRevokeMosaicFormState, useRevokeMosaicTransaction } from '@/app/screens/mosaic/hooks';
import React, { useEffect, useMemo } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').RevokeMosaicRouteParams} RevokeMosaicRouteParams */
/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * RevokeMosaic screen component. Provides the interface for reclaiming a revokable mosaic from a holder
 * account back to its creator on the Symbol network, on behalf of the current account or one of its
 * multisig accounts.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {RevokeMosaicRouteParams} props.route.params - Route parameters.
 * @returns {React.ReactNode} RevokeMosaic component.
 */
export const RevokeMosaic = props => {
	const { route } = props;
	const walletController = useWalletController(route.params?.chainName);
	const {
		accounts,
		isWalletReady,
		isNetworkConnectionReady,
		networkIdentifier,
		chainName,
		ticker
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};
	const walletAccounts = accounts[networkIdentifier];
	const { tokenId } = route.params;

	// Sender selection (creator; current or multisig)
	const {
		options: senderOptions,
		value: senderAddress,
		changeValue: changeSenderAddress,
		selectedAccount,
		load: loadSenderOptions,
		reset: resetSenderOptions
	} = useTransactionSender(walletController, { initialAddress: route.params?.senderAddress });

	// Mosaic info
	const {
		mosaic,
		isLoading: isMosaicLoading,
		load: loadMosaic,
		reset: resetMosaic
	} = useMosaicInfo({ walletController, tokenId });

	// Mosaic holders
	const {
		owners,
		isLoading: isOwnersLoading,
		load: loadOwners,
		reset: resetOwners
	} = useMosaicOwners({ walletController, tokenId });

	useWalletRefreshLifecycle({
		walletController,
		onRefresh: () => {
			loadSenderOptions();
			loadMosaic();
			loadOwners();
		},
		onClear: () => {
			resetSenderOptions();
			resetMosaic();
			resetOwners();
		}
	});
	useInit(loadSenderOptions, isWalletReady);
	useInit(loadMosaic, isWalletReady);
	useInit(loadOwners, isWalletReady);

	// Form state
	const {
		sourceAddress,
		amount,
		transactionSpeed,
		isAmountValid,
		changeSourceAddress,
		changeAmount,
		changeTransactionSpeed,
		changeAmountValidity
	} = useRevokeMosaicFormState({ routeParams: route.params });

	// Holders excluding the sender. Revoking from the creator itself is not a valid revocation
	const sourceOptions = useMemo(
		() => owners.filter(owner => owner.address !== senderAddress),
		[owners, senderAddress]
	);
	const selectedOwner = sourceOptions.find(owner => owner.address === sourceAddress);
	const availableBalance = selectedOwner?.amount ?? '0';

	// The token is fixed to the mosaic the screen was opened for
	/** @type {Token[]} */
	const tokens = useMemo(() => {
		if (!mosaic)
			return [];

		return [{
			id: mosaic.id,
			name: mosaic.names?.[0] || mosaic.id,
			amount: availableBalance,
			divisibility: mosaic.divisibility
		}];
	}, [mosaic, availableBalance]);

	// Transaction creation and preview
	const { createRevokeMosaicTransaction, getConfirmationPreview } = useRevokeMosaicTransaction({
		walletController,
		senderPublicKey: selectedAccount?.publicKey,
		mosaicId: tokenId,
		divisibility: mosaic?.divisibility,
		amount,
		sourceAddress
	});

	// Transaction fees
	const {
		data: transactionFees,
		isLoading: isFeesLoading,
		call: fetchFees
	} = useTransactionFees(createRevokeMosaicTransaction, walletController);
	const calculateFeesSafely = useDebounce(fetchFees, 1000);
	useEffect(() => {
		if (isWalletReady && mosaic && isAmountValid && sourceAddress)
			calculateFeesSafely();
	}, [isWalletReady, mosaic, isAmountValid, sourceAddress, amount, selectedAccount?.publicKey]);

	// Transaction workflow
	const workflow = useStandardTransactionWorkflow({
		createTransaction: createRevokeMosaicTransaction,
		walletController,
		transactionFeeTiers: transactionFees,
		transactionFeeTierLevel: transactionSpeed
	});

	// Derived state
	const isLoading = !isWalletReady || isMosaicLoading || isOwnersLoading;
	const isButtonDisabled = !isNetworkConnectionReady
		|| !sourceAddress
		|| !isAmountValid
		|| !transactionFees
		|| isFeesLoading
		|| !selectedAccount?.publicKey;

	return (
		<TransactionScreenTemplate
			isLoading={isLoading}
			isSendButtonDisabled={isButtonDisabled}
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
						<StyledText type="title">{$t('screen_RevokeMosaic')}</StyledText>
						<StyledText type="body">{$t('s_revoke_description')}</StyledText>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_mosaicCreation_sender_title')}</StyledText>
						<SelectTransactionSender
							value={senderAddress}
							options={senderOptions}
							ticker={ticker}
							chainName={chainName}
							networkIdentifier={networkIdentifier}
							walletAccounts={walletAccounts}
							addressBook={walletController.modules.addressBook}
							onChange={changeSenderAddress}
						/>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_send_from_title')}</StyledText>
						<SelectSourceAccount
							label={$t('fieldTitle_account')}
							value={sourceAddress}
							owners={sourceOptions}
							chainName={chainName}
							networkIdentifier={networkIdentifier}
							walletAccounts={walletAccounts}
							addressBook={walletController.modules.addressBook}
							onChange={changeSourceAddress}
						/>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_send_token_title')}</StyledText>
						<Stack gap="s">
							<SelectToken
								label={$t('input_mosaic')}
								value={mosaic?.id}
								tokens={tokens}
								chainName={chainName}
								networkIdentifier={networkIdentifier}
								isDisabled
								onChange={() => {}}
							/>
							<InputAmount
								label={$t('input_amount')}
								availableBalance={availableBalance}
								networkIdentifier={networkIdentifier}
								value={amount}
								onChange={changeAmount}
								onValidityChange={changeAmountValidity}
							/>
						</Stack>
					</Stack>
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
