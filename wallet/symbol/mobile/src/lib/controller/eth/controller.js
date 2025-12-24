import {
	WalletController,
	StorageInterface,
	MnemonicKeystore,
	ExternalAccountKeystore,
	BridgeModule,
} from 'wallet-common-core';
import { PersistentStorageInterface } from '@/app/lib/storage/PersistentStorageInterface';
import { SecureStorageInterface } from '@/app/lib/storage/SecureStorageInterface';
import { makeRequest } from '@/app/utils';
import { config } from '@/app/config';
import { ethereumNetworkApi } from '@/app/lib/controller/eth/api';
import { ethereumWalletSdk } from '@/app/lib/controller/eth/sdk';
import { ethereumBridgeHelper } from '@/app/lib/controller/eth/bridge';
import { TransferModule } from 'wallet-common-ethereum';

/**
 * @typedef {Object} WalletControllerModules
 * @property {TransferModule} transfer - The module that handles transfer transaction operations.
 * @property {BridgeModule} bridge - The module that handles bridge transaction operations.
 */

const modules = [
	new TransferModule(),
	new BridgeModule({
		makeRequest,
		bridgeHelper: ethereumBridgeHelper,
	})
];


/**
 * Wallet controller.
 * @type {WalletController & { modules: WalletControllerModules }}
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
		networkIdentifiers: ['mainnet', 'testnet'],
		createDefaultNetworkProperties: networkIdentifier => config.chains.ethereum.defaultNetworkProperties[networkIdentifier],
		networkPollingInterval: config.connectionInterval,
	})
);
