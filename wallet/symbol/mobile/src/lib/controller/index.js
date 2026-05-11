import { ethereumNetworkApi } from './ethereum/api';
import { ethereumBridgeHelper } from './ethereum/bridge';
import { ethereumWalletController } from './ethereum/controller';
import { symbolBridgeHelper } from './symbol/bridge';
import { symbolWalletController } from './symbol/controller';
import { makeRequest } from '@/app/utils';
import { BridgePairManager, SwapWorkflowManager } from 'wallet-common-core';
import { UniswapPairManager } from 'wallet-common-ethereum';

const QUOTER_ADDRESS = '0x01eEE36F73aC548c45aD7A6D623fB37fA2221767';
const WETH_ADDRESS = '0x3A8C1bd531b5C1aeFBB9ebc3e021C1251cF4Ccb1';
const WXYM_ADDRESS = '0x5E8343A455F03109B737B6D8b410e4ECCE998cdA';
const SWAP_ROUTER = '0xc50f6b8AcBc6C5852A44371ef31b52122F43c349';
const UNISWAP_POOL_FEE = 3000;

const walletControllers = {
	main: symbolWalletController,
	additional: [
		ethereumWalletController
	]
};

const bridges = [
	// XYM -> wXYM
	new SwapWorkflowManager({
		id: 'symbol-xym-ethereum-wxym-wrap',
		pairManagers: [
			new BridgePairManager({
				id: 'symbol-xym-ethereum-wxym-wrap',
				mode: 'wrap',
				nativeWalletController: symbolWalletController,
				wrappedWalletController: ethereumWalletController,
				nativeBridgeHelper: symbolBridgeHelper,
				wrappedBridgeHelper: ethereumBridgeHelper,
				bridgeUrls: {
					testnet: 'https://bridge.symbol.tools/testnet/ethereum-wrapped',
					mainnet: 'https://bridge.symbol.tools/ethereum-wrapped'
				},
				makeRequest
			})
		]
	}),
	// wXYM -> XYM
	new SwapWorkflowManager({
		id: 'symbol-xym-ethereum-wxym-unwrap',
		pairManagers: [
			new BridgePairManager({
				id: 'symbol-xym-ethereum-wxym-unwrap',
				mode: 'unwrap',
				nativeWalletController: symbolWalletController,
				wrappedWalletController: ethereumWalletController,
				nativeBridgeHelper: symbolBridgeHelper,
				wrappedBridgeHelper: ethereumBridgeHelper,
				bridgeUrls: {
					testnet: 'https://bridge.symbol.tools/testnet/ethereum-wrapped',
					mainnet: 'https://bridge.symbol.tools/ethereum-wrapped'
				},
				makeRequest
			})
		]
	}),
	// XYM -> ETH
	new SwapWorkflowManager({
		id: 'symbol-xym-ethereum-eth-wrap',
		pairManagers: [
			new BridgePairManager({
				id: 'symbol-xym-ethereum-eth-wrap',
				mode: 'wrap',
				nativeWalletController: symbolWalletController,
				wrappedWalletController: ethereumWalletController,
				nativeBridgeHelper: symbolBridgeHelper,
				wrappedBridgeHelper: ethereumBridgeHelper,
				bridgeUrls: {
					testnet: 'https://bridge.symbol.tools/testnet/ethereum-native',
					mainnet: 'https://bridge.symbol.tools/ethereum-native'
				},
				makeRequest
			})
		]
	}),
	// wETH -> wXYM (Uniswap)
	new SwapWorkflowManager({
		id: 'ethereum-weth-wxym-uniswap',
		pairManagers: [
			new UniswapPairManager({
				id: 'ethereum-weth-wxym-uniswap',
				mode: 'wrap',
				walletController: ethereumWalletController,
				uniswapApi: ethereumNetworkApi.uniswap,
				transactionApi: ethereumNetworkApi.transaction,
				nativeTokenId: WETH_ADDRESS,
				wrappedTokenId: WXYM_ADDRESS,
				quoterAddress: QUOTER_ADDRESS,
				swapRouterAddress: SWAP_ROUTER,
				poolFee: UNISWAP_POOL_FEE
			})
		]
	})
];

export default symbolWalletController;
export { 
	symbolWalletController, 
	ethereumWalletController,
	walletControllers, 
	bridges
};


