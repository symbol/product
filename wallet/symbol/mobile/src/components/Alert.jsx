import { StyledText } from '@/app/components';
import { borders, colors, spacings } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const createTextColorStyle = (color) => ({ color });
const createBackgroundColorStyle = (color) => ({ backgroundColor: color });

export const Alert = props => {
	const { type, title, body, isIconHidden, inverseColors } = props;
	const statusColors = {
		success: colors.success,
		info: colors.info,
		warning: colors.warning,
		danger: colors.danger,
		main: colors.bgMain,
	}

	const typeAlertMap = {
		success: {
			backgroundColor: createBackgroundColorStyle(inverseColors
				? statusColors.success
				: statusColors.main
			),
			textColor: createTextColorStyle(inverseColors
				? statusColors.main
				: statusColors.success
			),
		},
		info: {
			backgroundColor: createBackgroundColorStyle(inverseColors
				? statusColors.info
				: statusColors.main
			),
			textColor: createTextColorStyle(inverseColors
				? statusColors.main
				: statusColors.info
			),
		},
		warning: {
			icon: require('@/app/assets/images/icon-warning-alert.png'),
			backgroundColor: createBackgroundColorStyle(inverseColors
				? statusColors.warning
				: statusColors.main
			),
			textColor: createTextColorStyle(inverseColors
				? statusColors.main
				: statusColors.warning
			),
		},
		danger: {
			icon: require('@/app/assets/images/icon-danger-alert.png'),
			backgroundColor: createBackgroundColorStyle(inverseColors
				? statusColors.danger
				: statusColors.main
			),
			textColor: createTextColorStyle(inverseColors
				? statusColors.main
				: statusColors.danger
			),
		}
	};

	const alert = typeAlertMap[type];

	return (
		<View style={[styles.widget, alert.backgroundColor]}>
			{!isIconHidden && !!alert.icon && <Image style={styles.icon} source={alert.icon} />}
			{!!title && (
				<StyledText type="subtitle" style={[styles.text, alert.textColor]}>
					{title}
				</StyledText>
			)}
			<StyledText type="body" style={[styles.text, alert.textColor]}>
				{body}
			</StyledText>
		</View>
	);
};

const styles = StyleSheet.create({
	icon: {
		width: 24,
		height: 24
	},
	widget: {
		flexDirection: 'column',
		padding: spacings.margin,
		borderRadius: borders.borderRadiusForm,
		//minHeight: 100,
		alignItems: 'center'
	},
	text: {
		textAlign: 'center'
	},
});
