import { DialogBox, Divider, Stack, StyledText, TableView } from '@/app/components';
import { $t } from '@/app/localization';
import React from 'react';
import { ScrollView } from 'react-native-gesture-handler';

/** @typedef {import('../types/ConfirmationDialog').ConfirmationDialogSection} ConfirmationDialogSection */

/**
 * A dialog component for confirming transaction details before submission.
 * Displays a scrollable preview of all confirmation sections with their details rendered in table format.
 * Each section carries its own chain context (address book, accounts, chain name, network identifier),
 * making the dialog multi-chain aware.
 * @param {object} props - Component props.
 * @param {boolean} props.isVisible - Controls the visibility of the confirmation dialog.
 * @param {string} [props.title] - Custom dialog title, defaults to localized transfer confirmation title.
 * @param {string} [props.text] - Optional descriptive text displayed below the title.
 * @param {ConfirmationDialogSection[]} props.sections - Ordered array of confirmation sections to preview.
 * @param {function(): void} props.onConfirm - Callback invoked when user confirms the transaction.
 * @param {function(): void} props.onCancel - Callback invoked when user cancels the confirmation.
 * @returns {React.ReactNode} Transaction confirmation dialog component.
 */
export const TransactionConfirmationDialog = ({
	isVisible,
	title,
	text,
	sections,
	onConfirm,
	onCancel
}) => {
	const isMultiSection = sections?.length > 1;
	const isFirstDividerShown = !!text;
	const isNextDividerShown = isMultiSection;

	const isDividerShown = index => {
		if (index === 0)
			return isFirstDividerShown;

		return isNextDividerShown;
	};

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
					{isVisible && sections?.map((section, index) => (
						<Stack key={section.id ?? `section_${index}`}>
							{isDividerShown(index) && <Divider />}
							{isMultiSection && section.title ? (
								<StyledText type="title" size="s">
									{section.title}
								</StyledText>
							) : null}
							<TableView
								isTitleTranslatable
								data={section.tableData}
								addressBook={section.addressBook}
								walletAccounts={section.walletAccounts}
								chainName={section.chainName}
								networkIdentifier={section.networkIdentifier}
							/>
						</Stack>
					))}
				</Stack>
			</ScrollView>
		</DialogBox>
	);
};
