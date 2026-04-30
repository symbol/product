import { AccountView, Amount } from '@/app/components';
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
				<View key={item.account.address} style={styles.item}>
					<AccountView
						address={item.account.address}
						name={item.account.name}
						size="m"
					/>
					<View style={styles.amountListContainer}>
						{item.amounts.map(amount => (
							<Amount
								key={amount.label}
								value={amount.amountText}
								ticker={amount.label}
								isColored
								size={amount.size}
							/>
						))}
					</View>
				</View>
			))}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		gap: Sizes.Semantic.layoutSpacing.m,
		width: '100%'
	},
	item: {
		flexDirection: 'row',
		width: '100%',
		justifyContent: 'space-between',
		gap: Sizes.Semantic.layoutSpacing.s
	},
	amountListContainer: {
		alignItems: 'flex-end'
	}
}); 
