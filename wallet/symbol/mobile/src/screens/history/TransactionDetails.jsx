import {
	Alert,
	Amount,
	Button,
	ButtonPlain,
	Columns,
	DialogBox,
	Divider,
	ExpandableCard,
	Field,
	PasscodeView,
	Screen,
	Spacer,
	Stack,
	StatusRow,
	StyledText,
	TableView
} from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { $t } from '@/app/localization';
import { AmountBreakdown, TransactionGraphic } from '@/app/screens/history/components';
import { DB_UPDATE_LATENCY_AFTER_ANNOUNCE } from '@/app/screens/history/constants';
import { useCosignFlow, useLiveTransactionInfo } from '@/app/screens/history/hooks';
import { CosignStatus } from '@/app/screens/history/types/Cosignature';
import {
	createAmountBreakdownDisplayData,
	createCosignAlertData,
	createSafetyWarningAlertData,
	createTransactionBaseTableData,
	createdCardListData,
	getTransactionCosignStatus,
	getTransactionDateText,
	getTransactionStatus,
	getTransactionTypeText,
	isTransactionDangerous
} from '@/app/screens/history/utils';
import { createExplorerTransactionUrl } from '@/app/utils';
import React from 'react';


/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

/**
 * TransactionDetails screen component. Displays a selected transaction with its
 * details, date, current status, and cosignature actions when the transaction
 * requires the active account to co-sign.
 * @param {object} props - Component props.
 * @param {object} props.route - React Navigation route object.
 * @param {object} props.route.params - Route parameters.
 * @param {ChainName} props.route.params.chainName - Chain name (e.g., 'symbol').
 * @param {Transaction} props.route.params.transaction - Transaction to display.
 * @param {string} props.route.params.group - Transaction group (e.g., 'confirmed', 'unconfirmed').
 * @returns {import('react').ReactNode} TransactionDetails component.
 */
export const TransactionDetails = ({ route }) => {
	const { chainName, transaction: preloadedData, group } = route.params;
	const walletController = useWalletController(chainName);
	const { ticker, currentAccount, networkIdentifier, networkProperties, accounts, modules } = walletController;
	const walletAccounts = accounts[networkIdentifier];
	const { addressBook } = modules;

	// Transaction data with live updates
	const transactionFetchManager = useLiveTransactionInfo(walletController, preloadedData, group);
	const { transaction, status } = transactionFetchManager.data;

	// Native currency info
	const nativeCurrencyTokenId = networkProperties?.networkCurrency?.id || networkProperties?.networkCurrency?.mosaicId;

	// Main details
	const transactionTypeText = getTransactionTypeText(transaction, currentAccount);
	const statusDisplayData = getTransactionStatus(status.group);
	const dateText = getTransactionDateText(transaction, status.group);

	// Transaction graphic data
	const cardListDataOptions = {
		chainName,
		networkIdentifier,
		nativeCurrencyTicker: ticker,
		nativeCurrencyTokenId,
		walletAccounts,
		addressBook
	};
	const cardListData = createdCardListData(transaction, cardListDataOptions);

	// Transaction remaining details table data
	const transactionBaseTableData = createTransactionBaseTableData(transaction);

	// Amount Breakdown data
	const amountBreakdownDisplayOptions = {
		chainName,
		networkIdentifier,
		nativeCurrencyTokenId,
		currentAccountAddress: currentAccount?.address,
		walletAccounts,
		addressBook
	};
	const amountBreakdownDisplayData = createAmountBreakdownDisplayData(transaction, amountBreakdownDisplayOptions);

	// Cosignature
	const cosignStatus = getTransactionCosignStatus(transaction, {
		currentAccount,
		addressBook,
		walletAccounts,
		transactionGroup: status.group
	});
	const cosignatueAlert = createCosignAlertData(cosignStatus);
	const isCosignable = cosignStatus === CosignStatus.AWAITING_CURRENT_ACCOUNT;
	const isCosignButtonVisible = isCosignable;
	const isDetailsExpanded = isCosignable;

	// Cosign flow
	const cosignFlow = useCosignFlow({
		transaction,
		walletController,
		onSuccess: () => setTimeout(() => transactionFetchManager.refresh(), DB_UPDATE_LATENCY_AFTER_ANNOUNCE)
	});

	// SafetyWarning
	const isDangerous = isTransactionDangerous(transaction);
	const safetyWarning = createSafetyWarningAlertData(isDangerous, isCosignable);

	// Block explorer
	const explorerUrl = createExplorerTransactionUrl(
		chainName,
		networkIdentifier,
		transaction.hash
	);
	const openBlockExplorer = () => PlatformUtils.openLink(explorerUrl);

	return (
		<Screen refresh={{ onRefresh: transactionFetchManager.refresh }}>
			<Screen.Upper>
				<Spacer>
					<Stack gap="xl">
						<Stack>
							<StyledText type="title">
								{transactionTypeText}
							</StyledText>
							<Field title={$t('s_transactionDetails_amount')}>
								<Amount
									value={amountBreakdownDisplayData.currentAccount.amountText}
									ticker={ticker}
									isColored
									size="l"
								/>
							</Field>
							<Columns>
								<Field title={$t('s_transactionDetails_status')}>
									<StatusRow
										variant={statusDisplayData.variant}
										statusText={statusDisplayData.text}
										icon={statusDisplayData.iconName}
									/>
								</Field>
								<Field title={$t('s_transactionDetails_date')}>
									<StyledText>
										{dateText}
									</StyledText>
								</Field>
							</Columns>
							{safetyWarning.isVisible && (
								<Alert
									icon={safetyWarning.icon}
									variant={safetyWarning.variant}
									body={safetyWarning.text}
								/>
							)}
							{cosignatueAlert.isVisible && (
								<Alert
									icon={cosignatueAlert.icon}
									variant={cosignatueAlert.variant}
									body={cosignatueAlert.text}
								/>
							)}
						</Stack>
						<Stack gap="s">
							{cardListData.map((cardData, index) => (
								<ExpandableCard
									key={index}
									isExpanded={isDetailsExpanded}
									collapsibleChildren={
										<Spacer top="none">
											<Stack>
												<Divider inverse />
												<TableView
													data={cardData.table}
													addressBook={addressBook}
													walletAccounts={walletController.accounts}
													chainName={chainName}
													networkIdentifier={networkIdentifier}
													translate={$t}
													isTitleTranslatable
												/>
											</Stack>
										</Spacer>
									}
								>
									<Spacer>
										<TransactionGraphic
											typeText={cardData.graphic.typeText}
											source={cardData.graphic.source}
											target={cardData.graphic.target}
											arrowCaptions={cardData.graphic.arrowCaptions}
										/>
									</Spacer>
								</ExpandableCard>
							))}
						</Stack>
						<TableView
							data={transactionBaseTableData}
							addressBook={addressBook}
							walletAccounts={walletController.accounts}
							chainName={chainName}
							networkIdentifier={networkIdentifier}
							translate={$t}
							isTitleTranslatable
						/>
						{amountBreakdownDisplayData.isBreakdownVisible && (
							<Stack>
								<Divider />
								<StyledText type="title" size="s">
									{$t('s_transactionDetails_amountBreakdown_title')}
								</StyledText>
								<AmountBreakdown breakdown={amountBreakdownDisplayData.breakdown} />
							</Stack>
						)}
						<Divider />
						<Stack>
							{isCosignButtonVisible && (
								<Button
									text={$t('button_signAndApprove')}
									onPress={cosignFlow.startCosignFlow}
									isDisabled={cosignFlow.isLoading}
								/>
							)}
							<ButtonPlain
								icon="block-explorer"
								text={$t('button_openTransactionInExplorer')}
								onPress={openBlockExplorer}
							/>
						</Stack>
					</Stack>
				</Spacer>
			</Screen.Upper>
			<Screen.Modals>
				<DialogBox
					type="confirm"
					title={$t('s_transactionDetails_cosignDialog_confirm_title')}
					text={$t('s_transactionDetails_cosignDialog_confirm_text')}
					isVisible={cosignFlow.confirmationDialogProps.isVisible}
					onSuccess={cosignFlow.confirmationDialogProps.onConfirm}
					onCancel={cosignFlow.confirmationDialogProps.onCancel}
				/>
				<DialogBox
					type="alert"
					title={$t('s_transactionDetails_cosignDialog_success_title')}
					text={$t('s_transactionDetails_cosignDialog_success_text')}
					isVisible={cosignFlow.successDialogProps.isVisible}
					onSuccess={cosignFlow.successDialogProps.onSuccess}
				/>
				<PasscodeView {...cosignFlow.passcodeProps} />
			</Screen.Modals>
		</Screen>
	);
};
