import { ethereumNetworkApi } from '@/app/lib/controller/eth/api';
import { BridgeHelper } from 'wallet-common-ethereum';

export const ethereumBridgeHelper = new BridgeHelper({
    tokenApi: ethereumNetworkApi.token,
    transactionApi: ethereumNetworkApi.transaction,
});
