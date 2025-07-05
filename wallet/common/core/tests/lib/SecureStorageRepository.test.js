import { SecureStorageRepository } from '../../src/lib/storage/SecureStorageRepository';
import { mnemonic } from '../fixtures/wallet';
import { runRepositoryTest } from '../test-utils/repository';

const jsonString = '{"key":"value"}';
const jsonObject = { key: 'value' }; // JSON is already says that it is an object, but added for clarity

const storageTestConfig = [
	{
		key: 'MNEMONIC',
		getterName: 'getMnemonic',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: mnemonic,
		expectedFilledValue: mnemonic,
		setterName: 'setMnemonic',
		setterArguments: [mnemonic],
		storagePayload: mnemonic
	},
	{
		key: 'ACCOUNTS',
		getterName: 'getAccounts',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: jsonString,
		expectedFilledValue: jsonObject,
		setterName: 'setAccounts',
		setterArguments: [jsonObject],
		storagePayload: jsonString
	}
];

describe('SecureStorageRepository', () => {
	runRepositoryTest(SecureStorageRepository, storageTestConfig);
});
