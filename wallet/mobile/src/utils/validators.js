import { MnemonicPassPhrase } from 'symbol-hd-wallets';

export const validateRequired = () => str => {
    if (str.length === 0) {
        return 'validation_error_field_required';
    }
}

export const validateAccountName = () => str => {
    if (str.length > 15) {
        return 'validation_error_contact_name_long';
    }
}

export const validateMnemonic = () => str => {
    const mnemonicPassPhrase = new MnemonicPassPhrase(str.trim());
    const isValidMnemonic = mnemonicPassPhrase.isValid();

    if (!isValidMnemonic) {
        return 'validation_error_mnemonic_invalid';
    }
}

export const validateMnemonicWord = () => str => {
    if (str.length > 15) {
        return 'validation_error_contact_name_long';
    }
}
