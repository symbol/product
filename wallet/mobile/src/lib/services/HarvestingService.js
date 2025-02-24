import _ from 'lodash';
import { config } from '@/app/config';
import { absoluteToRelativeAmount, addressFromRaw, makeRequest, networkTypeToIdentifier, timestampToLocalDate } from '@/app/utils';
import { NetworkService } from '@/app/lib/services/NetworkService';
import * as AccountTypes from '@/app/types/Account';
import * as HarvestingTypes from '@/app/types/Harvesting';
import * as NetworkTypes from '@/app/types/Network';
import * as SearchCriteriaTypes from '@/app/types/SearchCriteria';
import { HarvestingStatus } from '@/app/constants';

export class HarvestingService {
    /**
     * Fetches the harvesting status of an account.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {AccountTypes.PublicAccount} account - Requested account.
     * @returns {Promise<{ status: string, nodeUrl?: string }>} - The harvesting status.
     */
    static async fetchStatus(networkProperties, account) {
        const { networkIdentifier } = networkProperties;
        const statisticsServiceUrl = config.statisticsServiceURL[networkIdentifier];

        // Fetch account linked keys
        const url = `${networkProperties.nodeUrl}/accounts/${account.address}`;
        const {
            account: { supplementalPublicKeys },
        } = await makeRequest(url);
        const linkedPublicKey = supplementalPublicKeys.linked?.publicKey || null;
        const nodePublicKey = supplementalPublicKeys.node?.publicKey || null;
        const vrfPublicKey = supplementalPublicKeys.vrf?.publicKey || null;
        const isAllKeysLinked = linkedPublicKey && nodePublicKey && vrfPublicKey;

        // If no keys linked, check if the account public key is a node's key (node operator)
        if (!isAllKeysLinked) {
            const accountPublicKey = account.publicKey;
            const nodeInfoEndpoint = `${statisticsServiceUrl}/nodes/${accountPublicKey}`;
            try {
                // Operator status if the account public key is a node's key
                const nodeInfo = await makeRequest(nodeInfoEndpoint);
                const nodeUrl = nodeInfo.apiStatus.restGatewayUrl;

                return {
                    status: HarvestingStatus.OPERATOR,
                    nodeUrl,
                };
            } catch {
                // Inactive status if no keys linked and the account public key is not a node's key
                return {
                    status: HarvestingStatus.INACTIVE,
                };
            }
        }

        // Fetch node info and its unlocked accounts.
        try {
            const nodeInfoEndpoint = `${statisticsServiceUrl}/nodes/nodePublicKey/${nodePublicKey}`;
            const nodeInfo = await makeRequest(nodeInfoEndpoint);
            const nodeUrl = nodeInfo.apiStatus.restGatewayUrl;
            const unlockedAccountsEndpoint = `${nodeUrl}/node/unlockedaccount`;
            const { unlockedAccount } = await makeRequest(unlockedAccountsEndpoint);
            const isAccountUnlocked = unlockedAccount.find((publicKey) => publicKey === linkedPublicKey);

            // Active status if all keys linked and the account is in the node's unlocked list.
            // Pending status if all keys linked but the account is not in the node's unlocked list.
            return {
                status: isAccountUnlocked ? HarvestingStatus.ACTIVE : HarvestingStatus.PENDING,
                nodeUrl,
            };
        } catch {
            // Inactive status if node isn't found in the statistics service (treat it as down).
            return {
                status: HarvestingStatus.NODE_UNKNOWN,
            };
        }
    }

    /**
     * Fetches the harvesting summary of an account.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} address - Requested account address.
     * @returns {Promise<HarvestingTypes.HarvestingSummary>} - The harvesting summary.
     */
    static async fetchSummary(networkProperties, address) {
        const chainHeight = await NetworkService.ping(networkProperties.nodeUrl);

        const dayInSeconds = 86400;
        const dayInBlocks = Math.round(dayInSeconds / networkProperties.blockGenerationTargetTime) * 30;
        const heightDayAgo = chainHeight - dayInBlocks;

        let isLastPage = false;
        let isEndBlockFound = false;
        let pageNumber = 1;
        let harvestedBlocks = [];

        while (!isLastPage && !isEndBlockFound) {
            const harvestedBlocksPage = await HarvestingService.fetchHarvestedBlocks(networkProperties, address, { pageNumber });
            const filteredPerDayPage = harvestedBlocksPage.filter((block) => block.height >= heightDayAgo);
            isLastPage = harvestedBlocksPage.length === 0;
            isEndBlockFound = filteredPerDayPage.length !== harvestedBlocksPage.length;
            harvestedBlocks.push(...filteredPerDayPage);
            pageNumber++;
        }

        let latestBlockDate = null;
        if (harvestedBlocks.length) {
            const height = harvestedBlocks[0].height;
            const endpoint = `${networkProperties.nodeUrl}/blocks/${height}`;
            const { block } = await makeRequest(endpoint);
            const timestamp = parseInt(block.timestamp);

            latestBlockDate = timestampToLocalDate(timestamp, networkProperties.epochAdjustment);
        }

        return {
            latestAmount: harvestedBlocks.length ? harvestedBlocks[0].amount.toFixed(2) : 0,
            latestHeight: harvestedBlocks.length ? harvestedBlocks[0].height : null,
            latestDate: latestBlockDate,
            amountPer30Days: harvestedBlocks.length ? _.sumBy(harvestedBlocks, 'amount').toFixed(2) : 0,
            blocksHarvestedPer30Days: harvestedBlocks.length,
        };
    }

    /**
     * Fetches harvested blocks by an account.
     * @param {NetworkTypes.NetworkProperties} networkProperties - Network properties.
     * @param {string} address - Requested account address.
     * @param {SearchCriteriaTypes.HarvestedBlockSearchCriteria} searchCriteria - Pagination params.
     * @returns {Promise<HarvestingTypes.HarvestedBlock[]>} - The harvested blocks.
     */
    static async fetchHarvestedBlocks(networkProperties, address, searchCriteria) {
        const { pageNumber = 1, pageSize = 100, order = 'desc' } = searchCriteria;
        const { divisibility } = networkProperties.networkCurrency;
        const receiptType = 8515;
        const endpoint = `${networkProperties.nodeUrl}/statements/transaction?receiptType=${receiptType}&targetAddress=${address}&pageSize=${pageSize}&pageNumber=${pageNumber}&order=${order}`;
        const response = await makeRequest(endpoint);

        return response.data.map((el) => ({
            height: el.statement.height,
            date: timestampToLocalDate(el.meta.timestamp, networkProperties.epochAdjustment),
            amount: absoluteToRelativeAmount(
                el.statement.receipts.find((receipt) => receipt.type === receiptType && addressFromRaw(receipt.targetAddress) === address)
                    ?.amount || 0,
                divisibility
            ),
        }));
    }

    /**
     * Fetches the node list (API and dual nodes) that are suggested for harvesting.
     * @param {NetworkTypes.NetworkIdentifier} networkIdentifier - Network identifier.
     * @returns {Promise<string[]>} - The node list.
     */
    static async fetchNodeList(networkIdentifier) {
        const baseUrl = config.statisticsServiceURL[networkIdentifier];
        const filter = 'suggested';
        const endpoint = `${baseUrl}/nodes?filter=${filter}&ssl=true`;

        const nodes = await makeRequest(endpoint);

        return nodes.map((node) => node.apiStatus.restGatewayUrl);
    }

    /**
     * Fetches the node info.
     * @param {string} nodeUrl - Node URL.
     * @returns {Promise<{ nodePublicKey: string, networkIdentifier: NetworkTypes.NetworkIdentifier }>} - The node info.
     */
    static async fetchNodeInfo(nodeUrl) {
        // Get nodePublicKey of the selected node
        const endpoint = `${nodeUrl}/node/info`;
        const { nodePublicKey, networkIdentifier: nodeNetworkType } = await makeRequest(endpoint);

        return {
            nodePublicKey,
            networkIdentifier: networkTypeToIdentifier(nodeNetworkType),
        };
    }
}
