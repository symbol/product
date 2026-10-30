import { AccountBalanceRow } from '@/app/components';
import { Sizes } from '@/app/styles';
import { StyleSheet, View } from 'react-native';

/** @typedef {import('@/app/screens/history/types/AmountBreakdown').BreakdownDisplayRow} BreakdownDisplayRow */

/**
 * AmountBreakdown component. Displays a breakdown of token amount changes for
 * each account involved in a transaction.
 * @param {object} props - Component props.
 * @param {BreakdownDisplayRow[]} props.breakdown - Array of breakdown rows per account.
 * @returns {import('react').ReactNode} AmountBreakdown component.
 */
export const AmountBreakdown = ({ breakdown }) => {
	return (
		<View style={styles.root}>
			{breakdown.map(item => (
				<AccountBalanceRow
					key={item.account.address}
					address={item.account.address}
					name={item.account.name}
					amounts={item.amounts.map(amountItem => ({
						value: amountItem.amountText,
						ticker: amountItem.label,
						size: amountItem.size,
						isColored: true
					}))}
				/>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		gap: Sizes.Semantic.layoutSpacing.m,
		width: '100%'
	}
});
