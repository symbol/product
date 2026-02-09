import { SHAKE_DURATION_MS, SHAKE_OFFSET } from '../constants';
import { useCallback } from 'react';
import { useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Hook for managing passcode shake animation.
 * @returns {object} - Shake animation utilities.
 */
export const usePasscodeShake = () => {
	const shakeAnimation = useSharedValue(0);

	const triggerShake = useCallback(() => {
		shakeAnimation.value = withSequence(
			withTiming(SHAKE_OFFSET, { duration: SHAKE_DURATION_MS }),
			withTiming(-SHAKE_OFFSET, { duration: SHAKE_DURATION_MS }),
			withTiming(SHAKE_OFFSET, { duration: SHAKE_DURATION_MS }),
			withTiming(-SHAKE_OFFSET, { duration: SHAKE_DURATION_MS }),
			withTiming(0, { duration: SHAKE_DURATION_MS })
		);
	}, [shakeAnimation]);

	return {
		shakeAnimation,
		triggerShake
	};
};
