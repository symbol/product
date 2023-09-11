import { config } from 'src/config';
import { getMosaicRelativeAmount, makeRequest, networkTypeToIdentifier } from 'src/utils';
import { ChainHttp, DtoMapping, NetworkHttp } from 'symbol-sdk';
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

        return nodes.map((node) => node.apiStatus.restGatewayUrl);
    }

    static async fetchNetworkProperties(nodeUrl) {
        const networkHttp = new NetworkHttp(nodeUrl);
        const chainHttp = new ChainHttp(nodeUrl);
        const [networkType, networkProps, transactionFees, chainInfo] = await Promise.all([
            networkHttp.getNetworkType().pipe(timeout(nodeProbeTimeout)).toPromise(),
            networkHttp.getNetworkProperties().pipe(timeout(nodeProbeTimeout)).toPromise(),
            networkHttp.getTransactionFees().pipe(timeout(nodeProbeTimeout)).toPromise(),
            chainHttp.getChainInfo().pipe(timeout(nodeProbeTimeout)).toPromise(),
        ]);

        const networkCurrencyMosaicId = DtoMapping.toSimpleHex(networkProps.chain.currencyMosaicId);
        const mosaicInfo = await MosaicService.fetchMosaicInfo({ nodeUrl }, networkCurrencyMosaicId);
        const wsUrl = nodeUrl.replace('http', 'ws') + '/ws';

        return {
            nodeUrl,
            wsUrl,
            networkIdentifier: networkTypeToIdentifier(networkType),
            generationHash: networkProps.network.generationHashSeed,
            chainHeight: chainInfo.height.compact(),
            blockGenerationTargetTime: networkProps.chain.blockGenerationTargetTime.replace(/s/g, ''),
            epochAdjustment: parseInt(networkProps.network.epochAdjustment),
            transactionFees,
            networkCurrency: {
                name: mosaicInfo.names[0],
                mosaicId: networkCurrencyMosaicId,
                divisibility: mosaicInfo.divisibility,
            },
        };
    }

    static async ping(nodeUrl) {
        const endpoint = `${nodeUrl}/chain/info`;
        const chainInfo = await makeRequest(endpoint);

        return parseInt(chainInfo.height);
    }

    static async fetchRentalFees(networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/network/fees/rental`;
        const fees = await makeRequest(endpoint);

        return {
            mosaic: getMosaicRelativeAmount(fees.effectiveMosaicRentalFee, networkProperties.networkCurrency.divisibility),
            rootNamespacePerBlock: getMosaicRelativeAmount(
                fees.effectiveRootNamespaceRentalFeePerBlock,
                networkProperties.networkCurrency.divisibility
            ),
            subNamespace: getMosaicRelativeAmount(fees.effectiveChildNamespaceRentalFee, networkProperties.networkCurrency.divisibility),
        };
    }
}
