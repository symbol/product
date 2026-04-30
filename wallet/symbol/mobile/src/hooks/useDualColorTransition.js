import { timings } from '@/app/styles';
import { useCallback, useEffect } from 'react';
import { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

/**
 * React hook for managing dual-axis color transitions (e.g., focus + error states).
 * @param {object} options - Hook options.
 * @param {object} options.primaryPalette - Primary color palette (e.g., default state).
 * @param {object} options.secondaryPalette - Secondary color palette (e.g., error state).
 * @param {'focused'|'pressed'} options.transitionState - Target state for primary transition.
 * @param {boolean} [options.isDisabled=false] - Whether component is disabled.
 * @param {boolean} [options.isSecondaryActive=false] - Whether secondary palette is active (e.g., error state).
 * @returns {object} Dual transition utilities.
 */
export const useDualColorTransition = ({
	primaryPalette,
	secondaryPalette,
	transitionState,
	isDisabled = false,
	isSecondaryActive = false
}) => {
	const primaryTransition = useSharedValue(0);
	const secondaryTransition = useSharedValue(isSecondaryActive ? 1 : 0);

	// Sync secondary transition with isSecondaryActive prop
	useEffect(() => {
		secondaryTransition.value = withTiming(isSecondaryActive ? 1 : 0, timings.press);
	}, [isSecondaryActive, secondaryTransition]);

	const animateIn = useCallback(e => {
		e?.stopPropagation?.();
		if (isDisabled) 
			return;
		primaryTransition.value = withTiming(1, timings.press);
	}, [isDisabled, primaryTransition]);

	const animateOut = useCallback(e => {
		e?.stopPropagation?.();
		primaryTransition.value = withTiming(0, timings.press);
	}, [primaryTransition]);

	/**
	 * Creates animated styles with dual-axis interpolation.
	 * @param {Array<{property: string, styleProperty?: string}>} mappings - Array of properties to animate, 
	 * with optional mapping to style properties.
	 */
	const createAnimatedStyles = mappings => {
		return useAnimatedStyle(() => {
			const styles = {};

			mappings.forEach(({ property, styleProperty }) => {
				const prop = styleProperty || property;

				// Get colors from both palettes for all states
				const primaryDefault = primaryPalette?.default?.[property];
				const primaryTransitioned = primaryPalette?.[transitionState]?.[property];
				const primaryDisabled = primaryPalette?.disabled?.[property];

				const secondaryDefault = secondaryPalette?.default?.[property];
				const secondaryTransitioned = secondaryPalette?.[transitionState]?.[property];
				const secondaryDisabled = secondaryPalette?.disabled?.[property];

				if (!primaryDefault || !secondaryDefault) 
					return;

				// First interpolate between palettes (primary ↔ secondary) for each state
				const stateDefault = interpolateColor(
					secondaryTransition.value,
					[0, 1],
					[primaryDefault, secondaryDefault]
				);
				const stateTransitioned = interpolateColor(
					secondaryTransition.value,
					[0, 1],
					[primaryTransitioned || primaryDefault, secondaryTransitioned || secondaryDefault]
				);
				const stateDisabled = interpolateColor(
					secondaryTransition.value,
					[0, 1],
					[primaryDisabled || primaryDefault, secondaryDisabled || secondaryDefault]
				);

				// Then interpolate between states based on primary transition
				const fromState = isDisabled ? stateDisabled : stateDefault;
				const toState = isDisabled ? stateDisabled : stateTransitioned;

				styles[prop] = interpolateColor(
					primaryTransition.value,
					[0, 1],
					[fromState, toState]
				);
			});

			return styles;
		});
	};

	return {
		primaryTransition,
		secondaryTransition,
		animateIn,
		animateOut,
		createAnimatedStyles
	};
};
