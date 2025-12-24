/**
 * Checks if an address is known. An address is known if it is in the address book or wallet accounts.
 * @param {string} address - The address.
 * @param {Array} accounts - Wallet accounts.
 * @param {object} addressBook - The address book.
 * @returns {boolean} True if the address is known, false otherwise.
 */
export const isAddressKnown = (address, accounts, addressBook) => {
    if (!address) 
        return false;
    
    const walletAccount = accounts.find(account => address === account.address);
    if (walletAccount) 
        return true;
    
    const contact = addressBook.getContactByAddress(address);
    if (contact) 
        return true;
    
    return false;
};

/**
 * Get the name of an address from the address book or wallet accounts.
 * @param {string} address - The address.
 * @param {object} currentAccount - The current account.
 * @param {Array} accounts - Wallet accounts.
 * @param {object} addressBook - The address book.
 * @returns {string} The name or an address if the name is not found.
 */
export const getAddressName = (address, currentAccount, accounts, addressBook) => {
    if (!address) 
        return '';

    if (address === currentAccount.address) 
        return currentAccount.name;
    
    const walletAccount = accounts.find(account => address === account.address);

    if (walletAccount) 
        return walletAccount.name;
    
    const contact = addressBook.getContactByAddress(address);
    if (contact) 
        return contact.name;
    
    return address;
};
