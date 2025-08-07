import { ControllerError } from '../../src/error/ControllerError';
import { AddressBookModule } from '../../src/lib/modules/AddressBookModule';
import { networkIdentifiers } from '../fixtures/wallet';
import { createStorageMock } from '../test-utils/storage';
import { jest } from '@jest/globals';

describe('AddressBookModule', () => {
	let persistentStorageInterface;
	let addressBookModule;
	let onStateChange;
	let root;

	const contact1 = {
		id: 'TCF3372B2Y5NFO2NXI7ZEOB625YJ63J6B5R5QYQ',
		address: 'TCF3372B2Y5NFO2NXI7ZEOB625YJ63J6B5R5QYQ',
		name: 'Test Contact 1',
		notes: 'Some notes',
		isBlackListed: false
	};

	const contact2 = {
		id: 'TD2Q23PU5TBA25BF2U7E53Y23X5Y5X5Y5X5Y5X5',
		address: 'TD2Q23PU5TBA25BF2U7E53Y23X5Y5X5Y5X5Y5X5',
		name: 'Test Contact 2',
		isBlackListed: true
	};

	beforeEach(() => {
		persistentStorageInterface = createStorageMock({});
		root = { networkIdentifier: 'testnet' };
		onStateChange = jest.fn();

		addressBookModule = new AddressBookModule({
			persistentStorageInterface,
			root,
			networkIdentifiers,
			onStateChange
		});
		addressBookModule._persistentStorageRepository.getAddressBook = jest.fn();
		addressBookModule._persistentStorageRepository.setAddressBook = jest.fn();
	});

	it('has correct static name', () => {
		// Assert:
		expect(AddressBookModule.name).toBe('addressBook');
	});

	describe('initial state', () => {
		it('starts with an empty address book', () => {
			// Assert:
			expect(addressBookModule.contacts).toStrictEqual([]);
			expect(addressBookModule.whiteList).toStrictEqual([]);
			expect(addressBookModule.blackList).toStrictEqual([]);
		});
	});

	describe('loadCache()', () => {
		it('loads address book from persistent storage', async () => {
			// Arrange:
			const storedAddressBook = {
				testnet: [contact1, contact2],
				mainnet: []
			};
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue(storedAddressBook);

			// Act:
			await addressBookModule.loadCache();

			// Assert:
			expect(addressBookModule._persistentStorageRepository.getAddressBook).toHaveBeenCalled();
			expect(addressBookModule.contacts).toStrictEqual([contact1, contact2]);
			expect(addressBookModule.whiteList).toStrictEqual([contact1]);
			expect(addressBookModule.blackList).toStrictEqual([contact2]);
			expect(onStateChange).toHaveBeenCalled();
		});
	});

	describe('clear()', () => {
		it('resets state', async () => {
			// Arrange:
			const storedAddressBook = { testnet: [contact1], mainnet: [] };
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue(storedAddressBook);
			await addressBookModule.loadCache();
			expect(addressBookModule.contacts).toHaveLength(1);

			// Act:
			addressBookModule.clear();

			// Assert:
			expect(addressBookModule.contacts).toStrictEqual([]);
			expect(onStateChange).toHaveBeenCalled();
		});
	});

	describe('addContact()', () => {
		it('adds a new contact and persists it', async () => {
			// Arrange:
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue({ testnet: [], mainnet: [] });
			addressBookModule._persistentStorageRepository.setAddressBook.mockResolvedValue(undefined);

			// Act:
			await addressBookModule.addContact(contact1);

			// Assert:
			const expectedContact = { ...contact1, notes: 'Some notes', isBlackListed: false };
			expect(addressBookModule.contacts).toStrictEqual([expectedContact]);
			expect(addressBookModule._persistentStorageRepository.setAddressBook).toHaveBeenCalledWith({
				testnet: [expectedContact],
				mainnet: []
			});
			expect(onStateChange).toHaveBeenCalled();
		});

		it('throws an error if contact with the same address exists', async () => {
			// Arrange:
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue({ testnet: [contact1], mainnet: [] });

			// Act & Assert:
			await expect(addressBookModule.addContact(contact1))
				.rejects.toThrow(new ControllerError(
					`Failed to add contact. Contact with address "${contact1.address}" already exists`,
					'error_failed_add_contact_already_exists'
				));
		});
	});

	describe('removeContact()', () => {
		it('removes an existing contact and persists the change', async () => {
			// Arrange:
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue({ testnet: [contact1, contact2], mainnet: [] });
			addressBookModule._persistentStorageRepository.setAddressBook.mockResolvedValue(undefined);

			// Act:
			await addressBookModule.removeContact(contact1.id);

			// Assert:
			expect(addressBookModule.contacts).toStrictEqual([contact2]);
			expect(addressBookModule._persistentStorageRepository.setAddressBook).toHaveBeenCalledWith({
				testnet: [contact2],
				mainnet: []
			});
			expect(onStateChange).toHaveBeenCalled();
		});

		it('throws an error if contact to remove is not found', async () => {
			// Arrange:
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue({ testnet: [contact2], mainnet: [] });

			// Act & Assert:
			await expect(addressBookModule.removeContact(contact1.id))
				.rejects.toThrow(new ControllerError(
					`Failed to remove contact. Contact with id "${contact1.id}" not found`,
					'error_failed_remove_contact_not_found'
				));
		});
	});

	describe('updateContact()', () => {
		it('updates an existing contact and persists the change', async () => {
			// Arrange:
			const updatedContact = { ...contact1, name: 'Updated Name' };
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue({ testnet: [contact1], mainnet: [] });
			addressBookModule._persistentStorageRepository.setAddressBook.mockResolvedValue(undefined);

			// Act:
			await addressBookModule.updateContact(updatedContact);

			// Assert:
			expect(addressBookModule.contacts[0].name).toBe('Updated Name');
			expect(addressBookModule._persistentStorageRepository.setAddressBook).toHaveBeenCalledWith({
				testnet: [updatedContact],
				mainnet: []
			});
			expect(onStateChange).toHaveBeenCalled();
		});

		it('throws an error if contact to update is not found', async () => {
			// Arrange:
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue({ testnet: [], mainnet: [] });

			// Act & Assert:
			await expect(addressBookModule.updateContact(contact1))
				.rejects.toThrow(new ControllerError(
					`Failed to update contact. Contact with id "${contact1.id}" not found`,
					'error_failed_update_contact_not_found'
				));
		});
	});

	describe('getters', () => {
		beforeEach(async () => {
			const storedAddressBook = { testnet: [contact1, contact2], mainnet: [] };
			addressBookModule._persistentStorageRepository.getAddressBook.mockResolvedValue(storedAddressBook);
			await addressBookModule.loadCache();
		});

		it('getContactById returns the correct contact or null', () => {
			expect(addressBookModule.getContactById(contact1.id)).toStrictEqual(contact1);
			expect(addressBookModule.getContactById('non-existent-id')).toBeNull();
		});

		it('getContactByAddress returns the correct contact or null', () => {
			expect(addressBookModule.getContactByAddress(contact2.address)).toStrictEqual(contact2);
			expect(addressBookModule.getContactByAddress('non-existent-address')).toBeNull();
		});
	});
});
