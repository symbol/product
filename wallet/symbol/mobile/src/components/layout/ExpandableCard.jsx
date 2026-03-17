import { Card } from './Card';
import { Icon, TouchableNative } from '@/app/components';
import { Sizes } from '@/app/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';


/** @typedef {import('react')} React */

const DEFAULT_BORDER_RADIUS = 'm';
const ANIMATION_DURATION_MS = 300;

const iconMap = {
	expanded: 'chevron-up',
	collapsed: 'chevron-down'
};

/**
 * ExpandableCard component. A card container with expandable/collapsible content section,
 * featuring animated height transitions and a chevron indicator.
 *
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Always visible content rendered at the top of the card.
 * @param {React.ReactNode} props.collapsibleChildren - Content that expands/collapses at the bottom.
 * @param {boolean} [props.isExpanded=false] - External control for expanded state.
 * @param {'s'|'m'|'l'} [props.borderRadius='m'] - Border radius size passed to Card.
 * @param {string} [props.color] - Background color passed to Card.
 * @param {object} [props.style] - Additional styles passed to Card.
 *
 * @returns {React.ReactNode} ExpandableCard component
 */
export const ExpandableCard = ({
	children,
	collapsibleChildren,
	isExpanded: isExpandedProp = false,
	borderRadius = DEFAULT_BORDER_RADIUS,
	color,
	style
}) => {
	// State
	const [isExpanded, setIsExpanded] = useState(isExpandedProp);

	// Animation values
	const animatedHeight = useSharedValue(isExpandedProp ? 1 : 0);
	const collapsibleHeightValue = useSharedValue(0);

	// Sync internal state with external prop changes
	useEffect(() => {
		setIsExpanded(isExpandedProp);
		animatedHeight.value = withTiming(isExpandedProp ? 1 : 0, { duration: ANIMATION_DURATION_MS });
	}, [isExpandedProp, animatedHeight]);

	// Animated styles
	const animatedCollapsibleStyle = useAnimatedStyle(() => ({
		height: animatedHeight.value * collapsibleHeightValue.value,
		opacity: animatedHeight.value,
		overflow: 'hidden'
	}));

	// Handlers
	const handlePress = useCallback(() => {
		setIsExpanded(isExpanded => {
			const newExpanded = !isExpanded;
			animatedHeight.value = withTiming(newExpanded ? 1 : 0, { duration: ANIMATION_DURATION_MS });
            
			return newExpanded;
		});
	}, [animatedHeight]);

	const handleCollapsibleLayout = useCallback(event => {
		const { height } = event.nativeEvent.layout;

		if (height > 0 && collapsibleHeightValue.value === 0)
			collapsibleHeightValue.value = height;
	}, [collapsibleHeightValue]);

	// Icon name based on state
	const iconName = isExpanded ? iconMap.expanded : iconMap.collapsed;

	return (
		<Card borderRadius={borderRadius} color={color} style={style}>
			<TouchableNative onPress={handlePress}>
				<View>
					{children}
					<Animated.View style={[animatedCollapsibleStyle, styles.collapsibleContainer]}>
						<View onLayout={handleCollapsibleLayout} style={styles.collapsibleContent}>
							{collapsibleChildren}
						</View>
					</Animated.View>
					<View style={styles.iconContainer}>
						<Icon name={iconName} size="xxs" />
					</View>
				</View>
			</TouchableNative>
		</Card>
	);
};

const styles = StyleSheet.create({
	iconContainer: {
		position: 'absolute',
		bottom: Sizes.Primitives.spacing100,
		left: 0,
		right: 0,
		alignItems: 'center'
	},
	collapsibleContainer: {
		position: 'relative'
	},
	collapsibleContent: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0
	}
});
