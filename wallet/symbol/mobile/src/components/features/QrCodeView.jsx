import { Colors, Sizes } from '@/app/styles';
import * as QRCodeCanvas from 'qrcode/lib/server';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const ERROR_CORRECTION_LEVEL = 'M';

const SIZE = Sizes.Semantic.qrCodeSize.m;
const PADDING = Sizes.Semantic.layoutSpacing.m;
const BORDER_RADIUS = Sizes.Semantic.borderRadius.m;
const COLOR_BACKGROUND = Colors.Primitives.white;
const ANIMATION_DURATION = 250;


/**
 * QrCodeView component. A component that generates and displays a QR code image from a data string.
 * @param {object} props - Component props.
 * @param {string} props.qrDataString - The data string to encode as a QR code.
 * @returns {React.ReactNode} QrCodeView component.
 */
export const QrCodeView = ({ qrDataString }) => {
	const [qrImageSource, setQrImageSource] = useState(null);
	const isImageVisible = Boolean(qrImageSource);

	useEffect(() => {
		const generateQrCode = async () => {
			try {
				const config = {
					errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
					margin: PADDING / 4
				};
				const uri = await QRCodeCanvas.toDataURL(qrDataString, config);
				setQrImageSource({ uri });
			} catch {}
		};

		generateQrCode();
	}, [qrDataString]);

	return (
		<View style={styles.root}>
			{isImageVisible && (
				<Animated.Image source={qrImageSource} style={styles.image} entering={FadeIn.duration(ANIMATION_DURATION)} />
			)}
		</View>
	);
};


const styles = StyleSheet.create({
	root: {
		width: SIZE,
		height: SIZE,
		backgroundColor: COLOR_BACKGROUND,
		borderRadius: BORDER_RADIUS,
		overflow: 'hidden'
	},
	image: {
		width: '100%',
		height: '100%'
	}
});
