import { ethereumNetworkApi } from './ethereum/api';
import { ethereumBridgeHelper } from './ethereum/bridge';
import { ethereumWalletController } from './ethereum/controller';
import { symbolBridgeHelper } from './symbol/bridge';
import { symbolWalletController } from './symbol/controller';
import { config } from '@/app/config';
import { makeRequest } from '@/app/utils';
import { BridgePairManager, SwapWorkflowManager } from 'wallet-common-core';
import { UniswapPairManager, constants } from 'wallet-common-ethereum';

const Pairs = {
	XYM_bXYM: new BridgePairManager({
		mode: 'wrap',
		nativeWalletController: symbolWalletController,
		wrappedWalletController: ethereumWalletController,
		nativeBridgeHelper: symbolBridgeHelper,
		wrappedBridgeHelper: ethereumBridgeHelper,
		bridgeUrls: {
			testnet: config.bridge.bridgeEthereumWrapped.testnet.bridgeUrl,
			mainnet: config.bridge.bridgeEthereumWrapped.mainnet.bridgeUrl
		},
		makeRequest
	}),
	bXYM_XYM: new BridgePairManager({
		mode: 'unwrap',
		nativeWalletController: symbolWalletController,
		wrappedWalletController: ethereumWalletController,
		nativeBridgeHelper: symbolBridgeHelper,
		wrappedBridgeHelper: ethereumBridgeHelper,
		bridgeUrls: {
			testnet: config.bridge.bridgeEthereumWrapped.testnet.bridgeUrl,
			mainnet: config.bridge.bridgeEthereumWrapped.mainnet.bridgeUrl
		},
		makeRequest
	}),
	XYM_ETH: new BridgePairManager({
		mode: 'wrap',
		nativeWalletController: symbolWalletController,
		wrappedWalletController: ethereumWalletController,
		nativeBridgeHelper: symbolBridgeHelper,
		wrappedBridgeHelper: ethereumBridgeHelper,
		bridgeUrls: {
			testnet: config.bridge.bridgeEthereumNative.testnet.bridgeUrl,
			mainnet: config.bridge.bridgeEthereumNative.mainnet.bridgeUrl
		},
		makeRequest
	}),
	ETH_bXYM: new UniswapPairManager({
		mode: 'wrap',
		walletController: ethereumWalletController,
		uniswapApi: ethereumNetworkApi.uniswap,
		transactionApi: ethereumNetworkApi.transaction,
		configs: {
			testnet: {
				nativeTokenId: constants.NETWORK_CURRENCY_ID,
				wrappedTokenId: config.bridge.uniswapWrapped.testnet.bxymAddress,
				wethTokenId: config.bridge.uniswapWrapped.testnet.wethAddress,
				quoterAddress: config.bridge.uniswapWrapped.testnet.quoterAddress,
				swapRouterAddress: config.bridge.uniswapWrapped.testnet.routerAddress,
				poolAddress: config.bridge.uniswapWrapped.testnet.poolAddress,
				poolFee: config.bridge.uniswapWrapped.testnet.poolFee
			},
			mainnet: {
				nativeTokenId: constants.NETWORK_CURRENCY_ID,
				wrappedTokenId: config.bridge.uniswapWrapped.mainnet.bxymAddress,
				wethTokenId: config.bridge.uniswapWrapped.mainnet.wethAddress,
				quoterAddress: config.bridge.uniswapWrapped.mainnet.quoterAddress,
				swapRouterAddress: config.bridge.uniswapWrapped.mainnet.routerAddress,
				poolAddress: config.bridge.uniswapWrapped.mainnet.poolAddress,
				poolFee: config.bridge.uniswapWrapped.mainnet.poolFee
			}
		}
	})
};

export const bridges = [
	// XYM -> bXYM
	new SwapWorkflowManager({
		pairManagers: [Pairs.XYM_bXYM]
	}),
	// bXYM -> XYM
	new SwapWorkflowManager({
		pairManagers: [Pairs.bXYM_XYM]
	}),
	// XYM -> ETH
	new SwapWorkflowManager({
		pairManagers: [Pairs.XYM_ETH]
	}),
	// ETH -> XYM
	new SwapWorkflowManager({
		pairManagers: [Pairs.ETH_bXYM, Pairs.bXYM_XYM]
	})
];
