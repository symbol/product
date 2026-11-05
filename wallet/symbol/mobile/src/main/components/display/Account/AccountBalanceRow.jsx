import { IdentityRow } from '../IdentityRow';
import { AccountAvatar, Amount, StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/types/Sizes').SizeVariant} SizeVariant */

/**
 * One amount line of an account balance row.
 * @typedef {object} AccountBalanceAmount
 * @property {string|null} value - The amount value.
 * @property {string} [ticker] - The ticker symbol shown after the value.
 * @property {SizeVariant} [size] - The amount size. Defaults to the row size.
 * @property {boolean} [isColored] - Whether to color the value by its sign.
 */

const DEFAULT_SIZE = 'm';

/**
 * AccountBalanceRow component. Account row with a balance: avatar next to the name, the address and
 * one or more amounts. Size "l" stacks the amounts between the name and the address, showing the
 * address as the title when the name is missing; size "m" aligns the amounts to the bottom right.
 * @param {object} props - Component props.
 * @param {string} props.address - Account address, always shown.
 * @param {string} [props.name] - Resolved account name, shown above the address.
 * @param {string|null} [props.amount] - Account balance. Hidden when nullish.
 * @param {string} [props.ticker] - Currency ticker symbol of the balance.
 * @param {AccountBalanceAmount[]} [props.amounts] - Several amounts rendered one per line, replacing the single balance.
 * @param {string} [props.imageId] - Known account image identifier.
 * @param {React.ReactNode} [props.accessory] - Optional element rendered on the right side of the row.
 * @param {('m'|'l')} [props.size=DEFAULT_SIZE] - Size of the row avatar and amounts; also selects the layout.
 * @returns {React.ReactNode} AccountBalanceRow component.
 */
export const AccountBalanceRow = ({ address, name, amount, ticker, amounts, imageId, accessory, size = DEFAULT_SIZE }) => {
	// Name
	const isNameVisible = !!name;

	// Address
	const addressTextSize = isNameVisible ? 's' : 'm';
	const addressTextNumberOfLines = isNameVisible ? 1 : 2;

	// Amount
	const isAmountProvided = amount !== undefined && amount !== null;
	const amountList = amounts ?? (isAmountProvided ? [{ value: amount, ticker }] : []);
	const isAmountVisible = amountList.length > 0;
	const amountElements = amountList.map((item, index) => (
		<Amount
			key={index}
			value={item.value}
			ticker={item.ticker}
			isColored={item.isColored}
			size={item.size ?? size}
		/>
	));

	return (
		<IdentityRow avatar={<AccountAvatar address={address} imageId={imageId} size={size} />} accessory={accessory}>
			{size === 'l' ? (
				<>
					<StyledText type="title" size="s">
						{name ?? address}
					</StyledText>
					{amountElements}
					<StyledText type="label" size="s">
						{address}
					</StyledText>
				</>
			) : (
				<View style={styles.bodyMedium}>
					<View style={styles.textColumn}>
						{isNameVisible && (
							<StyledText>
								{name}
							</StyledText>
						)}
						<StyledText size={addressTextSize} numberOfLines={addressTextNumberOfLines}>
							{address}
						</StyledText>
					</View>
					{isAmountVisible && (
						<View style={styles.amountColumn}>
							{amountElements}
						</View>
					)}
				</View>
			)}
		</IdentityRow>
	);
};

const styles = StyleSheet.create({
	bodyMedium: {
		flexGrow: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Sizes.Semantic.spacing.l
	},
	textColumn: {
		flexShrink: 1
	},
	amountColumn: {
		alignSelf: 'flex-end',
		alignItems: 'flex-end'
	}
});
