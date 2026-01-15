import { DialogBox, StyledText, TextBox, TouchableNative } from '@/app/components';
import { useToggle, useValidation } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import { getUserCurrencyAmountText, validateAmount } from '@/app/utils';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * An input component for entering and validating cryptocurrency amounts, featuring real-time
 * price conversion, available balance display, and a max amount selection with confirmation dialog.
 *
 * @param {object} props - Component props.
 * @param {string} props.label - Label for the input field.
 * @param {string} props.value - Current amount input value.
 * @param {import('@/app/types/Price').Price} [props.price] - Token price for currency conversion display.
 * @param {string} [props.networkIdentifier] - Network identifier for price formatting.
 * @param {string} [props.availableBalance] - Available balance to show and set as max.
 * @param {function} props.onChange - Callback when input value changes.
 * @param {function} props.onValidityChange - Callback when validity state changes.
 * @param {Array} [props.extraValidators=[]] - Additional validators to apply.
 */
export const InputAmount = props => {
	const { label, value, price, networkIdentifier, availableBalance, onChange, onValidityChange, extraValidators = [] } = props;
	const [isConfirmVisible, toggleConfirm] = useToggle(false);
	const [priceText, setPriceText] = useState('');

	// Validation
	const errorMessage = useValidation(value, [validateAmount(availableBalance), ...extraValidators], $t);

	useEffect(() => {
		onValidityChange?.(!errorMessage);
	}, [value, errorMessage]);

	// Price text
	useEffect(() => {
		setPriceText(getUserCurrencyAmountText(value, price, networkIdentifier));
	}, [value, price, networkIdentifier]);

	// Handlers
	const handleChange = str => {
		const formattedStr = str
			.replace(/,/g, '.')
			.replace(/[^.\d]/g, '')
			.replace(/^(\d*\.?)|(\d*)\.?/g, '$1$2');

		onChange(formattedStr);
	};
	const handleSetMax = () => {
		handleChange('' + availableBalance);
		toggleConfirm();
	};

	// Available balance
	const isAvailableBalanceShown = availableBalance !== undefined;
	const availableBalanceTextStyle = availableBalance !== '0' ? styles.availableBalanceText : styles.availableBalanceTextError;

	return (
		<View style={styles.root}>
			<TextBox
				label={label}
				keyboardType="decimal-pad"
				placeholder="0"
				errorMessage={errorMessage}
				value={value}
				onChange={handleChange}
				contentRight={
					<View style={styles.contentRight}>
						{!!priceText && (
							<StyledText type="label" style={styles.priceText}>
								{priceText}
							</StyledText>
						)}
						{isAvailableBalanceShown && (
							<TouchableNative
								containerStyle={styles.availableBalanceButton}
								onPress={toggleConfirm}
								disabled={!availableBalance}
							>
								<StyledText type="label" style={availableBalanceTextStyle}>
									{$t('c_inputAmount_label_available')}: {availableBalance}
								</StyledText>
							</TouchableNative>
						)}
					</View>
				}
			/>
			<DialogBox
				type="confirm"
				title={$t('c_inputAmount_confirm_title')}
				text={$t('c_inputAmount_confirm_text', { amount: availableBalance })}
				isVisible={isConfirmVisible}
				onSuccess={handleSetMax}
				onCancel={toggleConfirm}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		position: 'relative'
	},
	contentRight: {
		flexDirection: 'column',
		alignItems: 'flex-end'
	},
	priceText: {
		...Typography.Semantic.label.s,
		color: Colors.Components.control.default.default.label
	},
	availableBalanceButton: {
		borderRadius: Sizes.Semantic.borderRadius.s
	},
	availableBalanceText: {
		...Typography.Semantic.link.s,
		color: Colors.Components.link.default.default.text
	},
	availableBalanceTextError: {
		...Typography.Semantic.link.s,
		color: Colors.Semantic.role.danger.default
	}
});
