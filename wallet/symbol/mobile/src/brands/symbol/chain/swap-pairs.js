import { ethereumWalletController, symbolWalletController } from './wallet-controllers';
import { config } from '@/app/config';
import { cachedMakeRequest } from '@/app/lib/cache';
import { BridgePairManager, SwapWorkflowManager } from 'wallet-common-core';
import { BridgeHelper as EthereumBridgeHelper, UniswapPairManager, constants } from 'wallet-common-ethereum';
import { BridgeHelper as SymbolBridgeHelper } from 'wallet-common-symbol';

const symbolBridgeHelper = new SymbolBridgeHelper({
	tokenApi: symbolWalletController.networkApi.token
});

const ethereumBridgeHelper = new EthereumBridgeHelper({
	tokenApi: ethereumWalletController.networkApi.token,
	transactionApi: ethereumWalletController.networkApi.transaction
});

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
		makeRequest: cachedMakeRequest
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
		makeRequest: cachedMakeRequest
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
		makeRequest: cachedMakeRequest
	}),
	ETH_bXYM: new UniswapPairManager({
		mode: 'wrap',
		walletController: ethereumWalletController,
		uniswapApi: ethereumWalletController.networkApi.uniswap,
		transactionApi: ethereumWalletController.networkApi.transaction,
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
