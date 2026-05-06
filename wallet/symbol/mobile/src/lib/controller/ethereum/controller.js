import { ethereumNetworkApi } from './api';
import { ethereumWalletSdk } from './sdk';
import { config } from '@/app/config';
import { PersistentStorageInterface } from '@/app/lib/storage/PersistentStorageInterface';
import { SecureStorageInterface } from '@/app/lib/storage/SecureStorageInterface';
import {
	ExternalAccountKeystore,
	MnemonicKeystore,
	StorageInterface,
	WalletController
} from 'wallet-common-core';
import { TransferModule } from 'wallet-common-ethereum';

/** @typedef {import('@/app/types/Wallet').AdditionalWalletController} AdditionalWalletController */

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
