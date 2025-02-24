import { config } from '@/app/config';
import { MosaicService } from './MosaicService';
import { makeRequest, networkTypeToIdentifier } from '@/app/utils/network';
import { absoluteToRelativeAmount } from '@/app/utils/mosaic';
import * as NetworkTypes from '@/app/types/Network';

export class NetworkService {
    /**
     * Gets the default node list.
     * @param {string} networkIdentifier - Network identifier.
     * @returns {string[]} Default node list.
     */
    static async getDefaultNodeList(networkIdentifier) {
        return config.defaultNodes[networkIdentifier];
    }

    /**
     * Fetches the node list.
     * @param {string} networkIdentifier - Network identifier.
     * @returns {Promise<string[]>} The node list.
     */
    static async fetchNodeList(networkIdentifier) {
        const baseUrl = config.statisticsServiceURL[networkIdentifier];
        const filter = 'suggested';
        const limit = 30;
        const endpoint = `${baseUrl}/nodes?filter=${filter}&limit=${limit}`;

        const nodes = await makeRequest(endpoint);

        return nodes.map((node) => node.apiStatus.restGatewayUrl);
    }

    /**
     * Fetches the network properties.
     * @param {string} nodeUrl - Node URL.
     * @returns {Promise<NetworkTypes.NetworkInfo>} Network info.
     */
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

    /**
     * Pings the node and returns the chain height.
     * @param {string} nodeUrl - Node URL.
     * @returns {Promise<number>} Chain height.
     */
    static async ping(nodeUrl) {
        const endpoint = `${nodeUrl}/chain/info`;
        const chainInfo = await makeRequest(endpoint);

        return parseInt(chainInfo.height);
    }

    /**
     * Fetches the rental fees.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @returns {Promise<NetworkTypes.RentalFees>} Rental fees.
     */
    static async fetchRentalFees(networkProperties) {
        const endpoint = `${networkProperties.nodeUrl}/network/fees/rental`;
        const fees = await makeRequest(endpoint);

        return {
            mosaic: absoluteToRelativeAmount(fees.effectiveMosaicRentalFee, networkProperties.networkCurrency.divisibility),
            rootNamespacePerBlock: absoluteToRelativeAmount(
                fees.effectiveRootNamespaceRentalFeePerBlock,
                networkProperties.networkCurrency.divisibility
            ),
            subNamespace: absoluteToRelativeAmount(fees.effectiveChildNamespaceRentalFee, networkProperties.networkCurrency.divisibility),
        };
    }
}
