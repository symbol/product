export const TransactionGroup = {
	CONFIRMED: 'confirmed',
	UNCONFIRMED: 'unconfirmed',
	PARTIAL: 'partial',
	FAILED: 'failed'
};

export const TransactionAnnounceGroup = {
	DEFAULT: 'default',
	PARTIAL: 'partial',
	COSIGNATURE: 'cosignature'
};

export const MessageType = {
	PlainText: 0,
	EncryptedText: 1,
	DelegatedHarvesting: 254
};

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
	NODE_KEY_LINK: 16972
};

export const HarvestingStatus = {
	INACTIVE: 'inactive',
	ACTIVE: 'active',
	PENDING: 'pending',
	OPERATOR: 'operator',
	NODE_UNKNOWN: 'node_unknown'
};

export const NetworkType = {
	MAIN_NET: 104,
	TEST_NET: 152
};

export const NetworkIdentifier = {
	MAIN_NET: 'mainnet',
	TEST_NET: 'testnet'
};

export const Message = {
	UNLIMITED: 'unlimited',
	UNAVAILABLE: 'unavailable',
	INFINITY: 'infinity',
	MOSAIC: 'mosaic',
	ADDRESS: 'address',
	NO_ALIAS: 'noAlias',
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	UNKNOWN: 'unknown',
	EXPIRED: 'expired',
	UNCONFIRMED: 'unconfirmed',
	CONFIRMED: 'confirmed'
};

export const MosaicSupplyChangeAction = {
	Decrease: 0,
	Increase: 1
};

export const MosaicSupplyChangeActionMessage = {
	[MosaicSupplyChangeAction.Increase]: 'Increase',
	[MosaicSupplyChangeAction.Decrease]: 'Decrease'
};

export const NamespaceRegistrationType = {
	RootNamespace: 0,
	SubNamespace: 1
};

export const NamespaceRegistrationTypeMessage = {
	[NamespaceRegistrationType.RootNamespace]: 'RootNamespace',
	[NamespaceRegistrationType.SubNamespace]: 'SubNamespace'
};

export const AliasType = {
	None: 0,
	Mosaic: 1,
	Address: 2
};

export const AliasTypeMessage = {
	[AliasType.None]: 'None',
	[AliasType.Mosaic]: 'Mosaic',
	[AliasType.Address]: 'Address'
};

export const AliasAction = {
	Link: 1,
	Unlink: 0
};

export const AliasActionMessage = {
	[AliasAction.Link]: 'Link',
	[AliasAction.Unlink]: 'Unlink'
};

export const LinkAction = {
	Link: 1,
	Unlink: 0
};

export const LinkActionMessage = {
	[LinkAction.Link]: 'Link',
	[LinkAction.Unlink]: 'Unlink'
};

export const LockHashAlgorithm = {
	Op_Sha3_256: 0,
	Op_Hash_160: 1,
	Op_Hash_256: 2
};

export const LockHashAlgorithmMessage = {
	[LockHashAlgorithm.Op_Sha3_256]: 'Sha3 256',
	[LockHashAlgorithm.Op_Hash_160]: 'Hash 160',
	[LockHashAlgorithm.Op_Hash_256]: 'Hash 256'
};

export const MetadataType = {
	Account: 0,
	Mosaic: 1,
	Namespace: 2
};

export const MetadataTypeMessage = {
	[MetadataType.Account]: 'Account',
	[MetadataType.Mosaic]: 'Mosaic',
	[MetadataType.Namespace]: 'Namespace'
};

export const AddressRestrictionFlag = {
	AllowIncomingAddress: 1,
	AllowOutgoingAddress: 16385,
	BlockIncomingAddress: 32769,
	BlockOutgoingAddress: 49153
};

export const AddressRestrictionFlagMessage = {
	[AddressRestrictionFlag.AllowIncomingAddress]: 'AllowIncomingAddresses',
	[AddressRestrictionFlag.AllowOutgoingAddress]: 'AllowOutgoingAddresses',
	[AddressRestrictionFlag.BlockIncomingAddress]: 'BlockIncomingAddresses',
	[AddressRestrictionFlag.BlockOutgoingAddress]: 'BlockOutgoingAddresses'
};

export const MosaicRestrictionFlag = {
	AllowMosaic: 2,
	BlockMosaic: 32770
};

export const MosaicRestrictionFlagMessage = {
	[MosaicRestrictionFlag.AllowMosaic]: 'AllowMosaics',
	[MosaicRestrictionFlag.BlockMosaic]: 'BlockMosaics'
};

export const OperationRestrictionFlag = {
	AllowOutgoingTransactionType: 16388,
	BlockOutgoingTransactionType: 49156
};

export const OperationRestrictionFlagMessage = {
	[OperationRestrictionFlag.AllowOutgoingTransactionType]: 'AllowOutgoingTransactions',
	[OperationRestrictionFlag.BlockOutgoingTransactionType]: 'BlockOutgoingTransactions'
};

export const MosaicRestrictionEntryType = {
	ADDRESS: 0,
	GLOBAL: 1
};

export const MosaicRestrictionEntryTypeMessage = {
	[MosaicRestrictionEntryType.ADDRESS]: 'MosaicAddressRestriction',
	[MosaicRestrictionEntryType.GLOBAL]: 'MosaicGlobalRestriction'
};

export const MosaicRestrictionType = {
	NONE: 0,
	EQ: 1,
	NE: 2,
	LT: 3,
	LE: 4,
	GT: 5,
	GE: 6
};

export const MosaicRestrictionTypeMessage = {
	[MosaicRestrictionType.EQ]: 'MosaicRestrictionTypeEQ',
	[MosaicRestrictionType.GE]: 'MosaicRestrictionTypeGE',
	[MosaicRestrictionType.GT]: 'MosaicRestrictionTypeGT',
	[MosaicRestrictionType.LE]: 'MosaicRestrictionTypeLE',
	[MosaicRestrictionType.LT]: 'MosaicRestrictionTypeLT',
	[MosaicRestrictionType.NE]: 'MosaicRestrictionTypeNE',
	[MosaicRestrictionType.NONE]: 'MosaicRestrictionTypeNONE'
};

export const MosaicFlags = {
	NONE: 0,
	SUPPLY_MUTABLE: 1,
	TRANSFERABLE: 2,
	RESTRICTABLE: 4,
	REVOKABLE: 8
};
