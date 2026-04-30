import { timings } from '@/app/styles';
import { useCallback } from 'react';
import { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * React hook for managing press transition animations with color interpolation.
 * @param {object} options - Hook options.
 * @param {object} options.palette - Color palette object with default/pressed/disabled states.
 * @param {'focused'|'pressed'} options.transitionState - Target state for transition.
 * @param {boolean} [options.isDisabled=false] - Whether component is disabled.
 * @returns {object} Press transition utilities.
 */
export const useColorTransition = ({
	palette,
	transitionState,
	isDisabled = false
}) => {
	const transition = useSharedValue(0);

	const animateIn = useCallback(e => {
		e?.stopPropagation?.();

		if (isDisabled) 
			return;

		transition.value = withTiming(1, timings.press);
	}, [isDisabled, transition]);

	const animateOut = useCallback(e => {
		e?.stopPropagation?.();
		transition.value = withTiming(0, timings.press);
	}, [transition]);

	/**
	 * Creates animated styles for multiple properties.
	 * @param {Array<{property: string, styleProperty?: string}>} mappings - Array of properties to animate,
	 * with optional mapping to style properties.
	 */
	const createAnimatedStyles = mappings => {
		return useAnimatedStyle(() => {
			const styles = {};
			
			mappings.forEach(({ property, styleProperty }) => {
				const prop = styleProperty || property;
				
				const colorDefault = palette?.default?.[property];
				const colorTransitioned = palette?.[transitionState]?.[property];
				const colorDisabled = palette?.disabled?.[property];

				if (!colorDefault) 
					return;

				const fromColor = isDisabled ? (colorDisabled || colorDefault) : colorDefault;
				const toColor = isDisabled ? (colorDisabled || colorDefault) : (colorTransitioned || colorDefault);

				styles[prop] = interpolateColor(
					transition.value,
					[0, 1],
					[fromColor, toColor]
				);
			});
			
			return styles;
		});
	};

	return {
		transition,
		animateIn,
		animateOut,
		createAnimatedStyles
	};
};
