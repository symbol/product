import { cloneDeep, shuffle } from 'lodash';
import { makeAutoObservable } from 'mobx';
import { LinkAction, LinkActionMessage, MessageType, TransactionType } from 'src/constants';
import { HarvestingService } from 'src/lib/services';
import { addressFromPublicKey, encodeDelegatedHarvestingMessage, generateKeyPair } from 'src/utils';

const defaultState = {};

export class HarvestingModule {
    constructor({ root, isObservable }) {
        this.name = 'harvesting';
        this._state = cloneDeep(defaultState);

        if (isObservable) makeAutoObservable(this);

        this._root = root;
    }

    fetchStatus = async () => {
        const { currentAccount, currentAccountInfo, networkProperties } = this._root;
        const { linkedKeys } = currentAccountInfo;

        return HarvestingService.fetchStatus(networkProperties, currentAccount, linkedKeys);
    };

    fetchAccountHarvestedBlocks = async (searchCriteria = {}) => {
        const { pageNumber = 1, pageSize = 15 } = searchCriteria;
        const { currentAccount, networkProperties } = this._root;
        const { address } = currentAccount;

        return HarvestingService.fetchHarvestedBlocks(networkProperties, address, { pageNumber, pageSize });
    };

    fetchNodeList = async () => {
        const { networkIdentifier } = this._root;
        const nodeList = await HarvestingService.fetchNodeList(networkIdentifier);

        return shuffle(nodeList);
    };

    fetchSummary = async () => {
        const { currentAccount, networkProperties } = this._root;
        const { address } = currentAccount;

        return HarvestingService.fetchSummary(networkProperties, address);
    };

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
        if (transactions.length === 0) throw new Error('error_harvesting_no_keys_to_unlink');

        // Prepare aggregate transaction
        return (aggregateTransaction = {
            type: TransactionType.AGGREGATE_COMPLETE,
            innerTransactions: transactions,
            signerPublicKey: accountPublicKey,
            fee,
        });
    };
}
