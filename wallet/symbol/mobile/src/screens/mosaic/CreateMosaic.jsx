import {
	Button,
	Checkbox,
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
import { MosaicFlagList } from '@/app/screens/mosaic/components';
import { useCreateMosaicFormState, useMosaicTransaction } from '@/app/screens/mosaic/hooks';
import {
	calculateMosaicDurationDays,
	validateMosaicDivisibility,
	validateMosaicDuration,
	validateMosaicSupply
} from '@/app/screens/mosaic/utils';
import { validateRequired } from '@/app/utils';
import React, { useEffect } from 'react';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

/**
 * CreateMosaic screen component. Provides the interface for creating a new mosaic (token)
 * on the Symbol network by configuring the divisibility, initial supply, duration and mosaic flags,
 * on behalf of the current account or one of its multisig accounts.
 * @returns {React.ReactNode} CreateMosaic component.
 */
export const CreateMosaic = () => {
	const walletController = useWalletController();
	const {
		isWalletReady,
		isNetworkConnectionReady,
		networkProperties,
		networkIdentifier,
		chainName,
		ticker
	} = walletController;
	const currentAccountInfo = walletController.currentAccountInfo || {};
	const walletAccounts = walletController.accounts[networkIdentifier];

	// Sender selection (current or multisig)
	const {
		options: senderOptions,
		value: senderAddress,
		changeValue: changeSenderAddress,
		selectedAccount,
		isMultisigSelected: isMultisigSender,
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
	const divisibilityErrorMessage = useValidation(divisibility, [validateRequired(), validateMosaicDivisibility()], $t);
	const supplyErrorMessage = useValidation(supply, [validateRequired(), validateMosaicSupply()], $t);
	const durationValidationMessage = useValidation(duration, [validateRequired(), validateMosaicDuration()], $t);
	const durationErrorMessage = isNeverExpiring ? undefined : durationValidationMessage;
	const isFormValid = !divisibilityErrorMessage && !supplyErrorMessage && !durationErrorMessage;

	// When creating from a multisig account, that account is the mosaic creator
	const senderPublicKey = isMultisigSender ? selectedAccount?.publicKey : undefined;

	// Transaction creation and preview
	const { createMosaicTransaction, getConfirmationPreview } = useMosaicTransaction({
		walletController,
		senderPublicKey,
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
	}, [isWalletReady, isFormValid, divisibility, supply, duration, isNeverExpiring, flags, senderPublicKey]);

	// Derived state
	const blockGenerationTargetTime = networkProperties?.blockGenerationTargetTime;
	const isDurationHintVisible = !isNeverExpiring && !durationErrorMessage && !!blockGenerationTargetTime;
	const durationDays = calculateMosaicDurationDays(duration, blockGenerationTargetTime);
	const isButtonDisabled = !isNetworkConnectionReady
		|| !isFormValid
		|| isFeesLoading
		|| !transactionFees;

	// Handlers
	const handleTransactionSendComplete = () => {
		resetForm();
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
			confirmDialogTitle={$t('s_mosaicCreation_confirm_title')}
			confirmDialogText={$t('s_mosaicCreation_confirm_text', { supply, divisibility })}
		>
			{buttonProps => (
				<Spacer bottom="l">
					<Stack gap="l">
						{/* Title and description */}
						<Stack gap="none">
							<StyledText type="title">
								{$t('s_mosaicCreation_mosaic_title')}
							</StyledText>
							<StyledText type="body">
								{$t('s_mosaicCreation_mosaic_description')}
							</StyledText>
						</Stack>

						{/* Creator section */}
						<Stack gap="none">
							<StyledText type="title" size="s">
								{$t('s_mosaicCreation_sender_title')}
							</StyledText>
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

						{/* Divisibility section */}
						<Stack gap="s">
							<Stack gap="none">
								<StyledText type="title" size="s">
									{$t('s_mosaicCreation_divisibility_title')}
								</StyledText>
								<StyledText type="body">
									{$t('s_mosaicCreation_divisibility_description')}
								</StyledText>
							</Stack>
							<TextBox
								label={$t('input_divisibility')}
								keyboardType="number-pad"
								errorMessage={divisibilityErrorMessage}
								value={divisibility}
								onChange={changeDivisibility}
							/>
						</Stack>

						{/* Supply section */}
						<Stack gap="s">
							<Stack gap="none">
								<StyledText type="title" size="s">
									{$t('s_mosaicCreation_supply_title')}
								</StyledText>
								<StyledText type="body">
									{$t('s_mosaicCreation_supply_description')}
								</StyledText>
							</Stack>
							<TextBox
								label={$t('input_supply')}
								keyboardType="number-pad"
								errorMessage={supplyErrorMessage}
								value={supply}
								onChange={changeSupply}
							/>
						</Stack>

						{/* Duration section */}
						<Stack gap="s">
							<Stack gap="none">
								<StyledText type="title" size="s">
									{$t('s_mosaicCreation_duration_title')}
								</StyledText>
								<StyledText type="body">
									{$t('s_mosaicCreation_duration_description')}
								</StyledText>
							</Stack>
							<TextBox
								label={$t('input_duration')}
								keyboardType="number-pad"
								isDisabled={isNeverExpiring}
								errorMessage={durationErrorMessage}
								value={duration}
								onChange={changeDuration}
							/>
							{isDurationHintVisible && (
								<StyledText type="body">
									{$t('s_mosaicCreation_durationDays', { duration: durationDays })}
								</StyledText>
							)}
							<Checkbox
								text={$t('s_mosaicCreation_duration_checkbox')}
								value={isNeverExpiring}
								onChange={toggleNeverExpiring}
							/>
						</Stack>

						{/* Flags sections */}
						<MosaicFlagList
							flags={flags}
							onFlagToggle={toggleFlag}
						/>

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
