import { Button } from '@/app/components';
import { $t } from '@/app/localization';
import { borders, colors, fonts, layout, spacings } from '@/app/styles';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export const AccountCardItem = props => {
	const { chainName, isActivated, balance, address, isLoading, ticker, onActivatePress } = props;
	
	const balanceText = balance ? balance : '0';
	const tickerText = ticker ? ticker : '';

	// // Split balance into integer and decimals for styling
	// let integerPart = balanceText;
	// let decimalPart;
	// if (balanceText.includes('.')) {
	// 	const parts = balanceText.split('.');
	// 	integerPart = parts[0] || '0';
	// 	decimalPart = parts[1] || '0';
	// 	// Optional: trim trailing zeros while keeping at least one digit
	// 	if (decimalPart) {
	// 		const trimmed = decimalPart.replace(/0+$/, '');
	// 		decimalPart = trimmed === '' ? '0' : trimmed;
	// 	}
	// }

	return (
		<View style={styles.root} onTouchEnd={e => e.stopPropagation()}>
			{isLoading && <ActivityIndicator color={colors.primary} style={styles.loadingIndicator} />}
			<View style={styles.content}>
				<Text style={styles.textTitle}>{$t('c_accountCard_title_account')}</Text>
				<Text style={styles.textName}>{chainName}</Text>
				<View>
					<Text style={styles.textTitle}>{$t('c_accountCard_title_balance')}</Text>
				</View>
				<Animated.View entering={FadeIn} key={balanceText}>
					<View style={[layout.row, layout.alignEnd]}>
						<Text style={styles.textBalance}>{balanceText}</Text>
						{/* {decimalPart !== undefined && (
							<Text style={styles.textBalanceDecimals}>{`.${decimalPart}`}</Text>
						)} */}
						<Text style={styles.textTicker}>{` ${tickerText}`}</Text>
					</View>
				</Animated.View>
				{isActivated && (
					<>
						<Text style={styles.textTitle}>{$t('c_accountCard_title_address')}</Text>
						<Text style={styles.textAddress}>{address}</Text>
					</>
				)}
				{!isActivated && !isLoading && (
					<View>
						<Button
							isPrimary
							title={$t('button_activateAccount')}
							onPress={onActivatePress}
						/>
					</View>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative',
		width: '100%',
		borderRadius: borders.borderRadiusForm,
		backgroundColor: colors.bgCard,
	},
	loadingIndicator: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		backgroundColor: '#0001'
	},
	content: {
		width: '100%',
		paddingHorizontal: spacings.padding,
		paddingBottom: spacings.padding2
	},
	textTitle: {
		...fonts.label,
		marginTop: spacings.margin,
		opacity: 0.7,
		color: colors.textForm
	},
	textName: {
		...fonts.title,
		color: colors.textForm
	},
	textBalance: {
		...fonts.body,
		fontSize: 36,
		lineHeight: 40,
		color: colors.textForm
	},
	textBalanceDecimals: {
		...fonts.body,
		fontSize: 20,
		lineHeight: 32,
		color: colors.textForm,
		marginLeft: 2
	},
	textTicker: {
		...fonts.body,
		fontSize: 16,
		lineHeight: 28,
		color: colors.textForm,
		marginLeft: 6
	},
	textAddress: {
		...fonts.body,
		color: colors.textForm,
		marginRight: spacings.margin / 2
	},
});

