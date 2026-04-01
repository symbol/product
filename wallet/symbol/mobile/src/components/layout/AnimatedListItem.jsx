import React from 'react';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

const ENTERING_DURATION = 300;
const EXITING_DURATION = 200;
const LAYOUT_DURATION = 300;
const ENTERING_ANIMATION_DELAY = 250;

/**
 * AnimatedListItem component. Wraps list items with smooth enter/exit transitions
 * and layout repositioning animations. Items fade in when added and fade out when
 * removed, while other items smoothly move to accommodate the change.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - The item content to animate.
 * @param {object} [props.style] - Additional styles for the animated container.
 *
 * @returns {React.ReactNode} AnimatedListItem component
 */
export const AnimatedListItem = ({ children, style }) => (
	<Animated.View
		entering={FadeIn.delay(ENTERING_ANIMATION_DELAY).duration(ENTERING_DURATION)}
		exiting={FadeOut.duration(EXITING_DURATION)}
		layout={LinearTransition.duration(LAYOUT_DURATION)}
		style={style}
	>
		{children}
	</Animated.View>
);
