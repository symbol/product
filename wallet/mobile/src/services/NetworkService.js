//import { defaultNodes, nodeProbeTimeout, statisticsServiceURL } from '@config/config.json';
import { networkTypeToIdentifier } from 'src/utils';
//import { timeout } from 'rxjs/operators';
import { ChainHttp, NetworkHttp, NetworkType, NodeHttp, RepositoryFactoryHttp, TransactionFees } from 'symbol-sdk';

export class NetworkService {
    static async getDefaultNodeList(networkIdentifier) {
        return defaultNodes[networkIdentifier];
    }

    static async fetchNodeList(networkIdentifier) {
        const baseUrl = statisticsServiceURL[networkIdentifier];
        const filter = 'suggested';
        const limit = 30;
        const endpoint = `${baseUrl}/nodes?filter=${filter}&limit=${limit}`;

        return fetch(endpoint);
    }

    static async fetchNetworkProperties(nodeUrl) {
        const networkHttp = new NetworkHttp(nodeUrl);
        const chainHttp = new ChainHttp(node);
        const [networkType, networkProps, transactionFees, chainInfo] = await Promise.all([
            networkHttp
                .getNetworkType()
                //.pipe(timeout(nodeProbeTimeout))
                .toPromise(),
            networkHttp
                .getNetworkProperties()
                //.pipe(timeout(nodeProbeTimeout))
                .toPromise(),
            networkHttp
                .getTransactionFees()
                //.pipe(timeout(nodeProbeTimeout))
                .toPromise(),
            chainHttp
                .getChainInfo()
                //.pipe(timeout(nodeProbeTimeout))
                .toPromise(),
        ]);

        return {
            nodeUrl,
            networkIdentifier: networkTypeToIdentifier(networkType),
            generationHash: networkProps.network.generationHashSeed,
            chainHeight: chainInfo.height.compact(),
            epochAdjustment: parseInt(networkProps.network.epochAdjustment),
            transactionFees,
            networkCurrency: {
                namespaceName: networkCurrency.currency.namespaceId.fullName,
                namespaceId: networkCurrency.currency.namespaceId.id.toHex(),
                mosaicId: networkCurrency.currency.mosaicId.toHex(),
                divisibility: networkCurrency.currency.divisibility,
            },
        };
    }
}
