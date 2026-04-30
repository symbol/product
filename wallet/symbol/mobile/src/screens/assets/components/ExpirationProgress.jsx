import { StyledText } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import { blockDurationToDaysLeft } from '@/app/utils';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const REMAINING_BLOCK_WARNING_THRESHOLD = 2880;
const ANIMATION_DURATION = 500;
const ANIMATION_DELAY = 1000;
const PROGRESS_HEIGHT = Sizes.Semantic.spacing.xs;

/**
 * Props for the ExpirationProgress component.
 * @typedef {object} ExpirationProgressProps
 * @property {number} endHeight - Block height when token expires.
 * @property {number} startHeight - Block height when token was created.
 * @property {number} chainHeight - Current blockchain height.
 * @property {number} blockGenerationTargetTime - Average block generation time in seconds.
 * @property {import('react-native').ViewStyle} [style] - Optional container style.
 */

/**
 * ExpirationProgress component. Displays animated progress bar showing token expiration status
 * with color-coded warning states and remaining time text.
 * @param {ExpirationProgressProps} props - Component props.
 * @returns {React.ReactNode} ExpirationProgress component.
 */
export const ExpirationProgress = ({ endHeight, startHeight, chainHeight, blockGenerationTargetTime, style }) => {
	// Expiration percentage calculation
	const durationBlocks = endHeight - startHeight;
	const elapsedBlocks = chainHeight - startHeight;
	const expirationPercentage = durationBlocks <= 0
		? (chainHeight >= endHeight ? 100 : 0)
		: Math.max(0, Math.min(100, Math.trunc((elapsedBlocks * 100) / durationBlocks)));

	// Color
	const remainedBlocks = endHeight - chainHeight;
	const progressBarColorStyle = remainedBlocks > REMAINING_BLOCK_WARNING_THRESHOLD
		? styles.progress__normal
		: remainedBlocks > 0
			? styles.progress__warning
			: styles.progress__expired;

	// Progress slide animation
	const displayedPercentage = useSharedValue(0);
	const animatedProgressBarStyle = useAnimatedStyle(() => ({
		width: `${displayedPercentage.value}%`
	}));

	const progressBarStyle = [styles.progressBar, progressBarColorStyle, animatedProgressBarStyle];

	useEffect(() => {
		setTimeout(() => {
			displayedPercentage.value = withTiming(expirationPercentage, { duration: ANIMATION_DURATION });
		}, ANIMATION_DELAY);
	}, [expirationPercentage]);

	// Expiration status text
	const statusText = expirationPercentage === 100
		? $t('s_assets_item_expired')
		: $t('s_assets_item_expireIn', { inTime: blockDurationToDaysLeft(remainedBlocks, blockGenerationTargetTime) });

	return (
		<View style={style}>
			<StyledText type="label" variant="secondary" size="s">
				{statusText}
			</StyledText>
			<View style={styles.progressBarOuter}>
				<Animated.View style={progressBarStyle} />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	progressBarOuter: {
		width: '100%',
		height: PROGRESS_HEIGHT,
		backgroundColor: Colors.Components.progress.background,
		overflow: 'hidden',
		borderRadius: Sizes.Semantic.borderRadius.round
	},
	progressBar: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		width: '100%',
		height: '100%'
	},
	progress__normal: {
		backgroundColor: Colors.Components.progress.bar.default
	},
	progress__warning: {
		backgroundColor: Colors.Components.progress.bar.warning
	},
	progress__expired: {
		backgroundColor: Colors.Components.progress.bar.danger
	}
});
