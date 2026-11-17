import { Header } from '@/app/app/components';
import { Alert, ButtonClose, FlexContainer, Screen, Spacer } from '@/app/components';
import { useWalletController } from '@/app/hooks';
import { $t } from '@/app/localization';
import { Router } from '@/app/router/Router';
import { createCameraAlertData } from '@/app/screens/transport/utils';
import { useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';

/**
 * Scan screen component. Provides a QR code scanner interface.
 * @returns {React.ReactNode} Scan screen component.
 */
export const Scan = () => {
	const walletController = useWalletController();
	const { currentAccount } = walletController;

	// Handlers
	const handleScan = useCallback(scannedData => {
		if (scannedData.length > 0)
			Router.goToTransportRequest({ params: { transportUri: scannedData[0].value } });
	}, []);

	// Scanner setup
	const codeScanner = useCodeScanner({
		codeTypes: ['qr'],
		onCodeScanned: handleScan
	});

	// Camera hardware setup
	const device = useCameraDevice('back');

	// Camera permission
	const { hasPermission, requestPermission } = useCameraPermission();

	useEffect(() => {
		if (!hasPermission)
			requestPermission();
	}, [hasPermission]);

	// Turn camera on when screen is focused, off when unfocused
	const isScreenFocused = useIsFocused();

	// Alert data for camera status feedback
	const cameraAlert = createCameraAlertData(hasPermission, device);

	// Derived State
	const isCameraReady = device != null && hasPermission;
	const isCameraActive = isScreenFocused && isCameraReady;

	return (
		<Screen isScrollDisabled>
			<Screen.Header>
				<Header currentAccount={currentAccount} />
			</Screen.Header>
			<Screen.Upper>
				<Spacer>
					<FlexContainer right>
						<ButtonClose text={$t('button_cancel')} onPress={Router.goBack} />
					</FlexContainer>
				</Spacer>
				{cameraAlert.isVisible && (
					<FlexContainer fill center>
						<Spacer>
							<Alert
								variant={cameraAlert.variant}
								body={cameraAlert.text}
							/>
						</Spacer>
					</FlexContainer>
				)}
			</Screen.Upper>
			<Screen.Background>
				{isCameraReady && (
					<Camera
						style={styles.camera}
						isActive={isCameraActive}
						device={device}
						codeScanner={codeScanner}
					/>
				)}
			</Screen.Background>
		</Screen>
	);
};

const styles = StyleSheet.create({
	camera: {
		flex: 1
	}
});
