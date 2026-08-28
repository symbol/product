import { Card, Icon, StyledText, TouchableNative } from '@/app/components';
import { Colors, Sizes } from '@/app/styles';
import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

const CARD_HEIGHT_MULTIPLIER = 35;
const CARD_HEIGHT = Sizes.Semantic.spacing.m * CARD_HEIGHT_MULTIPLIER;
const CARD_BACKGROUND_COLOR = Colors.Semantic.overlay.primary.default;
const IMAGE_HEIGHT_PERCENT = '70%';
const CONTENT_HEIGHT_PERCENT = '50%';
const CONTENT_OVERLAY_OPACITY = 'rgba(0,0,0,0.7)';
const LOCK_ICON_SIZE = 'xl';

/**
 * ActionCard component. Displays a feature card with an image, title, and description.
 * Used in the Actions screen to navigate to various wallet features.
 * @param {object} props - Component props.
 * @param {string} props.title - Card title text.
 * @param {string} props.description - Card description text.
 * @param {number} props.imageSource - Image source for the card background.
 * @param {boolean} [props.isDisabled=false] - Whether the card is disabled. Fades the content and shows a lock icon.
 * @param {function(): void} props.onPress - Callback function when the card is pressed.
 * @returns {React.ReactNode} ActionCard component.
 */
export const ActionCard = ({ title, description, imageSource, isDisabled = false, onPress }) => {
	const imageContainerStyle = [styles.imageContainer, isDisabled && styles.imageContainer__disabled];
	const contentInnerStyle = isDisabled ? styles.contentInner__disabled : null;

	return (
		<Card style={styles.card} color={CARD_BACKGROUND_COLOR}>
			<TouchableNative
				style={styles.touchable}
				containerStyle={styles.touchableContainer}
				colorPressed={Colors.Semantic.overlay.primary.default}
				disabled={isDisabled}
				onPress={onPress}
			>
				<View style={imageContainerStyle}>
					<ImageBackground
						source={imageSource}
						style={styles.image}
						imageStyle={styles.imageInner}
					/>
				</View>
				<View style={styles.content}>
					<View style={contentInnerStyle}>
						<StyledText type="title" size="s" style={styles.title}>
							{title}
						</StyledText>
						<StyledText type="body" style={styles.description}>
							{description}
						</StyledText>
					</View>
				</View>
				{isDisabled && (
					<View style={styles.lockIconContainer}>
						<Icon name="lock" variant="warning" size={LOCK_ICON_SIZE} />
					</View>
				)}
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
	imageContainer__disabled: {
		opacity: 0.5
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
	contentInner__disabled: {
		opacity: 0.3
	},
	lockIconContainer: {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		height: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 3
	},
	title: {
		marginBottom: Sizes.Semantic.spacing.xs,
		textAlign: 'center'
	},
	description: {
		textAlign: 'center'
	}
});
