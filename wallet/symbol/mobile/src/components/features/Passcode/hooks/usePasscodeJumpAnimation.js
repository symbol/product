import { PASSCODE_PIN_LENGTH } from '@/app/constants';
import { Sizes } from '@/app/styles';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Easing, cancelAnimation, makeMutable, withDelay, withSequence, withTiming } from 'react-native-reanimated';

const JUMP_HEIGHT = Sizes.Semantic.spacing.l;
const JUMP_DURATION = 150;
const DOT_DELAY = 250;
const ANIMATION_LOOP_DELAY = 2000;

/**
 * Hook for managing passcode dots jump animation.
 * Creates a sequential jumping animation where each dot jumps one after another.
 * @param {number} [length=PASSCODE_PIN_LENGTH] - Number of dots.
 * @returns {object} - Jump animation utilities.
 */
export const usePasscodeJumpAnimation = (length = PASSCODE_PIN_LENGTH) => {
	const dotAnimations = useMemo(
		() => Array.from({ length }, () => makeMutable(0)),
		[length]
	);
	const isAnimatingRef = useRef(false);
	const animationLoopRef = useRef(null);

	const runJumpSequence = useCallback(() => {
		if (!isAnimatingRef.current) 
			return;

		const totalSequenceDuration = (length * DOT_DELAY) + (JUMP_DURATION * 2);
		const sequenceDurationWithDelay = totalSequenceDuration + ANIMATION_LOOP_DELAY;

		dotAnimations.forEach((animation, index) => {
			animation.value = withDelay(
				index * DOT_DELAY,
				withSequence(
					withTiming(-JUMP_HEIGHT, { 
						duration: JUMP_DURATION, 
						easing: Easing.out(Easing.quad) 
					}),
					withTiming(0, { 
						duration: JUMP_DURATION, 
						easing: Easing.in(Easing.quad) 
					})
				)
			);
		});

		// Schedule the next loop iteration
		animationLoopRef.current = setTimeout(() => {
			if (isAnimatingRef.current) 
				runJumpSequence();	
		}, sequenceDurationWithDelay);
	}, [dotAnimations, length]);

	const startJumpAnimation = useCallback(() => {
		if (isAnimatingRef.current) 
			return;
		
		isAnimatingRef.current = true;
		runJumpSequence();
	}, [runJumpSequence]);

	const stopJumpAnimation = useCallback(() => {
		isAnimatingRef.current = false;
		
		if (animationLoopRef.current) {
			clearTimeout(animationLoopRef.current);
			animationLoopRef.current = null;
		}

		// Reset all dots to initial position
		dotAnimations.forEach(animation => {
			cancelAnimation(animation);
			animation.value = withTiming(0, { duration: 100 });
		});
	}, [dotAnimations]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			isAnimatingRef.current = false;
			
			if (animationLoopRef.current) 
				clearTimeout(animationLoopRef.current);
		};
	}, []);

	return {
		dotAnimations,
		startJumpAnimation,
		stopJumpAnimation
	};
};
