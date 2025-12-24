import { Dropdown } from '@/app/components';
import { colors, fonts, spacings } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const tokenIconMap = {
	'symbol.xym': require('@/app/assets/images/tokens/preview-symbol-xym.png'),
	'ETH': require('@/app/assets/images/tokens/preview-ethereum-eth.png'),
	'default': require('@/app/assets/images/tokens/preview-default.png')
}

export const SelectMosaic = props => {
	const { testID, title, value, list, chainHeight, onChange } = props;

	const availableMosaicList = list.filter(item => item.tokenInfo.endHeight > chainHeight || !item.tokenInfo.duration);

	const getImageSrc = item => tokenIconMap[item.tokenInfo.name] || tokenIconMap.default;

	return (
		<Dropdown
			testID={testID}
			title={title}
			value={value}
			list={availableMosaicList}
			onChange={onChange}
			renderItem={({ item, index }) => (
				<View style={styles.item}>
					<View style={styles.label}>
						<Image source={getImageSrc(item)} style={styles.icon} />
						<Text style={styles.name}>{item.label}</Text>
					</View>
					<Text style={styles.amount}>{availableMosaicList[index].tokenInfo.amount}</Text>
				</View>
			)}
		/>
	);
};

const styles = StyleSheet.create({
	item: {
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	label: {
		flexDirection: 'row',
		alignItems: 'center'
	},
	icon: {
		height: 24,
		width: 24,
		marginRight: spacings.paddingSm
	},
	name: {
		...fonts.body,
		color: colors.textBody
	},
	amount: {
		...fonts.label,
		fontSize: 12,
		color: colors.textBody,
		opacity: 0.7
	}
});
