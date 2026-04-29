import { Scan } from '@/app/screens/transport/Scan';
import { AccountFixtureBuilder } from '__fixtures__/local/AccountFixtureBuilder';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockRouter, mockWalletController } from '__tests__/mock-helpers';
import { useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';

// Mocks

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	useIsFocused: () => true
}));

jest.mock('react-native-vision-camera', () => {
	const React = require('react');
	const { View } = require('react-native');

	return {
		Camera: jest.fn(() => React.createElement(View, { accessibilityLabel: 'camera-viewfinder' })),
		useCameraPermission: jest.fn(),
		useCameraDevice: jest.fn(),
		useCodeScanner: jest.fn()
	};
});

// Constants

const CHAIN_NAME = 'symbol';
const NETWORK_IDENTIFIER = 'testnet';
const QR_URI = 'symbol://transport?data=abc123';

// Screen Text

const SCREEN_TEXT = {
	buttonCancel: 'button_cancel',
	alertNoPermission: 's_scan_alert_noPermission_text',
	alertNoDevice: 's_scan_alert_noDevice_text'
};

// Account Fixtures

const account = AccountFixtureBuilder
	.createWithAccount(CHAIN_NAME, NETWORK_IDENTIFIER, 0)
	.build();

// Camera Data

const cameraDevice = { id: 'back', name: 'Back Camera' };

// Camera Mock Helper

const createCameraMock = (overrides = {}) => {
	const requestPermissionMock = jest.fn();
	const hasPermission = overrides.hasPermission !== undefined ? overrides.hasPermission : true;
	const device = 'device' in overrides ? overrides.device : cameraDevice;

	useCameraPermission.mockReturnValue({ hasPermission, requestPermission: requestPermissionMock });
	useCameraDevice.mockReturnValue(device);

	let capturedOnCodeScanned;
	useCodeScanner.mockImplementation(config => {
		capturedOnCodeScanned = config.onCodeScanned;
		return {};
	});

	return {
		requestPermissionMock,
		simulateScan: uri => capturedOnCodeScanned([{ value: uri }])
	};
};

// Setup

const setupMocks = (cameraOverrides = {}) => {
	mockWalletController({ currentAccount: account });

	return createCameraMock(cameraOverrides);
};

describe('screens/transport/Scan', () => {
	beforeEach(() => {
		mockLocalization();
	});

	describe('render', () => {
		it('renders cancel button and account name', () => {
			// Arrange:
			setupMocks();
			const expectedTexts = [
				SCREEN_TEXT.buttonCancel,
				account.name
			];

			// Act:
			const screenTester = new ScreenTester(Scan);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('camera state', () => {
		const runCameraStateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				setupMocks(config.cameraOverrides);

				// Act:
				const screenTester = new ScreenTester(Scan);

				// Assert:
				if (expected.alertText)
					screenTester.expectText([expected.alertText]);
				else
					screenTester.notExpectText([SCREEN_TEXT.alertNoPermission, SCREEN_TEXT.alertNoDevice]);

				if (expected.isCameraVisible)
					screenTester.expectElement('camera-viewfinder', 'label');
				else
					screenTester.notExpectElement('camera-viewfinder', 'label');
			});
		};

		const cameraStateTests = [
			{
				description: 'shows no-permission alert and hides camera when permission is denied',
				config: { cameraOverrides: { hasPermission: false, device: cameraDevice } },
				expected: { alertText: SCREEN_TEXT.alertNoPermission, isCameraVisible: false }
			},
			{
				description: 'shows no-device alert and hides camera when device is unavailable',
				config: { cameraOverrides: { hasPermission: true, device: null } },
				expected: { alertText: SCREEN_TEXT.alertNoDevice, isCameraVisible: false }
			},
			{
				description: 'hides alert and shows camera when permission is granted and device is available',
				config: { cameraOverrides: { hasPermission: true, device: cameraDevice } },
				expected: { alertText: null, isCameraVisible: true }
			}
		];

		cameraStateTests.forEach(test => {
			runCameraStateTest(test.description, test.config, test.expected);
		});
	});

	describe('permission request', () => {
		const runPermissionRequestTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const { requestPermissionMock } = setupMocks(config.cameraOverrides);

				// Act:
				new ScreenTester(Scan);

				// Assert:
				if (expected.isPermissionRequested)
					expect(requestPermissionMock).toHaveBeenCalledTimes(1);
				else
					expect(requestPermissionMock).not.toHaveBeenCalled();
			});
		};

		const permissionRequestTests = [
			{
				description: 'requests camera permission on mount when permission is not granted',
				config: { cameraOverrides: { hasPermission: false } },
				expected: { isPermissionRequested: true }
			},
			{
				description: 'does not request camera permission when permission is already granted',
				config: { cameraOverrides: { hasPermission: true } },
				expected: { isPermissionRequested: false }
			}
		];

		permissionRequestTests.forEach(test => {
			runPermissionRequestTest(test.description, test.config, test.expected);
		});
	});

	describe('navigation', () => {
		it('navigates back when cancel button is pressed', () => {
			// Arrange:
			setupMocks();
			const routerMock = mockRouter({ goBack: jest.fn() });
			const screenTester = new ScreenTester(Scan);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.buttonCancel);

			// Assert:
			expect(routerMock.goBack).toHaveBeenCalledTimes(1);
		});

		it('navigates to transport request when QR code is scanned', () => {
			// Arrange:
			const { simulateScan } = setupMocks();
			const routerMock = mockRouter({ goToTransportRequest: jest.fn() });
			new ScreenTester(Scan);

			// Act:
			simulateScan(QR_URI);

			// Assert:
			expect(routerMock.goToTransportRequest).toHaveBeenCalledWith({
				params: { transportUri: QR_URI }
			});
		});
	});
});
