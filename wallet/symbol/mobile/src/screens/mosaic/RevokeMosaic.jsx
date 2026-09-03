import {
	Alert,
	FeeSelector,
	Field,
	InputAmount,
	Spacer,
	Stack,
	StyledText,
	TokenInfoCard,
	TransactionScreenTemplate
} from '@/app/components';
import { useStandardTransactionWorkflow } from '@/app/components/templates/TransactionScreenTemplate/hooks';
import {
	useDebounce,
	useInit,
	useTokenDisplayData,
	useTransactionFees,
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
import { createNoHoldersAlertData, getPaddedSupplyText } from '@/app/screens/mosaic/utils';
import React, { useEffect, useMemo } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').RevokeMosaicRouteParams} RevokeMosaicRouteParams */

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
		ticker,
		currentAccount
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};
	const { mosaicId } = route.params;

	// Transaction sender: the revocation is always sent by the current account
	const senderAddress = currentAccount.address;

	// Mosaic info
	const {
		mosaic,
		isLoading: isMosaicLoading,
		load: loadMosaic,
		reset: resetMosaic
	} = useMosaicInfo({ walletController, mosaicId });
	const mosaicToken = mosaic ? { id: mosaic.id, name: mosaic.names?.[0] } : { id: mosaicId };
	const { name: mosaicName, imageId: mosaicImageId } = useTokenDisplayData(mosaicToken, chainName);

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
		loadMosaic();
		loadOwners();

		if (isSelectedSourceAccountFetchNeeded)
			loadSourceOwner(sourceAddress);
	};
	useWalletRefreshLifecycle({
		walletController,
		onRefresh: loadAll,
		onClear: () => {
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
	const isFormVisible = !!sourceOptions.length;
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
						<StyledText type="title">{$t('screen_RevokeMosaic')}</StyledText>
						<StyledText type="body">{$t('s_revoke_description')}</StyledText>
					</Stack>
					{!!mosaic && (
						<TokenInfoCard name={mosaicName} imageId={mosaicImageId}>
							<Field title={$t('fieldTitle_mosaicId')}>
								<StyledText>{mosaic.id}</StyledText>
							</Field>
							<Field title={$t('fieldTitle_divisibility')}>
								<StyledText>{mosaic.divisibility}</StyledText>
							</Field>
							<Field title={$t('fieldTitle_supply')}>
								<StyledText>{getPaddedSupplyText(mosaic.supply, mosaic.divisibility)}</StyledText>
							</Field>
						</TokenInfoCard>
					)}
					{noHoldersAlert.isVisible && (
						<Alert
							variant={noHoldersAlert.variant}
							body={noHoldersAlert.text}
						/>
					)}
					{isFormVisible && (
						<Stack gap="none">
							<StyledText type="title" size="s">{$t('s_send_from_title')}</StyledText>
							<Stack>
								<InputSourceAccount
									label={$t('fieldTitle_account')}
									value={sourceAddress}
									owners={sourceOptions}
									senderAddress={senderAddress}
									chainName={chainName}
									onChange={changeSourceAddress}
									onValidityChange={changeSourceAddressValidity}
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
