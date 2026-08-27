import {
	Alert,
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
import { InputSourceAccount } from '@/app/screens/mosaic/components';
import {
	useMosaicInfo,
	useMosaicOwner,
	useMosaicOwners,
	useRevokeMosaicFormState,
	useRevokeMosaicTransaction
} from '@/app/screens/mosaic/hooks';
import { createNoHoldersAlertData } from '@/app/screens/mosaic/utils';
import React, { useEffect, useMemo } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').RevokeMosaicRouteParams} RevokeMosaicRouteParams */
/** @typedef {import('@/app/types/Token').Token} Token */

/**
 * RevokeMosaic screen component. Provides the interface for reclaiming a revokable mosaic from a holder
 * account back to its creator on the Symbol network, on behalf of the current account.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {RevokeMosaicRouteParams} props.route.params - Route parameters.
 * @returns {React.ReactNode} RevokeMosaic component.
 */
export const RevokeMosaic = props => {
	const { route } = props;
	const walletController = useWalletController(route.params?.chainName);
	const {
		isWalletReady,
		isNetworkConnectionReady,
		networkIdentifier,
		chainName,
		ticker
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};
	const { mosaicId } = route.params;

	// Transaction sender
	const {
		options: senderOptions,
		value: senderAddress,
		changeValue: changeSenderAddress,
		load: loadSenderOptions,
		reset: resetSenderOptions
	} = useTransactionSender(walletController);

	// Mosaic info
	const {
		mosaic,
		isLoading: isMosaicLoading,
		load: loadMosaic,
		reset: resetMosaic
	} = useMosaicInfo({ walletController, mosaicId });

	// Mosaic holder account list
	const {
		owners,
		isLoading: isOwnersLoading,
		load: loadOwners,
		reset: resetOwners
	} = useMosaicOwners({ walletController, mosaicId });
	const sourceOptions = useMemo(
		() => owners.filter(owner => owner.address !== senderAddress),
		[owners, senderAddress]
	);

	// Manually entered holder account
	const {
		owner: fetchedMosaicOwner,
		isLoading: isIndividualOwnerLoading,
		load: loadSourceOwner,
		reset: resetSourceOwner
	} = useMosaicOwner({ walletController, mosaicId });

	// Form state
	const {
		sourceAddress,
		amount,
		transactionSpeed,
		isSourceAddressValid,
		isAmountValid,
		changeSourceAddress,
		changeAmount,
		changeTransactionSpeed,
		changeSourceAddressValidity,
		changeAmountValidity
	} = useRevokeMosaicFormState({ routeParams: route.params });

	// Resolve mosaic owner info from the fetched owner list or individually fetched for the manually entered address
	const listedMosaicOwner = sourceOptions.find(owner => owner.address === sourceAddress);
	const isFetchedMosaicOwnerFresh = fetchedMosaicOwner?.address === sourceAddress;
	const resolvedMosaicOwner = listedMosaicOwner ?? (isFetchedMosaicOwnerFresh ? fetchedMosaicOwner : null);
	const isSelectedSourceAccountFetchNeeded = isSourceAddressValid && !listedMosaicOwner;

	// Load all data on screen init and refresh
	const loadAll = () => {
		loadSenderOptions();
		loadMosaic();
		loadOwners();

		if (isSelectedSourceAccountFetchNeeded)
			loadSourceOwner(sourceAddress);
	};
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: loadAll,
		onClear: () => {
			resetSenderOptions();
			resetMosaic();
			resetOwners();
			resetSourceOwner();
		}
	});
	useInit(loadAll, isWalletReady);;
	useEffect(() => {
		if (isSelectedSourceAccountFetchNeeded)
			loadSourceOwner(sourceAddress);
		else
			resetSourceOwner();
	}, [sourceAddress, isSelectedSourceAccountFetchNeeded]);

	// Available balance: the held amount of the listed or fetched holder, unknown while the fetch is in flight
	const availableBalance = isIndividualOwnerLoading ? undefined : (resolvedMosaicOwner?.amount ?? '0');

	// The selection is fixed to the mosaic the screen was opened for
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
		mosaicId,
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
		if (isWalletReady && mosaic && isAmountValid && isSourceAddressValid)
			calculateFeesSafely();
	}, [isWalletReady, mosaic, isAmountValid, isSourceAddressValid, sourceAddress, amount]);

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
		|| !isSourceAddressValid
		|| isIndividualOwnerLoading
		|| !isAmountValid
		|| !transactionFees
		|| isFeesLoading;
	// With no holders nobody owns the mosaic, so manual address entry cannot help either
	const isAddressInputDisabled = !sourceOptions.length;

	const noHoldersAlert = createNoHoldersAlertData(sourceOptions.length, isLoading);

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
						<StyledText type="title" size="s">{$t('s_mosaicCreation_sender_title')}</StyledText>
						<SelectTransactionSender
							value={senderAddress}
							options={senderOptions}
							chainName={chainName}
							isMultisigDisabled
							onChange={changeSenderAddress}
						/>
					</Stack>
					<Stack gap="none">
						<StyledText type="title">{$t('screen_RevokeMosaic')}</StyledText>
						<StyledText type="body">{$t('s_revoke_description')}</StyledText>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_send_from_title')}</StyledText>
						<Stack gap="s">
							<InputSourceAccount
								label={$t('fieldTitle_account')}
								value={sourceAddress}
								owners={sourceOptions}
								senderAddress={senderAddress}
								chainName={chainName}
								isDisabled={isAddressInputDisabled}
								onChange={changeSourceAddress}
								onValidityChange={changeSourceAddressValidity}
							/>
							{noHoldersAlert.isVisible && (
								<Alert
									variant={noHoldersAlert.variant}
									body={noHoldersAlert.text}
								/>
							)}
						</Stack>
					</Stack>
					<Stack gap="none">
						<StyledText type="title" size="s">{$t('s_revoke_mosaic_title')}</StyledText>
						<Stack gap="s">
							<SelectToken
								label={$t('input_mosaic')}
								value={mosaic?.id}
								tokens={tokens}
								chainName={chainName}
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
