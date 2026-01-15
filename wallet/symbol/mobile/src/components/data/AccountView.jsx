import { AccountAvatar, ActionRow, ButtonCopy, StyledText } from '@/app/components';
import { Sizes } from '@/app/styles';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const DEFAULT_SIZE = 'm';

/**
 * Account view component.
 * Displays account avatar, name/address, and copy button.
 * 
 * @param {object} props - Component props
 * @param {string} props.address - Account address
 * @param {string} [props.name] - Optional account name
 * @param {string} [props.imageId] - Known account image identifier
 * @param {string} [props.size=DEFAULT_SIZE] - Size of the avatar
 * @param {boolean} [props.isCopyButtonVisible] - Whether the copy button is shown
 * @param {boolean} [props.isStretched=false] - If true, the component will stretch to fill the available width
 * 
 * @returns {React.ReactNode} Account view component
 */
export const AccountView = ({ address, name, imageId, size = DEFAULT_SIZE, isCopyButtonVisible = true, isStretched = false }) => {
	const rootSizeStyleMap = {
		s: styles.root_small,
		m: styles.root_medium,
		l: styles.root_large
	};
	const rootSizeStyle = rootSizeStyleMap[size];
	const isNameVisible = !!name;
	const isAddressVisible = !isNameVisible || size !== 's';
	const addressTextSize = isNameVisible ? 's' : 'm';

	return (
		<ActionRow
			isStretched={isStretched}
			button={isCopyButtonVisible ? <ButtonCopy content={address} /> : null}
		>
			<View style={[styles.root, rootSizeStyle]}>
				<AccountAvatar
					address={address}
					imageId={imageId}
					size={size}
				/>
				<View>
					{isNameVisible && (
						<StyledText>
							{name}
						</StyledText>
					)}
					{isAddressVisible && (
						<StyledText size={addressTextSize}>
							{address}
						</StyledText>
					)}
				</View>
			</View>
		</ActionRow>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	root_small: {
		gap: Sizes.Semantic.spacing.s
	},
	root_medium: {
		gap: Sizes.Semantic.spacing.m
	},
	root_large: {
		gap: Sizes.Semantic.spacing.m
	}
});
