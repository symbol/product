import { config } from '@/app/config';
import { cachedMakeRequest } from '@/app/lib/cache';
import { PersistentStorageInterface } from '@/app/lib/storage/PersistentStorageInterface';
import { SecureStorageInterface } from '@/app/lib/storage/SecureStorageInterface';
import {
	ExternalAccountKeystore,
	MnemonicKeystore,
	StorageInterface,
	WalletController
} from 'wallet-common-core';
import { Api, TransferModule, sdk as ethereumWalletSdk } from 'wallet-common-ethereum';

/** @typedef {import('@/app/types/Wallet').AdditionalWalletController} AdditionalWalletController */

const ethereumNetworkApi = new Api({
	makeRequest: cachedMakeRequest,
	config: {
		nodeList: config.chains.ethereum.nodeList,
		erc20TokensAddresses: config.chains.ethereum.erc20TokensAddresses
	}
});

const modules = [
	new TransferModule()
];

/**
 * Wallet controller.
 * @type {AdditionalWalletController}
 */
export const ethereumWalletController = /** @type {any} */ (
	new WalletController({
		chainName: config.chains.ethereum.chainName,
		ticker: config.chains.ethereum.ticker,
		api: ethereumNetworkApi,
		sdk: ethereumWalletSdk,
		persistentStorageInterface: new StorageInterface(PersistentStorageInterface).createScope('ethereum'),
		secureStorageInterface: new StorageInterface(SecureStorageInterface).createScope('ethereum'),
		keystores: [MnemonicKeystore, ExternalAccountKeystore],
		modules,
		networkIdentifiers: config.networkIdentifiers,
		createDefaultNetworkProperties: networkIdentifier => config.chains.ethereum.defaultNetworkProperties[networkIdentifier],
		networkPollingInterval: config.connectionInterval
	})
);
