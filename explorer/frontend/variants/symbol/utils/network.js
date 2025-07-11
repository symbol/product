import config from '@/config';

export const getNetworkProperties = () => ({
    nodeUrl: config.SYMBOL_NODE_URL,
    networkType: config.SYMBOL_NETWORK_TYPE,
    networkIdentifier: config.SYMBOL_NETWORK_IDENTIFIER,
    epochAdjustment: config.SYMBOL_EPOCH_ADJUSTMENT,
    generationHash: config.SYMBOL_GENERATION_HASH,
    networkCurrency: {
        mosaicId: config.NATIVE_MOSAIC_ID,
        divisibility: config.NATIVE_MOSAIC_DIVISIBILITY,
        name: config.NATIVE_MOSAIC_TICKER
    }
})
