/** @typedef {import('@/app/types/Account').WalletAccount} WalletAccount */
/** @typedef {import('@/app/types/Wallet').AddressBookModule} AddressBookModule */

/**
 * Returns a validator that checks whether the contact name is unique
 * across both the address book and the wallet accounts.
 * @param {WalletAccount[]} walletAccounts - List of accounts in the wallet.
 * @param {AddressBookModule} addressBook - The address book module containing existing contacts.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateUniqueContactName = (walletAccounts, addressBook) => name => {
	const trimmedName = name.trim();

	if (!trimmedName)
		return;

	const lowerTrimmedName = trimmedName.toLowerCase();

	const isDuplicateInAddressBook = addressBook.contacts.some(contact => contact.name.toLowerCase() === lowerTrimmedName);

	if (isDuplicateInAddressBook)
		return 'validation_error_already_exists';

	const isDuplicateInWalletAccounts = walletAccounts.some(account => account.name.toLowerCase() === lowerTrimmedName);

	if (isDuplicateInWalletAccounts)
		return 'validation_error_already_exists';

	return;
};

/**
 * Returns a validator that checks whether the contact address is unique
 * across both the address book and the wallet accounts.
 * @param {WalletAccount[]} walletAccounts - List of accounts in the wallet.
 * @param {AddressBookModule} addressBook - The address book module containing existing contacts.
 * @returns {function(string): string|undefined} Validator function.
 */
export const validateUniqueContactAddress = (walletAccounts, addressBook) => address => {
	const trimmedAddress = address.trim();

	if (!trimmedAddress)
		return;

	const lowerTrimmedAddress = trimmedAddress.toLowerCase();

	const isDuplicateInAddressBook = addressBook.contacts.some(contact => contact.address.toLowerCase() === lowerTrimmedAddress);

	if (isDuplicateInAddressBook)
		return 'validation_error_already_exists';

	const isDuplicateInWalletAccounts = walletAccounts.some(account => account.address.toLowerCase() === lowerTrimmedAddress);

	if (isDuplicateInWalletAccounts)
		return 'validation_error_already_exists';

	return;
};
