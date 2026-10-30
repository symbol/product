import { Sizes } from '@/app/styles';
import React from 'react';
import { Image, StyleSheet } from 'react-native';

/**
 * AppLogo component. Displays the current brand app logo.
 * @returns {React.ReactNode} AppLogo component.
 */
export const AppLogo = () => {
	return (
		<Image source={require('@/brand/assets/images/logos/app-logo.png')} style={styles.logo} />
	);
};

const styles = StyleSheet.create({
	logo: {
		width: Sizes.Primitives.spacing1900,
		height: Sizes.Primitives.spacing500,
		resizeMode: 'contain'
	}
});
