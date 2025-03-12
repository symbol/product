import { HarvestingModule } from '@/app/lib/controller/modules/HarvestingModule';
import { HarvestingService } from '@/app/lib/services';
import { AppError } from '@/app/lib/error';
import { shuffle } from 'lodash';
import { TransactionType } from '@/app/constants';
import { currentAccount, currentNetworkIdentifier, walletStorageAccounts } from '__fixtures__/local/wallet';
import { networkProperties } from '__fixtures__/local/network';
import * as utils from '@/app/utils';

jest.mock('@/app/lib/services', () => ({
    HarvestingService: {
        fetchStatus: jest.fn(),
        fetchHarvestedBlocks: jest.fn(),
        fetchNodeList: jest.fn(),
        fetchSummary: jest.fn(),
    },
}));

jest.mock('lodash', () => ({
    ...jest.requireActual('lodash'),
    shuffle: jest.fn((arr) => arr),
}));

jest.mock('@/app/utils', () => {
    const actualModule = jest.requireActual('@/app/utils');
    return {
        __esModule: true,
        ...actualModule,
    };
});

const LINK_ACTION = 'v_link';
const UNLINK_ACTION = 'v_unlink';

const LINKED_KEYS = {
    vrfPublicKey: 'currentVrfKey',
    linkedPublicKey: 'currentLinkedKey',
    nodePublicKey: 'currentNodeKey',
};

const NEW_NODE_ACCOUNT = walletStorageAccounts.testnet[1];
const NEW_REMOTE_ACCOUNT = walletStorageAccounts.testnet[2];
const NEW_VRF_ACCOUNT = walletStorageAccounts.testnet[3];

const DELEGATED_HARVESTING_MESSAGE = 'delegated-harvesting-message';

const VRF_KEY_LINK_TRANSACTION = {
    linkAction: LINK_ACTION,
    linkedPublicKey: NEW_VRF_ACCOUNT.publicKey,
    signerPublicKey: currentAccount.publicKey,
    type: 16963,
};
const REMOTE_KEY_LINK_TRANSACTION = {
    linkAction: LINK_ACTION,
    linkedPublicKey: NEW_REMOTE_ACCOUNT.publicKey,
    signerPublicKey: currentAccount.publicKey,
    type: 16716,
};
const NODE_KEY_LINK_TRANSACTION = {
    linkAction: LINK_ACTION,
    linkedPublicKey: NEW_NODE_ACCOUNT.publicKey,
    signerPublicKey: currentAccount.publicKey,
    type: 16972,
};
const DELEGATED_HARVESTING_TRANSACTION = {
    message: {
        payload: DELEGATED_HARVESTING_MESSAGE,
        text: '',
        type: 254,
    },
    mosaics: [],
    recipientAddress: NEW_NODE_ACCOUNT.address,
    signerPublicKey: currentAccount.publicKey,
    type: 16724,
};
const VRF_KEY_UNLINK_TRANSACTION = {
    linkAction: UNLINK_ACTION,
    linkedPublicKey: LINKED_KEYS.vrfPublicKey,
    signerPublicKey: currentAccount.publicKey,
    type: 16963,
};
const REMOTE_KEY_UNLINK_TRANSACTION = {
    linkAction: UNLINK_ACTION,
    linkedPublicKey: LINKED_KEYS.linkedPublicKey,
    signerPublicKey: currentAccount.publicKey,
    type: 16716,
};
const NODE_KEY_UNLINK_TRANSACTION = {
    linkAction: UNLINK_ACTION,
    linkedPublicKey: LINKED_KEYS.nodePublicKey,
    signerPublicKey: currentAccount.publicKey,
    type: 16972,
};

describe('HarvestingModule', () => {
    let harvestingModule, mockRoot;

    beforeEach(() => {
        mockRoot = {
            currentAccount,
            currentAccountInfo: { linkedKeys: {} },
            networkProperties,
            networkIdentifier: currentNetworkIdentifier,
            getCurrentAccountPrivateKey: jest.fn().mockResolvedValue(currentAccount.privateKey),
        };
        harvestingModule = new HarvestingModule({ root: mockRoot, isObservable: false });
    });

    describe('fetchStatus', () => {
        it('fetches harvesting status', async () => {
            // Arrange:
            const expectedStatus = { status: 'active', nodeUrl: 'testNode' };
            HarvestingService.fetchStatus.mockResolvedValue(expectedStatus);

            // Act:
            const result = await harvestingModule.fetchStatus();

            // Assert:
            expect(result).toEqual(expectedStatus);
            expect(HarvestingService.fetchStatus).toHaveBeenCalledWith(
                mockRoot.networkProperties,
                mockRoot.currentAccount,
                mockRoot.currentAccountInfo.linkedKeys
            );
        });
    });

    describe('fetchAccountHarvestedBlocks', () => {
        it('fetches harvested blocks with default search criteria', async () => {
            // Arrange:
            const expectedBlocks = [{ block: 1 }, { block: 2 }];
            HarvestingService.fetchHarvestedBlocks.mockResolvedValue(expectedBlocks);

            // Act:
            const result = await harvestingModule.fetchAccountHarvestedBlocks();

            // Assert:
            expect(result).toEqual(expectedBlocks);
            expect(HarvestingService.fetchHarvestedBlocks).toHaveBeenCalledWith(
                mockRoot.networkProperties,
                mockRoot.currentAccount.address,
                { pageNumber: 1, pageSize: 15 }
            );
        });
    });

    describe('fetchNodeList', () => {
        it('fetches and shuffles the node list', async () => {
            // Arrange:
            const nodeList = ['node1', 'node2', 'node3'];
            HarvestingService.fetchNodeList.mockResolvedValue(nodeList);

            // Act:
            const result = await harvestingModule.fetchNodeList();

            // Assert:
            expect(result).toEqual(nodeList);
            expect(HarvestingService.fetchNodeList).toHaveBeenCalledWith(mockRoot.networkIdentifier);
            expect(shuffle).toHaveBeenCalledWith(nodeList);
        });
    });

    describe('fetchSummary', () => {
        it('fetches harvesting summary', async () => {
            // Arrange:
            const expectedSummary = { harvestedBlocks: 10 };
            HarvestingService.fetchSummary.mockResolvedValue(expectedSummary);

            // Act:
            const result = await harvestingModule.fetchSummary();

            // Assert:
            expect(result).toEqual(expectedSummary);
            expect(HarvestingService.fetchSummary).toHaveBeenCalledWith(mockRoot.networkProperties, mockRoot.currentAccount.address);
        });
    });

    describe('createStartHarvestingTransaction', () => {
        const runStartHarvestingTest = async (linkedKeys, newAccountsToLink, expectedDelegateHarvestingMessage, expectedTransaction) => {
            // Arrange:
            mockRoot.currentAccountInfo.linkedKeys = linkedKeys;
            const { nodeAccount, remoteAccount, vrfAccount } = newAccountsToLink;
            const nodePublicKey = nodeAccount.publicKey;
            jest.spyOn(utils, 'generateKeyPair').mockReturnValueOnce(vrfAccount).mockReturnValueOnce(remoteAccount);
            const mockEncodeDelegatedHarvestingMessage = jest
                .spyOn(utils, 'encodeDelegatedHarvestingMessage')
                .mockReturnValueOnce(expectedDelegateHarvestingMessage);

            // Act:
            const transaction = await harvestingModule.createStartHarvestingTransaction(nodePublicKey);

            // Assert:
            expect(transaction).toStrictEqual(expectedTransaction);
            expect(mockEncodeDelegatedHarvestingMessage).toHaveBeenCalledWith(
                currentAccount.privateKey,
                nodePublicKey,
                remoteAccount.privateKey,
                vrfAccount.privateKey
            );
        };
        it('links new keys when no keys linked', async () => {
            // Arrange:
            const newAccountsToLink = {
                nodeAccount: NEW_NODE_ACCOUNT,
                remoteAccount: NEW_REMOTE_ACCOUNT,
                vrfAccount: NEW_VRF_ACCOUNT,
            };
            const linkedKeys = {}; // No currently linked keys
            const expectedDelegateHarvestingMessage = DELEGATED_HARVESTING_MESSAGE;
            const expectedTransaction = {
                type: TransactionType.AGGREGATE_COMPLETE,
                innerTransactions: [
                    VRF_KEY_LINK_TRANSACTION,
                    REMOTE_KEY_LINK_TRANSACTION,
                    NODE_KEY_LINK_TRANSACTION,
                    DELEGATED_HARVESTING_TRANSACTION,
                ],
                signerPublicKey: currentAccount.publicKey,
                fee: 0,
            };

            // Act & Assert:
            await runStartHarvestingTest(linkedKeys, newAccountsToLink, expectedDelegateHarvestingMessage, expectedTransaction);
        });

        it('unlinks old keys and links new keys when keys already linked', async () => {
            // Arrange:
            const newAccountsToLink = {
                nodeAccount: NEW_NODE_ACCOUNT,
                remoteAccount: NEW_REMOTE_ACCOUNT,
                vrfAccount: NEW_VRF_ACCOUNT,
            };
            const linkedKeys = LINKED_KEYS;
            const expectedDelegateHarvestingMessage = DELEGATED_HARVESTING_MESSAGE;
            const expectedTransaction = {
                type: TransactionType.AGGREGATE_COMPLETE,
                innerTransactions: [
                    VRF_KEY_UNLINK_TRANSACTION,
                    REMOTE_KEY_UNLINK_TRANSACTION,
                    NODE_KEY_UNLINK_TRANSACTION,
                    VRF_KEY_LINK_TRANSACTION,
                    REMOTE_KEY_LINK_TRANSACTION,
                    NODE_KEY_LINK_TRANSACTION,
                    DELEGATED_HARVESTING_TRANSACTION,
                ],
                signerPublicKey: currentAccount.publicKey,
                fee: 0,
            };

            // Act & Assert:
            await runStartHarvestingTest(linkedKeys, newAccountsToLink, expectedDelegateHarvestingMessage, expectedTransaction);
        });
    });

    describe('createStopHarvestingTransaction', () => {
        it('creates a valid stop harvesting transaction', () => {
            // Arrange:
            mockRoot.currentAccountInfo.linkedKeys = LINKED_KEYS;

            // Act:
            const transaction = harvestingModule.createStopHarvestingTransaction();

            // Assert:
            expect(transaction).toEqual({
                type: TransactionType.AGGREGATE_COMPLETE,
                innerTransactions: [VRF_KEY_UNLINK_TRANSACTION, REMOTE_KEY_UNLINK_TRANSACTION, NODE_KEY_UNLINK_TRANSACTION],
                signerPublicKey: currentAccount.publicKey,
                fee: 0,
            });
        });

        it('throws an error if no keys linked', () => {
            // Arrange:
            mockRoot.currentAccountInfo.linkedKeys = {}; // No currently linked keys

            // Act & Assert:
            expect(() => harvestingModule.createStopHarvestingTransaction()).toThrow(
                new AppError('error_harvesting_no_keys_to_unlink', 'Failed to create stop harvesting transaction. No keys to unlink.')
            );
        });
    });
});
