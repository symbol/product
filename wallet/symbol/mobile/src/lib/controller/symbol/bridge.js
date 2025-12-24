import {  BridgeHelper } from 'wallet-common-symbol';
import { api } from '@/app/lib/api';

export const symbolBridgeHelper = new BridgeHelper({
    mosaicApi: api.mosaic,
})
