import {
	Divider,
	FeeSelector,
	Field,
	Spacer,
	Stack,
	StyledText,
	TextBox,
	TokenInfoCard,
	TransactionScreenTemplate
} from '@/app/components';
import { useStandardTransactionWorkflow } from '@/app/components/templates/TransactionScreenTemplate/hooks';
import {
	useDebounce,
	useInit,
	useTokenDisplayData,
	useTransactionFees,
	useValidation,
	useWalletController,
	useWalletRefreshLifecycle
} from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { SupplyDeltaView } from '@/app/screens/mosaic/components';
import { useModifyMosaicFormState, useModifyMosaicTransaction, useMosaicInfo } from '@/app/screens/mosaic/hooks';
import { calculateSupplyDelta, validateMosaicSupply, validateSupplyChanged } from '@/app/screens/mosaic/utils';
import { validateRequired } from '@/app/utils';
import React, { useEffect, useMemo } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

/** @typedef {import('@/app/screens/mosaic/types/Mosaic').ModifyMosaicRouteParams} ModifyMosaicRouteParams */

/**
 * ModifyMosaic screen component. Provides the interface for changing the total supply of an existing
 * supply-mutable mosaic on the Symbol network, on behalf of its creator account.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {ModifyMosaicRouteParams} props.route.params - Route parameters.
 * @returns {React.ReactNode} ModifyMosaic component.
 */
export const ModifyMosaic = props => {
	const { route } = props;
	const walletController = useWalletController(route.params?.chainName);
	const {
		isWalletReady,
		isNetworkConnectionReady,
		chainName,
		ticker
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};
	const { mosaicId } = route.params;

	// Mosaic info
	const {
		mosaic,
		isLoading: isMosaicLoading,
		load: loadMosaic,
		reset: resetMosaic
	} = useMosaicInfo({ walletController, mosaicId });
	const mosaicToken = mosaic ? { id: mosaic.id, name: mosaic.names?.[0] } : { id: mosaicId };
	const { name: mosaicName, imageId: mosaicImageId } = useTokenDisplayData(mosaicToken, chainName);

	// Form state
	const {
		newSupply,
		transactionSpeed,
		changeNewSupply,
		changeTransactionSpeed
	} = useModifyMosaicFormState({ currentSupply: mosaic?.supply });

	// Supply change delta calculation
	const supplyDelta = useMemo(
		() => (mosaic ? calculateSupplyDelta(mosaic.supply, newSupply, mosaic.divisibility) : null),
		[mosaic, newSupply]
	);

	// Validation
	const supplyErrorMessage = useValidation(
		newSupply,
		[
			validateRequired(),
			validateMosaicSupply(mosaic?.divisibility),
			validateSupplyChanged(mosaic?.supply, mosaic?.divisibility)
		],
		$t
	);
	const isFormValid = !!mosaic && !supplyErrorMessage;

	// Transaction creation and preview
	const { createModifyMosaicTransaction, getConfirmationPreview } = useModifyMosaicTransaction({
		walletController,
		mosaicId,
		divisibility: mosaic?.divisibility,
		delta: supplyDelta?.delta,
		action: supplyDelta?.action
	});

	// Transaction fees
	const {
		data: transactionFees,
		isLoading: isFeesLoading,
		call: fetchFees
	} = useTransactionFees(createModifyMosaicTransaction, walletController);
	const calculateFeesSafely = useDebounce(fetchFees, 1000);
	useEffect(() => {
		if (isWalletReady && isFormValid)
			calculateFeesSafely();
	}, [isWalletReady, isFormValid, newSupply]);

	// Transaction workflow
	const workflow = useStandardTransactionWorkflow({
		createTransaction: createModifyMosaicTransaction,
		walletController,
		transactionFeeTiers: transactionFees,
		transactionFeeTierLevel: transactionSpeed
	});

	useWalletRefreshLifecycle({
		walletController,
		onRefresh: loadMosaic,
		onClear: resetMosaic
	});
	useInit(loadMosaic, isWalletReady);

	// Derived state
	const isLoading = !isWalletReady || isMosaicLoading;
	const isButtonDisabled = !isNetworkConnectionReady
		|| !isFormValid
		|| !transactionFees
		|| isFeesLoading;

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
			confirmDialogTitle={$t('s_modifyMosaic_confirm_title')}
			confirmDialogText={$t('s_modifyMosaic_confirm_text', { supply: newSupply })}
		>
			<Spacer>
				<Stack gap="l">
					<Stack gap="none">
						<StyledText type="title">{$t('screen_ModifyMosaic')}</StyledText>
						<StyledText type="body">{$t('s_modifyMosaic_description')}</StyledText>
					</Stack>
					{!!mosaic && (
						<TokenInfoCard name={mosaicName} imageId={mosaicImageId}>
							<Field title={$t('fieldTitle_mosaicId')}>
								<StyledText>{mosaic.id}</StyledText>
							</Field>
							<Field title={$t('fieldTitle_divisibility')}>
								<StyledText>{mosaic.divisibility}</StyledText>
							</Field>
						</TokenInfoCard>
					)}
					<Divider />
					{!!mosaic && (
						<SupplyDeltaView
							divisibility={mosaic.divisibility}
							currentSupply={mosaic.supply}
							newSupply={newSupply}
							delta={supplyDelta.delta}
							action={supplyDelta.action}
						/>
					)}
					<TextBox
						label={$t('s_modifyMosaic_newSupply_label')}
						keyboardType="decimal-pad"
						errorMessage={supplyErrorMessage}
						value={newSupply}
						onChange={changeNewSupply}
					/>
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
