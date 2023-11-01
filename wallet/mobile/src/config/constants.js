import {
    AddressRestrictionFlag,
    AliasAction,
    LinkAction,
    LockHashAlgorithm,
    MetadataType,
    MosaicRestrictionEntryType,
    MosaicRestrictionFlag,
    MosaicRestrictionType,
    MosaicSupplyChangeAction,
    NamespaceRegistrationType,
    OperationRestrictionFlag,
} from 'symbol-sdk';

export class Constants {
    static Message = {
        UNLIMITED: '∞',
        UNAVAILABLE: 'v_na',
        INFINITY: '∞',
        MOSAIC: 'v_moasic',
        ADDRESS: 'v_address',
        NO_ALIAS: 'v_noAlias',
        ACTIVE: 'v_active',
        INACTIVE: 'v_inactive',
        UNKNOWN: 'v_unknown',
        EXPIRED: 'v_expired',
        UNCONFIRMED: 'unconfirmed',
        CONFIRMED: 'confirmed',
    };

    static MosaicSupplyChangeAction = {
        [MosaicSupplyChangeAction.Increase]: 'v_increase',
        [MosaicSupplyChangeAction.Decrease]: 'v_decrease',
    };

    static NamespaceRegistrationType = {
        [NamespaceRegistrationType.RootNamespace]: 'v_rootNamespace',
        [NamespaceRegistrationType.SubNamespace]: 'v_subNamespace',
    };

    static AliasAction = {
        [AliasAction.Link]: 'v_link',
        [AliasAction.Unlink]: 'v_unlink',
    };

    static LinkAction = {
        [LinkAction.Link]: 'v_link',
        [LinkAction.Unlink]: 'v_unlink',
    };

    static LockHashAlgorithm = {
        [LockHashAlgorithm.Op_Sha3_256]: 'Sha3 256',
        [LockHashAlgorithm.Op_Hash_160]: 'Hash 160',
        [LockHashAlgorithm.Op_Hash_256]: 'Hash 256',
    };

    static MetadataType = {
        [MetadataType.Account]: 'Account',
        [MetadataType.Mosaic]: 'Mosaic',
        [MetadataType.Namespace]: 'Namespace',
    };

    static AddressRestrictionFlag = {
        [AddressRestrictionFlag.AllowIncomingAddress]: 'v_AllowIncomingAddresses',
        [AddressRestrictionFlag.AllowOutgoingAddress]: 'v_AllowOutgoingAddresses',
        [AddressRestrictionFlag.BlockIncomingAddress]: 'v_BlockIncomingAddresses',
        [AddressRestrictionFlag.BlockOutgoingAddress]: 'v_BlockOutgoingAddresses',
    };

    static MosaicRestrictionFlag = {
        [MosaicRestrictionFlag.AllowMosaic]: 'v_AllowMosaics',
        [MosaicRestrictionFlag.BlockMosaic]: 'v_BlockMosaics',
    };

    static OperationRestrictionFlag = {
        [OperationRestrictionFlag.AllowOutgoingTransactionType]: 'v_AllowOutgoingTransactions',
        [OperationRestrictionFlag.BlockOutgoingTransactionType]: 'v_BlockOutgoingTransactions',
    };

    static MosaicRestrictionEntryType = {
        [MosaicRestrictionEntryType.ADDRESS]: 'v_MosaicAddressRestriction',
        [MosaicRestrictionEntryType.GLOBAL]: 'v_MosaicGlobalRestriction',
    };

    static MosaicRestrictionType = {
        [MosaicRestrictionType.EQ]: 'v_mosaicRestrictionTypeEQ',
        [MosaicRestrictionType.GE]: 'v_mosaicRestrictionTypeGE',
        [MosaicRestrictionType.GT]: 'v_mosaicRestrictionTypeGT',
        [MosaicRestrictionType.LE]: 'v_mosaicRestrictionTypeLE',
        [MosaicRestrictionType.LT]: 'v_mosaicRestrictionTypeLT',
        [MosaicRestrictionType.NE]: 'v_mosaicRestrictionTypeNE',
        [MosaicRestrictionType.NONE]: 'v_mosaicRestrictionTypeNONE',
    };

    static Events = {
        CONFIRMED_TRANSACTION: 'event.listener.confirmed',
        PARTIAL_TRANSACTION: 'event.listener.partial',
        LOGOUT: 'event.app.logout',
        LOGIN: 'event.app.login',
    };

    static MosaicFlags = {
        NONE: 0,
        SUPPLY_MUTABLE: 1,
        TRANSFERABLE: 2,
        RESTRICTABLE: 4,
        REVOKABLE: 8,
    };
}

export const TransactionType = {
    RESERVED: 0,
    TRANSFER: 16724,
    NAMESPACE_REGISTRATION: 16718,
    ADDRESS_ALIAS: 16974,
    MOSAIC_ALIAS: 17230,
    MOSAIC_DEFINITION: 16717,
    MOSAIC_SUPPLY_CHANGE: 16973,
    MOSAIC_SUPPLY_REVOCATION: 17229,
    MULTISIG_ACCOUNT_MODIFICATION: 16725,
    AGGREGATE_COMPLETE: 16705,
    AGGREGATE_BONDED: 16961,
    HASH_LOCK: 16712,
    SECRET_LOCK: 16722,
    SECRET_PROOF: 16978,
    ACCOUNT_ADDRESS_RESTRICTION: 16720,
    ACCOUNT_MOSAIC_RESTRICTION: 16976,
    ACCOUNT_OPERATION_RESTRICTION: 17232,
    ACCOUNT_KEY_LINK: 16716,
    MOSAIC_ADDRESS_RESTRICTION: 16977,
    MOSAIC_GLOBAL_RESTRICTION: 16721,
    ACCOUNT_METADATA: 16708,
    MOSAIC_METADATA: 16964,
    NAMESPACE_METADATA: 17220,
    VRF_KEY_LINK: 16963,
    VOTING_KEY_LINK: 16707,
    NODE_KEY_LINK: 16972,
    PERSISTENT_DELEGATION_REQUEST: 'PERSISTENT_DELEGATION_REQUEST',
};
