import { config } from '@/config';
import { MosaicService } from './MosaicService';
import { makeRequest, networkTypeToIdentifier } from '@/utils/network';
import { getMosaicRelativeAmount } from '@/utils/mosaic';

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
        const [nodeInfo, networkProps, transactionFees, chainInfo] = await Promise.all([
            makeRequest(`${nodeUrl}/node/info`),
            makeRequest(`${nodeUrl}/network/properties`),
            makeRequest(`${nodeUrl}/network/fees/transaction`),
            makeRequest(`${nodeUrl}/chain/info`),
        ]);

        const networkCurrencyMosaicId = networkProps.chain.currencyMosaicId.split("'").join('').replace(/^(0x)/, '');
        const mosaicInfo = await MosaicService.fetchMosaicInfo({ nodeUrl }, networkCurrencyMosaicId);
        const wsUrl = nodeUrl.replace('http', 'ws') + '/ws';

        return {
            nodeUrl,
            wsUrl,
            networkIdentifier: networkTypeToIdentifier(nodeInfo.networkIdentifier),
            generationHash: nodeInfo.networkGenerationHashSeed,
            chainHeight: parseInt(chainInfo.height),
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
