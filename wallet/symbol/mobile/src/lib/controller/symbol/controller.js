import { symbolNetworkApi } from './api';
import { symbolBridgeHelper } from './bridge';
import { symbolWalletSdk } from './sdk';
import { config } from '@/app/config';
import { PersistentStorageInterface } from '@/app/lib/storage/PersistentStorageInterface';
import { SecureStorageInterface } from '@/app/lib/storage/SecureStorageInterface';
import { makeRequest } from '@/app/utils';
import {
	AddressBookModule,
	BridgeModule,
	ExternalAccountKeystore,
	LocalizationModule,
	MarketModule,
	MnemonicKeystore,
	StorageInterface,
	WalletController
} from 'wallet-common-core';
import { HarvestingModule, TransferModule } from 'wallet-common-symbol';

/** @typedef {import('../../types/Network').NetworkProperties} NetworkProperties */

/**
 * @typedef {Object} WalletControllerModules
 * @property {AddressBookModule} addressBook - The address book module.
 * @property {HarvestingModule} harvesting - The module that handles harvesting information and operations.
 * @property {LocalizationModule} localization - The module that handles localization and language settings.
 * @property {MarketModule} market - The module that handles market information.
 * @property {TransferModule} transfer - The module that handles transfer transaction operations.
 */
const modules = [
	new AddressBookModule(),
	new MarketModule({
		marketApi: symbolNetworkApi.market
	}),
	new TransferModule(),
	new LocalizationModule(),
	new HarvestingModule(),
	new BridgeModule({
		makeRequest,
		bridgeHelper: symbolBridgeHelper
	})
];

/**
 * Symbol wallet controller.
 * @type {WalletController & { modules: WalletControllerModules, networkProperties: NetworkProperties }}
 */
export const symbolWalletController = /** @type {any} */ (
	new WalletController({
		chainName: config.chains.symbol.chainName,
		ticker: config.chains.symbol.ticker,
		api: symbolNetworkApi,
		sdk: symbolWalletSdk,
		persistentStorageInterface: new StorageInterface(PersistentStorageInterface),
		secureStorageInterface: new StorageInterface(SecureStorageInterface),
		keystores: [MnemonicKeystore, ExternalAccountKeystore],
		modules,
		networkIdentifiers: config.networkIdentifiers,
		createDefaultNetworkProperties: networkIdentifier => config.chains.symbol.defaultNetworkProperties[networkIdentifier],
		networkPollingInterval: config.connectionInterval
	})
);
