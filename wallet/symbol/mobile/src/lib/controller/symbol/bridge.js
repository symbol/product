import { symbolNetworkApi } from './api';
import {  BridgeHelper } from 'wallet-common-symbol';

export const symbolBridgeHelper = new BridgeHelper({
	mosaicApi: symbolNetworkApi.mosaic
});
