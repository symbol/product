import { symbolNetworkApi } from './api';
import {  BridgeHelper } from 'wallet-common-symbol';

export const symbolBridgeHelper = new BridgeHelper({
	tokenApi: symbolNetworkApi.token
});
