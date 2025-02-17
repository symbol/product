import _ from 'lodash';
import { config } from 'src/config';
import { addressFromRaw, getMosaicRelativeAmount, makeRequest, networkTypeToIdentifier, timestampToLocalDate } from 'src/utils';
import { NetworkService } from 'src/lib/services/NetworkService';
const HarvestingStatus = {
    inactive: 'inactive',
    active: 'active',
    pending: 'pending',
    operator: 'operator',
};

export class HarvestingService {
    static async fetchStatus(networkProperties, account, linkedKeys) {
        const { networkIdentifier } = networkProperties;
        const statisticsServiceUrl = config.statisticsServiceURL[networkIdentifier];
        const { linkedPublicKey, nodePublicKey, vrfPublicKey } = linkedKeys;
        const isAllKeysLinked = linkedPublicKey && nodePublicKey && vrfPublicKey;

        if (!isAllKeysLinked) {
            const accountPublicKey = account.publicKey;
            const nodeInfoEndpoint = `${statisticsServiceUrl}/nodes/${accountPublicKey}`;
            try {
                // Operator status if the account public key is a node's key
                const nodeInfo = await makeRequest(nodeInfoEndpoint);
                const nodeUrl = nodeInfo.apiStatus.restGatewayUrl;

                return {
                    status: HarvestingStatus.operator,
                    nodeUrl,
                };
            } catch {
                // Inactive status if no keys linked and the account public key is not a node's key
                return {
                    status: HarvestingStatus.inactive,
                };
            }
        }

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
                status: isAccountUnlocked ? HarvestingStatus.active : HarvestingStatus.pending,
                nodeUrl,
            };
        } catch {
            // Inactive status if node isn't found in the statistics service (treat it as down).
            return {
                status: HarvestingStatus.inactive,
            };
        }
    }

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

    static async fetchHarvestedBlocks(networkProperties, address, { pageNumber = 1, pageSize = 100 }) {
        const { divisibility } = networkProperties.networkCurrency;
        const receiptType = 8515;
        const endpoint = `${networkProperties.nodeUrl}/statements/transaction?receiptType=${receiptType}&targetAddress=${address}&pageSize=${pageSize}&pageNumber=${pageNumber}&order=desc`;
        const response = await makeRequest(endpoint);

        return response.data.map((el) => ({
            height: el.statement.height,
            date: timestampToLocalDate(el.meta.timestamp, networkProperties.epochAdjustment),
            amount: getMosaicRelativeAmount(
                el.statement.receipts.find((receipt) => receipt.type === receiptType && addressFromRaw(receipt.targetAddress) === address)
                    ?.amount || 0,
                divisibility
            ),
        }));
    }

    static async fetchNodeList(networkIdentifier) {
        const baseUrl = config.statisticsServiceURL[networkIdentifier];
        const filter = 'suggested';
        const endpoint = `${baseUrl}/nodes?filter=${filter}&ssl=true`;

        const nodes = await makeRequest(endpoint);

        return nodes.map((node) => ({
            url: node.apiStatus.restGatewayUrl,
            nodePublicKey: node.apiStatus.publicKey,
        }));
    }

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
