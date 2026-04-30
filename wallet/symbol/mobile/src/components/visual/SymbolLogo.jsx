import { Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * SymbolLogo component. A component displaying the Symbol logo image.
 * @returns {React.ReactNode} SymbolLogo component.
 */
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
