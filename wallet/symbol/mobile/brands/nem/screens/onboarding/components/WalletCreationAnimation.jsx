import { Colors, Sizes } from '@/app/styles';
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
	Easing,
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated';

const LOGO_SIZE = Sizes.Primitives.spacing2000;
const LOGO_SOURCE_SIZE = 248;
const SEGMENT_SOURCE_SIZE = 496;
const GLOW_SIZE = LOGO_SIZE * (SEGMENT_SOURCE_SIZE / LOGO_SOURCE_SIZE);

const FADE_IN_DURATION = 4000;
const FLICKER_PERIOD = 4000;
const FLICKER_DEPTH = 0.6;
const FLICKER_GROWTH = 0.1;

const SEGMENTS = [
	{ 
		id: 'yellow', 
		source: require('../../../assets/images/art/nem-logo-segment-yellow.png'), 
		periodRatio: 0.9 
	},
	{ 
		id: 'blue', 
		source: require('../../../assets/images/art/nem-logo-segment-blue.png'), 
		periodRatio: 1.1 
	},
	{ 
		id: 'green', 
		source: require('../../../assets/images/art/nem-logo-segment-green.png'), 
		periodRatio: 1 
	}
];

const GLOW_LAYERS = [
	{ 
		id: 'halo', 
		scale: 1.8, 
		blurRadius: 40, 
		opacity: 1 
	},
	{ 
		id: 'inner', 
		scale: 1.03, 
		blurRadius: 20, 
		opacity: 1 
	}
];

const GlowLayer = ({ source, layer, intensity, flicker }) => {
	const animatedStyle = useAnimatedStyle(() => ({
		opacity: layer.opacity * intensity.value * (1 - (FLICKER_DEPTH * flicker.value)),
		transform: [{ scale: layer.scale + (FLICKER_GROWTH * flicker.value) }]
	}));

	return (
		<Animated.Image 
			source={source} 
			blurRadius={layer.blurRadius} 
			style={[styles.glow, animatedStyle]} 
		/>
	);
};

const SegmentGlow = ({ source, periodRatio }) => {
	const intensity = useSharedValue(0);
	const flicker = useSharedValue(0);

	useEffect(() => {
		intensity.value = withTiming(1, { 
			duration: FADE_IN_DURATION, 
			easing: Easing.inOut(Easing.quad) 
		});
		flicker.value = withRepeat(
			withTiming(1, { 
				duration: FLICKER_PERIOD * periodRatio, 
				easing: Easing.inOut(Easing.sin) 
			}),
			-1,
			true
		);

		return () => {
			cancelAnimation(intensity);
			cancelAnimation(flicker);
		};
	}, []);

	return GLOW_LAYERS.map(layer => (
		<GlowLayer 
			key={layer.id} 
			source={source} 
			layer={layer} 
			intensity={intensity} 
			flicker={flicker} 
		/>
	));
};

/**
 * WalletCreationAnimation component. Displays animated NEM logo while waiting for the wallet creation process to complete.
 * @returns {React.ReactNode} WalletCreationAnimation component.
 */
export const WalletCreationAnimation = () => {
	return (
		<View style={styles.root}>
			{SEGMENTS.map(segment => (
				<SegmentGlow 
					key={segment.id} 
					source={segment.source} 
					periodRatio={segment.periodRatio} 
				/>
			))}
			<Image source={require('../../../assets/images/art/nem-logo.png')} style={styles.logo} />
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
		width: '100%',
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: Colors.Components.main.background
	},
	glow: {
		position: 'absolute',
		width: GLOW_SIZE,
		height: GLOW_SIZE,
		resizeMode: 'contain'
	},
	logo: {
		width: LOGO_SIZE,
		height: LOGO_SIZE,
		resizeMode: 'contain'
	}
});
