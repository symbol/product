import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { Clipboard, PermissionsAndroid, Platform, Vibration } from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';

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

jest.mock('rn-fetch-blob', () => ({
	fs: {
		dirs: {
			DocumentDir: '/mock/document/dir',
			DownloadDir: '/mock/download/dir'
		},
		writeFile: jest.fn()
	},
	ios: {
		previewDocument: jest.fn()
	}
}));

describe('lib/PlatformUtils', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('copyToClipboard', () => {
		const runCopyToClipboardTest = (config, expected) => {
			it(`copies "${config.str}" to clipboard`, () => {
				// Act:
				PlatformUtils.copyToClipboard(config.str);

				// Assert:
				expect(Clipboard.setString).toHaveBeenCalledWith(expected.value);
			});
		};

		const tests = [
			{ str: 'test string', expected: { value: 'test string' } },
			{ str: '', expected: { value: '' } },
			{ str: 'NABCDEFGHIJKLMNOPQRSTUVWXYZ234567', expected: { value: 'NABCDEFGHIJKLMNOPQRSTUVWXYZ234567' } }
		];

		tests.forEach(test => {
			runCopyToClipboardTest({ str: test.str }, test.expected);
		});
	});

	describe('getOS', () => {
		const runGetOSTest = (config, expected) => {
			it(`returns "${expected.os}" when platform is ${config.platform}`, () => {
				// Arrange:
				Platform.OS = config.platform;

				// Act:
				const result = PlatformUtils.getOS();

				// Assert:
				expect(result).toBe(expected.os);
			});
		};

		const tests = [
			{ platform: 'ios', expected: { os: 'ios' } },
			{ platform: 'android', expected: { os: 'android' } }
		];

		tests.forEach(test => {
			runGetOSTest({ platform: test.platform }, test.expected);
		});
	});

	describe('vibrate', () => {
		const runVibrateTest = (config, expected) => {
			it(`${expected.shouldVibrate ? 'vibrates' : 'does not vibrate'} on ${config.platform}`, () => {
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
			{ platform: 'android', expected: { shouldVibrate: true } },
			{ platform: 'ios', expected: { shouldVibrate: false } }
		];

		tests.forEach(test => {
			runVibrateTest({ platform: test.platform }, test.expected);
		});
	});

	describe('requestWritePermission', () => {
		describe('android', () => {
			beforeEach(() => {
				Platform.OS = 'android';
			});

			it('returns true when permission is already granted', async () => {
				// Arrange:
				PermissionsAndroid.check.mockResolvedValue(true);

				// Act:
				const result = await PlatformUtils.requestWritePermission();

				// Assert:
				expect(result).toBe(true);
				expect(PermissionsAndroid.check).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
				expect(PermissionsAndroid.request).not.toHaveBeenCalled();
			});

			it('returns true when permission is granted after request', async () => {
				// Arrange:
				PermissionsAndroid.check.mockResolvedValue(false);
				PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

				// Act:
				const result = await PlatformUtils.requestWritePermission();

				// Assert:
				expect(result).toBe(true);
				expect(PermissionsAndroid.request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
			});

			it('returns false when permission is denied', async () => {
				// Arrange:
				PermissionsAndroid.check.mockResolvedValue(false);
				PermissionsAndroid.request.mockResolvedValue('denied');

				// Act:
				const result = await PlatformUtils.requestWritePermission();

				// Assert:
				expect(result).toBe(false);
			});

			it('returns false when permission request throws an error', async () => {
				// Arrange:
				PermissionsAndroid.check.mockResolvedValue(false);
				PermissionsAndroid.request.mockRejectedValue(new Error('Permission error'));

				// Act:
				const result = await PlatformUtils.requestWritePermission();

				// Assert:
				expect(result).toBe(false);
			});
		});

		describe('ios', () => {
			it('returns true without checking permissions', async () => {
				// Arrange:
				Platform.OS = 'ios';

				// Act:
				const result = await PlatformUtils.requestWritePermission();

				// Assert:
				expect(result).toBe(true);
				expect(PermissionsAndroid.check).not.toHaveBeenCalled();
				expect(PermissionsAndroid.request).not.toHaveBeenCalled();
			});
		});
	});

	describe('writeFile', () => {
		const runWriteFileTest = (config, expected) => {
			it(`writes file to ${expected.directory} on ${config.platform}`, async () => {
				// Arrange:
				Platform.OS = config.platform;
				PermissionsAndroid.check.mockResolvedValue(true);
				RNFetchBlob.fs.writeFile.mockResolvedValue();

				// Act:
				const result = await PlatformUtils.writeFile(config.data, config.filename, config.encoding);

				// Assert:
				expect(result).toBe(true);
				expect(RNFetchBlob.fs.writeFile).toHaveBeenCalledWith(expected.path, config.data, config.encoding);
			});
		};

		const tests = [
			{
				platform: 'ios',
				data: 'test data',
				filename: 'test.txt',
				encoding: 'utf8',
				expected: { directory: 'DocumentDir', path: '/mock/download/dir/test.txt' }
			},
			{
				platform: 'android',
				data: 'android data',
				filename: 'android.txt',
				encoding: 'base64',
				expected: { directory: 'DownloadDir', path: '/mock/download/dir/android.txt' }
			}
		];

		tests.forEach(test => {
			runWriteFileTest(
				{ platform: test.platform, data: test.data, filename: test.filename, encoding: test.encoding },
				test.expected
			);
		});

		it('calls previewDocument on iOS after writing file', async () => {
			// Arrange:
			Platform.OS = 'ios';
			PermissionsAndroid.check.mockResolvedValue(true);
			RNFetchBlob.fs.writeFile.mockResolvedValue();

			// Act:
			await PlatformUtils.writeFile('data', 'file.txt', 'utf8');

			// Assert:
			expect(RNFetchBlob.ios.previewDocument).toHaveBeenCalledWith('/mock/download/dir/file.txt');
		});

		it('does not call previewDocument on Android after writing file', async () => {
			// Arrange:
			Platform.OS = 'android';
			PermissionsAndroid.check.mockResolvedValue(true);
			RNFetchBlob.fs.writeFile.mockResolvedValue();

			// Act:
			await PlatformUtils.writeFile('data', 'file.txt', 'utf8');

			// Assert:
			expect(RNFetchBlob.ios.previewDocument).not.toHaveBeenCalled();
		});

		it('throws error when writeFile fails', async () => {
			// Arrange:
			Platform.OS = 'android';
			PermissionsAndroid.check.mockResolvedValue(true);
			RNFetchBlob.fs.writeFile.mockRejectedValue(new Error('Write failed'));

			// Act & Assert:
			await expect(PlatformUtils.writeFile('data', 'file.txt', 'utf8')).rejects.toThrow('error_failed_write_file');
		});

		it('requests write permission before writing file', async () => {
			// Arrange:
			Platform.OS = 'android';
			PermissionsAndroid.check.mockResolvedValue(false);
			PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
			RNFetchBlob.fs.writeFile.mockResolvedValue();

			// Act:
			await PlatformUtils.writeFile('data', 'file.txt', 'utf8');

			// Assert:
			expect(PermissionsAndroid.request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
		});
	});
});
