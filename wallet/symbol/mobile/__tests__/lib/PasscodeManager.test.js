import { PASSCODE_LOCKOUT_DURATION_MS, PASSCODE_MAX_FAILED_ATTEMPTS, PASSCODE_PIN_LENGTH } from '@/app/constants';
import { PasscodeManager } from '@/app/lib/passcode/PasscodeManager';

// Mocks

jest.mock('@/app/lib/storage/SecureStorageInterface', () => {
	const store = new Map();
	return {
		SecureStorageInterface: {
			getItem: jest.fn(key => Promise.resolve(store.get(key) ?? null)),
			setItem: jest.fn((key, value) => {
				store.set(key, value);
				return Promise.resolve();
			}),
			removeItem: jest.fn(key => {
				store.delete(key);
				return Promise.resolve();
			}),
			_store: store
		}
	};
});

const { SecureStorageInterface: mockSecureStorage } =
	jest.requireMock('@/app/lib/storage/SecureStorageInterface');

// Constants

const VALID_PASSCODE = '1234';
const INVALID_PASSCODE = '0000';

const StorageKey = {
	PIN_HASH: 'passcode:pinHash',
	FAILED_ATTEMPTS: 'passcode:failedAttempts',
	LOCKOUT_UNTIL: 'passcode:lockoutUntil'
};

const ErrorMessage = {
	MUST_BE_STRING: 'Passcode must be a string',
	INVALID_LENGTH: `Passcode must be ${PASSCODE_PIN_LENGTH} digits`,
	MUST_BE_DIGITS: 'Passcode must contain only digits'
};

const VerifyResult = {
	VALID: {
		isValid: true,
		remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS,
		isLocked: false
	},
	LOCKED: {
		isValid: false,
		remainingAttempts: 0,
		isLocked: true
	}
};

const LockStatus = {
	UNLOCKED: { isLocked: false, remainingTimeMs: 0 }
};

// Helpers

const setupPasscode = async passcodeManager => {
	await passcodeManager.create(VALID_PASSCODE);
	jest.clearAllMocks();
};

const setupFailedAttempts = async count => {
	await mockSecureStorage.setItem(StorageKey.FAILED_ATTEMPTS, String(count));
};

const setupActiveLockout = async () => {
	const futureTime = Date.now() + PASSCODE_LOCKOUT_DURATION_MS;
	await mockSecureStorage.setItem(StorageKey.LOCKOUT_UNTIL, String(futureTime));
};

describe('lib/PasscodeManager', () => {
	let passcodeManager;

	beforeEach(() => {
		mockSecureStorage._store.clear();
		passcodeManager = new PasscodeManager();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('configuration', () => {
		it('returns configured passcode length', () => {
			// Act:
			const result = passcodeManager.getPasscodeLength();

			// Assert:
			expect(result).toBe(PASSCODE_PIN_LENGTH);
		});

		it('returns configured max attempts', () => {
			// Act:
			const result = passcodeManager.getMaxAttempts();

			// Assert:
			expect(result).toBe(PASSCODE_MAX_FAILED_ATTEMPTS);
		});
	});

	describe('isPasscodeSet', () => {
		const runIsPasscodeSetTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				if (config.hasStoredHash)
					await mockSecureStorage.setItem(StorageKey.PIN_HASH, 'storedHash');

				// Act:
				const result = await passcodeManager.isPasscodeSet();

				// Assert:
				expect(result).toBe(expected.isSet);
			});
		};

		const isPasscodeSetTests = [
			{
				description: 'returns true when passcode is set',
				config: { hasStoredHash: true },
				expected: { isSet: true }
			},
			{
				description: 'returns false when passcode is not set',
				config: { hasStoredHash: false },
				expected: { isSet: false }
			}
		];

		isPasscodeSetTests.forEach(test => {
			runIsPasscodeSetTest(test.description, test.config, test.expected);
		});
	});

	describe('validatePasscodeFormat', () => {
		describe('valid passcodes', () => {
			const runValidPasscodeTest = (description, passcode) => {
				it(description, () => {
					// Act & Assert:
					expect(() => passcodeManager.validatePasscodeFormat(passcode))
						.not.toThrow();
				});
			};

			const validPasscodeTests = [
				{ description: 'accepts 4-digit passcode', passcode: '1234' },
				{ description: 'accepts passcode with zeros', passcode: '0000' },
				{ description: 'accepts mixed digits', passcode: '9182' }
			];

			validPasscodeTests.forEach(({ description, passcode }) => {
				runValidPasscodeTest(description, passcode);
			});
		});

		describe('invalid passcodes', () => {
			const runInvalidPasscodeTest = (description, config, expected) => {
				it(description, () => {
					// Act & Assert:
					expect(() => passcodeManager.validatePasscodeFormat(config.passcode))
						.toThrow(expected.errorMessage);
				});
			};

			const invalidPasscodeTests = [
				{
					description: 'throws for number type',
					config: { passcode: 1234 },
					expected: { errorMessage: ErrorMessage.MUST_BE_STRING }
				},
				{
					description: 'throws for null',
					config: { passcode: null },
					expected: { errorMessage: ErrorMessage.MUST_BE_STRING }
				},
				{
					description: 'throws for undefined',
					config: { passcode: undefined },
					expected: { errorMessage: ErrorMessage.MUST_BE_STRING }
				},
				{
					description: 'throws for too short passcode',
					config: { passcode: '123' },
					expected: { errorMessage: ErrorMessage.INVALID_LENGTH }
				},
				{
					description: 'throws for too long passcode',
					config: { passcode: '12345' },
					expected: { errorMessage: ErrorMessage.INVALID_LENGTH }
				},
				{
					description: 'throws for passcode with letters',
					config: { passcode: '12ab' },
					expected: { errorMessage: ErrorMessage.MUST_BE_DIGITS }
				},
				{
					description: 'throws for passcode with special characters',
					config: { passcode: '12!@' },
					expected: { errorMessage: ErrorMessage.MUST_BE_DIGITS }
				},
				{
					description: 'throws for empty string',
					config: { passcode: '' },
					expected: { errorMessage: ErrorMessage.INVALID_LENGTH }
				}
			];

			invalidPasscodeTests.forEach(test => {
				runInvalidPasscodeTest(test.description, test.config, test.expected);
			});
		});
	});

	describe('create', () => {
		it('stores hashed passcode and resets failed attempts', async () => {
			// Act:
			await passcodeManager.create(VALID_PASSCODE);

			// Assert:
			expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.PIN_HASH, expect.any(String));
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
		});

		it('throws for invalid passcode format', async () => {
			// Act & Assert:
			await expect(passcodeManager.create('invalid'))
				.rejects.toThrow(ErrorMessage.INVALID_LENGTH);
		});
	});

	describe('verify', () => {
		beforeEach(async () => {
			await setupPasscode(passcodeManager);
		});

		it('returns valid result for correct passcode', async () => {
			// Act:
			const result = await passcodeManager.verify(VALID_PASSCODE);

			// Assert:
			expect(result).toEqual(VerifyResult.VALID);
		});

		it('resets failed attempts on successful verification', async () => {
			// Arrange:
			await setupFailedAttempts(3);

			// Act:
			await passcodeManager.verify(VALID_PASSCODE);

			// Assert:
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
		});

		it('increments failed attempts on incorrect passcode', async () => {
			// Act:
			await passcodeManager.verify(INVALID_PASSCODE);

			// Assert:
			expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS, '1');
		});

		describe('remaining attempts', () => {
			const runRemainingAttemptsTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					if (config.previousAttempts > 0)
						await setupFailedAttempts(config.previousAttempts);

					// Act:
					const result = await passcodeManager.verify(INVALID_PASSCODE);

					// Assert:
					expect(result.remainingAttempts).toBe(expected.remainingAttempts);
					expect(result.isValid).toBe(false);
				});
			};

			const remainingAttemptsTests = [
				{
					description: 'returns correct remaining after first failure',
					config: { previousAttempts: 0 },
					expected: { remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS - 1 }
				},
				{
					description: 'returns correct remaining after multiple failures',
					config: { previousAttempts: 5 },
					expected: { remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS - 6 }
				},
				{
					description: 'returns zero when max reached',
					config: { previousAttempts: PASSCODE_MAX_FAILED_ATTEMPTS - 1 },
					expected: { remainingAttempts: 0 }
				}
			];

			remainingAttemptsTests.forEach(test => {
				runRemainingAttemptsTest(test.description, test.config, test.expected);
			});
		});

		describe('lockout', () => {
			it('sets lockout when max attempts exceeded', async () => {
				// Arrange:
				await setupFailedAttempts(PASSCODE_MAX_FAILED_ATTEMPTS - 1);

				// Act:
				const result = await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(result.isLocked).toBe(true);
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL, expect.any(String));
			});

			it('returns locked result when already locked', async () => {
				// Arrange:
				await setupActiveLockout();

				// Act:
				const result = await passcodeManager.verify(VALID_PASSCODE);

				// Assert:
				expect(result).toEqual(VerifyResult.LOCKED);
			});
		});
	});

	describe('clear', () => {
		it('removes all passcode-related data', async () => {
			// Arrange:
			await setupPasscode(passcodeManager);
			await setupFailedAttempts(3);
			await setupActiveLockout();
			jest.clearAllMocks();

			// Act:
			await passcodeManager.clear();

			// Assert:
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.PIN_HASH);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL);
		});
	});

	describe('failed attempts management', () => {
		const runGetFailedAttemptsTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				if (config.storedValue !== null)
					await mockSecureStorage.setItem(StorageKey.FAILED_ATTEMPTS, config.storedValue);

				// Act:
				const result = await passcodeManager.getFailedAttempts();

				// Assert:
				expect(result).toBe(expected.attempts);
			});
		};

		const getFailedAttemptsTests = [
			{
				description: 'returns 0 when no attempts stored',
				config: { storedValue: null },
				expected: { attempts: 0 }
			},
			{
				description: 'returns stored count',
				config: { storedValue: '5' },
				expected: { attempts: 5 }
			}
		];

		getFailedAttemptsTests.forEach(test => {
			runGetFailedAttemptsTest(test.description, test.config, test.expected);
		});

		it('resets failed attempts', async () => {
			// Arrange:
			await setupFailedAttempts(5);
			jest.clearAllMocks();

			// Act:
			await passcodeManager.resetFailedAttempts();

			// Assert:
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
		});
	});

	describe('lockout management', () => {
		it('stores lockout timestamp with correct duration', async () => {
			// Arrange:
			const beforeTime = Date.now();
			const expectedLockoutTimeString = String(beforeTime + PASSCODE_LOCKOUT_DURATION_MS);

			// Act:
			await passcodeManager.setLockout();

			// Assert:
			expect(mockSecureStorage.setItem)
				.toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL, expectedLockoutTimeString);
		});

		it('clears lockout timestamp', async () => {
			// Arrange:
			await setupActiveLockout();
			jest.clearAllMocks();

			// Act:
			await passcodeManager.clearLockout();

			// Assert:
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL);
		});

		describe('getLockStatus', () => {
			it('returns unlocked when no lockout set', async () => {
				// Act:
				const result = await passcodeManager.getLockStatus();

				// Assert:
				expect(result).toEqual(LockStatus.UNLOCKED);
			});

			it('returns locked with remaining time when lockout active', async () => {
				// Arrange:
				await setupActiveLockout();

				// Act:
				const result = await passcodeManager.getLockStatus();

				// Assert:
				expect(result.isLocked).toBe(true);
				expect(result.remainingTimeMs).toBeGreaterThan(0);
			});

			it('clears expired lockout and returns unlocked', async () => {
				// Arrange:
				const expiredTime = Date.now() - 1000;
				await mockSecureStorage.setItem(StorageKey.LOCKOUT_UNTIL, String(expiredTime));

				// Act:
				const result = await passcodeManager.getLockStatus();

				// Assert:
				expect(result).toEqual(LockStatus.UNLOCKED);
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL);
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
			});
		});
	});

	describe('integration', () => {
		it('completes full passcode lifecycle', async () => {
			// Act & Assert: Create passcode
			await passcodeManager.create(VALID_PASSCODE);
			const isSetAfterCreate = await passcodeManager.isPasscodeSet();
			expect(isSetAfterCreate).toBe(true);

			// Act & Assert: Verify correct passcode
			const validResult = await passcodeManager.verify(VALID_PASSCODE);
			expect(validResult.isValid).toBe(true);

			// Act & Assert: Verify incorrect passcode
			const invalidResult = await passcodeManager.verify(INVALID_PASSCODE);
			expect(invalidResult.isValid).toBe(false);

			// Act & Assert: Clear passcode
			await passcodeManager.clear();
			const isSetAfterClear = await passcodeManager.isPasscodeSet();
			expect(isSetAfterClear).toBe(false);
		});

		it('handles lockout workflow correctly', async () => {
			// Arrange:
			await passcodeManager.create(VALID_PASSCODE);

			// Act: Exhaust all attempts
			for (let i = 0; i < PASSCODE_MAX_FAILED_ATTEMPTS; i++)
				await passcodeManager.verify(INVALID_PASSCODE);

			// Assert: Account is locked
			const lockStatus = await passcodeManager.getLockStatus();
			expect(lockStatus.isLocked).toBe(true);

			// Assert: Cannot verify while locked
			const result = await passcodeManager.verify(VALID_PASSCODE);
			expect(result.isLocked).toBe(true);
			expect(result.isValid).toBe(false);
		});
	});
});
