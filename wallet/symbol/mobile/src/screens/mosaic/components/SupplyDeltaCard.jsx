import { Card, Divider, Field, StyledText, TokenInfoView } from '@/app/components';
import { MosaicSupplyChangeAction } from '@/app/constants';
import { $t } from '@/app/localization';
import { getPaddedSupplyDeltaText, getPaddedSupplyText } from '@/app/screens/mosaic/utils';
import { Colors, Sizes, Typography } from '@/app/styles';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */

/**
 * The proportional widths of the supply bar segments, expressed as fractions of the full bar.
 * @typedef {object} SupplyBarRatios
 * @property {number} baseRatio - The share of the bar held by both the current and the new supply.
 * @property {number} changeRatio - The share of the bar added or removed by the change.
 */

/**
 * One step of the supply timeline.
 * @typedef {object} SupplyTimelineStep
 * @property {string} label - The supply field the step describes.
 * @property {string} value - The amount text shown under the label.
 * @property {object} [valueStyle] - Additional styles for the amount text.
 * @property {number} markerSize - The marker dot diameter.
 * @property {object} markerStyle - The marker fill and border style.
 * @property {string} [connectorColor] - The color of the connector running down to the next step.
 */

const EMPTY_RATIO = 0;
const FULL_RATIO = 1;

const BAR_HEIGHT = Sizes.Semantic.spacing.m + Sizes.Semantic.spacing.s;
const BAR_SEGMENT_GAP = Sizes.Semantic.spacing.xs;
const BAR_OUTLINE_WIDTH = Sizes.Semantic.borderWidth.s;
const BAR_ANIMATION_DURATION = 300;
// The smallest share of the bar a real change may take, so a change too small to scale still shows.
const MIN_CHANGE_RATIO = 0.02;

// Rail geometry. The gutter is as wide as the largest marker so every dot centers on the same vertical axis, and
// the dot sits on the label line. A fixed step pitch keeps the dots evenly spaced and the connectors equal.
const MARKER_SIZE = Sizes.Semantic.spacing.l;
const EVENT_MARKER_SIZE = Sizes.Semantic.spacing.xl;
const RAIL_GUTTER_WIDTH = EVENT_MARKER_SIZE;
const RAIL_WIDTH = Sizes.Semantic.borderWidth.m;
const RAIL_LEFT_OFFSET = (RAIL_GUTTER_WIDTH - RAIL_WIDTH) / 2;
const STEP_PADDING = Sizes.Semantic.spacing.m;
const LABEL_ROW_HEIGHT = Typography.Semantic.label.s.lineHeight;
const VALUE_ROW_HEIGHT = Typography.Semantic.bodyBold.xl.lineHeight;
const STEP_PITCH = (STEP_PADDING * 2) + LABEL_ROW_HEIGHT + VALUE_ROW_HEIGHT;
const MARKER_CENTER_OFFSET = STEP_PADDING + (LABEL_ROW_HEIGHT / 2);

/** The direction the card renders, distinguishing an unchanged supply from a gain and a loss. */
const SupplyChangeDirection = {
	NONE: 'none',
	INCREASE: 'increase',
	DECREASE: 'decrease'
};

const directionColors = {
	[SupplyChangeDirection.NONE]: Colors.Semantic.role.neutral.default,
	[SupplyChangeDirection.INCREASE]: Colors.Semantic.role.success.default,
	[SupplyChangeDirection.DECREASE]: Colors.Semantic.role.danger.default
};

/**
 * Resolves the direction of the change, which drives the bar, the marker and the delta color as one value so
 * they can never disagree. An unchanged supply is its own direction rather than an increase of zero.
 * @param {string} delta - The supply change magnitude in relative units.
 * @param {number|null} action - The supply change action, or null when the supply is unchanged.
 * @returns {string} The change direction key.
 */
const getSupplyChangeDirection = (delta, action) => {
	if (delta === '0' || null === action)
		return SupplyChangeDirection.NONE;

	return MosaicSupplyChangeAction.Increase === action
		? SupplyChangeDirection.INCREASE
		: SupplyChangeDirection.DECREASE;
};

/**
 * Splits the bar into the share both supplies have in common and the share the change adds or removes. The
 * larger of the two amounts always spans the whole bar, so one pair of ratios describes an increase and a
 * decrease alike. The amounts are compared as numbers, which is precise enough for a proportion.
 * @param {string} currentSupply - The current total supply in relative units.
 * @param {string} newSupply - The requested total supply in relative units.
 * @param {boolean} isChanged - Whether the supply changes at all, decided by the caller in atomic units.
 * @returns {SupplyBarRatios} The bar segment ratios.
 */
const calculateSupplyBarRatios = (currentSupply, newSupply, isChanged) => {
	const currentValue = Number(currentSupply);
	const newValue = Number(newSupply);
	const largerValue = Math.max(currentValue, newValue);
	const scaledRatio = largerValue ? FULL_RATIO - (Math.min(currentValue, newValue) / largerValue) : EMPTY_RATIO;
	const changeRatio = isChanged ? Math.max(scaledRatio, MIN_CHANGE_RATIO) : EMPTY_RATIO;

	return { baseRatio: FULL_RATIO - changeRatio, changeRatio };
};

/**
 * Returns the layout of the marker of the step at the given index, centering the dot on the rail axis and
 * placing it one fixed pitch below the previous one, which keeps the gaps between the dots equal.
 * @param {number} index - The step index.
 * @param {number} size - The marker dot diameter.
 * @returns {object} The marker layout style.
 */
const getMarkerLayout = (index, size) => ({
	width: size,
	height: size,
	top: MARKER_CENTER_OFFSET + (index * STEP_PITCH) - (size / 2),
	left: (RAIL_GUTTER_WIDTH - size) / 2
});

/**
 * Returns the layout of the connector running from the marker of the step at the given index down to the next
 * one. Every connector spans exactly one pitch, so all the lines come out equal in length.
 * @param {number} index - The step index.
 * @returns {object} The connector layout style.
 */
const getConnectorLayout = index => ({
	top: MARKER_CENTER_OFFSET + (index * STEP_PITCH),
	height: STEP_PITCH
});

/**
 * BarSegment component. One proportional segment of the supply bar. The gap separating it from the base
 * segment and its outline scale in with its width, so a segment that takes no share of the bar leaves no
 * trace on it and an unchanged supply reads as one unbroken bar.
 * @param {object} props - Component props.
 * @param {number} props.ratio - The share of the bar the segment takes.
 * @param {'left'|'right'} [props.gapSide] - The side the segment is separated from the base segment on.
 * @param {boolean} [props.hasOutline=false] - Whether the segment is drawn with an outline.
 * @param {object} [props.style] - Additional styles for the segment.
 * @returns {React.ReactNode} BarSegment component.
 */
const BarSegment = ({ ratio, gapSide, hasOutline = false, style }) => {
	const widthRatio = useSharedValue(ratio);

	useEffect(() => {
		widthRatio.value = withTiming(ratio, { duration: BAR_ANIMATION_DURATION });
	}, [ratio, widthRatio]);

	const animatedStyle = useAnimatedStyle(() => {
		const presence = Math.min(widthRatio.value / MIN_CHANGE_RATIO, FULL_RATIO);

		return {
			width: `${widthRatio.value * 100}%`,
			marginLeft: 'left' === gapSide ? presence * BAR_SEGMENT_GAP : 0,
			marginRight: 'right' === gapSide ? presence * BAR_SEGMENT_GAP : 0,
			borderWidth: hasOutline ? presence * BAR_OUTLINE_WIDTH : 0
		};
	});

	return <Animated.View style={[styles.barSegment, style, animatedStyle]} />;
};

/**
 * SupplyBar component. The bar whose full width is the larger of the two supplies: the share both supplies
 * have in common, with the share the change removes on its left and the share it adds on its right. Both
 * change segments stay mounted in a fixed order, so switching direction shrinks one side while the other
 * grows instead of moving a segment across the bar.
 * @param {object} props - Component props.
 * @param {string} props.direction - The change direction key.
 * @param {number} props.baseRatio - The share of the bar held by both supplies.
 * @param {number} props.changeRatio - The share of the bar added or removed by the change.
 * @returns {React.ReactNode} SupplyBar component.
 */
const SupplyBar = ({ direction, baseRatio, changeRatio }) => {
	const decreaseRatio = SupplyChangeDirection.DECREASE === direction ? changeRatio : EMPTY_RATIO;
	const increaseRatio = SupplyChangeDirection.INCREASE === direction ? changeRatio : EMPTY_RATIO;

	return (
		<View style={styles.barTrack}>
			<BarSegment ratio={decreaseRatio} gapSide="right" hasOutline style={styles.barSegment__decrease} />
			<BarSegment ratio={baseRatio} style={styles.barSegment__base} />
			<BarSegment ratio={increaseRatio} gapSide="left" style={styles.barSegment__increase} />
		</View>
	);
};

/**
 * SupplyTimeline component. The vertical rail stepping through the supply change. The markers and the
 * connectors between them are laid out from a fixed pitch in their own gutter, so the dots stay evenly spaced
 * and each connector is a single element carrying one color from one dot to the next.
 * @param {object} props - Component props.
 * @param {SupplyTimelineStep[]} props.steps - The steps, from the current supply down to the new one.
 * @returns {React.ReactNode} SupplyTimeline component.
 */
const SupplyTimeline = ({ steps }) => {
	const lastIndex = steps.length - 1;

	return (
		<View style={styles.timeline}>
			<View style={styles.rail}>
				{steps.map((step, index) => (
					<React.Fragment key={step.label}>
						{index < lastIndex && (
							<View
								style={[
									styles.connector,
									getConnectorLayout(index),
									!!step.connectorColor && { backgroundColor: step.connectorColor }
								]}
							/>
						)}
						<View style={[styles.marker, step.markerStyle, getMarkerLayout(index, step.markerSize)]} />
					</React.Fragment>
				))}
			</View>
			<View style={styles.steps}>
				{steps.map((step, index) => (
					<Field
						key={step.label}
						title={step.label}
						size="s"
						style={[styles.step, index < lastIndex && styles.step__pitched]}
					>
						<StyledText bold style={step.valueStyle} numberOfLines={1}>
							{step.value}
						</StyledText>
					</Field>
				))}
			</View>
		</View>
	);
};

/**
 * SupplyDeltaCard component. A read-only receipt of the requested supply change: an identity row naming the
 * mosaic, a proportional bar whose full width is the larger of the two supplies, and a rail stepping from the
 * current supply through the signed change down to the new one. The bar seats a removed share to the left of
 * the surviving supply and an added share to its right, so the direction of the change reads from the side
 * the colored segment sits on. Every amount is padded to the full divisibility to keep the decimals aligned.
 * @param {object} props - Component props.
 * @param {TokenInfo} props.token - The mosaic whose supply is being changed.
 * @param {string} props.currentSupply - The current total supply in relative units.
 * @param {string} props.newSupply - The requested total supply in relative units.
 * @param {string} props.delta - The change magnitude in relative units.
 * @param {number|null} props.action - The supply change action, or null when the supply is unchanged.
 * @returns {React.ReactNode} SupplyDeltaCard component.
 */
export const SupplyDeltaCard = ({ token, currentSupply, newSupply, delta, action }) => {
	// Direction
	const direction = getSupplyChangeDirection(delta, action);
	const isChanged = SupplyChangeDirection.NONE !== direction;
	const directionColor = directionColors[direction];

	// Bar proportions
	const { baseRatio, changeRatio } = calculateSupplyBarRatios(currentSupply, newSupply, isChanged);

	// Timeline steps
	const steps = [
		{
			label: $t('s_modifyMosaic_currentSupply_label'),
			value: getPaddedSupplyText(currentSupply, token.divisibility),
			markerSize: MARKER_SIZE,
			markerStyle: styles.marker__current
		},
		{
			label: $t('s_modifyMosaic_delta_label'),
			value: getPaddedSupplyDeltaText(delta, action, token.divisibility),
			valueStyle: [styles.changeValue, isChanged && { color: directionColor }],
			markerSize: EVENT_MARKER_SIZE,
			markerStyle: [styles.marker__change, { backgroundColor: directionColor }],
			connectorColor: isChanged ? directionColor : null
		},
		{
			label: $t('s_modifyMosaic_newSupply_label'),
			value: getPaddedSupplyText(newSupply, token.divisibility),
			markerSize: MARKER_SIZE,
			markerStyle: styles.marker__new
		}
	];

	return (
		<Card style={styles.card}>
			<View style={styles.identityRow}>
				<TokenInfoView
					id={token.id}
					name={token.name}
				/>
				<StyledText size="s" variant="secondary" numberOfLines={1}>
					{$t('s_modifyMosaic_divisibility_label', { divisibility: token.divisibility })}
				</StyledText>
			</View>
			<SupplyBar direction={direction} baseRatio={baseRatio} changeRatio={changeRatio} />
			<Divider />
			<SupplyTimeline steps={steps} />
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		padding: Sizes.Semantic.layoutPadding.m,
		gap: Sizes.Semantic.spacing.m
	},
	identityRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: Sizes.Semantic.spacing.m
	},
	barTrack: {
		flexDirection: 'row',
		height: BAR_HEIGHT,
		borderRadius: Sizes.Semantic.borderRadius.round,
		backgroundColor: Colors.Semantic.background.tertiary.default,
		overflow: 'hidden'
	},
	barSegment: {
		height: '100%'
	},
	barSegment__base: {
		backgroundColor: Colors.Semantic.role.secondary.default
	},
	barSegment__increase: {
		backgroundColor: Colors.Semantic.role.success.default
	},
	barSegment__decrease: {
		backgroundColor: Colors.Semantic.role.danger.muted,
		borderColor: Colors.Semantic.role.danger.default,
		borderStyle: 'dashed'
	},
	timeline: {
		flexDirection: 'row'
	},
	rail: {
		width: RAIL_GUTTER_WIDTH
	},
	connector: {
		position: 'absolute',
		left: RAIL_LEFT_OFFSET,
		width: RAIL_WIDTH,
		backgroundColor: Colors.Semantic.background.tertiary.lighter
	},
	marker: {
		position: 'absolute',
		borderRadius: Sizes.Semantic.borderRadius.round
	},
	marker__current: {
		backgroundColor: Colors.Components.card.background,
		borderWidth: Sizes.Semantic.borderWidth.m,
		borderColor: Colors.Semantic.content.primary.muted
	},
	marker__change: {
		borderWidth: Sizes.Semantic.borderWidth.l,
		borderColor: Colors.Components.card.background
	},
	marker__new: {
		backgroundColor: Colors.Semantic.content.primary.default
	},
	steps: {
		flex: 1,
		paddingLeft: Sizes.Semantic.spacing.m
	},
	step: {
		paddingVertical: STEP_PADDING
	},
	step__pitched: {
		height: STEP_PITCH
	},
	changeValue: {
		...Typography.Semantic.bodyBold.xl
	}
});
