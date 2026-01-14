import { Bip39 } from '@/app/lib/bip39';

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
