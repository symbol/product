import { PASSCODE_LOCKOUT_DURATION_MS, PASSCODE_MAX_FAILED_ATTEMPTS, PASSCODE_PIN_LENGTH } from '@/app/constants';
import { SecureStorageInterface } from '@/app/lib/storage/SecureStorageInterface';
import CryptoJS from 'crypto-js';
import Hex from 'crypto-js/enc-hex';
import PBKDF2 from 'crypto-js/pbkdf2';
import { StorageInterface } from 'wallet-common-core';

const STORAGE_KEY_PIN_HASH = 'pinHash';
const STORAGE_KEY_PIN_SALT = 'pinSalt';
const STORAGE_KEY_FAILED_ATTEMPTS = 'failedAttempts';
const STORAGE_KEY_CONSECUTIVE_FAILURES = 'consecutiveFailures';
const STORAGE_KEY_LOCKOUT_UNTIL = 'lockoutUntil';
const PBKDF2_ITERATIONS = 10000;
const PBKDF2_KEY_SIZE_WORDS = 256 / 32;
const PBKDF2_SALT_SIZE_BYTES = 16;

/**
 * Derives a passcode hash using PBKDF2.
 * @param {string} passcode - The passcode to hash.
 * @param {string} [saltHex] - Optional hex-encoded salt.
 * @returns {Promise<{ hash: string, salt: string }>} - The derived hash and salt.
 */
const derivePasscodeHashPBKDF2 = async (passcode, saltHex) => {
	const salt = saltHex || CryptoJS.lib.WordArray.random(PBKDF2_SALT_SIZE_BYTES).toString(Hex);
	const hash = PBKDF2(passcode, Hex.parse(salt), {
		keySize: PBKDF2_KEY_SIZE_WORDS,
		iterations: PBKDF2_ITERATIONS
	}).toString(Hex);

	return { hash, salt };
};

const safeCompareStrings = (left, right) => {
	if (typeof left !== 'string' || typeof right !== 'string')
		return false;

	const maxLength = Math.max(left.length, right.length);
	let mismatch = left.length ^ right.length;

	for (let i = 0; i < maxLength; i++) {
		const leftCode = i < left.length ? left.charCodeAt(i) : 0;
		const rightCode = i < right.length ? right.charCodeAt(i) : 0;
		mismatch |= leftCode ^ rightCode;
	}

	return mismatch === 0;
};

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
		const { hash, salt } = await derivePasscodeHashPBKDF2(passcode);
		await this.storage.setItem(STORAGE_KEY_PIN_HASH, hash);
		await this.storage.setItem(STORAGE_KEY_PIN_SALT, salt);
		await this.resetFailedAttempts();
		await this.resetConsecutiveFailures();
		await this.clearLockout();
	};

	/**
	 * @typedef {Object} VerifyResult
	 * @property {boolean} isValid - Whether the passcode is correct.
	 * @property {number} remainingAttempts - Remaining attempts before lockout.
	 * @property {boolean} isLocked - Whether the user is currently locked out.
	 * @property {number|null} lockoutUntil - Timestamp until which the user is locked out, or null if not locked.
	 */

	/**
	 * Verify if the provided passcode matches the stored passcode.
	 * @param {string} passcode - The passcode to verify.
	 * @returns {Promise<VerifyResult>} - Verification result and status.
	 */
	verify = async passcode => {
		// await this.resetFailedAttempts();
		// await this.resetConsecutiveFailures();
		// await this.clearLockout();
		const lockStatus = await this.getLockStatus();

		if (lockStatus.isLocked) {
			return { 
				isValid: false, 
				remainingAttempts: 0, 
				isLocked: true,
				lockoutUntil: lockStatus.lockoutUntil
			};
		}

		const storedHash = await this.storage.getItem(STORAGE_KEY_PIN_HASH);
		const storedSalt = await this.storage.getItem(STORAGE_KEY_PIN_SALT);
		const isValid = storedHash && storedSalt
			? safeCompareStrings(storedHash, (await derivePasscodeHashPBKDF2(passcode, storedSalt)).hash)
			: false;

		if (isValid) {
			await this.resetFailedAttempts();
			await this.resetConsecutiveFailures();
			return { 
				isValid: true, 
				remainingAttempts: PASSCODE_MAX_FAILED_ATTEMPTS, 
				isLocked: false,
				lockoutUntil: null
			};
		}

		const { consecutiveFailures } = lockStatus;
		const failedAttempts = await this.incrementFailedAttempts();
		const remainingAttempts = PASSCODE_MAX_FAILED_ATTEMPTS - failedAttempts;

		let lockoutUntil = null;
		if (remainingAttempts <= 0 || consecutiveFailures)
			lockoutUntil = await this.setLockout(consecutiveFailures);

		const isLocked = Boolean(lockoutUntil);
		
		return { 
			isValid: false, 
			remainingAttempts: isLocked ? 0 : Math.max(0, remainingAttempts), 
			isLocked,
			lockoutUntil
		};
	};

	/**
	 * Clear the stored passcode and all related data.
	 * @returns {Promise<void>}
	 */
	clear = async () => {
		await this.storage.removeItem(STORAGE_KEY_PIN_HASH);
		await this.storage.removeItem(STORAGE_KEY_PIN_SALT);
		await this.resetFailedAttempts();
		await this.resetConsecutiveFailures();
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
	 * Get the current number of consecutive failures.
	 * @returns {Promise<number>}
	 */
	getConsecutiveFailures = async () => {
		const failures = await this.storage.getItem(STORAGE_KEY_CONSECUTIVE_FAILURES);
		
		return failures ? parseInt(failures, 10) : 0;
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
	 * Reset consecutive failures counter.
	 * @returns {Promise<void>}
	 */
	resetConsecutiveFailures = async () => {
		await this.storage.removeItem(STORAGE_KEY_CONSECUTIVE_FAILURES);
	};

	/**
	 * Set lockout timestamp.
	 * @param {number} consecutiveFailures - Current consecutive failures count.
	 * @returns {Promise<number>} - The timestamp until which the user is locked out.
	 */
	setLockout = async consecutiveFailures => {
		const lockoutDuration = consecutiveFailures * PASSCODE_LOCKOUT_DURATION_MS;
		const lockoutUntil = Date.now() + lockoutDuration;
		await this.storage.setItem(STORAGE_KEY_LOCKOUT_UNTIL, String(lockoutUntil));
		await this.storage.setItem(STORAGE_KEY_CONSECUTIVE_FAILURES, String(consecutiveFailures + 1));

		return lockoutUntil;
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
	 * @returns {Promise<{isLocked: boolean, lockoutUntil: number, consecutiveFailures: number}>}
	 */
	getLockStatus = async () => {
		const lockoutUntil = await this.storage.getItem(STORAGE_KEY_LOCKOUT_UNTIL);
		const consecutiveFailures = await this.getConsecutiveFailures();

		if (!lockoutUntil) 
			return { isLocked: false, lockoutUntil: null, consecutiveFailures };
		

		const lockoutTime = parseInt(lockoutUntil, 10);
		const now = Date.now();

		if (now >= lockoutTime) {
			await this.clearLockout();
			await this.resetFailedAttempts();
			
			return { 
				isLocked: false, 
				lockoutUntil: null, 
				consecutiveFailures 
			};
		}

		return { 
			isLocked: true, 
			lockoutUntil: lockoutTime, 
			consecutiveFailures 
		};
	};
}
