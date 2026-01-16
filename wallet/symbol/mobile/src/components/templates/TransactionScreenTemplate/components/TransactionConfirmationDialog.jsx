import { DialogBox, Stack, StyledText, TableView } from '@/app/components';
import { $t } from '@/app/localization';
import { Sizes } from '@/app/styles';
import React from 'react';
import { View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

/** @typedef {import('wallet-common-core/src/lib/models/TransactionBundle').TransactionBundle} TransactionBundle */

/** @typedef {import('wallet-common-core/src/lib/controllers/WalletController').WalletController} WalletController */

/** @typedef {import('@/app/types/Table').TableRow} TableRow */

/** @typedef {import('wallet-common-core/src/types/Transaction').Transaction} Transaction */

/**
 * A dialog component for confirming transaction details before submission.
 * Displays a scrollable preview of all transactions in a bundle with their details rendered in table format.
 * Supports both single transactions and composite bundles with multiple transactions.
 * 
 * @param {object} props - Component props
 * @param {boolean} props.isVisible - Controls the visibility of the confirmation dialog
 * @param {string} [props.title] - Custom dialog title, defaults to localized transfer confirmation title
 * @param {string} [props.text] - Optional descriptive text displayed below the title
 * @param {TransactionBundle|null} props.transactionBundle - The transaction bundle containing transactions to preview
 * @param {function(Transaction): TableRow[]} props.getConfirmationPreview 
 * - Callback function that generates table row data for a transaction preview
 * @param {WalletController} props.walletController - Wallet controller instance providing address book, accounts, and network info
 * @param {function(): void} props.onConfirm - Callback invoked when user confirms the transaction
 * @param {function(): void} props.onCancel - Callback invoked when user cancels the confirmation
 * 
 * @returns {React.ReactNode} Transaction confirmation dialog component
 */
export const TransactionConfirmationDialog = ({
	isVisible,
	title,
	text,
	transactionBundle,
	getConfirmationPreview,
	walletController,
	onConfirm,
	onCancel
}) => {
	const isTransactionCounterShown = transactionBundle?.isComposite;

	return (
		<DialogBox
			type="confirm"
			title={title || $t('form_transfer_confirm_title')}
			text={text}
			isVisible={isVisible}
			onSuccess={onConfirm}
			onCancel={onCancel}
		>
			<ScrollView>
				<Stack>
					{isVisible && transactionBundle?.transactions.map((transaction, index) => (
						<View key={`t_preview_${index}`}>
							{isTransactionCounterShown && (
								<StyledText type="label" style={{ marginTop: Sizes.Semantic.spacing.m }}>
									{$t('form_transfer_transaction_preview_title', { index: index + 1 })}
								</StyledText>
							)}
							<TableView
								isTitleTranslatable
								data={getConfirmationPreview(transaction)}
								addressBook={walletController.modules.addressBook}
								walletAccounts={walletController.accounts}
								chainName={walletController.chainName}
								networkIdentifier={walletController.networkIdentifier}
							/>
						</View>
					))}
				</Stack>
			</ScrollView>
		</DialogBox>
	);
};
