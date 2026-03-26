import { Sizes } from '@/app/styles';
import { Image, StyleSheet, View } from 'react-native';

/** @typedef {import('react')} React */

const CONTAINER_HEIGHT = Sizes.Semantic.spacing.m * 20;
const IMAGE_HEIGHT = CONTAINER_HEIGHT * 1;

const sourceMap = {
	'multisig-account': require('@/app/assets/images/art/multisig-chest.png')
};


/**
 * ScreenIllustration component. Displays a full-width decorative illustration image for screen headers.
 *
 * @param {object} props - Component props.
 * @param {string} props.name - Name of the illustration to display.
 *
 * @returns {React.ReactNode} ScreenIllustration component
 */
export const ScreenIllustration = ({ name }) => {
	const source = sourceMap[name];

	if (!source)
		throw new Error(`ScreenIllustration: image source not found for name "${name}".`);

	return (
		<View style={styles.container}>
			<Image 
				source={source} 
				style={styles.image}
				accessibilityLabel={`${name} illustration`}
				testID={`illustration-${name}`} 
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: 'relative',
		width: '100%',
		height: CONTAINER_HEIGHT
	},
	image: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: IMAGE_HEIGHT,
		resizeMode: 'cover',
		opacity: 1
	}
});


//670+270+300
