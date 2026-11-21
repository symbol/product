// Generated from GET /api/symbol/transactions/unconfirmed through the real REST
// facade, database mapper and view, using SymbolUnconfirmedTransactionTestUtils.py
// node fixtures on TESTNET with native mosaic divisibility 6. The transfer message
// matches test_can_format_unconfirmed_transfer in REST's test_TransactionView.py.
// These are deterministic REST test responses, not a live node capture.

export const transferUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 176,
	timestamp: null,
	toAddress: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	transactionHash: '0101010101010101010101010101010101010101010101010101010101010101',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '48656C6C6F',
				type: 0
			}
		},
		{
			amount: 123.0,
			id: '72C0212E67A08BCE',
			name: '72C0212E67A08BCE'
		}
	],
	version: 1
};

export const aggregateBondedUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: [
		{
			deadline: null,
			embeddedTransactions: null,
			fee: null,
			fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			height: 0,
			signature: null,
			size: null,
			timestamp: null,
			toAddress: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			transactionHash: null,
			transactionType: 'TRANSFER',
			value: [
				{
					amount: 5.0,
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE'
				}
			],
			version: 1
		}
	],
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 264,
	timestamp: null,
	toAddress: null,
	transactionHash: '0202020202020202020202020202020202020202020202020202020202020202',
	transactionType: 'AGGREGATE_BONDED',
	value: [
		{
			cosignatures: [],
			transactionsHash: '2C03591ED233B317D8617565D7F75085E0710804EB836933171DDEBC3BBC4294'
		}
	],
	version: 2
};

export const namespaceRegistrationUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 152,
	timestamp: null,
	toAddress: null,
	transactionHash: '0303030303030303030303030303030303030303030303030303030303030303',
	transactionType: 'NAMESPACE_REGISTRATION',
	value: [
		{
			duration: '86400',
			id: '9B26A9460345E820',
			name: 'test--',
			registrationType: 0
		}
	],
	version: 1
};

export const addressAliasUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 161,
	timestamp: null,
	toAddress: null,
	transactionHash: '0404040404040404040404040404040404040404040404040404040404040404',
	transactionType: 'ADDRESS_ALIAS',
	value: [
		{
			address: 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
			aliasAction: 1,
			namespaceId: 'D748B092093AA7A1'
		}
	],
	version: 1
};

export const mosaicAliasUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 145,
	timestamp: null,
	toAddress: null,
	transactionHash: '0505050505050505050505050505050505050505050505050505050505050505',
	transactionType: 'MOSAIC_ALIAS',
	value: [
		{
			aliasAction: 1,
			mosaicId: '699E9532708D2FB8',
			namespaceId: 'D47D7DC85A201C13'
		}
	],
	version: 1
};

export const mosaicDefinitionUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 150,
	timestamp: null,
	toAddress: null,
	transactionHash: '0606060606060606060606060606060606060606060606060606060606060606',
	transactionType: 'MOSAIC_DEFINITION',
	value: [
		{
			divisibility: 4,
			duration: '100',
			flags: 15,
			id: '0E2B031D9C83906D',
			nonce: 1308337564
		}
	],
	version: 1
};

export const mosaicSupplyChangeUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 145,
	timestamp: null,
	toAddress: null,
	transactionHash: '0707070707070707070707070707070707070707070707070707070707070707',
	transactionType: 'MOSAIC_SUPPLY_CHANGE',
	value: [
		{
			action: 1,
			delta: '100000',
			mosaicId: '0E2B031D9C83906D'
		}
	],
	version: 1
};

export const mosaicSupplyRevocationUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 168,
	timestamp: null,
	toAddress: null,
	transactionHash: '0808080808080808080808080808080808080808080808080808080808080808',
	transactionType: 'MOSAIC_SUPPLY_REVOCATION',
	value: [
		{
			amount: '1',
			mosaicId: '0E2B031D9C83906D',
			sourceAddress: 'TAJHE6PY3UOW3EPZVL5UP52WPNOIQXH7BL6MXSQ'
		}
	],
	version: 1
};

export const aggregateCompleteMultisigAccountModificationUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: [
		{
			deadline: null,
			embeddedTransactions: null,
			fee: null,
			fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			height: 0,
			signature: null,
			size: null,
			timestamp: null,
			toAddress: null,
			transactionHash: null,
			transactionType: 'MULTISIG_ACCOUNT_MODIFICATION',
			value: [
				{
					addressAdditions: [],
					addressDeletions: ['TD7TOGIBCITKDRXRVVVVTNZ7H5B72CZRJAPBBQY'],
					minApprovalDelta: -1,
					minRemovalDelta: -1
				}
			],
			version: 1
		}
	],
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 248,
	timestamp: null,
	toAddress: null,
	transactionHash: '0909090909090909090909090909090909090909090909090909090909090909',
	transactionType: 'AGGREGATE_COMPLETE',
	value: [
		{
			cosignatures: [],
			transactionsHash: 'B239D10DAECEEB7077E1F6942300916041E91CBEA7613B267BAF3D913CBE6A22'
		}
	],
	version: 3
};

export const hashLockUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 184,
	timestamp: null,
	toAddress: null,
	transactionHash: '0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A',
	transactionType: 'HASH_LOCK',
	value: [
		{
			amount: '10000000',
			duration: '5760',
			hash: 'ADA2C97667D2D0C856E1EC5C5FC3236081C4ECE01AF7051B6CC5EBF9FAEAE6CB',
			mosaicId: '72C0212E67A08BCE'
		}
	],
	version: 1
};

export const secretLockUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 209,
	timestamp: null,
	toAddress: 'TAJHE6PY3UOW3EPZVL5UP52WPNOIQXH7BL6MXSQ',
	transactionHash: '0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B0B',
	transactionType: 'SECRET_LOCK',
	value: [
		{
			amount: '100000000',
			duration: '100',
			hashAlgorithm: 0,
			mosaicId: '72C0212E67A08BCE',
			secret: '5F6844DA291E0C5D427FB7E2E042E5621DD8E9146FB10193066EB75BA674164F'
		}
	],
	version: 1
};

export const secretProofUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 207,
	timestamp: null,
	toAddress: 'TAJHE6PY3UOW3EPZVL5UP52WPNOIQXH7BL6MXSQ',
	transactionHash: '0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C0C',
	transactionType: 'SECRET_PROOF',
	value: [
		{
			hashAlgorithm: 0,
			proof: '100C5F424FB6FE5F4A789A21CDD299E10D09EA5A',
			secret: '5F6844DA291E0C5D427FB7E2E042E5621DD8E9146FB10193066EB75BA674164F'
		}
	],
	version: 1
};

export const accountAddressRestrictionUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 160,
	timestamp: null,
	toAddress: null,
	transactionHash: '0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D0D',
	transactionType: 'ACCOUNT_ADDRESS_RESTRICTION',
	value: [
		{
			restrictionAdditions: [],
			restrictionDeletions: ['TCSFD7TYOFAWXJ2IB7RTR4ELZVWX22Y5QPQLNKA'],
			restrictionFlags: 32769
		}
	],
	version: 1
};

export const accountMosaicRestrictionUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 144,
	timestamp: null,
	toAddress: null,
	transactionHash: '0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E0E',
	transactionType: 'ACCOUNT_MOSAIC_RESTRICTION',
	value: [
		{
			restrictionAdditions: [],
			restrictionDeletions: ['699E9532708D2FB8'],
			restrictionFlags: 32770
		}
	],
	version: 1
};

export const accountOperationRestrictionUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 138,
	timestamp: null,
	toAddress: null,
	transactionHash: '0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F0F',
	transactionType: 'ACCOUNT_OPERATION_RESTRICTION',
	value: [
		{
			restrictionAdditions: [],
			restrictionDeletions: [16716],
			restrictionFlags: 49156
		}
	],
	version: 1
};

export const accountKeyLinkUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 161,
	timestamp: null,
	toAddress: null,
	transactionHash: '1010101010101010101010101010101010101010101010101010101010101010',
	transactionType: 'ACCOUNT_KEY_LINK',
	value: [
		{
			linkAction: 0,
			linkedPublicKey: 'F7D905E706693CAD93D176158A52F48196075D0D2B78123623B0CA184855E9DA'
		}
	],
	version: 1
};

export const mosaicAddressRestrictionUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 184,
	timestamp: null,
	toAddress: null,
	transactionHash: '1111111111111111111111111111111111111111111111111111111111111111',
	transactionType: 'MOSAIC_ADDRESS_RESTRICTION',
	value: [
		{
			mosaicId: '1213766D49458631',
			newRestrictionValue: '40',
			previousRestrictionValue: '30',
			restrictionKey: '00000000000056CE',
			targetAddress: 'TD7TOGIBCITKDRXRVVVVTNZ7H5B72CZRJAPBBQY'
		}
	],
	version: 1
};

export const mosaicGlobalRestrictionUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 170,
	timestamp: null,
	toAddress: null,
	transactionHash: '1212121212121212121212121212121212121212121212121212121212121212',
	transactionType: 'MOSAIC_GLOBAL_RESTRICTION',
	value: [
		{
			mosaicId: '1213766D49458631',
			newRestrictionType: 6,
			newRestrictionValue: '20',
			previousRestrictionType: 0,
			previousRestrictionValue: '0',
			referenceMosaicId: '0000000000000000',
			restrictionKey: '00000000000056CE'
		}
	],
	version: 1
};

export const aggregateCompleteAccountMetadataUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: [
		{
			deadline: null,
			embeddedTransactions: null,
			fee: null,
			fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			height: 0,
			signature: null,
			size: null,
			timestamp: null,
			toAddress: null,
			transactionHash: null,
			transactionType: 'ACCOUNT_METADATA',
			value: [
				{
					scopedMetadataKey: 'AB79F8932C207FF0',
					targetAddress: 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
					value: '6D65746164617461',
					valueSize: 8,
					valueSizeDelta: 8
				}
			],
			version: 1
		}
	],
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 264,
	timestamp: null,
	toAddress: null,
	transactionHash: '1313131313131313131313131313131313131313131313131313131313131313',
	transactionType: 'AGGREGATE_COMPLETE',
	value: [
		{
			cosignatures: [],
			transactionsHash: 'F2B4E535B5F02DCE54C0D8774EC271495C7C751B2EE6551D6E5A4F36658C88B9'
		}
	],
	version: 3
};

export const aggregateCompleteMosaicMetadataUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: [
		{
			deadline: null,
			embeddedTransactions: null,
			fee: null,
			fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			height: 0,
			signature: null,
			size: null,
			timestamp: null,
			toAddress: null,
			transactionHash: null,
			transactionType: 'MOSAIC_METADATA',
			value: [
				{
					scopedMetadataKey: 'E58D01B9EFE794B0',
					targetAddress: 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
					targetMosaicId: '699E9532708D2FB8',
					value: '6D6F73616963206D65746164617461',
					valueSize: 15,
					valueSizeDelta: 15
				}
			],
			version: 1
		}
	],
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 280,
	timestamp: null,
	toAddress: null,
	transactionHash: '1414141414141414141414141414141414141414141414141414141414141414',
	transactionType: 'AGGREGATE_COMPLETE',
	value: [
		{
			cosignatures: [],
			transactionsHash: 'D1D5F3C1BA3BA7FE04288311D3E2AE95CF6ABBD18FA125C5C7F641CFFA205869'
		}
	],
	version: 3
};

export const aggregateCompleteNamespaceMetadataUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: [
		{
			deadline: null,
			embeddedTransactions: null,
			fee: null,
			fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
			height: 0,
			signature: null,
			size: null,
			timestamp: null,
			toAddress: null,
			transactionHash: null,
			transactionType: 'NAMESPACE_METADATA',
			value: [
				{
					scopedMetadataKey: 'A7BA0DDE53F20693',
					targetAddress: 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
					targetNamespaceId: 'D47D7DC85A201C13',
					value: '6E616D657370616365206D65746164617461',
					valueSize: 18,
					valueSizeDelta: 18
				}
			],
			version: 1
		}
	],
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 280,
	timestamp: null,
	toAddress: null,
	transactionHash: '1515151515151515151515151515151515151515151515151515151515151515',
	transactionType: 'AGGREGATE_COMPLETE',
	value: [
		{
			cosignatures: [],
			transactionsHash: 'C4B0BDC78E6A3C14942954D61F2FD98A0E09C8D3EAA50206E23FA56BE46E42D4'
		}
	],
	version: 3
};

export const vrfKeyLinkUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 161,
	timestamp: null,
	toAddress: null,
	transactionHash: '1616161616161616161616161616161616161616161616161616161616161616',
	transactionType: 'VRF_KEY_LINK',
	value: [
		{
			linkAction: 0,
			linkedPublicKey: 'D7EC9E0D284AEC0ED01AF09E286EA2F6D02B39F2CC95AB872687185C085C1BF6'
		}
	],
	version: 1
};

export const votingKeyLinkUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 169,
	timestamp: null,
	toAddress: null,
	transactionHash: '1717171717171717171717171717171717171717171717171717171717171717',
	transactionType: 'VOTING_KEY_LINK',
	value: [
		{
			endEpoch: 150,
			linkAction: 0,
			linkedPublicKey: '1410185FF4E7CBC7A4F4D080CB6F5B3DC0553BB163A63EB6B90318A2077D10C5',
			startEpoch: 100
		}
	],
	version: 1
};

export const nodeKeyLinkUnconfirmedTransactionResponse = {
	deadline: '2022-11-02 07:25:23',
	embeddedTransactions: null,
	fee: null,
	fromAddress: 'TDPO5E6N2BZZNRNDLHHQ2FC3D6RBVUEOXEO26YY',
	height: 0,
	signature:
		'ABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABABAB',
	size: 161,
	timestamp: null,
	toAddress: null,
	transactionHash: '1818181818181818181818181818181818181818181818181818181818181818',
	transactionType: 'NODE_KEY_LINK',
	value: [
		{
			linkAction: 0,
			linkedPublicKey: '7D484DAD2B7D8B8F5E7DD52D29E338C5C5D7A7FBF065297A2A7902AD237616B9'
		}
	],
	version: 1
};

export const transactionListUnconfirmedResponse = [
	transferUnconfirmedTransactionResponse,
	aggregateBondedUnconfirmedTransactionResponse,
	namespaceRegistrationUnconfirmedTransactionResponse,
	addressAliasUnconfirmedTransactionResponse,
	mosaicAliasUnconfirmedTransactionResponse,
	mosaicDefinitionUnconfirmedTransactionResponse,
	mosaicSupplyChangeUnconfirmedTransactionResponse,
	mosaicSupplyRevocationUnconfirmedTransactionResponse,
	aggregateCompleteMultisigAccountModificationUnconfirmedTransactionResponse,
	hashLockUnconfirmedTransactionResponse,
	secretLockUnconfirmedTransactionResponse,
	secretProofUnconfirmedTransactionResponse,
	accountAddressRestrictionUnconfirmedTransactionResponse,
	accountMosaicRestrictionUnconfirmedTransactionResponse,
	accountOperationRestrictionUnconfirmedTransactionResponse,
	accountKeyLinkUnconfirmedTransactionResponse,
	mosaicAddressRestrictionUnconfirmedTransactionResponse,
	mosaicGlobalRestrictionUnconfirmedTransactionResponse,
	aggregateCompleteAccountMetadataUnconfirmedTransactionResponse,
	aggregateCompleteMosaicMetadataUnconfirmedTransactionResponse,
	aggregateCompleteNamespaceMetadataUnconfirmedTransactionResponse,
	vrfKeyLinkUnconfirmedTransactionResponse,
	votingKeyLinkUnconfirmedTransactionResponse,
	nodeKeyLinkUnconfirmedTransactionResponse
];
