import { cloneDeep, shuffle } from 'lodash';
import { makeAutoObservable } from 'mobx';
import { LinkAction, LinkActionMessage, MessageType, TransactionType } from '@/app/constants';
import { HarvestingService } from '@/app/lib/services';
import { addressFromPublicKey, encodeDelegatedHarvestingMessage, generateKeyPair } from '@/app/utils';
import { AppError } from '@/app/lib/error';
import * as HarvestingTypes from '@/app/types/Harvesting';
import * as TransactionTypes from '@/app/types/Transaction';
import * as SearchCriteriaTypes from '@/app/types/SearchCriteria';

const defaultState = {};

export class HarvestingModule {
    constructor({ root, isObservable }) {
        this.name = 'harvesting';
        this._state = cloneDeep(defaultState);

        if (isObservable) makeAutoObservable(this);

        this._root = root;
    }

    /**
     * Fetches the harvesting status of the current account.
     * @returns {Promise<{ status: string, nodeUrl?: string }>} - The harvesting status.
     */
    fetchStatus = async () => {
        const { currentAccount, currentAccountInfo, networkProperties } = this._root;
        const { linkedKeys } = currentAccountInfo;

        return HarvestingService.fetchStatus(networkProperties, currentAccount, linkedKeys);
    };

    /**
     * Fetches harvested blocks by current account.
     * @param {SearchCriteriaTypes.HarvestedBlockSearchCriteria} searchCriteria - Pagination params.
     * @returns {Promise<HarvestingTypes.HarvestedBlock[]>} - The harvested blocks.
     */
    fetchAccountHarvestedBlocks = async (searchCriteria = {}) => {
        const { pageNumber = 1, pageSize = 15 } = searchCriteria;
        const { currentAccount, networkProperties } = this._root;
        const { address } = currentAccount;

        return HarvestingService.fetchHarvestedBlocks(networkProperties, address, { pageNumber, pageSize });
    };

    /**
     * Fetches the node list (API and dual nodes) that are suggested for harvesting.
     * @returns {Promise<string[]>} - The node list.
     */
    fetchNodeList = async () => {
        const { networkIdentifier } = this._root;
        const nodeList = await HarvestingService.fetchNodeList(networkIdentifier);

        return shuffle(nodeList);
    };

    /**
     * Fetches the harvesting summary of current account.
     * @returns {Promise<HarvestingTypes.HarvestingSummary>} - The harvesting summary.
     */
    fetchSummary = async () => {
        const { currentAccount, networkProperties } = this._root;
        const { address } = currentAccount;

        return HarvestingService.fetchSummary(networkProperties, address);
    };

    /**
     * Prepares the transaction to start harvesting for the current account.
     * Aggregate transaction includes linking the VRF and remote keys, and sending a request to the node.
     * If the keys are already linked, they will be unlinked first.
     * @param {string} nodePublicKey - The public key of the node.
     * @param {string} [password] - The wallet password.
     * @returns {Promise<TransactionTypes.Transaction>} - The transaction to start harvesting.
     */
    createStartHarvestingTransaction = async (nodePublicKey, password) => {
        const currentAccountPrivateKey = await this._root.getCurrentAccountPrivateKey(password);
        const { currentAccount, currentAccountInfo, networkIdentifier } = this._root;
        const accountPublicKey = currentAccount.publicKey;
        const { linkedKeys } = currentAccountInfo;
        const nodeAddress = addressFromPublicKey(nodePublicKey, networkIdentifier);
        const fee = 0;

        const vrfAccount = generateKeyPair(networkIdentifier);
        const remoteAccount = generateKeyPair(networkIdentifier);
        const transactions = [];

        // If the keys is already linked to account, unlink them first
        if (linkedKeys.vrfPublicKey) {
            transactions.push({
                type: TransactionType.VRF_KEY_LINK,
                linkAction: LinkActionMessage[LinkAction.Unlink],
                linkedPublicKey: linkedKeys.vrfPublicKey,
                signerPublicKey: accountPublicKey,
            });
        }
        if (linkedKeys.linkedPublicKey) {
            transactions.push({
                type: TransactionType.ACCOUNT_KEY_LINK,
                linkAction: LinkActionMessage[LinkAction.Unlink],
                linkedPublicKey: linkedKeys.linkedPublicKey,
                signerPublicKey: accountPublicKey,
            });
        }
        if (linkedKeys.nodePublicKey) {
            transactions.push({
                type: TransactionType.NODE_KEY_LINK,
                linkAction: LinkActionMessage[LinkAction.Unlink],
                linkedPublicKey: linkedKeys.nodePublicKey,
                signerPublicKey: accountPublicKey,
            });
        }

        // Then link the new ones
        transactions.push({
            type: TransactionType.VRF_KEY_LINK,
            linkAction: LinkActionMessage[LinkAction.Link],
            linkedPublicKey: vrfAccount.publicKey,
            signerPublicKey: accountPublicKey,
        });
        transactions.push({
            type: TransactionType.ACCOUNT_KEY_LINK,
            linkAction: LinkActionMessage[LinkAction.Link],
            linkedPublicKey: remoteAccount.publicKey,
            signerPublicKey: accountPublicKey,
        });
        transactions.push({
            type: TransactionType.NODE_KEY_LINK,
            linkAction: LinkActionMessage[LinkAction.Link],
            linkedPublicKey: nodePublicKey,
            signerPublicKey: accountPublicKey,
        });

        // Request node for harvesting
        transactions.push({
            type: TransactionType.TRANSFER,
            mosaics: [],
            message: {
                type: MessageType.DelegatedHarvesting,
                payload: encodeDelegatedHarvestingMessage(
                    currentAccountPrivateKey,
                    nodePublicKey,
                    remoteAccount.privateKey,
                    vrfAccount.privateKey
                ),
                text: '',
            },
            signerPublicKey: accountPublicKey,
            recipientAddress: nodeAddress,
        });

        // Prepare aggregate transaction
        return {
            type: TransactionType.AGGREGATE_COMPLETE,
            innerTransactions: transactions,
            signerPublicKey: accountPublicKey,
            fee,
        };
    };

    /**
     * Prepares the transaction to stop harvesting for the current account.
     * Aggregate transaction includes unlinking the VRF and remote keys.
     * @returns {TransactionTypes.Transaction} - The transaction to stop harvesting.
     */
    createStopHarvestingTransaction = () => {
        const { currentAccount, currentAccountInfo } = this._root;
        const accountPublicKey = currentAccount.publicKey;
        const { linkedKeys } = currentAccountInfo;
        const fee = 0;
        const transactions = [];

        // Unlink supplemental key
        if (linkedKeys.vrfPublicKey) {
            transactions.push({
                type: TransactionType.VRF_KEY_LINK,
                linkAction: LinkAction[LinkAction.Unlink],
                linkedPublicKey: linkedKeys.vrfPublicKey,
                signerPublicKey: accountPublicKey,
            });
        }
        if (linkedKeys.linkedPublicKey) {
            transactions.push({
                type: TransactionType.ACCOUNT_KEY_LINK,
                linkAction: LinkAction[LinkAction.Unlink],
                linkedPublicKey: linkedKeys.linkedPublicKey,
                signerPublicKey: accountPublicKey,
            });
        }
        if (linkedKeys.nodePublicKey) {
            transactions.push({
                type: TransactionType.NODE_KEY_LINK,
                linkAction: LinkAction[LinkAction.Unlink],
                linkedPublicKey: linkedKeys.nodePublicKey,
                signerPublicKey: accountPublicKey,
            });
        }

        // If nothing to unlink, then just escape
        if (transactions.length === 0) {
            throw new AppError('error_harvesting_no_keys_to_unlink', 'Failed to create stop harvesting transaction. No keys to unlink.');
        }

        // Prepare aggregate transaction
        return (aggregateTransaction = {
            type: TransactionType.AGGREGATE_COMPLETE,
            innerTransactions: transactions,
            signerPublicKey: accountPublicKey,
            fee,
        });
    };
}
