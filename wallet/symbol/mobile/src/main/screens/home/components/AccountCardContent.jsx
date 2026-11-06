import {
	Amount,
	CopyButtonContainer,
	DialogBox,
	EditButtonContainer,
	Field,
	Stack,
	StyledText
} from '@/app/components';
import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { getUserCurrencyAmountText, validateAccountName, validateRequired } from '@/app/utils';
import React from 'react';

/** @typedef {import('@/app/types/ColorVariants').InverseColorVariants} InverseColorVariants */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Price').Price} Price */

/**
 * AccountCardContent component. The shared content of the brand account card widgets, displaying
 * the account name with rename, balance with its user currency value, and address with copy.
 * @param {object} props - Component props.
 * @param {string} props.address - Account address to display.
 * @param {string} props.balance - Account balance amount.
 * @param {string} props.name - Account name.
 * @param {Price} props.price - Token price for user currency conversion.
 * @param {string} props.ticker - Currency ticker symbol.
 * @param {NetworkIdentifier} props.networkIdentifier - Network identifier for currency formatting.
 * @param {InverseColorVariants} [props.textColorVariant='default'] - Text color variant. 'inverse' is for a frame
 * whose background needs the inverse text color.
 * @param {function(string): void} props.onNameChange - Callback when account name is changed.
 * @returns {React.ReactNode} AccountCardContent component.
 */
export const AccountCardContent = props => {
	const {
		address,
		balance,
		name,
		price,
		ticker,
		networkIdentifier,
		textColorVariant = 'default',
		onNameChange
	} = props;

	// State
	const [isNameEditShown, toggleNameEdit] = useToggle(false);

	// Validation
	const nameValidators = [validateRequired(), validateAccountName()];

	const userCurrencyBalanceText = getUserCurrencyAmountText(balance, price, networkIdentifier);
	const isInverse = textColorVariant === 'inverse';

	// Handlers
	const handleNameChange = newName => {
		toggleNameEdit();
		onNameChange(newName);
	};

	return (
		<>
			<Stack>
				<Field title={$t('fieldTitle_account')} inverse={isInverse}>
					<EditButtonContainer inverse={isInverse} onEditPress={toggleNameEdit}>
						<StyledText type="title" inverse={isInverse}>
							{name}
						</StyledText>
					</EditButtonContainer>
				</Field>
				<Field title={$t('fieldTitle_balance')} inverse={isInverse}>
					<Amount
						value={balance}
						ticker={ticker}
						size="l"
						inverse={isInverse}
					/>
					{!!userCurrencyBalanceText && (
						<StyledText inverse={isInverse}>
							{userCurrencyBalanceText}
						</StyledText>
					)}
				</Field>
				<Field title={$t('fieldTitle_address')} inverse={isInverse}>
					<CopyButtonContainer value={address} inverse={isInverse}>
						<StyledText inverse={isInverse}>{address}</StyledText>
					</CopyButtonContainer>
				</Field>
			</Stack>
			<DialogBox
				type="prompt"
				title={$t('screen_home_dialog_renameAccount_title')}
				text={$t('screen_home_dialog_renameAccount_description')}
				promptValidators={nameValidators}
				isVisible={isNameEditShown}
				onSuccess={handleNameChange}
				onCancel={toggleNameEdit}
			/>
		</>
	);
};
