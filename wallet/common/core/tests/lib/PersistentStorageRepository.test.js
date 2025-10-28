import { PersistentStorageRepository } from '../../src/lib/storage/PersistentStorageRepository';
import { runRepositoryTest } from '../test-utils/repository';

const jsonString = '{"key":"value"}';
const jsonObject = { key: 'value' }; // JSON is already says that it is an object, but added for clarity

const storageTestConfig = [
	{
		key: 'DATA_SCHEMA_VERSION',
		getterName: 'getDataSchemaVersion',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: '1',
		expectedFilledValue: 1,
		setterName: 'setDataSchemaVersion',
		setterArguments: [1],
		storagePayload: '1'
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
	},
	{
		key: 'NETWORK_IDENTIFIER',
		getterName: 'getNetworkIdentifier',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: 'network-1',
		expectedFilledValue: 'network-1',
		setterName: 'setNetworkIdentifier',
		setterArguments: ['network-1'],
		storagePayload: 'network-1'
	},
	{
		key: 'SELECTED_NODE',
		getterName: 'getSelectedNode',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: 'http://localhost:3000',
		expectedFilledValue: 'http://localhost:3000',
		setterName: 'setSelectedNode',
		setterArguments: ['http://localhost:3000'],
		storagePayload: 'http://localhost:3000'
	},
	{
		key: 'CURRENT_ACCOUNT_PUBLIC',
		getterName: 'getCurrentAccountPublicKey',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: 'public-key-1',
		expectedFilledValue: 'public-key-1',
		setterName: 'setCurrentAccountPublicKey',
		setterArguments: ['public-key-1'],
		storagePayload: 'public-key-1'
	},
	{
		key: 'SELECTED_LANGUAGE',
		getterName: 'getSelectedLanguage',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: 'en',
		expectedFilledValue: 'en',
		setterName: 'setSelectedLanguage',
		setterArguments: ['en'],
		storagePayload: 'en'
	},
	{
		key: 'SEED_ADDRESSES',
		getterName: 'getSeedAddresses',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: jsonString,
		expectedFilledValue: jsonObject,
		setterName: 'setSeedAddresses',
		setterArguments: [jsonObject],
		storagePayload: JSON.stringify(jsonObject)
	},
	{
		key: 'LATEST_TRANSACTIONS',
		getterName: 'getLatestTransactions',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: jsonString,
		expectedFilledValue: jsonObject,
		setterName: 'setLatestTransactions',
		setterArguments: [jsonObject],
		storagePayload: JSON.stringify(jsonObject)
	},
	{
		key: 'ACCOUNT_INFOS',
		getterName: 'getAccountInfos',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: jsonString,
		expectedFilledValue: jsonObject,
		setterName: 'setAccountInfos',
		setterArguments: [jsonObject],
		storagePayload: JSON.stringify(jsonObject)
	},
	{
		key: 'ADDRESS_BOOK',
		getterName: 'getAddressBook',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: jsonString,
		expectedFilledValue: jsonObject,
		setterName: 'setAddressBook',
		setterArguments: [jsonObject],
		storagePayload: JSON.stringify(jsonObject)
	},
	{
		key: 'USER_CURRENCY',
		getterName: 'getUserCurrency',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: 'USD',
		expectedFilledValue: 'USD',
		setterName: 'setUserCurrency',
		setterArguments: ['USD'],
		storagePayload: 'USD'
	},
	{
		key: 'NETWORK_PROPERTIES',
		getterName: 'getNetworkProperties',
		emptyStorageValue: null,
		expectedEmptyValue: null,
		filledStorageValue: jsonString,
		expectedFilledValue: jsonObject,
		setterName: 'setNetworkProperties',
		setterArguments: [jsonObject],
		storagePayload: jsonString
	}
];

describe('PersistentStorageRepository', () => {
	runRepositoryTest(PersistentStorageRepository, storageTestConfig);
});
