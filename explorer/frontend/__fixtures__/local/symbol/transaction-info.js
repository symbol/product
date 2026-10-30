// Independently specified expectations for the #2723 contract and existing TransactionGraphic inputs.
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

const transferDetail = { recipient, mosaics, message: { type: 'plain', text: 'Hello 日本語' } };
const transferGraphic = { type: 'TRANSFER', sender, recipient, detail: transferDetail };
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
	info: { ...info, recipient, value: mosaics, amount: 1.234567, ...embeddedInfo }, detail: transferDetail, graphic: transferGraphic
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
const hashLock = {
	transactionHash: hash, ownerAddress: sender, endHeight: 100, status: 'unused',
	mosaics: [{ id: mosaicId, name: 'symbol.xym', amount: 10, isNative: true }]
};
// Expected page models are specified independently of the API service and response fixture.
const baseTransaction = {
	...info,
	hash,
	isEmbedded: false,
	aggregateHash: null,
	embeddedIndex: null,
	group: 'confirmed',
	version: 1,
	signer: sender,
	aggregate: null,
	hashLock: null,
	signatures: [],
	accountStateChange: null
};
const createTransaction = (type, detail, bodyFields = {}, overrides = {}) => ({
	...baseTransaction,
	type,
	detail,
	body: [{ type, sender, recipient: null, detail, ...bodyFields }],
	...overrides
});
const transferBody = { type: 'TRANSFER', sender, recipient, detail: transferDetail, mosaics, message: transferDetail.message };
const transfer = createTransaction('TRANSFER', transferDetail, { recipient, mosaics, message: { type: 'plain', text: 'Hello 日本語' } }, {
	recipient, value: mosaics, amount: 1.234567
});
const aggregateBody = [transferBody, { type: 'ACCOUNT_METADATA', sender, recipient: null, detail: metadataDetail }];
const aggregateComplete = createTransaction('AGGREGATE_COMPLETE', aggregateDetail, {}, {
	aggregate, body: aggregateBody, signatures: [{ signer: linkedAddress, signature: 'EF'.repeat(64) }]
});
const zeroMosaics = [{ id: mosaicId, name: 'symbol.xym', amount: 0 }];
const zeroDetail = { recipient, mosaics: zeroMosaics, message: null };
const emptyDetail = { recipient, mosaics: [], message: null };
const encryptedDetail = { ...transferDetail, message: { type: 'encrypted', text: 'AAFF' } };
const aliasTransferDetail = {
	recipient: `namespace:${namespaceId}`,
	mosaics: [{ id: namespaceId, name: namespaceId, amount: 1234567 }],
	message: null
};

export const transactionInfoResults = {
	transfer,
	transferZero: createTransaction('TRANSFER', zeroDetail, { recipient, mosaics: zeroMosaics, message: null }, {
		recipient, amount: 0, value: zeroMosaics, fee: 0
	}),
	transferEmpty: createTransaction('TRANSFER', emptyDetail, { recipient, mosaics: [], message: null }, { recipient }),
	transferEncrypted: createTransaction('TRANSFER', encryptedDetail, {
		recipient, mosaics, message: { type: 'encrypted', text: 'AAFF' }
	}, {
		recipient, value: mosaics, amount: 1.234567
	}),
	transferUnconfirmedAlias: createTransaction('TRANSFER', aliasTransferDetail, {
		recipient: `namespace:${namespaceId}`,
		mosaics: [{ id: namespaceId, name: namespaceId, amount: 1234567 }],
		message: null
	}, {
		...pendingInfo, hash: 'BA'.repeat(32), group: 'unconfirmed', recipient: `namespace:${namespaceId}`
	}),
	aggregateComplete,
	aggregateBonded: { ...aggregateComplete, type: 'AGGREGATE_BONDED', hashLock },
	aggregatePartial: {
		...aggregateComplete, ...pendingInfo, type: 'AGGREGATE_BONDED', group: 'partial', signatures: [], hashLock: null,
		aggregate: { ...aggregate, cosignatures: [], embeddedTransactions: [
			{ ...childTransfer, group: 'partial', info: { ...childTransfer.info, ...pendingInfo } },
			{ ...childMetadata, group: 'partial', info: { ...childMetadata.info, ...pendingInfo } }
		] }
	},
	accountKeyLink: createTransaction('ACCOUNT_KEY_LINK', keyDetail, {
		targetAccount: sender, keyLinkAction: 1, linkedPublicKey: '01'.repeat(32), linkedAddress
	}),
	accountKeyUnlink: createTransaction('ACCOUNT_KEY_LINK', { ...keyDetail, linkAction: 'unlink' }, {
		targetAccount: sender, keyLinkAction: 2, linkedPublicKey: '01'.repeat(32), linkedAddress
	}),
	nodeKeyLink: createTransaction('NODE_KEY_LINK', keyDetail, {
		targetAccount: sender, keyLinkAction: 1, linkedPublicKey: '01'.repeat(32), linkedAddress
	}),
	vrfKeyLink: createTransaction('VRF_KEY_LINK', keyDetail, {
		targetAccount: sender, keyLinkAction: 1, linkedPublicKey: '01'.repeat(32), linkedAddress
	}),
	votingKeyLink: createTransaction('VOTING_KEY_LINK', { ...keyDetail, startEpoch: 0, endEpoch: 2 }, {
		targetAccount: sender, keyLinkAction: 1, linkedPublicKey: '01'.repeat(32), linkedAddress
	}),
	hashLock: createTransaction('HASH_LOCK', lockDetail, { mosaics }, { value: mosaics }),
	secretLock: createTransaction('SECRET_LOCK', secretLockDetail, { recipient, mosaics }, { recipient, value: mosaics }),
	secretProof: createTransaction('SECRET_PROOF', secretDetail, { recipient }, { recipient }),
	accountMetadata: createTransaction('ACCOUNT_METADATA', metadataDetail),
	mosaicMetadata: createTransaction('MOSAIC_METADATA', { ...metadataDetail, targetMosaicId: mosaicId, targetMosaicAliasNames: [] }),
	namespaceMetadata: createTransaction('NAMESPACE_METADATA', { ...metadataDetail, targetNamespaceId: namespaceId, namespaceName: null }),
	mosaicDefinition: createTransaction('MOSAIC_DEFINITION', definitionDetail, { mosaic: { id: mosaicId, name: mosaicId } }),
	mosaicSupplyDecrease: createTransaction('MOSAIC_SUPPLY_CHANGE', supplyDetail, {
		targetMosaic: { id: mosaicId, name: mosaicId }, delta: '9007199254740993', supplyAction: 2
	}, { value: [{ id: mosaicId, name: 'symbol.xym', amount: 9007199254.740993 }] }),
	mosaicSupplyIncrease: createTransaction('MOSAIC_SUPPLY_CHANGE', { ...supplyDetail, action: 'increase', delta: '0' }, {
		targetMosaic: { id: mosaicId, name: mosaicId }, delta: '0', supplyAction: 1
	}, { value: [{ id: mosaicId, name: 'symbol.xym', amount: 0 }] }),
	mosaicSupplyRevocation: createTransaction('MOSAIC_SUPPLY_REVOCATION', revocationDetail, {
		sender: recipient, recipient: sender, mosaics
	}, { value: mosaics }),
	multisigModification: createTransaction('MULTISIG_ACCOUNT_MODIFICATION', multisigDetail, {
		targetAccount: sender, cosignatoryAdditions: [recipient, `namespace:${namespaceId}`, recipient], cosignatoryDeletions: [sender]
	}),
	addressAlias: createTransaction('ADDRESS_ALIAS', aliasDetail, { recipient, namespace: { id: namespaceId, name: null } }),
	mosaicAlias: createTransaction('MOSAIC_ALIAS', mosaicAliasDetail, {
		namespace: { id: namespaceId, name: 'alias' }, targetMosaic: { id: mosaicId, name: mosaicId }
	}),
	namespaceSub: createTransaction('NAMESPACE_REGISTRATION', namespaceDetail, { namespace: { id: namespaceId, name: 'leaf' } }),
	namespaceRoot: createTransaction('NAMESPACE_REGISTRATION', {
		...namespaceDetail, registrationType: 'root', parentId: null, duration: '0'
	}, { namespace: { id: namespaceId, name: 'leaf' } }),
	accountAddressRestriction: createTransaction('ACCOUNT_ADDRESS_RESTRICTION', addressRestrictionDetail),
	accountMosaicRestriction: createTransaction('ACCOUNT_MOSAIC_RESTRICTION', mosaicRestrictionDetail),
	accountOperationRestriction: createTransaction('ACCOUNT_OPERATION_RESTRICTION', operationRestrictionDetail),
	mosaicAddressRestriction: createTransaction('MOSAIC_ADDRESS_RESTRICTION', mosaicAddressRestrictionDetail),
	mosaicGlobalRestriction: createTransaction('MOSAIC_GLOBAL_RESTRICTION', mosaicGlobalRestrictionDetail)
};
