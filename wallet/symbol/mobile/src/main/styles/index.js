import { Easing } from 'react-native-reanimated';

export * from './colors';
export * from './sizes';
export * from './typography';

export const timings = {
	press: {
		duration: 100,
		easing: Easing.linear
	}
};
