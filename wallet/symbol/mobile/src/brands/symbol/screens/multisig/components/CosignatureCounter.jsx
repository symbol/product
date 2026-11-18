import { ButtonCircle, StyledText } from '@/app/components';
import { Colors, Sizes, timings } from '@/app/styles';
import React, { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const COMPONENT_HEIGHT = Sizes.Semantic.spacing.xxl;
const SEGMENT_HEIGHT = Sizes.Semantic.spacing.s;
const SEGMENT_GAP = Sizes.Semantic.spacing.s;
const ICON_SIZE = Sizes.Semantic.iconSize.xs;
const BUTTON_SIZE = 'm';
const PROGRESS_ANIMATION_DURATION = 200;

const SelectorVariant = {
	MIN_APPROVALS: 'min-approval',
	MIN_REMOVALS: 'min-removal'
};

const iconSourceMap = {
	accountOne: require('@/app/assets/images/components/multisig/account.png'),
	accountMulti: require('@/app/assets/images/components/multisig/account-multi.png')
};

const progressBarColors = {
	default: Colors.Components.progress.bar.default,
	[SelectorVariant.MIN_APPROVALS]: Colors.Components.progress.bar.success,
	[SelectorVariant.MIN_REMOVALS]: Colors.Components.progress.bar.danger,
	empty: Colors.Components.progress.background
};

/**
 * ProgressSegment component. A single animated segment of the progress bar.
 * @param {object} props - Component props.
 * @param {boolean} props.isFilled - Whether the segment is filled.
 * @param {string} props.filledColor - Color to use when the segment is filled.
 * @returns {React.ReactNode} ProgressSegment component.
 */
const ProgressSegment = ({ isFilled, filledColor }) => {
	const progress = useSharedValue(isFilled ? 1 : 0);

	useEffect(() => {
		progress.value = withTiming(isFilled ? 1 : 0, {
			duration: PROGRESS_ANIMATION_DURATION,
			easing: timings.press.easing
		});
	}, [isFilled, progress]);

	const animatedStyle = useAnimatedStyle(() => ({
		backgroundColor: interpolateColor(
			progress.value,
			[0, 1],
			[progressBarColors.empty, filledColor]
		)
	}));

	return <Animated.View style={[styles.segment, animatedStyle]} />;
};

/**
 * CosignatureCounter component. Displays a segmented progress bar representing cosignatures count,
 * with optional increment/decrement controls for editing mode.
 * Each segment represents one cosignatory; filled segments indicate the minimum requirement value.
 * @param {object} props - Component props.
 * @param {number} props.value - Current count value (filled segments).
 * @param {number} props.total - Total number of segments (total cosignatories).
 * @param {boolean} [props.isEditable=false] - Whether to show increment/decrement buttons.
 * @param {'min-approval'|'min-removal'} [props.variant='min-approval'] - Determines the color scheme for the progress bar.
 * @param {function(number): void} [props.onChange] - Callback fired with new value when increment/decrement buttons are pressed.
 * @param {object} [props.style] - Additional styles for the component container.
 * @returns {React.ReactNode} CosignatureCounter component.
 */
export const CosignatureCounter = ({
	value,
	total,
	isEditable = false,
	variant = SelectorVariant.MIN_APPROVALS,
	onChange,
	style
}) => {
	const minValue = 1;
	const maxValue = total;
	const fillColor = progressBarColors[variant];

	const handleDecrement = () => {
		if (value > minValue)
			onChange?.(value - 1);
	};

	const handleIncrement = () => {
		if (value < maxValue)
			onChange?.(value + 1);
	};

	const segments = useMemo(() => {
		const segments = [];

		for (let i = 0; i < total; i++) {
			segments.push(<ProgressSegment 
				key={i} 
				isFilled={i < value} 
				filledColor={fillColor} 
			/>);
		}

		return segments;
	}, [total, value, fillColor]);

	const isValueProvided = typeof value === 'number';
	const valueText = `${isValueProvided ? value : '..'} of ${total}`;

	return (
		<View style={[styles.root, style]}>
			{isEditable && (
				<ButtonCircle
					icon="minus"
					size={BUTTON_SIZE}
					onPress={handleDecrement}
				/>
			)}
			<View style={styles.content}>
				<View style={styles.header}>
					<Image source={iconSourceMap.accountOne} style={styles.icon} />
					<StyledText>
						{valueText}
					</StyledText>
					<Image source={iconSourceMap.accountMulti} style={styles.icon} />
				</View>
				<View style={styles.progressBar}>
					{segments}
				</View>
			</View>
			{isEditable && (
				<ButtonCircle
					icon="plus"
					size={BUTTON_SIZE}
					onPress={handleIncrement}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: Sizes.Semantic.spacing.m,
		height: COMPONENT_HEIGHT
	},
	button: {
		padding: Sizes.Semantic.spacing.s,
		justifyContent: 'center',
		alignItems: 'center'
	},
	content: {
		flex: 1
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center'
	},
	icon: {
		width: ICON_SIZE,
		height: ICON_SIZE
	},
	progressBar: {
		flexDirection: 'row',
		gap: SEGMENT_GAP
	},
	segment: {
		flex: 1,
		height: SEGMENT_HEIGHT
	}
});
