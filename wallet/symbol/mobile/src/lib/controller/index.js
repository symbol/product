import { BridgeManager } from 'wallet-common-core';
import { symbolWalletController } from './symbol/controller';
import { ethereumWalletController } from './eth/controller';
import { makeRequest } from '@/app/utils';

const controllers = {
    main: symbolWalletController,
    additional: [
        ethereumWalletController
    ]
};

const bridges = [
    new BridgeManager({
        nativeWalletController: symbolWalletController,
        wrappedWalletController: ethereumWalletController,
        bridgeUrls: {
            testnet: 'https://bridge.symbol.tools/testnet/ethereum-wrapped',
            mainnet: 'https://bridge.symbol.tools/ethereum-wrapped',
        },
        makeRequest
    })
]

export default symbolWalletController;
export { ethereumWalletController, controllers, bridges };


