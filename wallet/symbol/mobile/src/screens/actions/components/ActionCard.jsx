import { Card, StyledText, TouchableNative } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

const CARD_HEIGHT_MULTIPLIER = 35;
const CARD_HEIGHT = Sizes.Semantic.spacing.m * CARD_HEIGHT_MULTIPLIER;
const CARD_BACKGROUND_COLOR = Colors.Semantic.overlay.primary.default;
const IMAGE_HEIGHT_PERCENT = '70%';
const CONTENT_HEIGHT_PERCENT = '50%';
const CONTENT_OVERLAY_OPACITY = 'rgba(0,0,0,0.7)';

/**
 * ActionCard component. Displays a feature card with an image, title, and description.
 * Used in the Actions screen to navigate to various wallet features.
 *
 * @param {object} props - Component props
 * @param {string} props.title - Card title text.
 * @param {string} props.description - Card description text.
 * @param {number} props.imageSource - Image source for the card background.
 * @param {Function} props.onPress - Callback function when the card is pressed.
 *
 * @returns {React.ReactNode} ActionCard component
 */
export const ActionCard = ({ title, description, imageSource, onPress }) => {
	return (
		<Card style={styles.card} color={CARD_BACKGROUND_COLOR}>
			<TouchableNative
				style={styles.touchable}
				containerStyle={styles.touchableContainer}
				colorPressed={Colors.Semantic.overlay.primary.default}
				onPress={onPress}
			>
				<View style={styles.imageContainer}>
					<ImageBackground
						source={imageSource}
						style={styles.image}
						imageStyle={styles.imageInner}
					/>
				</View>
				<View style={styles.content}>
					<StyledText type="title" size="s" style={styles.title}>
						{title}
					</StyledText>
					<StyledText type="body" style={styles.description}>
						{description}
					</StyledText>
				</View>
			</TouchableNative>
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		overflow: 'hidden',
		height: CARD_HEIGHT
	},
	touchable: {
		width: '100%',
		height: '100%'
	},
	touchableContainer: {
		width: '100%',
		height: '100%'
	},
	imageContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: IMAGE_HEIGHT_PERCENT,
		zIndex: 1
	},
	image: {
		width: '100%',
		height: '100%',
		justifyContent: 'flex-end'
	},
	imageInner: {
		width: '100%',
		height: '100%',
		resizeMode: 'cover'
	},
	content: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		width: '100%',
		height: CONTENT_HEIGHT_PERCENT,
		backgroundColor: CONTENT_OVERLAY_OPACITY,
		zIndex: 2,
		padding: Sizes.Semantic.spacing.m
	},
	title: {
		marginBottom: Sizes.Semantic.spacing.xs,
		textAlign: 'center'
	},
	description: {
		textAlign: 'center'
	}
});
