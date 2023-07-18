import _ from 'lodash';
import { config } from 'src/config';
import {
    addressFromRaw,
    getMosaicAbsoluteAmount,
    getMosaicRelativeAmount,
    makeRequest,
    networkIdentifierToNetworkType,
    publicAccountFromPrivateKey,
    timestampToLocalDate,
} from 'src/utils';
import {
    Account,
    AccountKeyLinkTransaction,
    AggregateTransaction,
    Deadline,
    LinkAction,
    NodeKeyLinkTransaction,
    PersistentDelegationRequestTransaction,
    TransactionHttp,
    UInt64,
    VrfKeyLinkTransaction,
} from 'symbol-sdk';
import { TransactionService } from './TransactionService';

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
            const accountPublicKey = publicAccountFromPrivateKey(account.privateKey, networkIdentifier).publicKey;
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

    static async fetchSummary(networkProperties, address, chainHeight) {
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

        const latestBlockDate = harvestedBlocks.length
            ? await TransactionService.fetchDate(harvestedBlocks[0].height, networkProperties)
            : null;

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

    static async start(networkProperties, account, nodeUrl, linkedKeys, fee) {
        // Get nodePublicKey of the selected node
        const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
        const endpoint = `${nodeUrl}/node/info`;
        const { nodePublicKey, networkIdentifier: nodeNetworkType} = await makeRequest(endpoint);

        if (nodeNetworkType !== networkType) {
            throw Error('error_failed_harvesting_wrong_node_network');
        }

        // Generate brand new VRF and remote account keys
        const vrfAccount = Account.generateNewAccount(networkType);
        const remoteAccount = Account.generateNewAccount(networkType);
        const maxFee = UInt64.fromUint(getMosaicAbsoluteAmount(fee, networkProperties.networkCurrency.divisibility));
        const transactions = [];

        // If the keys is already linked to account, unlink them first
        if (linkedKeys.vrfPublicKey) {
            transactions.push(
                VrfKeyLinkTransaction.create(
                    Deadline.create(networkProperties.epochAdjustment),
                    linkedKeys.vrfPublicKey,
                    LinkAction.Unlink,
                    networkType,
                    maxFee
                )
            );
        }
        if (linkedKeys.linkedPublicKey) {
            transactions.push(
                AccountKeyLinkTransaction.create(
                    Deadline.create(networkProperties.epochAdjustment),
                    linkedKeys.linkedPublicKey,
                    LinkAction.Unlink,
                    networkType,
                    maxFee
                )
            );
        }
        if (linkedKeys.nodePublicKey) {
            transactions.push(
                NodeKeyLinkTransaction.create(
                    Deadline.create(networkProperties.epochAdjustment),
                    linkedKeys.nodePublicKey,
                    LinkAction.Unlink,
                    networkType,
                    maxFee
                )
            );
        }

        // Then link the new ones
        transactions.push(
            VrfKeyLinkTransaction.create(
                Deadline.create(networkProperties.epochAdjustment),
                vrfAccount.publicKey,
                LinkAction.Link,
                networkType,
                maxFee
            )
        );
        transactions.push(
            AccountKeyLinkTransaction.create(
                Deadline.create(networkProperties.epochAdjustment),
                remoteAccount.publicKey,
                LinkAction.Link,
                networkType,
                maxFee
            )
        );
        transactions.push(
            NodeKeyLinkTransaction.create(
                Deadline.create(networkProperties.epochAdjustment),
                nodePublicKey,
                LinkAction.Link,
                networkType,
                maxFee
            )
        );

        // Request node for harvesting
        transactions.push(
            PersistentDelegationRequestTransaction.createPersistentDelegationRequestTransaction(
                Deadline.create(networkProperties.epochAdjustment),
                remoteAccount.privateKey,
                vrfAccount.privateKey,
                nodePublicKey,
                networkType,
                maxFee
            )
        );

        // Prepare, sign and announce aggregate transaction
        const currentAccount = Account.createFromPrivateKey(account.privateKey, networkType);
        const aggregateTransaction = AggregateTransaction.createComplete(
            Deadline.create(networkProperties.epochAdjustment),
            transactions.map((transaction) => transaction.toAggregate(currentAccount.publicAccount)),
            networkType,
            [],
            maxFee
        );
        const signedTransaction = currentAccount.sign(aggregateTransaction, networkProperties.generationHash);
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);

        return transactionHttp.announce(signedTransaction).toPromise();
    }

    static async stop(networkProperties, account, linkedKeys, fee) {
        const networkType = networkIdentifierToNetworkType(networkProperties.networkIdentifier);
        const maxFee = UInt64.fromUint(getMosaicAbsoluteAmount(fee, networkProperties.networkCurrency.divisibility));
        const transactions = [];

        // Unlink supplemental key
        if (linkedKeys.vrfPublicKey) {
            transactions.push(
                VrfKeyLinkTransaction.create(
                    Deadline.create(networkProperties.epochAdjustment),
                    linkedKeys.vrfPublicKey,
                    LinkAction.Unlink,
                    networkType,
                    maxFee
                )
            );
        }
        if (linkedKeys.linkedPublicKey) {
            transactions.push(
                AccountKeyLinkTransaction.create(
                    Deadline.create(networkProperties.epochAdjustment),
                    linkedKeys.linkedPublicKey,
                    LinkAction.Unlink,
                    networkType,
                    maxFee
                )
            );
        }
        if (linkedKeys.nodePublicKey) {
            transactions.push(
                NodeKeyLinkTransaction.create(
                    Deadline.create(networkProperties.epochAdjustment),
                    linkedKeys.nodePublicKey,
                    LinkAction.Unlink,
                    networkType,
                    maxFee
                )
            );
        }

        // If nothing to unlink, then just escape
        if (transactions.length === 0) {
            return;
        }

        // Prepare, sign and announce aggregate transaction
        const currentAccount = Account.createFromPrivateKey(account.privateKey, networkType);
        const aggregateTransaction = AggregateTransaction.createComplete(
            Deadline.create(networkProperties.epochAdjustment),
            transactions.map((transaction) => transaction.toAggregate(currentAccount.publicAccount)),
            networkType,
            [],
            maxFee
        );
        const signedTransaction = currentAccount.sign(aggregateTransaction, networkProperties.generationHash);
        const transactionHttp = new TransactionHttp(networkProperties.nodeUrl);

        return transactionHttp.announce(signedTransaction).toPromise();
    }

    static async fetchNodeList(networkIdentifier) {
        const baseUrl = config.statisticsServiceURL[networkIdentifier];
        const filter = 'suggested';
        const endpoint = `${baseUrl}/nodes?filter=${filter}&ssl=true`;

        const nodes = await makeRequest(endpoint);

        return nodes.map((node) => node.apiStatus.restGatewayUrl);
    }
}
