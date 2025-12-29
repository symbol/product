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
		const runWriteFileTest = (description, config, expected) => {
			it(description, async () => {
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
				description: 'writes file to DocumentDir on ios',
				config: {
					platform: 'ios',
					data: 'test data',
					filename: 'test.txt',
					encoding: 'utf8'
				},
				expected: { directory: 'DocumentDir', path: '/mock/download/dir/test.txt' }
			},
			{
				description: 'writes file to DownloadDir on android',
				config: {
					platform: 'android',
					data: 'android data',
					filename: 'android.txt',
					encoding: 'base64'
				},
				expected: { directory: 'DownloadDir', path: '/mock/download/dir/android.txt' }
			}
		];

		tests.forEach(test => {
			runWriteFileTest(test.description, test.config, test.expected);
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
