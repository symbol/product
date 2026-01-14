import { Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

export const SymbolLogo = () => {
	return (
		<Image source={require('@/app/assets/images/logos/symbol-full.png')} style={styles.logo} />
	);
};

const styles = StyleSheet.create({
	logo: {
		width: Sizes.Primitives.spacing1900,
		height: Sizes.Primitives.spacing500,
		resizeMode: 'contain'
	}
});
