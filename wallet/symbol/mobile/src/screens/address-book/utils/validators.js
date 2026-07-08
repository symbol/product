/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Wallet').AddressBookModule} AddressBookModule */

/**
 * Creates a validator that checks whether a field value is unique
 * across both the address book and the wallet accounts.
 * @param {WalletAccount[]} walletAccounts - List of accounts in the wallet.
 * @param {AddressBookModule} addressBook - The address book module containing existing contacts.
 * @param {function(object): string} getField - Function that extracts the field to compare from an item.
 * @param {string} [ignoredContactId] - Contact id to ignore while checking address book duplicates.
 * @returns {function(string): string|undefined} Validator function.
 */
const createUniqueValidator = (walletAccounts, addressBook, getField, ignoredContactId) => value => {
	const trimmedValue = value.trim();

	if (!trimmedValue)
		return;

	const lowerTrimmedValue = trimmedValue.toLowerCase();

	if (addressBook.contacts.some(contact => {
		if (contact.id === ignoredContactId)
			return false;

		return getField(contact).toLowerCase() === lowerTrimmedValue;
	}))
		return 'validation_error_already_exists';

	if (walletAccounts.some(account => getField(account).toLowerCase() === lowerTrimmedValue))
		return 'validation_error_already_exists';
};

/**
 * Returns a validator that checks whether the contact name is unique
 * across both the address book and the wallet accounts.
 * @param {WalletAccount[]} walletAccounts - List of accounts in the wallet.
 * @param {AddressBookModule} addressBook - The address book module containing existing contacts.
 * @param {string} [ignoredContactId] - Contact id to ignore while checking address book duplicates.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateUniqueContactName = (walletAccounts, addressBook, ignoredContactId) =>
	createUniqueValidator(walletAccounts, addressBook, item => item.name, ignoredContactId);

/**
 * Returns a validator that checks whether the contact address is unique
 * across both the address book and the wallet accounts.
 * @param {WalletAccount[]} walletAccounts - List of accounts in the wallet.
 * @param {AddressBookModule} addressBook - The address book module containing existing contacts.
 * @param {string} [ignoredContactId] - Contact id to ignore while checking address book duplicates.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateUniqueContactAddress = (walletAccounts, addressBook, ignoredContactId) =>
	createUniqueValidator(walletAccounts, addressBook, item => item.address, ignoredContactId);
