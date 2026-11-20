// Contract-based examples from #2723, SymbolTransactionDetailView; not captured API responses.
const sender = 'TAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAI';
const recipient = 'TABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQ';
const linkedAddress = 'TCUZDUB4XJ4XV3KSUBQ6NPZPP4RY3CUFZ6HIVBI';
const mosaicId = '72C0212E67A08BCE';
const namespaceId = '85BBEA6CC462B244';
const hash = 'AB'.repeat(32);
const mosaics = [{ id: mosaicId, name: 'symbol.xym', amount: 1.234567 }];
const block = { height: 7, hash: 'EF'.repeat(32), timestamp: '2026-01-07 00:00:00', feeMultiplier: 123 };
const info = {
	height: 7,
	timestamp: '2026-01-07 00:00:00',
	fee: 0.0001,
	value: [],
	amount: 0,
	maxFee: 0.001,
	deadline: '2026-01-08 00:00:00',
	sender,
	recipient: null,
	signerPublicKey: '01'.repeat(32),
	signature: 'CD'.repeat(64),
	size: 200,
	block
};
const pendingInfo = { height: null, timestamp: null, fee: null, value: null, amount: null, block: null };
const embeddedInfo = { fee: null, maxFee: null, deadline: null, signature: null, size: null };

const createResponse = (type, detail, overrides = {}) => ({
	hash,
	isEmbedded: false,
	aggregateHash: null,
	embeddedIndex: null,
	group: 'confirmed',
	type,
	version: 1,
	info: { ...info },
	detail,
	aggregate: null,
	hashLock: null,
	graphic: { transactions: [{ type, sender, recipient: null, detail }] },
	...overrides
});

const transferDetail = { recipient, mosaics, message: { type: 'plain', text: 'Hello 日本語' } };
const transferGraphic = { type: 'TRANSFER', sender, recipient, detail: transferDetail };
const transfer = createResponse('TRANSFER', transferDetail, {
	info: { ...info, recipient, value: mosaics, amount: 1.234567 },
	graphic: { transactions: [transferGraphic] }
});
const keyDetail = { linkAction: 'link', linkedPublicKey: '01'.repeat(32), linkedAccountAddress: linkedAddress };
const supplyDetail = { mosaicId, action: 'decrease', delta: '9007199254740993' };
const namespaceDetail = {
	namespaceId, namespaceName: 'leaf', registrationType: 'sub', parentId: 'AAAAAAAAAAAAAAAA', duration: null
};
const multisigDetail = {
	minApprovalDelta: -1,
	minRemovalDelta: 0,
	addressAdditions: [recipient, `namespace:${namespaceId}`, recipient],
	addressDeletions: [sender]
};
const metadataDetail = { targetAddress: recipient, scopedMetadataKey: '0000000000000001', valueDelta: 'FF00', valueSizeDelta: -1 };
const secretDetail = { recipient, secret: 'AA'.repeat(32), proof: 'BB', hashAlgorithm: 'sha3_256' };
const definitionDetail = {
	mosaicId, divisibility: 0, duration: '0', nonce: 1, supplyMutable: false, transferable: true, restrictable: false, revokable: false
};
const lockDetail = { mosaics, duration: '9007199254740993', hash: 'AA'.repeat(32) };
const secretLockDetail = { mosaics, recipient, duration: '1', secret: 'AA'.repeat(32), hashAlgorithm: 'hash160' };
const revocationDetail = { address: recipient, mosaics };
const aliasDetail = { namespaceId, namespaceName: null, aliasAction: 'unlink', address: recipient };
const mosaicAliasDetail = { namespaceId, namespaceName: 'alias', aliasAction: 'link', mosaicId };
const addressRestrictionDetail = {
	restrictionFlags: 1, restrictionType: 'Allow Incoming Address',
	restrictionAddressAdditions: [recipient, `namespace:${namespaceId}`, recipient], restrictionAddressDeletions: []
};
const mosaicRestrictionDetail = {
	restrictionFlags: 2, restrictionType: 'Allow Incoming Mosaic',
	restrictionMosaicAdditions: [namespaceId, mosaicId], restrictionMosaicDeletions: []
};
const operationRestrictionDetail = {
	restrictionFlags: 16388, restrictionType: 'Allow Outgoing Operation',
	restrictionOperationAdditions: ['SECRET_LOCK', 'TRANSFER'], restrictionOperationDeletions: []
};
const mosaicAddressRestrictionDetail = {
	mosaicId, mosaicAliasNames: [], targetAddress: recipient, restrictionKey: '0000000000000001',
	previousRestrictionValue: '18446744073709551615', newRestrictionValue: '0'
};
const mosaicGlobalRestrictionDetail = {
	mosaicId, referenceMosaicId: '0000000000000000', mosaicAliasNames: [], restrictionKey: '0000000000000001',
	previousRestrictionType: 'NONE', previousRestrictionValue: '0', newRestrictionType: 'EQ', newRestrictionValue: '9007199254740993'
};
const childTransfer = {
	hash: null, isEmbedded: true, aggregateHash: hash, embeddedIndex: 0, group: 'confirmed', type: 'TRANSFER', version: 1,
	info: { ...transfer.info, ...embeddedInfo }, detail: transferDetail, graphic: transferGraphic
};
const childMetadata = {
	hash: null, isEmbedded: true, aggregateHash: hash, embeddedIndex: 1, group: 'confirmed', type: 'ACCOUNT_METADATA', version: 1,
	info: { ...info, ...embeddedInfo }, detail: metadataDetail,
	graphic: { type: 'ACCOUNT_METADATA', sender, recipient: null, detail: metadataDetail }
};
const aggregate = {
	hash,
	embeddedTransactions: [childTransfer, childMetadata],
	cosignatures: [{ signer: linkedAddress, signature: 'EF'.repeat(64) }]
};
const aggregateDetail = { transactionsHash: 'AA'.repeat(32) };
const aggregateGraphic = { transactions: [transferGraphic, childMetadata.graphic] };
const aggregateComplete = createResponse('AGGREGATE_COMPLETE', aggregateDetail, { aggregate, graphic: aggregateGraphic });
const hashLock = {
	transactionHash: hash, ownerAddress: sender, endHeight: 100, status: 'unused',
	mosaics: [{ id: mosaicId, name: 'symbol.xym', amount: 10, isNative: true }]
};
const aliasTransferDetail = {
	recipient: `namespace:${namespaceId}`,
	mosaics: [{ id: namespaceId, name: namespaceId, amount: 1234567 }],
	message: null
};

export const transactionInfoResponses = {
	transfer,
	transferZero: {
		...transfer, info: { ...transfer.info, amount: 0, value: [{ id: mosaicId, name: 'symbol.xym', amount: 0 }], fee: 0 },
		detail: { recipient, mosaics: [{ id: mosaicId, name: 'symbol.xym', amount: 0 }], message: null },
		graphic: { transactions: [{ ...transferGraphic, detail: {
			recipient, mosaics: [{ id: mosaicId, name: 'symbol.xym', amount: 0 }], message: null
		} }] }
	},
	transferEmpty: createResponse('TRANSFER', { recipient, mosaics: [], message: null }, {
		info: { ...info, recipient },
		graphic: { transactions: [{ ...transferGraphic, detail: { recipient, mosaics: [], message: null } }] }
	}),
	transferEncrypted: {
		...transfer, detail: { ...transferDetail, message: { type: 'encrypted', text: 'AAFF' } },
		graphic: { transactions: [{ ...transferGraphic, detail: { ...transferDetail, message: { type: 'encrypted', text: 'AAFF' } } }] }
	},
	transferUnconfirmedAlias: createResponse('TRANSFER', aliasTransferDetail, {
		hash: 'BA'.repeat(32), group: 'unconfirmed', info: { ...info, ...pendingInfo, recipient: `namespace:${namespaceId}` },
		graphic: { transactions: [{ type: 'TRANSFER', sender, recipient: `namespace:${namespaceId}`, detail: aliasTransferDetail }] }
	}),
	aggregateComplete,
	aggregateBonded: { ...aggregateComplete, type: 'AGGREGATE_BONDED', hashLock },
	aggregatePartial: {
		...aggregateComplete, type: 'AGGREGATE_BONDED', group: 'partial', hashLock: null, info: { ...info, ...pendingInfo },
		aggregate: { ...aggregate, cosignatures: [], embeddedTransactions: [
			{ ...childTransfer, group: 'partial', info: { ...childTransfer.info, ...pendingInfo } },
			{ ...childMetadata, group: 'partial', info: { ...childMetadata.info, ...pendingInfo } }
		] }
	},
	accountKeyLink: createResponse('ACCOUNT_KEY_LINK', keyDetail),
	accountKeyUnlink: createResponse('ACCOUNT_KEY_LINK', { ...keyDetail, linkAction: 'unlink' }),
	nodeKeyLink: createResponse('NODE_KEY_LINK', keyDetail),
	vrfKeyLink: createResponse('VRF_KEY_LINK', keyDetail),
	votingKeyLink: createResponse('VOTING_KEY_LINK', { ...keyDetail, startEpoch: 0, endEpoch: 2 }),
	hashLock: createResponse('HASH_LOCK', lockDetail, { info: { ...info, value: mosaics } }),
	secretLock: createResponse('SECRET_LOCK', secretLockDetail, {
		info: { ...info, recipient, value: mosaics },
		graphic: { transactions: [{ type: 'SECRET_LOCK', sender, recipient, detail: secretLockDetail }] }
	}),
	secretProof: createResponse('SECRET_PROOF', secretDetail, {
		info: { ...info, recipient }, graphic: { transactions: [{ type: 'SECRET_PROOF', sender, recipient, detail: secretDetail }] }
	}),
	accountMetadata: createResponse('ACCOUNT_METADATA', metadataDetail),
	mosaicMetadata: createResponse('MOSAIC_METADATA', { ...metadataDetail, targetMosaicId: mosaicId, targetMosaicAliasNames: [] }),
	namespaceMetadata: createResponse('NAMESPACE_METADATA', { ...metadataDetail, targetNamespaceId: namespaceId, namespaceName: null }),
	mosaicDefinition: createResponse('MOSAIC_DEFINITION', definitionDetail),
	mosaicSupplyDecrease: createResponse('MOSAIC_SUPPLY_CHANGE', supplyDetail, {
		info: { ...info, value: [{ id: mosaicId, name: 'symbol.xym', amount: 9007199254.740993 }] }
	}),
	mosaicSupplyIncrease: createResponse('MOSAIC_SUPPLY_CHANGE', { ...supplyDetail, action: 'increase', delta: '0' }, {
		info: { ...info, value: [{ id: mosaicId, name: 'symbol.xym', amount: 0 }] }
	}),
	mosaicSupplyRevocation: createResponse('MOSAIC_SUPPLY_REVOCATION', revocationDetail, {
		info: { ...info, value: mosaics },
		graphic: { transactions: [{ type: 'MOSAIC_SUPPLY_REVOCATION', sender: recipient, recipient: sender, detail: revocationDetail }] }
	}),
	multisigModification: createResponse('MULTISIG_ACCOUNT_MODIFICATION', multisigDetail),
	addressAlias: createResponse('ADDRESS_ALIAS', aliasDetail, {
		graphic: { transactions: [{ type: 'ADDRESS_ALIAS', sender, recipient, detail: aliasDetail }] }
	}),
	mosaicAlias: createResponse('MOSAIC_ALIAS', mosaicAliasDetail),
	namespaceSub: createResponse('NAMESPACE_REGISTRATION', namespaceDetail),
	namespaceRoot: createResponse('NAMESPACE_REGISTRATION', {
		...namespaceDetail, registrationType: 'root', parentId: null, duration: '0'
	}),
	accountAddressRestriction: createResponse('ACCOUNT_ADDRESS_RESTRICTION', addressRestrictionDetail),
	accountMosaicRestriction: createResponse('ACCOUNT_MOSAIC_RESTRICTION', mosaicRestrictionDetail),
	accountOperationRestriction: createResponse('ACCOUNT_OPERATION_RESTRICTION', operationRestrictionDetail),
	mosaicAddressRestriction: createResponse('MOSAIC_ADDRESS_RESTRICTION', mosaicAddressRestrictionDetail),
	mosaicGlobalRestriction: createResponse('MOSAIC_GLOBAL_RESTRICTION', mosaicGlobalRestrictionDetail)
};
