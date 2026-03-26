import {
	Alert,
	Button,
	ButtonPlain,
	DialogBox,
	Divider,
	FeeSelector,
	Field,
	FlexContainer,
	InputAddress,
	Spacer,
	Stack,
	StyledText,
	TransactionScreenTemplate
} from '@/app/components';
import { useAsyncManager, useDebounce, useTransactionFees, useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { CosignatoryList, CosignatureCounter, MultisigAccountListItem } from '@/app/screens/multisig/components';
import { useCosignatureInput, useMultisigTransaction, useMultisigTransactionState } from '@/app/screens/multisig/hooks';
import { createCosignatoryInputAlertData } from '@/app/screens/multisig/utils/cosignatory-input-alert';
import { validateAddress } from '@/app/utils';
import React, { useEffect, useState } from 'react';

/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/** @type {TransactionFeeTierLevel} */
const DEFAULT_TRANSACTION_SPEED = 'medium';

/**
 * ModifyMultisigAccount screen component. Provides the interface for modifying an existing multisig account
 * by updating cosignatories and configuring approval thresholds.
 *
 * @param {Object} props - Component props.
 * @param {Object} props.route - React Navigation route object.
 * @param {Object} props.route.params - Route parameters.
 * @param {string} props.route.params.chainName - The blockchain name.
 * @param {string} props.route.params.accountAddress - The address of the multisig account to modify.
 * @returns {React.ReactNode} ModifyMultisigAccount component.
 */
export const ModifyMultisigAccount = props => {
	const { chainName, accountAddress, preloadedData } = props.route.params;
	const walletController = useWalletController(chainName);
	const {
		networkIdentifier,
		accounts,
		currentAccount,
		ticker
	} = walletController;
	const walletAccounts = accounts[networkIdentifier];
	const { addressBook, multisig: multisigModule } = walletController.modules;

	// New account
	// Fetch multisig account data
	const dataManager = useAsyncManager({
		callback: async () => multisigModule.fetchAccountInfo(accountAddress),
		defaultData: preloadedData
	});
	const multisigAccountInfo = dataManager.data;
	useEffect(() => {
		dataManager.call();
	}, []);

	// Form state
	const {
		minApproval,
		minRemoval,
		cosignatories,
		changeMinApproval,
		changeMinRemoval,
		addCosignatory,
		removeCosignatory,
		reset: resetFlow
	} = useMultisigTransactionState(multisigAccountInfo);

	// Cosignatory input dialog
	const {
		cosignatoryInput,
		inputCosignatory,
		isInputDialogVisible,
		openInputDialog,
		closeInputDialog,
		submitInput
	} = useCosignatureInput(addCosignatory);

	// Cosignatory alert
	const cosignatoryAlert = createCosignatoryInputAlertData(cosignatories, currentAccount);

	// Transaction creation and preview
	const {
		createModificationTransaction,
		getTransactionPreviewTable
	} = useMultisigTransaction({
		walletController,
		multisigAccountInfo,
		cosignatories,
		minApproval,
		minRemoval
	});

	// Transaction fees
	const [transactionSpeed, setTransactionSpeed] = useState(DEFAULT_TRANSACTION_SPEED);
	const {
		data: transactionFees,
		isLoading: isFeesLoading,
		call: fetchFees
	} = useTransactionFees(() => createModificationTransaction(), walletController);
	const calculateFeesSafely = useDebounce(fetchFees, 1000);
	useEffect(() => {
		if (multisigAccountInfo && cosignatories.length > 0)
			calculateFeesSafely();
	}, [multisigAccountInfo, cosignatories.length, minApproval, minRemoval]);

	// Derived state
	const cosignatoriesCount = cosignatories.length;
	const isButtonDisabled = isFeesLoading || cosignatoriesCount === 0 || !multisigAccountInfo;

	// Handlers
	const handleTransactionSendComplete = () => {
		resetFlow();
		Router.goToHome();
	};

	return (
		<TransactionScreenTemplate
			isSendButtonDisabled={isButtonDisabled}
			isLoading={dataManager.isLoading}
			createTransaction={createModificationTransaction}
			getConfirmationPreview={getTransactionPreviewTable}
			onComplete={handleTransactionSendComplete}
			walletController={walletController}
			isCustomSendButtonUsed={true}
			confirmDialogTitle={$t('s_multisig_create_dialog_confirm_title')}
			confirmDialogText={$t('s_multisig_create_dialog_confirm_text', {
				address: accountAddress,
				cosignatoriesCount
			})}
			transactionFeeTiers={transactionFees}
			transactionFeeTierLevel={transactionSpeed}
			modals={(
				<DialogBox
					isVisible={isInputDialogVisible}
					title={$t('s_multisig_create_dialog_addCosignatory_title')}
					type="confirm"
					onSuccess={submitInput}
					onCancel={closeInputDialog}
				>
					<Stack>
						<InputAddress
							label={$t('input_address')}
							extraValidators={[validateAddress(chainName)]}
							addressBook={addressBook}
							accounts={walletAccounts}
							value={cosignatoryInput}
							onChange={inputCosignatory}
						/>
					</Stack>
				</DialogBox>
			)}
		>
			{buttonProps => (
				<Spacer bottom="l">
					<Stack gap="l">
						<Stack>
							<Stack gap="none">
								<StyledText type="title">
									{$t('s_multisig_modify_title')}
								</StyledText>
								<StyledText type="body">
									{$t('s_multisig_modify_description')}
								</StyledText>
							</Stack>
							{multisigAccountInfo && (
								<MultisigAccountListItem
									address={multisigAccountInfo.address}
									balance={multisigAccountInfo.balance}
									ticker={ticker}
									walletAccounts={walletAccounts}
									addressBook={addressBook}
									chainName={chainName}
									networkIdentifier={networkIdentifier}
								/>
							)}
						</Stack>

						<Divider />

						<Stack>
							<Stack gap="none">
								<StyledText type="title">
									{$t('s_multisig_cosignatory_title')}
								</StyledText>
								<StyledText type="body">
									{$t('s_multisig_cosignatory_description')}
								</StyledText>
							</Stack>
							{cosignatoryAlert.isVisible && (
								<Alert
									variant={cosignatoryAlert.variant}
									body={cosignatoryAlert.text}
								/>
							)}
							{cosignatoriesCount > 0 && (
								<CosignatoryList
									isEditable
									cosignatories={cosignatories}
									chainName={chainName}
									networkIdentifier={networkIdentifier}
									walletAccounts={walletAccounts}
									addressBook={addressBook}
									onRemove={removeCosignatory}
								/>
							)}
							<FlexContainer center>
								<ButtonPlain
									icon="plus"
									text={$t('button_add')}
									onPress={openInputDialog}
								/>
							</FlexContainer>
						</Stack>

						<Divider />

						<Stack>
							<Stack gap="none">
								<StyledText type="title">
									{$t('s_multisig_approvals_title')}
								</StyledText>
								<StyledText type="body">
									{$t('s_multisig_approvals_description')}
								</StyledText>
							</Stack>
							<Field title={$t('fieldTitle_minApprovals')}>
								<CosignatureCounter
									variant="min-approval"
									value={minApproval}
									total={Math.max(cosignatoriesCount, 1)}
									isEditable
									onChange={changeMinApproval}
								/>
							</Field>
							<Field title={$t('fieldTitle_minRemovals')}>
								<CosignatureCounter
									variant="min-removal"
									value={minRemoval}
									total={Math.max(cosignatoriesCount, 1)}
									isEditable
									onChange={changeMinRemoval}
								/>
							</Field>
						</Stack>

						{transactionFees && (
							<FeeSelector
								title={$t('fieldTitle_transactionFee')}
								feeTiers={transactionFees}
								value={transactionSpeed}
								ticker={ticker}
								onChange={setTransactionSpeed}
							/>
						)}

						<Button {...buttonProps} />
					</Stack>
				</Spacer>
			)}
		</TransactionScreenTemplate>
	);
};
