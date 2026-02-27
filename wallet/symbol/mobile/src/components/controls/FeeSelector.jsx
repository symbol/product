/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('wallet-common-core/src/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */

import { useToggle } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Colors, Sizes, Typography } from '@/app/styles';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Slider from 'react-native-smooth-slider';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/**
 * @enum {string}
 */
const FeeTierLevel = {
	SLOW: 'slow',
	MEDIUM: 'medium',
	FAST: 'fast'
};

const SLIDER_MIN_VALUE = 0;
const SLIDER_MAX_VALUE = 2;
const IMAGE_ANIMATION_OFFSET = -500;
const IMAGE_WIDTH = 68;
const THUMB_TOUCH_SIZE = { width: 60, height: 60 };
const SLIDER_MARGIN_TOP = -18;

const IMAGES = [
	require('@/app/assets/images/components/fees-slow.png'),
	require('@/app/assets/images/components/fees-medium.png'),
	require('@/app/assets/images/components/fees-fast.png')
];

const FEE_TIER_LEVELS = [FeeTierLevel.SLOW, FeeTierLevel.MEDIUM, FeeTierLevel.FAST];

/**
 * Creates a fee tier option object.
 * @param {TransactionFeeTierLevel} level - The fee tier level.
 * @param {string} value - The fee amount value.
 * @returns {{ label: string, speed: TransactionFeeTierLevel, value: string }} The fee tier option.
 */
const createFeeTierOption = (level, value) => ({
	label: $t(`selector_fee_${level}`),
	speed: level,
	value
});

/**
 * FeeSelector component. A component for selecting transaction fee levels among slow, medium, and fast
 * options using a slider interface, featuring animated visual feedback.
 *
 * @param {object} props - Component props
 * @param {object} [props.style] - Additional styles for the component container.
 * @param {string} props.title - The title label displayed above the fee selector.
 * @param {TransactionFeeTiers | TransactionFeeTiers[]} props.feeTiers - The fee tiers configuration.
 * @param {TransactionFeeTierLevel} props.value - The currently selected fee tier level.
 * @param {string} props.ticker - The ticker symbol for the fee currency.
 * @param {function} props.onChange - Function to call when the selected fee tier changes.
 *
 * @returns {React.ReactNode} FeeSelector component
 */
export const FeeSelector = ({ style, title, feeTiers, value, ticker, onChange }) => {
	// State
	const [sliderKey, refreshSlider] = useToggle(true);
	const imageTranslation = useSharedValue(0);

	// Fee options
	const options = useMemo(() => {
		if (!Array.isArray(feeTiers)) {
			return [
				createFeeTierOption(FeeTierLevel.SLOW, feeTiers.slow.token.amount),
				createFeeTierOption(FeeTierLevel.MEDIUM, feeTiers.medium.token.amount),
				createFeeTierOption(FeeTierLevel.FAST, feeTiers.fast.token.amount)
			];
		}

		const divisibility = feeTiers[0]?.slow.token.divisibility || 0;
		const sumAmounts = (amount1, amount2) =>
			safeOperationWithRelativeAmounts(
				divisibility,
				[amount1, amount2],
				(absoluteAmount1, absoluteAmount2) => absoluteAmount1 + absoluteAmount2
			);

		return feeTiers.reduce(
			(acc, tier) => [
				createFeeTierOption(FeeTierLevel.SLOW, sumAmounts(tier.slow.token.amount, acc[0].value)),
				createFeeTierOption(FeeTierLevel.MEDIUM, sumAmounts(tier.medium.token.amount, acc[1].value)),
				createFeeTierOption(FeeTierLevel.FAST, sumAmounts(tier.fast.token.amount, acc[2].value))
			],
			[
				createFeeTierOption(FeeTierLevel.SLOW, '0'),
				createFeeTierOption(FeeTierLevel.MEDIUM, '0'),
				createFeeTierOption(FeeTierLevel.FAST, '0')
			]
		);
	}, [feeTiers]);

	// Derived values
	const sliderValue = FEE_TIER_LEVELS.indexOf(value);
	const imageSrc = IMAGES[sliderValue];
	const selectedFeeValue = options[sliderValue].value;
	const selectedFeeLabel = options[sliderValue].label;
	const valueField = `${selectedFeeLabel} | ${selectedFeeValue} ${ticker}`;

	// Animations
	const animatedImageStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: imageTranslation.value }]
	}));

	// Handlers
	const handleChange = newValue => {
		const newSliderValue = Math.round(newValue);
		onChange(options[newSliderValue]?.speed || FeeTierLevel.MEDIUM);

		if (newSliderValue !== sliderValue) {
			imageTranslation.value = IMAGE_ANIMATION_OFFSET;
			imageTranslation.value = withTiming(0);
		}
	};

	const handleSlidingComplete = () => {
		refreshSlider();
	};

	return (
		<View style={[styles.root, style]}>
			<View style={styles.inputContainer}>
				<Animated.Image source={imageSrc} style={[styles.image, animatedImageStyle]} />
				<Text style={styles.label}>{title}</Text>
				<Text style={styles.value}>{valueField}</Text>
			</View>
			<Slider
				key={sliderKey}
				value={sliderValue}
				minimumValue={SLIDER_MIN_VALUE}
				maximumValue={SLIDER_MAX_VALUE}
				minimumTrackTintColor={Colors.Primitives.transparent}
				maximumTrackTintColor={Colors.Primitives.transparent}
				style={styles.slider}
				trackStyle={styles.track}
				thumbStyle={styles.thumb}
				thumbTouchSize={THUMB_TOUCH_SIZE}
				useNativeDriver={false}
				onValueChange={handleChange}
				onSlidingComplete={handleSlidingComplete}
			/>
		</View>
	);
};

// Styles
const CONTAINER_BORDER_WIDTH = Sizes.Semantic.borderWidth.m;
const EXTRA_PIXEL_OFFSET = 0.75;

const styles = StyleSheet.create({
	root: {
		height: Sizes.Semantic.controlHeight.m,
		borderRadius: Sizes.Semantic.borderRadius.s,
		borderWidth: CONTAINER_BORDER_WIDTH,
		borderBottomColor: Colors.Components.control.default.default.border,
		backgroundColor: Colors.Components.control.default.default.background
	},
	inputContainer: {
		width: '100%',
		height: '100%',
		flexDirection: 'column',
		paddingHorizontal: Sizes.Semantic.spacing.m
	},
	label: {
		...Typography.Semantic.label.s,
		color: Colors.Components.control.default.default.label,
		transform: [{ translateY: (Typography.Semantic.label.s.lineHeight / 4) - (CONTAINER_BORDER_WIDTH / 2) }],
		paddingLeft: EXTRA_PIXEL_OFFSET
	},
	value: {
		...Typography.Semantic.input.m,
		color: Colors.Components.control.default.default.text
	},
	slider: {
		marginTop: SLIDER_MARGIN_TOP,
		marginHorizontal: Sizes.Semantic.spacing.m
	},
	track: {
		height: CONTAINER_BORDER_WIDTH
	},
	thumb: {
		backgroundColor: Colors.Semantic.content.primary.default,
		borderWidth: Sizes.Semantic.borderWidth.m,
		borderColor: Colors.Components.control.default.default.border
	},
	image: {
		width: IMAGE_WIDTH,
		height: '100%',
		top: 0,
		right: 0,
		position: 'absolute',
		resizeMode: 'contain'
	}
});
