import { Bip39 } from '@/app/lib/bip39';
import { isAddress, isPrivateKey } from '@/app/utils';
import { safeOperationWithRelativeAmounts } from 'wallet-common-core';

/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/**
 * Returns a validator that checks whether the field is not empty.
 * @param {boolean} [isRequired=true] - Whether the field is required.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateRequired =
	(isRequired = true) =>
		str => {
			if (isRequired && str.length === 0) 
				return 'validation_error_field_required';
		
		};

/**
 * Returns a validator that checks whether an account name is within the allowed length.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateAccountName = () => str => {
	if (str.length > 15) 
		return 'validation_error_account_name_long';
};

/**
 * Returns a validator that checks whether a mnemonic phrase is valid.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateMnemonic = () => str => {
	const isValidMnemonic = Bip39.validateMnemonic(str.trim());

	if (!isValidMnemonic) 
		return 'validation_error_mnemonic_invalid';
};

/**
 * Returns a validator that checks whether an amount does not exceed the available balance.
 * @param {string} availableBalance - The available balance to validate against.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateAmount = availableBalance => str => {
	const MAX_DIVISIBILITY = 18;
	const isAmountGreaterThanBalance = safeOperationWithRelativeAmounts(
		MAX_DIVISIBILITY,
		[str, availableBalance],
		(amount, balance) => (amount > balance ? 1n : 0n)
	);

	if (isAmountGreaterThanBalance !== '0')
		return 'validation_error_balance_not_enough';
};

/**
 * Returns a validator that checks whether a value is a valid address for the given blockchain.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateAddress = chainName => str => {
	const trimmedStr = str.trim();

	if (isAddress(trimmedStr, chainName))
		return;
	
	return 'validation_error_address_invalid';
};

/**
 * Returns a validator that checks whether a value is a valid private key for the given blockchain.
 * @param {ChainName} chainName - The blockchain name (e.g., 'symbol', 'ethereum').
 * @returns {function(string): string|undefined} Validator function.
 */
export const validatePrivateKey = chainName => str => {
	const trimmedStr = str.trim();

	if (isPrivateKey(trimmedStr, chainName))
		return;
	
	return 'validation_error_privateKey_invalid';
};
