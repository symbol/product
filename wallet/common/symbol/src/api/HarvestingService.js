import { HarvestingStatus } from '../constants';
import { addressFromRaw, createSearchUrl, networkTimestampToUnix, networkTypeToIdentifier } from '../utils';
import _ from 'lodash';
import { NotFoundError, absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Harvesting').HarvestingStatus} HarvestingStatus */
/** @typedef {import('../types/Harvesting').HarvestingSummary} HarvestingSummary */
/** @typedef {import('../types/Harvesting').HarvestedBlock} HarvestedBlock */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/SearchCriteria').HarvestedBlockSearchCriteria} HarvestedBlockSearchCriteria */

export class HarvestingService {
	#api;
	#config;
	#makeRequest;

	constructor(options) {
		this.#api = options.api;
		this.#config = options.config;
		this.#makeRequest = options.makeRequest;
	}

	/**
	 * Fetches the harvesting status of an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {PublicAccount} account - Requested account.
	 * @returns {Promise<HarvestingStatus>} - The harvesting status.
	 */
	fetchStatus = async (networkProperties, account) => {
		const { networkIdentifier } = networkProperties;
		const statisticsServiceUrl = this.#config.statisticsServiceURL[networkIdentifier];

		// Fetch account linked keys
		const url = `${networkProperties.nodeUrl}/accounts/${account.address}`;
		let supplementalPublicKeys;
		try {
			const { account } = await this.#makeRequest(url);
			supplementalPublicKeys = account.supplementalPublicKeys;
		} catch (error) {
			if (error instanceof NotFoundError)
				supplementalPublicKeys = {};
			else
				throw error;
		}

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
				const nodeInfo = await this.#makeRequest(nodeInfoEndpoint);
				const nodeUrl = nodeInfo.apiStatus.restGatewayUrl;

				return {
					status: HarvestingStatus.OPERATOR,
					nodeUrl
				};
			} catch {
				// Inactive status if no keys linked and the account public key is not a node's key
				return {
					status: HarvestingStatus.INACTIVE
				};
			}
		}

		// Fetch node info and its unlocked accounts.
		try {
			const nodeInfoEndpoint = `${statisticsServiceUrl}/nodes/nodePublicKey/${nodePublicKey}`;
			const nodeInfo = await this.#makeRequest(nodeInfoEndpoint);
			const nodeUrl = nodeInfo.apiStatus.restGatewayUrl;
			const unlockedAccountsEndpoint = `${nodeUrl}/node/unlockedaccount`;
			const { unlockedAccount } = await this.#makeRequest(unlockedAccountsEndpoint);
			const isAccountUnlocked = unlockedAccount.find(publicKey => publicKey === linkedPublicKey);

			// Active status if all keys linked and the account is in the node's unlocked list.
			// Pending status if all keys linked but the account is not in the node's unlocked list.
			return {
				status: isAccountUnlocked ? HarvestingStatus.ACTIVE : HarvestingStatus.PENDING,
				nodeUrl
			};
		} catch {
			// Inactive status if node isn't found in the statistics service (treat it as down).
			return {
				status: HarvestingStatus.NODE_UNKNOWN
			};
		}
	};

	/**
	 * Fetches the harvesting summary of an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - Requested account address.
	 * @returns {Promise<HarvestingSummary>} - The harvesting summary.
	 */
	fetchSummary = async (networkProperties, address) => {
		const chainHeight = await this.#api.network.pingNode(networkProperties.nodeUrl);

		const dayInSeconds = 86400;
		const dayInBlocks = Math.round(dayInSeconds / networkProperties.blockGenerationTargetTime);
		const monthInBlocks = dayInBlocks * 30;
		const heightMonthAgo = chainHeight - monthInBlocks;

		let isLastPage = false;
		let isEndBlockFound = false;
		let pageNumber = 1;
		let harvestedBlocks = [];

		while (!isLastPage && !isEndBlockFound) {
			const harvestedBlocksPage = await this.fetchHarvestedBlocks(networkProperties, address, { 
				pageNumber,
				pageSize: 100 
			});
			const filteredPerDayPage = harvestedBlocksPage.filter(block => block.height >= heightMonthAgo);
			isLastPage = harvestedBlocksPage.length === 0;
			isEndBlockFound = filteredPerDayPage.length !== harvestedBlocksPage.length;
			harvestedBlocks.push(...filteredPerDayPage);
			pageNumber++;
		}

		return {
			latestAmount: harvestedBlocks.length ? harvestedBlocks[0].amount.toFixed(2) : 0,
			latestHeight: harvestedBlocks.length ? harvestedBlocks[0].height : null,
			latestDate: harvestedBlocks.length ? harvestedBlocks[0].timestamp : null,
			amountPer30Days: harvestedBlocks.length ? _.sumBy(harvestedBlocks, 'amount').toFixed(2) : 0,
			blocksHarvestedPer30Days: harvestedBlocks.length
		};
	};

	/**
	 * Fetches harvested blocks by an account.
	 * @param {NetworkProperties} networkProperties - Network properties.
	 * @param {string} address - Requested account address.
	 * @param {HarvestedBlockSearchCriteria} [searchCriteria] - Pagination params.
	 * @returns {Promise<HarvestedBlock[]>} - The harvested blocks.
	 */
	fetchHarvestedBlocks = async (networkProperties, address, searchCriteria) => {
		const { divisibility } = networkProperties.networkCurrency;
		const receiptType = 8515;
		const endpoint = createSearchUrl(networkProperties.nodeUrl, '/statements/transaction', searchCriteria, {
			receiptType,
			targetAddress: address
		});
		const response = await this.#makeRequest(endpoint);

		return response.data.map(el => ({
			height: el.statement.height,
			timestamp: networkTimestampToUnix(el.meta.timestamp, networkProperties.epochAdjustment),
			amount: absoluteToRelativeAmount(
				el.statement.receipts.find(receipt => receipt.type === receiptType && addressFromRaw(receipt.targetAddress) === address)
					?.amount || '0',
				divisibility
			)
		}));
	};

	/**
	 * Fetches the node list (API and dual nodes) that are suggested for harvesting.
	 * @param {string} networkIdentifier - Network identifier.
	 * @returns {Promise<string[]>} - The node list.
	 */
	fetchNodeList = async networkIdentifier => {
		const baseUrl = this.#config.statisticsServiceURL[networkIdentifier];
		const filter = 'suggested';
		const endpoint = `${baseUrl}/nodes?filter=${filter}&ssl=true`;
		const nodes = await this.#makeRequest(endpoint);

		return nodes.map(node => node.apiStatus.restGatewayUrl);
	};

	/**
	 * Fetches the node info.
	 * @param {string} nodeUrl - Node URL.
	 * @returns {Promise<{ nodePublicKey: string, networkIdentifier: string }>} - The node info.
	 */
	fetchNodeInfo = async nodeUrl => {
		// Get nodePublicKey of the selected node
		const endpoint = `${nodeUrl}/node/info`;
		const { nodePublicKey, networkIdentifier: nodeNetworkType } = await this.#makeRequest(endpoint);

		return {
			nodePublicKey,
			networkIdentifier: networkTypeToIdentifier(nodeNetworkType)
		};
	};
}
