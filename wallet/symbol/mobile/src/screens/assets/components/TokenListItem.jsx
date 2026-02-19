import { Amount, ListItemContainer, StyledText, TokenAvatar } from '@/app/components';
import { $t } from '@/app/localization';
import { Colors, Sizes } from '@/app/styles';
import { blockDurationToDaysLeft, getTokenKnownInfo } from '@/app/utils';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const REMAINING_BLOCK_WARNING_THRESHOLD = 2880;
const ANIMATION_DURATION = 500;
const ANIMATION_DELAY = 1000;
const PROGRESS_HEIGHT = Sizes.Semantic.spacing.xs;
const PROGRESS_WIDTH = Sizes.Semantic.spacing.m * 15;

const ExpirationProgress = ({ endHeight, startHeight, chainHeight, blockGenerationTargetTime }) => {
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
		<View>
			<StyledText type="label" variant="secondary" size="s">
				{statusText}
			</StyledText>
			<View style={styles.progressBarOuter}>
				<Animated.View style={progressBarStyle} />
			</View>
		</View>
	);
};

export const TokenListItem = ({ token, chainName, networkIdentifier, chainHeight, blockGenerationTargetTime }) => {
	// Data resolution
	const resolvedTokenInfo = getTokenKnownInfo(
		chainName,
		networkIdentifier,
		token.id
	);

	// Name
	const name = resolvedTokenInfo.name ?? token.name;
	const { ticker } = resolvedTokenInfo;
	const nameText = !ticker
		? name
		: `${name} • ${ticker}`;

	// Expiration progress
	const isProgressShown = token.endHeight && !token.isUnlimitedDuration;

	return (
		<ListItemContainer cardStyle={styles.root}>
			<TokenAvatar imageId={resolvedTokenInfo.imageId} size="l" />
			<View>
				<StyledText>
					{nameText}
				</StyledText>
				<Amount size="l" value={token.amount} />
				{isProgressShown && (
					<ExpirationProgress
						startHeight={token.startHeight}
						endHeight={token.endHeight}
						chainHeight={chainHeight}
						blockGenerationTargetTime={blockGenerationTargetTime}
					/>
				)}
			</View>
		</ListItemContainer>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m
	},
	progressBarOuter: {
		width: PROGRESS_WIDTH,
		height: PROGRESS_HEIGHT,
		backgroundColor: Colors.Semantic.background.tertiary.darker,
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
		backgroundColor: Colors.Semantic.role.secondary.default
	},
	progress__warning: {
		backgroundColor: Colors.Semantic.role.warning.default
	},
	progress__expired: {
		backgroundColor: Colors.Semantic.role.danger.default
	}
});
