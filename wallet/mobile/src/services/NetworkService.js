import { config } from 'src/config';
import { makeRequest, networkTypeToIdentifier } from 'src/utils';
import { ChainHttp, DtoMapping, NetworkHttp, NetworkType, NodeHttp, RepositoryFactoryHttp, TransactionFees } from 'symbol-sdk';
import { timeout } from 'rxjs/operators';
import { MosaicService } from './MosaicService';

const nodeProbeTimeout = 5000;
export class NetworkService {
    static async getDefaultNodeList(networkIdentifier) {
        return config.defaultNodes[networkIdentifier];
    }

    static async fetchNodeList(networkIdentifier) {
        const baseUrl = config.statisticsServiceURL[networkIdentifier];
        const filter = 'suggested';
        const limit = 30;
        const endpoint = `${baseUrl}/nodes?filter=${filter}&limit=${limit}`;

        const nodes = await makeRequest(endpoint);
        
        return nodes.map(node => node.apiStatus.restGatewayUrl);
    }

    static async fetchNetworkProperties(nodeUrl) {
        const networkHttp = new NetworkHttp(nodeUrl);
        const chainHttp = new ChainHttp(nodeUrl);
        const [networkType, networkProps, transactionFees, chainInfo] = await Promise.all([
            networkHttp
                .getNetworkType()
                .pipe(timeout(nodeProbeTimeout))
                .toPromise(),
            networkHttp
                .getNetworkProperties()
                .pipe(timeout(nodeProbeTimeout))
                .toPromise(),
            networkHttp
                .getTransactionFees()
                .pipe(timeout(nodeProbeTimeout))
                .toPromise(),
            chainHttp
                .getChainInfo()
                .pipe(timeout(nodeProbeTimeout))
                .toPromise(),
        ]);

        const networkCurrencyMosaicId = DtoMapping.toSimpleHex(networkProps.chain.currencyMosaicId);
        const mosaicInfo = await MosaicService.fetchMosaicInfo({nodeUrl}, networkCurrencyMosaicId);

        return {
            nodeUrl,
            networkIdentifier: networkTypeToIdentifier(networkType),
            generationHash: networkProps.network.generationHashSeed,
            chainHeight: chainInfo.height.compact(),
            epochAdjustment: parseInt(networkProps.network.epochAdjustment),
            transactionFees,
            networkCurrency: {
                // namespaceName: networkCurrency.currency.namespaceId.fullName,
                // namespaceId: networkCurrency.currency.namespaceId.id.toHex(),
                mosaicId: networkCurrencyMosaicId,
                divisibility: mosaicInfo.divisibility,
            },
        };
    }

    static async ping(nodeUrl) {
        const endpoint = `${nodeUrl}/node/info`;
        return makeRequest(endpoint);
    }
}
