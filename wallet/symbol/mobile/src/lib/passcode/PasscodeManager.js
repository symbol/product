import { PASSCODE_LOCKOUT_DURATION_MS, PASSCODE_MAX_FAILED_ATTEMPTS, PASSCODE_PIN_LENGTH } from '@/app/constants';
import { SecureStorageInterface } from '@/app/lib/storage/SecureStorageInterface';
import SHA256 from 'crypto-js/sha256';
import { StorageInterface } from 'wallet-common-core';

const STORAGE_KEY_PIN_HASH = 'pinHash';
const STORAGE_KEY_FAILED_ATTEMPTS = 'failedAttempts';
const STORAGE_KEY_LOCKOUT_UNTIL = 'lockoutUntil';

/**
 * Hashes a passcode using SHA256.
 * @param {string} passcode - The passcode to hash.
 * @returns {string} - The hashed passcode.
 */
const hashPasscode = passcode => SHA256(passcode).toString();

export class PasscodeManager {
	constructor() {
		const secureStorage = new StorageInterface(SecureStorageInterface);
		this.storage = secureStorage.createScope('passcode');
	}

	/**
	 * Check if passcode is set.
	 * @returns {Promise<boolean>} - True if passcode is set, false otherwise.
	 */
	isPasscodeSet = async () => {
		const pinHash = await this.storage.getItem(STORAGE_KEY_PIN_HASH);
		
		return pinHash !== null;
	};

	/**
	 * Get the required passcode length.
	 * @returns {number} - The passcode length.
	 */
	getPasscodeLength = () => PASSCODE_PIN_LENGTH;

	/**
	 * Get the maximum failed attempts allowed.
	 * @returns {number} - The maximum failed attempts.
	 */
	getMaxAttempts = () => PASSCODE_MAX_FAILED_ATTEMPTS;


	/**
	 * Create and store a new passcode.
	 * @param {string} passcode - The passcode to store.
	 * @returns {Promise<void>}
	 * @throws {Error} If passcode is invalid.
	 */
	create = async passcode => {
		this.validatePasscodeFormat(passcode);
		const hash = hashPasscode(passcode);
		await this.storage.setItem(STORAGE_KEY_PIN_HASH, hash);
		await this.resetFailedAttempts();
	};

	/**
	 * Verify if the provided passcode matches the stored passcode.
	 * @param {string} passcode - The passcode to verify.
	 * @returns {Promise<{isValid: boolean, remainingAttempts: number, isLocked: boolean}>}
	 */
	verify = async passcode => {
		const lockStatus = await this.getLockStatus();

		if (lockStatus.isLocked)
			return { isValid: false, remainingAttempts: 0, isLocked: true };

		const storedHash = await this.storage.getItem(STORAGE_KEY_PIN_HASH);
		const inputHash = hashPasscode(passcode);
		const isValid = storedHash === inputHash;

		if (isValid) {
			await this.resetFailedAttempts();
			return { isValid: true, remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS, isLocked: false };
		}

		const failedAttempts = await this.incrementFailedAttempts();
		const remainingAttempts = PASSCODE_MAX_FAILED_ATTEMPTS - failedAttempts;

		if (remainingAttempts <= 0)
			await this.setLockout();

		return { isValid: false, remainingAttempts: Math.max(0, remainingAttempts), isLocked: remainingAttempts <= 0 };
	};

	/**
	 * Clear the stored passcode and all related data.
	 * @returns {Promise<void>}
	 */
	clear = async () => {
		await this.storage.removeItem(STORAGE_KEY_PIN_HASH);
		await this.resetFailedAttempts();
		await this.clearLockout();
	};

	/**
	 * Validate passcode format.
	 * @param {string} passcode - The passcode to validate.
	 * @throws {Error} If passcode format is invalid.
	 */
	validatePasscodeFormat = passcode => {
		if (typeof passcode !== 'string')
			throw new Error('Passcode must be a string');

		if (passcode.length !== PASSCODE_PIN_LENGTH)
			throw new Error(`Passcode must be ${PASSCODE_PIN_LENGTH} digits`);

		if (!/^\d+$/.test(passcode))
			throw new Error('Passcode must contain only digits');
	};

	/**
	 * Get the current number of failed attempts.
	 * @returns {Promise<number>}
	 */
	getFailedAttempts = async () => {
		const attempts = await this.storage.getItem(STORAGE_KEY_FAILED_ATTEMPTS);
		
		return attempts ? parseInt(attempts, 10) : 0;
	};

	/**
	 * Increment failed attempts counter.
	 * @returns {Promise<number>} - The new failed attempts count.
	 */
	incrementFailedAttempts = async () => {
		const current = await this.getFailedAttempts();
		const newCount = current + 1;
		await this.storage.setItem(STORAGE_KEY_FAILED_ATTEMPTS, String(newCount));
		
		return newCount;
	};

	/**
	 * Reset failed attempts counter.
	 * @returns {Promise<void>}
	 */
	resetFailedAttempts = async () => {
		await this.storage.removeItem(STORAGE_KEY_FAILED_ATTEMPTS);
	};

	/**
	 * Set lockout timestamp.
	 * @returns {Promise<void>}
	 */
	setLockout = async () => {
		const lockoutUntil = Date.now() + PASSCODE_LOCKOUT_DURATION_MS;
		await this.storage.setItem(STORAGE_KEY_LOCKOUT_UNTIL, String(lockoutUntil));
	};

	/**
	 * Clear lockout.
	 * @returns {Promise<void>}
	 */
	clearLockout = async () => {
		await this.storage.removeItem(STORAGE_KEY_LOCKOUT_UNTIL);
	};

	/**
	 * Get lock status.
	 * @returns {Promise<{isLocked: boolean, remainingTimeMs: number}>}
	 */
	getLockStatus = async () => {
		const lockoutUntil = await this.storage.getItem(STORAGE_KEY_LOCKOUT_UNTIL);

		if (!lockoutUntil)
			return { isLocked: false, remainingTimeMs: 0 };

		const lockoutTime = parseInt(lockoutUntil, 10);
		const now = Date.now();

		if (now >= lockoutTime) {
			await this.clearLockout();
			await this.resetFailedAttempts();
			return { isLocked: false, remainingTimeMs: 0 };
		}

		return { isLocked: true, remainingTimeMs: lockoutTime - now };
	};
}
