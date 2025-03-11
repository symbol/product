import { AddressBookModule } from '@/app/lib/controller/modules/AddressBookModule';
import { AppError } from '@/app/lib/error';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => ({ v4: jest.fn() }));

describe('modules/AddressBookModule', () => {
    let rootMock;
    let persistentStorageMock;
    let module;

    beforeEach(() => {
        persistentStorageMock = {
            getAddressBook: jest.fn().mockResolvedValue({}),
            setAddressBook: jest.fn().mockResolvedValue(),
        };

        rootMock = {
            _persistentStorage: persistentStorageMock,
            networkIdentifier: 'testnet',
        };

        module = new AddressBookModule({ root: rootMock, isObservable: false });
    });

    describe('get contacts()', () => {
        it('returns contacts for the current network', () => {
            // Arrange:
            module._state.addressBook = {
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            };
            const expectedContacts = [{ id: '1', address: 'A1', name: 'Alice' }];

            // Act:
            const contacts = module.contacts;

            // Assert:
            expect(contacts).toEqual(expectedContacts);
        });
    });

    describe('get blackList()', () => {
        it('returns blacklisted contacts for the current network', () => {
            // Arrange:
            module._state.addressBook = {
                testnet: [
                    { id: '1', address: 'A1', name: 'Alice', isBlackListed: true },
                    { id: '2', address: 'A2', name: 'Bob', isBlackListed: false },
                ],
            };
            const expectedBlackList = [{ id: '1', address: 'A1', name: 'Alice', isBlackListed: true }];

            // Act:
            const blackList = module.blackList;

            // Assert:
            expect(blackList).toEqual(expectedBlackList);
        });
    });

    describe('get whiteList()', () => {
        it('returns whitelisted contacts for the current network', () => {
            // Arrange:
            module._state.addressBook = {
                testnet: [
                    { id: '1', address: 'A1', name: 'Alice', isBlackListed: true },
                    { id: '2', address: 'A2', name: 'Bob', isBlackListed: false },
                ],
            };
            const expectedWhiteList = [{ id: '2', address: 'A2', name: 'Bob', isBlackListed: false }];

            // Act:
            const whiteList = module.whiteList;

            // Assert:
            expect(whiteList).toEqual(expectedWhiteList);
        });
    });

    describe('loadCache', () => {
        it('loads the address book from the persistent storage', async () => {
            // Arrange:
            const addressBook = { testnet: [{ id: '1', address: 'A1', name: 'Alice' }] };
            persistentStorageMock.getAddressBook.mockResolvedValue(addressBook);

            // Act:
            await module.loadCache();

            // Assert:
            expect(module._state.addressBook).toEqual(addressBook);
        });
    });

    describe('getContactById', () => {
        it('returns a contact by its id', () => {
            // Arrange:
            module._state.addressBook = {
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            };
            const contactId = '1';
            const expectedContact = { id: '1', address: 'A1', name: 'Alice' };

            // Act:
            const contact = module.getContactById(contactId);

            // Assert:
            expect(contact).toEqual(expectedContact);
        });

        it('returns null when contact is not found', () => {
            // Arrange:
            module._state.addressBook = {
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            };
            const contactId = '2';
            const expectedResult = null;

            // Act:
            const contact = module.getContactById(contactId);

            // Assert:
            expect(contact).toBe(expectedResult);
        });
    });

    describe('getContactByAddress', () => {
        it('returns a contact by its address', () => {
            // Arrange:
            module._state.addressBook = {
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            };
            const contactAddress = 'A1';
            const expectedContact = { id: '1', address: 'A1', name: 'Alice' };

            // Act:
            const contact = module.getContactByAddress(contactAddress);

            // Assert:
            expect(contact).toEqual(expectedContact);
        });

        it('returns null when contact is not found', () => {
            // Arrange:
            module._state.addressBook = {
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            };
            const contactAddress = 'A2';
            const expectedResult = null;

            // Act:
            const contact = module.getContactByAddress(contactAddress);

            // Assert:
            expect(contact).toBe(expectedResult);
        });
    });

    describe('addContact', () => {
        it('adds a new contact', async () => {
            // Arrange:
            uuidv4.mockReturnValue('generated-id');
            persistentStorageMock.getAddressBook.mockResolvedValue({ testnet: [] });
            const newContact = { address: 'A1', name: 'Alice' };
            const expectedAddressBook = {
                testnet: [{ id: 'generated-id', address: 'A1', name: 'Alice', notes: '', isBlackListed: false }],
            };

            // Act:
            await module.addContact(newContact);

            // Assert:
            expect(persistentStorageMock.setAddressBook).toHaveBeenCalledWith(expectedAddressBook);
        });

        it('throws an error when contact already exists', async () => {
            // Arrange:
            persistentStorageMock.getAddressBook.mockResolvedValue({
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            });
            const newContact = { address: 'A1', name: 'Alice' };
            const expectedError = new AppError(
                'error_failed_add_contact_already_exists',
                'Failed to add contact. Contact with address "A1" already exists'
            );

            // Act: & Assert
            await expect(module.addContact(newContact)).rejects.toThrow(expectedError);
        });
    });

    describe('removeContact', () => {
        it('removes an existing contact', async () => {
            // Arrange:
            persistentStorageMock.getAddressBook.mockResolvedValue({
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            });
            const contactId = '1';
            const expectedAddressBook = { testnet: [] };

            // Act:
            await module.removeContact(contactId);

            // Assert:
            expect(persistentStorageMock.setAddressBook).toHaveBeenCalledWith(expectedAddressBook);
        });

        it('throws an error when contact is not found', async () => {
            // Arrange:
            persistentStorageMock.getAddressBook.mockResolvedValue({ testnet: [] });
            const contactId = '1';
            const expectedError = new AppError(
                'error_failed_remove_contact_not_found',
                'Failed to remove contact. Contact with id "1" not found'
            );

            // Act: & Assert
            await expect(module.removeContact(contactId)).rejects.toThrow(expectedError);
        });
    });

    describe('updateContact', () => {
        it('updates an existing contact', async () => {
            // Arrange:
            persistentStorageMock.getAddressBook.mockResolvedValue({
                testnet: [{ id: '1', address: 'A1', name: 'Alice' }],
            });
            const updatedContact = { id: '1', address: 'A1', name: 'Alice Updated' };
            const expectedAddressBook = {
                testnet: [{ id: '1', address: 'A1', name: 'Alice Updated', notes: '', isBlackListed: false }],
            };

            // Act:
            await module.updateContact(updatedContact);

            // Assert:
            expect(persistentStorageMock.setAddressBook).toHaveBeenCalledWith(expectedAddressBook);
        });

        it('throws an error when contact is not found', async () => {
            // Arrange:
            persistentStorageMock.getAddressBook.mockResolvedValue({ testnet: [] });
            const updatedContact = { id: '1', address: 'A1', name: 'Alice' };
            const expectedError = new AppError(
                'error_failed_update_contact_not_found',
                'Failed to update contact. Contact with id "1" not found'
            );

            // Act: & Assert
            await expect(module.updateContact(updatedContact)).rejects.toThrow(expectedError);
        });
    });
});
