import { ethereumWalletController } from './ethereum/controller';
import { symbolWalletController } from './symbol/controller';
import { makeRequest } from '@/app/utils';
import { BridgeManager } from 'wallet-common-core';

const walletControllers = {
	main: symbolWalletController,
	additional: [
		ethereumWalletController
	]
};

const bridges = [
	new BridgeManager({
		id: 'symbol-xym-ethereum-wxym',
		nativeWalletController: symbolWalletController,
		wrappedWalletController: ethereumWalletController,
		bridgeUrls: {
			testnet: 'https://bridge.symbol.tools/testnet/ethereum-wrapped',
			mainnet: 'https://bridge.symbol.tools/ethereum-wrapped'
		},
		makeRequest
	})
];

export default symbolWalletController;
export { 
	symbolWalletController, 
	ethereumWalletController,
	walletControllers, 
	bridges
};


