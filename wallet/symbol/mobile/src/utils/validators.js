import { Bip39 } from '@/app/lib/bip39';
import { relativeToAbsoluteAmount } from 'wallet-common-core';

export const validateRequired =
	(isRequired = true) =>
		str => {
			if (isRequired && str.length === 0) 
				return 'validation_error_field_required';
		
		};

export const validateAccountName = () => str => {
	if (str.length > 15) 
		return 'validation_error_account_name_long';
};

export const validateMnemonic = () => str => {
	const isValidMnemonic = Bip39.validateMnemonic(str.trim());

	if (!isValidMnemonic) 
		return 'validation_error_mnemonic_invalid';
};

export const validateAmount = availableBalance => str => {
	const MAX_DIVISIBILITY = 18;

	if (relativeToAbsoluteAmount(str, MAX_DIVISIBILITY) > relativeToAbsoluteAmount(availableBalance, MAX_DIVISIBILITY))
		return 'validation_error_balance_not_enough';
};
