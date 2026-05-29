import { ethereumNetworkApi } from './ethereum/api';
import { ethereumBridgeHelper } from './ethereum/bridge';
import { ethereumWalletController } from './ethereum/controller';
import { symbolBridgeHelper } from './symbol/bridge';
import { symbolWalletController } from './symbol/controller';
import { makeRequest } from '@/app/utils';
import { BridgePairManager, SwapWorkflowManager } from 'wallet-common-core';
import { UniswapPairManager, constants } from 'wallet-common-ethereum';
import { config } from '@/app/config';

const Pairs = {
	XYM_wXYM: new BridgePairManager({
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
	wXYM_XYM: new BridgePairManager({
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
	ETH_wXYM: new UniswapPairManager({
		mode: 'wrap',
		walletController: ethereumWalletController,
		uniswapApi: ethereumNetworkApi.uniswap,
		transactionApi: ethereumNetworkApi.transaction,
		configs: {
			testnet: {
				nativeTokenId: constants.NETWORK_CURRENCY_ID,
				wrappedTokenId: config.bridge.uniswapWrapped.testnet.wxymAddress,
				wethTokenId: config.bridge.uniswapWrapped.testnet.wethAddress,
				quoterAddress: config.bridge.uniswapWrapped.testnet.quoterAddress,
				swapRouterAddress: config.bridge.uniswapWrapped.testnet.routerAddress,
				poolFee: config.bridge.uniswapWrapped.testnet.poolFee
			},
			mainnet: {
				nativeTokenId: constants.NETWORK_CURRENCY_ID,
				wrappedTokenId: config.bridge.uniswapWrapped.mainnet.wxymAddress,
				wethTokenId: config.bridge.uniswapWrapped.mainnet.wethAddress,
				quoterAddress: config.bridge.uniswapWrapped.mainnet.quoterAddress,
				swapRouterAddress: config.bridge.uniswapWrapped.mainnet.routerAddress,
				poolFee: config.bridge.uniswapWrapped.mainnet.poolFee
			}
		}
	})
};

export const bridges = [
	// XYM -> wXYM
	new SwapWorkflowManager({
		pairManagers: [Pairs.XYM_wXYM]
	}),
	// wXYM -> XYM
	new SwapWorkflowManager({
		pairManagers: [Pairs.wXYM_XYM]
	}),
	// XYM -> ETH
	new SwapWorkflowManager({
		pairManagers: [Pairs.XYM_ETH]
	}),
	// ETH -> XYM 
	new SwapWorkflowManager({
		pairManagers: [Pairs.ETH_wXYM, Pairs.wXYM_XYM]
	})
];
