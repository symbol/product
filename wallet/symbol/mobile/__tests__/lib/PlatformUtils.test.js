import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { Clipboard, Platform, Vibration } from 'react-native';

jest.mock('react-native', () => ({
	Clipboard: {
		setString: jest.fn()
	},
	Platform: {
		OS: 'ios'
	},
	Vibration: {
		vibrate: jest.fn()
	},
	PermissionsAndroid: {
		PERMISSIONS: {
			WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE'
		},
		RESULTS: {
			GRANTED: 'granted'
		},
		check: jest.fn(),
		request: jest.fn()
	}
}));

describe('lib/PlatformUtils', () => {
	describe('copyToClipboard', () => {
		const runCopyToClipboardTest = (description, config, expected) => {
			it(description, () => {
				// Act:
				PlatformUtils.copyToClipboard(config.str);

				// Assert:
				expect(Clipboard.setString).toHaveBeenCalledWith(expected.value);
			});
		};

		const tests = [
			{
				description: 'copies "test string" to clipboard',
				config: { str: 'test string' },
				expected: { value: 'test string' }
			},
			{
				description: 'copies "" to clipboard',
				config: { str: '' },
				expected: { value: '' }
			},
			{
				description: 'copies "NABCDEFGHIJKLMNOPQRSTUVWXYZ234567" to clipboard',
				config: { str: 'NABCDEFGHIJKLMNOPQRSTUVWXYZ234567' },
				expected: { value: 'NABCDEFGHIJKLMNOPQRSTUVWXYZ234567' }
			}
		];

		tests.forEach(test => {
			runCopyToClipboardTest(test.description, test.config, test.expected);
		});
	});

	describe('getOS', () => {
		const runGetOSTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				Platform.OS = config.platform;

				// Act:
				const result = PlatformUtils.getOS();

				// Assert:
				expect(result).toBe(expected.os);
			});
		};

		const tests = [
			{
				description: 'returns "ios" when platform is ios',
				config: { platform: 'ios' },
				expected: { os: 'ios' }
			},
			{
				description: 'returns "android" when platform is android',
				config: { platform: 'android' },
				expected: { os: 'android' }
			}
		];

		tests.forEach(test => {
			runGetOSTest(test.description, test.config, test.expected);
		});
	});

	describe('vibrate', () => {
		const runVibrateTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				Platform.OS = config.platform;

				// Act:
				PlatformUtils.vibrate();

				// Assert:
				if (expected.shouldVibrate)
					expect(Vibration.vibrate).toHaveBeenCalledWith(2);
				else
					expect(Vibration.vibrate).not.toHaveBeenCalled();
			});
		};

		const tests = [
			{
				description: 'vibrates on android',
				config: { platform: 'android' },
				expected: { shouldVibrate: true }
			},
			{
				description: 'does not vibrate on ios',
				config: { platform: 'ios' },
				expected: { shouldVibrate: false }
			}
		];

		tests.forEach(test => {
			runVibrateTest(test.description, test.config, test.expected);
		});
	});
});
