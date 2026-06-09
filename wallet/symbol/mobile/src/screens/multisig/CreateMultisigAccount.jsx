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
import { generateAccount, validateAddress } from '@/app/utils';
import React, { useEffect, useMemo, useState } from 'react';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */

/** @type {TransactionFeeTierLevel} */
const DEFAULT_TRANSACTION_SPEED = 'medium';

/**
 * CreateMultisigAccount screen component. Provides the interface for creating a new multisig account
 * by generating a random account, adding cosignatories, and configuring approval thresholds.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {object} props.route.params - Route parameters.
 * @param {ChainName} props.route.params.chainName - The blockchain name.
 * @returns {React.ReactNode} CreateMultisigAccount component.
 */
export const CreateMultisigAccount = props => {
	const { chainName } = props.route.params;
	const walletController = useWalletController(chainName);
	const {
		networkIdentifier,
		accounts,
		currentAccount,
		ticker
	} = walletController;
	const walletAccounts = accounts[networkIdentifier];
	const { addressBook } = walletController.modules;

	// New account
	const accountGenerationManager = useAsyncManager({
		callback: async () => {
			const account = generateAccount(chainName, networkIdentifier);
			return account;
		}
	});
	useEffect(() => {
		accountGenerationManager.call();
	}, []);
	const isAccountGenerating = accountGenerationManager.isLoading;
	const multisigAccount = accountGenerationManager.data;
	const regenerateAccount =  accountGenerationManager.call;

	// Form state
	const defaultCosignatories = useMemo(() => [currentAccount.address], [currentAccount]);
	const {
		minApproval,
		minRemoval,
		cosignatories,
		changeMinApproval,
		changeMinRemoval,
		addCosignatory,
		removeCosignatory,
		reset: resetFlow
	} = useMultisigTransactionState({ cosignatories: defaultCosignatories });

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
		createNewAccountTransaction,
		getTransactionPreviewTable
	} = useMultisigTransaction({
		walletController,
		multisigAccount,
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
	} = useTransactionFees(() => createNewAccountTransaction(), walletController);
	const calculateFeesSafely = useDebounce(fetchFees, 1000);
	useEffect(() => {
		if (multisigAccount && cosignatories.length > 0)
			calculateFeesSafely();
	}, [multisigAccount, cosignatories.length, minApproval, minRemoval]);

	// Derived state
	const cosignatoriesCount = cosignatories.length;
	const isButtonDisabled = isFeesLoading || isAccountGenerating || cosignatoriesCount === 0 || !multisigAccount;

	// Handlers
	const handleTransactionSendComplete = () => {
		resetFlow();
		Router.goToHome();
	};

	return (
		<TransactionScreenTemplate
			isSendButtonDisabled={isButtonDisabled}
			isLoading={false}
			createTransaction={createNewAccountTransaction}
			getConfirmationPreview={getTransactionPreviewTable}
			onComplete={handleTransactionSendComplete}
			walletController={walletController}
			isCustomSendButtonUsed={true}
			confirmDialogTitle={$t('s_multisig_create_dialog_confirm_title')}
			confirmDialogText={$t('s_multisig_create_dialog_confirm_text', {
				address: multisigAccount?.address,
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
									{$t('s_multisig_create_title')}
								</StyledText>
								<StyledText type="body">
									{$t('s_multisig_create_description')}
								</StyledText>
							</Stack>
							{multisigAccount && (
								<MultisigAccountListItem
									address={multisigAccount.address}
									balance="0"
									ticker={ticker}
									walletAccounts={walletAccounts}
									addressBook={addressBook}
									chainName={chainName}
									networkIdentifier={networkIdentifier}
								/>
							)}
							<ButtonPlain
								text={$t('button_regenerateAddress')}
								onPress={regenerateAccount}
								isDisabled={isAccountGenerating}
							/>
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
