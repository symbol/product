import React from 'react';
import Animated, { FadeInDown, FadeOutUp, withDelay, withTiming } from 'react-native-reanimated';

const LAYOUT_ANIMATION_DURATION = 300;
const LAYOUT_ANIMATION_DELAY = 300;
const ENTERING_ANIMATION_DELAY = 250;

const CustomLayout = values => {
	'worklet';
	const isMovingUp = values.currentOriginY < values.targetOriginY;
	const timingConfig = { duration: LAYOUT_ANIMATION_DURATION };

	return {
		animations: {
			originY: isMovingUp
				? withTiming(values.targetOriginY, timingConfig)
				: withDelay(
					LAYOUT_ANIMATION_DELAY,
					withTiming(values.targetOriginY, timingConfig)
				)
		},
		initialValues: {
			originY: values.currentOriginY
		}
	};
};


/**
 * WidgetAnimatedWrapper component. Wraps a widget with animated enter/exit transitions and
 * layout repositioning. Renders nothing when not visible.
 * @param {object} props - Component props.
 * @param {boolean} props.isVisible - Whether the wrapped widget should be shown.
 * @param {React.ReactNode} props.children - The widget content to animate.
 * @returns {React.ReactNode} WidgetAnimatedWrapper component.
 */
export const WidgetAnimatedWrapper = ({ isVisible, children }) => {
	if (!isVisible)
		return null;

	return (
		<Animated.View 
			entering={FadeInDown.delay(ENTERING_ANIMATION_DELAY)}
			exiting={FadeOutUp}
			layout={CustomLayout}
		>
			{children}
		</Animated.View>
	);
};
