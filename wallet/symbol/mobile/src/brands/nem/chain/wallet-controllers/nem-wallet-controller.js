import { config } from '@/app/config';
import { cachedMakeRequest } from '@/app/lib/cache';
import { PersistentStorageInterface } from '@/app/lib/storage/PersistentStorageInterface';
import { SecureStorageInterface } from '@/app/lib/storage/SecureStorageInterface';
import {
	AddressBookModule,
	ExternalAccountKeystore,
	LocalizationModule,
	MarketModule,
	MnemonicKeystore,
	StorageInterface,
	WalletController
} from 'wallet-common-core';
import { Api, TransferModule, sdk as nemWalletSdk } from 'wallet-common-nem';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */

const nemNetworkApi = new Api({
	makeRequest: cachedMakeRequest,
	config: {
		nodewatchURL: config.chains.nem.nodewatchURL,
		marketCurrencies: config.marketCurrencies,
		marketDataURL: config.chains.nem.marketDataURL
	}
});

const modules = [
	new AddressBookModule(),
	new MarketModule({
		marketApi: nemNetworkApi.market
	}),
	new TransferModule(),
	new LocalizationModule()
];

/**
 * NEM wallet controller.
 * @type {MainWalletController}
 */
export const nemWalletController = /** @type {any} */ (
	new WalletController({
		chainName: config.chains.nem.chainName,
		ticker: config.chains.nem.ticker,
		api: nemNetworkApi,
		sdk: nemWalletSdk,
		persistentStorageInterface: new StorageInterface(PersistentStorageInterface),
		secureStorageInterface: new StorageInterface(SecureStorageInterface),
		keystores: [MnemonicKeystore, ExternalAccountKeystore],
		modules,
		networkIdentifiers: config.networkIdentifiers,
		createDefaultNetworkProperties: networkIdentifier => config.chains.nem.defaultNetworkProperties[networkIdentifier],
		networkPollingInterval: config.connectionInterval
	})
);
