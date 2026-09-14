import {
	Button,
	Checkbox,
	Divider,
	FeeSelector,
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
	useValidation,
	useWalletController,
	useWalletRefreshLifecycle
} from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import {
	ExpirationSummaryCard,
	InputDuration,
	MosaicFlagList,
	MosaicPreviewCard,
	SelectDivisibility
} from '@/app/screens/mosaic/components';
import { useCreateMosaicFormState, useMosaicIdentity, useMosaicTransaction } from '@/app/screens/mosaic/hooks';
import {
	getDefaultDurationInputValue,
	parseDurationBlocks,
	validateMosaicDuration,
	validateMosaicSupply
} from '@/app/screens/mosaic/utils';
import { validateRequired } from '@/app/utils';
import React, { useEffect } from 'react';
import Animated, { FadeInDown, FadeInUp, FadeOut, FadeOutUp, withDelay, withTiming } from 'react-native-reanimated';


const ENTERING_ANIMATION_DELAY = 250;
const LAYOUT_ANIMATION_DURATION = 300;
const LAYOUT_ANIMATION_DELAY = 250;

const CustomLayout = values => {
	'worklet';
	const isMovingDown = values.currentOriginY < values.targetOriginY;
	const timingConfig = { duration: LAYOUT_ANIMATION_DURATION };

	return {
		animations: {
			originY: isMovingDown
				? withTiming(values.targetOriginY, timingConfig)
				: withDelay(LAYOUT_ANIMATION_DELAY, withTiming(values.targetOriginY, timingConfig))
		},
		initialValues: {
			originY: values.currentOriginY
		}
	};
};

/**
 * CreateMosaic screen component. Provides the interface for creating a new mosaic
 * on the Symbol network by configuring the divisibility, initial supply, duration and mosaic flags,
 * on behalf of the current account.
 * @returns {React.ReactNode} CreateMosaic component.
 */
export const CreateMosaic = () => {
	const walletController = useWalletController();
	const {
		currentAccount,
		isWalletReady,
		isNetworkConnectionReady,
		networkProperties,
		chainName,
		ticker
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};

	// Transaction sender
	const {
		options: senderOptions,
		value: senderAddress,
		changeValue: changeSenderAddress,
		load: loadSenderOptions,
		reset: resetSenderOptions
	} = useTransactionSender(walletController);
	useWalletRefreshLifecycle({ walletController, onRefresh: loadSenderOptions, onClear: resetSenderOptions });
	useInit(loadSenderOptions, isWalletReady);

	// Form state
	const {
		divisibility,
		supply,
		duration,
		isNeverExpiring,
		flags,
		transactionSpeed,
		changeDivisibility,
		changeSupply,
		changeDuration,
		toggleNeverExpiring,
		toggleFlag,
		changeTransactionSpeed,
		reset: resetForm
	} = useCreateMosaicFormState();

	// Validation
	const supplyErrorMessage = useValidation(supply, [validateRequired(), validateMosaicSupply(divisibility)], $t);
	const durationValidationMessage = useValidation(duration, [validateRequired(), validateMosaicDuration()], $t);
	const durationErrorMessage = isNeverExpiring ? undefined : durationValidationMessage;
	const isFormValid = !supplyErrorMessage && !durationErrorMessage;

	// Mosaic identity. The nonce is generated once so the derived mosaic id stays stable across the create flow.
	const { nonce, mosaicId, regenerate: regenerateMosaicIdentity } = useMosaicIdentity(currentAccount.address);

	// Transaction creation and preview
	const { createMosaicTransaction, getConfirmationPreview } = useMosaicTransaction({
		walletController,
		nonce,
		supply,
		divisibility,
		duration,
		isNeverExpiring,
		flags
	});

	// Transaction fees
	const {
		data: transactionFees,
		isLoading: isFeesLoading,
		call: fetchFees
	} = useTransactionFees(createMosaicTransaction, walletController);
	const calculateFeesSafely = useDebounce(fetchFees, 1000);
	useEffect(() => {
		if (isWalletReady && isFormValid)
			calculateFeesSafely();
	}, [isWalletReady, isFormValid, divisibility, supply, duration, isNeverExpiring, flags]);

	// Derived state
	const blockGenerationTargetTime = networkProperties?.blockGenerationTargetTime;
	const isButtonDisabled = !isNetworkConnectionReady
		|| !isFormValid
		|| isFeesLoading
		|| !transactionFees;

	// Handlers
	const handleExpiryToggle = isExpiring => {
		toggleNeverExpiring();

		// Marking the mosaic as expiring with no value yet pre-fills a safe one-year lifetime.
		if (isExpiring && parseDurationBlocks(duration) === null)
			changeDuration(getDefaultDurationInputValue(blockGenerationTargetTime));
	};

	const handleTransactionSendComplete = () => {
		resetForm();
		regenerateMosaicIdentity();
		Router.goToHome();
	};

	// Transaction Workflow
	const workflow = useStandardTransactionWorkflow({
		createTransaction: createMosaicTransaction,
		walletController,
		transactionFeeTiers: transactionFees,
		transactionFeeTierLevel: transactionSpeed
	});

	return (
		<TransactionScreenTemplate
			isLoading={!isWalletReady}
			isSendButtonDisabled={isButtonDisabled}
			isMultisigAccount={currentAccountInfo.isMultisig}
			accountCosignatories={currentAccountInfo.cosignatories}
			getConfirmationPreview={getConfirmationPreview}
			onComplete={handleTransactionSendComplete}
			walletController={walletController}
			workflow={workflow}
			isCustomSendButtonUsed={true}
			confirmDialogTitle={$t('screen_mosaic_create_dialog_confirm_title')}
			confirmDialogText={$t('screen_mosaic_create_dialog_confirm_description', { supply, divisibility })}
		>
			{buttonProps => (
				<Spacer bottom="l">
					<Stack gap="l">
						{/* Title and description */}
						<Stack gap="none">
							<StyledText type="title">
								{$t('screen_mosaic_title_mosaic')}
							</StyledText>
							<StyledText type="body">
								{$t('screen_mosaic_description_mosaic')}
							</StyledText>
						</Stack>

						{/* Creator section */}
						<Stack gap="none">
							<StyledText type="title" size="s">
								{$t('screen_mosaic_title_sender')}
							</StyledText>
							<SelectTransactionSender
								value={senderAddress}
								options={senderOptions}
								chainName={chainName}
								isMultisigDisabled
								onChange={changeSenderAddress}
							/>
						</Stack>

						<Divider />

						{/* Quantity section */}
						<Stack gap="s">
							<Stack gap="none">
								<StyledText type="title" size="m">
									{$t('screen_mosaic_title_quantity')}
								</StyledText>
								<StyledText>
									{$t('screen_mosaic_description_quantity')}
								</StyledText>
							</Stack>
							<Stack gap="m">
								<MosaicPreviewCard
									supply={supply}
									divisibility={divisibility}
									mosaicId={mosaicId}
								/>
								<SelectDivisibility
									value={divisibility}
									onChange={changeDivisibility}
								/>
								<TextBox
									label={$t('screen_mosaic_label_totalSupply')}
									keyboardType="decimal-pad"
									errorMessage={supplyErrorMessage}
									value={supply}
									onChange={changeSupply}
								/>
							</Stack>
						</Stack>

						<Divider />

						{/* Duration section */}
						<Stack gap="l">
							<Stack gap="none">
								<StyledText type="title" size="m">
									{$t('screen_mosaic_title_duration')}
								</StyledText>
								<StyledText type="body">
									{$t('screen_mosaic_description_duration')}
								</StyledText>
							</Stack>
							<Checkbox
								text={$t('screen_mosaic_checkbox_expires')}
								value={!isNeverExpiring}
								onChange={handleExpiryToggle}
							/>
							<ExpirationSummaryCard
								duration={duration}
								blockGenerationTargetTime={blockGenerationTargetTime}
								isNeverExpiring={isNeverExpiring}
							/>
							{!isNeverExpiring && (
								<Animated.View
									entering={FadeInUp.delay(ENTERING_ANIMATION_DELAY)}
									exiting={FadeOutUp}
								>
									<InputDuration
										duration={duration}
										blockGenerationTargetTime={blockGenerationTargetTime}
										errorMessage={durationErrorMessage}
										onDurationChange={changeDuration}
									/>
								</Animated.View>
							)}
						</Stack>

						{/* Flags section */}
						<Animated.View layout={CustomLayout}>
							<Stack gap="l">
								<Divider />
								<Stack gap="s">
									<StyledText type="title" size="m">
										{$t('screen_mosaic_title_flags')}
									</StyledText>
									<MosaicFlagList
										flags={flags}
										onFlagToggle={toggleFlag}
									/>
								</Stack>
							</Stack>
						</Animated.View>

						{/* Fee selector */}
						{!!transactionFees && (
							<Animated.View entering={FadeInDown} exiting={FadeOut}>
								<FeeSelector
									title={$t('fieldTitle_transactionFee')}
									feeTiers={transactionFees}
									value={transactionSpeed}
									ticker={ticker}
									onChange={changeTransactionSpeed}
								/>
							</Animated.View>
						)}

						<Button {...buttonProps} />
					</Stack>
				</Spacer>
			)}
		</TransactionScreenTemplate>
	);
};
