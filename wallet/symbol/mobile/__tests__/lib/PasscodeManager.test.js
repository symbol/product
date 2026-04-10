import { PASSCODE_LOCKOUT_DURATION, PASSCODE_MAX_FAILED_ATTEMPTS, PASSCODE_PIN_LENGTH } from '@/app/constants';
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
	PIN_SALT: 'passcode:pinSalt',
	FAILED_ATTEMPTS: 'passcode:failedAttempts',
	CONSECUTIVE_FAILURES: 'passcode:consecutiveFailures',
	LOCKOUT_UNTIL: 'passcode:lockoutUntil'
};

const ErrorMessage = {
	MUST_BE_STRING: 'Passcode must be a string',
	INVALID_LENGTH: `Passcode must be ${PASSCODE_PIN_LENGTH} digits`,
	MUST_BE_DIGITS: 'Passcode must contain only digits'
};

// Expected Results

const verifyResultValid = {
	isValid: true,
	remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS,
	isLocked: false,
	lockoutUntil: null
};

const verifyResultLocked = {
	isValid: false,
	remainingAttempts: 0,
	isLocked: true,
	lockoutUntil: expect.any(Number)
};

const lockStatusUnlocked = {
	isLocked: false,
	lockoutUntil: null,
	consecutiveFailures: 0
};

// Helpers

const setupPasscode = async passcodeManager => {
	await passcodeManager.create(VALID_PASSCODE);
	jest.clearAllMocks();
};

const setupFailedAttempts = async count => {
	await mockSecureStorage.setItem(StorageKey.FAILED_ATTEMPTS, String(count));
};

const setupConsecutiveFailures = async count => {
	await mockSecureStorage.setItem(StorageKey.CONSECUTIVE_FAILURES, String(count));
};

const setupActiveLockout = async (durationMultiplier = 1) => {
	const futureTime = Date.now() + (durationMultiplier * PASSCODE_LOCKOUT_DURATION);
	await mockSecureStorage.setItem(StorageKey.LOCKOUT_UNTIL, String(futureTime));
};

const setupExpiredLockout = async consecutiveFailures => {
	const expiredTime = Date.now() - 1000;
	await mockSecureStorage.setItem(StorageKey.LOCKOUT_UNTIL, String(expiredTime));
	await setupConsecutiveFailures(consecutiveFailures);
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
		it('stores hashed passcode with salt and resets all state', async () => {
			// Act:
			await passcodeManager.create(VALID_PASSCODE);

			// Assert:
			expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.PIN_HASH, expect.any(String));
			expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.PIN_SALT, expect.any(String));
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL);
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

		describe('successful verification', () => {
			it('returns valid result for correct passcode', async () => {
				// Act:
				const result = await passcodeManager.verify(VALID_PASSCODE);

				// Assert:
				expect(result).toEqual(verifyResultValid);
			});

			it('resets failed attempts on successful verification', async () => {
				// Arrange:
				await setupFailedAttempts(3);
				await setupConsecutiveFailures(2);

				// Act:
				await passcodeManager.verify(VALID_PASSCODE);

				// Assert:
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES);
			});
		});

		describe('failed verification with remaining attempts', () => {
			it('increments failed attempts on incorrect passcode', async () => {
				// Act:
				await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS, '1');
			});

			it('does not increment consecutive failures until attempts are exhausted', async () => {
				// Act:
				await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(mockSecureStorage.setItem).not.toHaveBeenCalledWith(
					StorageKey.CONSECUTIVE_FAILURES,
					expect.any(String)
				);
			});

			const runRemainingAttemptsTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					if (config.previousAttempts > 0)
						await setupFailedAttempts(config.previousAttempts);

					// Act:
					const result = await passcodeManager.verify(INVALID_PASSCODE);

					// Assert:
					expect(result.isValid).toBe(false);
					expect(result.isLocked).toBe(expected.isLocked);
					expect(result.remainingAttempts).toBe(expected.remainingAttempts);
				});
			};

			const remainingAttemptsTests = [
				{
					description: 'returns correct remaining attempts after first failure',
					config: { previousAttempts: 0 },
					expected: {
						remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS - 1,
						isLocked: false
					}
				},
				{
					description: 'returns correct remaining attempts after multiple failures',
					config: { previousAttempts: 5 },
					expected: {
						remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS - 6,
						isLocked: false
					}
				}
			];

			remainingAttemptsTests.forEach(test => {
				runRemainingAttemptsTest(test.description, test.config, test.expected);
			});
		});

		describe('lockout on attempts exhaustion', () => {
			it('enters lockout when all attempts are exhausted', async () => {
				// Arrange:
				await setupFailedAttempts(PASSCODE_MAX_FAILED_ATTEMPTS - 1);
				const beforeTime = 1000;
				jest.spyOn(Date, 'now').mockReturnValue(beforeTime);

				// Act:
				const result = await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(result.isValid).toBe(false);
				expect(result.isLocked).toBe(true);
				expect(result.remainingAttempts).toBe(0);
				expect(result.lockoutUntil).toBe(beforeTime);
				Date.now.mockRestore();
			});

			it('sets consecutive failures to 1 on first lockout', async () => {
				// Arrange:
				await setupFailedAttempts(PASSCODE_MAX_FAILED_ATTEMPTS - 1);
				const beforeTime = 1000;
				jest.spyOn(Date, 'now').mockReturnValue(beforeTime);

				// Act:
				await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES, '1');
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL, String(beforeTime));
				Date.now.mockRestore();
			});
		});

		describe('lockout behavior', () => {
			it('returns locked result when attempting verification during active lockout', async () => {
				// Arrange:
				await setupActiveLockout();

				// Act:
				const result = await passcodeManager.verify(VALID_PASSCODE);

				// Assert:
				expect(result).toEqual(verifyResultLocked);
			});

			it('does not verify passcode during active lockout', async () => {
				// Arrange:
				await setupActiveLockout();
				const getItemSpy = jest.spyOn(mockSecureStorage, 'getItem');

				// Act:
				await passcodeManager.verify(VALID_PASSCODE);

				// Assert:
				expect(getItemSpy).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL);
				expect(getItemSpy).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES);
				expect(getItemSpy).not.toHaveBeenCalledWith(StorageKey.PIN_HASH);
				expect(getItemSpy).not.toHaveBeenCalledWith(StorageKey.PIN_SALT);
			});
		});

		describe('post-lockout behavior', () => {
			it('allows correct passcode on first attempt after lockout expires', async () => {
				// Arrange:
				await setupExpiredLockout(1);
				jest.clearAllMocks();

				// Act:
				const result = await passcodeManager.verify(VALID_PASSCODE);

				// Assert:
				expect(result).toEqual(verifyResultValid);
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL);
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES);
			});

			it('immediately locks again on first failed attempt after lockout expires', async () => {
				// Arrange:
				const beforeTime = 3000;
				jest.spyOn(Date, 'now').mockReturnValue(beforeTime);
				await mockSecureStorage.setItem(StorageKey.LOCKOUT_UNTIL, String(beforeTime - 1000));
				await setupConsecutiveFailures(1);
				jest.clearAllMocks();

				// Act:
				const result = await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(result.isValid).toBe(false);
				expect(result.isLocked).toBe(true);
				expect(result.remainingAttempts).toBe(0);
				expect(result.lockoutUntil).toBe(beforeTime + PASSCODE_LOCKOUT_DURATION);
				Date.now.mockRestore();
			});

			it('increments consecutive failures on lockout after expired lockout', async () => {
				// Arrange:
				const beforeTime = 3000;
				jest.spyOn(Date, 'now').mockReturnValue(beforeTime);
				await mockSecureStorage.setItem(StorageKey.LOCKOUT_UNTIL, String(beforeTime - 1000));
				await setupConsecutiveFailures(1);
				jest.clearAllMocks();

				// Act:
				await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES, '2');
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(
					StorageKey.LOCKOUT_UNTIL,
					String(beforeTime + PASSCODE_LOCKOUT_DURATION)
				);
				Date.now.mockRestore();
			});
		});

		describe('consecutive failures behavior', () => {
			it('multiplies lockout duration by consecutive failures count', async () => {
				// Arrange:
				await setupFailedAttempts(PASSCODE_MAX_FAILED_ATTEMPTS - 1);
				await setupConsecutiveFailures(2);
				const beforeTime = 5000;
				jest.spyOn(Date, 'now').mockReturnValue(beforeTime);
				const expectedLockoutTime = beforeTime + (2 * PASSCODE_LOCKOUT_DURATION);

				// Act:
				const result = await passcodeManager.verify(INVALID_PASSCODE);

				// Assert:
				expect(result.lockoutUntil).toBe(expectedLockoutTime);
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES, '3');
				Date.now.mockRestore();
			});
		});
	});

	describe('clear', () => {
		it('removes all passcode-related data', async () => {
			// Arrange:
			await setupPasscode(passcodeManager);
			await setupFailedAttempts(3);
			await setupConsecutiveFailures(2);
			await setupActiveLockout();
			jest.clearAllMocks();

			// Act:
			await passcodeManager.clear();

			// Assert:
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.PIN_HASH);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.PIN_SALT);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES);
			expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL);
		});

		it('resets passcode set status', async () => {
			// Arrange:
			await setupPasscode(passcodeManager);

			// Act:
			await passcodeManager.clear();

			// Assert:
			const isSet = await passcodeManager.isPasscodeSet();
			expect(isSet).toBe(false);
		});
	});

	describe('internal state management', () => {
		describe('failed attempts', () => {
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

			it('increments failed attempts', async () => {
				// Act:
				const result = await passcodeManager.incrementFailedAttempts();

				// Assert:
				expect(result).toBe(1);
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.FAILED_ATTEMPTS, '1');
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

		describe('consecutive failures', () => {
			const runGetConsecutiveFailuresTest = (description, config, expected) => {
				it(description, async () => {
					// Arrange:
					if (config.storedValue !== null)
						await mockSecureStorage.setItem(StorageKey.CONSECUTIVE_FAILURES, config.storedValue);

					// Act:
					const result = await passcodeManager.getConsecutiveFailures();

					// Assert:
					expect(result).toBe(expected.failures);
				});
			};

			const getConsecutiveFailuresTests = [
				{
					description: 'returns 0 when no consecutive failures stored',
					config: { storedValue: null },
					expected: { failures: 0 }
				},
				{
					description: 'returns stored consecutive failures count',
					config: { storedValue: '3' },
					expected: { failures: 3 }
				}
			];

			getConsecutiveFailuresTests.forEach(test => {
				runGetConsecutiveFailuresTest(test.description, test.config, test.expected);
			});

			it('resets consecutive failures', async () => {
				// Arrange:
				await setupConsecutiveFailures(3);
				jest.clearAllMocks();

				// Act:
				await passcodeManager.resetConsecutiveFailures();

				// Assert:
				expect(mockSecureStorage.removeItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES);
			});
		});

		describe('lockout', () => {
			it('sets lockout with base duration for first consecutive failure', async () => {
				// Arrange:
				const consecutiveFailures = 0;
				const beforeTime = 2000;
				jest.spyOn(Date, 'now').mockReturnValue(beforeTime);

				// Act:
				const lockoutUntil = await passcodeManager.setLockout(consecutiveFailures);

				// Assert:
				expect(lockoutUntil).toBe(beforeTime);
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL, String(beforeTime));
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES, '1');
				Date.now.mockRestore();
			});

			it('sets lockout with multiplied duration for subsequent failures', async () => {
				// Arrange:
				const consecutiveFailures = 3;
				const beforeTime = 4000;
				jest.spyOn(Date, 'now').mockReturnValue(beforeTime);
				const expectedLockoutTime = beforeTime + (3 * PASSCODE_LOCKOUT_DURATION);

				// Act:
				const lockoutUntil = await passcodeManager.setLockout(consecutiveFailures);

				// Assert:
				expect(lockoutUntil).toBe(expectedLockoutTime);
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.LOCKOUT_UNTIL, String(expectedLockoutTime));
				expect(mockSecureStorage.setItem).toHaveBeenCalledWith(StorageKey.CONSECUTIVE_FAILURES, '4');
				Date.now.mockRestore();
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
		});

		describe('getLockStatus', () => {
			it('returns unlocked status when no lockout is set', async () => {
				// Act:
				const result = await passcodeManager.getLockStatus();

				// Assert:
				expect(result).toEqual(lockStatusUnlocked);
			});

			it('returns locked status with remaining time when lockout is active', async () => {
				// Arrange:
				await setupActiveLockout();
				await setupConsecutiveFailures(2);

				// Act:
				const result = await passcodeManager.getLockStatus();

				// Assert:
				expect(result.isLocked).toBe(true);
				expect(result.lockoutUntil).toBeGreaterThan(Date.now());
				expect(result.consecutiveFailures).toBe(2);
			});

			it('clears expired lockout and returns unlocked with consecutive failures preserved', async () => {
				// Arrange:
				const expiredTime = Date.now() - 1000;
				await mockSecureStorage.setItem(StorageKey.LOCKOUT_UNTIL, String(expiredTime));
				await setupConsecutiveFailures(5);

				// Act:
				const result = await passcodeManager.getLockStatus();

				// Assert:
				expect(result.isLocked).toBe(false);
				expect(result.lockoutUntil).toBeNull();
				expect(result.consecutiveFailures).toBe(5);
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

		it('handles complete lockout cycle with expiry and success', async () => {
			// Arrange:
			await passcodeManager.create(VALID_PASSCODE);

			// Act: Exhaust all attempts
			for (let i = 0; i < PASSCODE_MAX_FAILED_ATTEMPTS; i++)
				await passcodeManager.verify(INVALID_PASSCODE);

			// Assert: Lockout is set and consecutive failures is 1
			const lockStatusAfterFirstCycle = await passcodeManager.getLockStatus();
			expect(lockStatusAfterFirstCycle.isLocked).toBe(false);
			expect(lockStatusAfterFirstCycle.consecutiveFailures).toBe(1);

			// Act: Verify correct passcode after lockout expires
			const result = await passcodeManager.verify(VALID_PASSCODE);

			// Assert: Success and all state reset
			expect(result.isValid).toBe(true);
			expect(result.isLocked).toBe(false);
			const lockStatusAfterSuccess = await passcodeManager.getLockStatus();
			expect(lockStatusAfterSuccess.consecutiveFailures).toBe(0);
		});

		it('handles multiple lockout cycles with increasing durations', async () => {
			// Arrange:
			await passcodeManager.create(VALID_PASSCODE);
			const mockNow = 10000;
			jest.spyOn(Date, 'now').mockReturnValue(mockNow);

			// Act: First lockout cycle
			for (let i = 0; i < PASSCODE_MAX_FAILED_ATTEMPTS; i++)
				await passcodeManager.verify(INVALID_PASSCODE);

			// Assert: First lockout with base duration
			let lockStatus = await passcodeManager.getLockStatus();
			expect(lockStatus.consecutiveFailures).toBe(1);

			// Act: Simulate lockout expiry and second lockout
			Date.now.mockReturnValue(mockNow + PASSCODE_LOCKOUT_DURATION + 1000);
			const secondLockoutResult = await passcodeManager.verify(INVALID_PASSCODE);

			// Assert: Second lockout with duration multiplied by consecutive failures
			expect(secondLockoutResult.isLocked).toBe(true);
			expect(secondLockoutResult.lockoutUntil).toBe(mockNow + PASSCODE_LOCKOUT_DURATION + 1000 + PASSCODE_LOCKOUT_DURATION);
			lockStatus = await passcodeManager.getLockStatus();
			expect(lockStatus.consecutiveFailures).toBe(2);

			Date.now.mockRestore();
		});
	});
});
