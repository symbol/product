import symbolSdk from 'symbol-sdk-v3';

const { symbol } = symbolSdk;

const alias = () => {
    const sampleAddress = 'TASYMBOLLK6FSL7GSEMQEAWN7VW55ZSZU2Q2Q5Y';
    const sampleNamespaceId = 0xc01dfee7feeddeadn;
    const sampleMosaicId = 0x7edcba90fedcba90n;

    return [
        {
            type: 'address_alias_transaction_v1',
            namespaceId: sampleNamespaceId,
            address: sampleAddress,
            aliasAction: 'link',
        },

        {
            type: 'mosaic_alias_transaction_v1',
            namespaceId: sampleNamespaceId,
            mosaicId: sampleMosaicId,
            aliasAction: 'link',
        },
    ];
};

const keyLink = () => {
    const samplePublicKey = 'BE0B4CF546B7B4F4BBFCFF9F574FDA527C07A53D3FC76F8BB7DB746F8E8E0A9F';

    return [
        {
            type: 'account_key_link_transaction_v1',
            linkedPublicKey: samplePublicKey,
            linkAction: 'link',
        },

        {
            type: 'node_key_link_transaction_v1',
            linkedPublicKey: samplePublicKey,
            linkAction: 'link',
        },

        {
            type: 'voting_key_link_transaction_v1',
            linkedPublicKey: samplePublicKey,
            linkAction: 'link',
            startEpoch: 10,
            endEpoch: 150,
        },

        {
            type: 'vrf_key_link_transaction_v1',
            linkedPublicKey: samplePublicKey,
            linkAction: 'link',
        },
    ];
};

const lock = () => {
    const sampleAddress = 'TASYMBOLLK6FSL7GSEMQEAWN7VW55ZSZU2Q2Q5Y';
    const sampleMosaicId = 0x7edcba90fedcba90n;
    const secret = 'C849C5A5F6BCA84EF1829B2A84C0BAC9D765383D000000000000000000000000';

    return [
        // note: only network currency can be used as a mosaic in hash lock
        {
            type: 'hash_lock_transaction_v1',
            mosaic: { mosaicId: sampleMosaicId, amount: 123_000000n },
            duration: 123n,
            hash: symbolSdk.Hash256.zero(),
        },

        {
            type: 'secret_lock_transaction_v1',
            mosaic: { mosaicId: sampleMosaicId, amount: 123_000000n },
            duration: 123n,
            recipientAddress: sampleAddress,
            secret,
            hashAlgorithm: 'hash_160',
        },

        {
            type: 'secret_proof_transaction_v1',
            recipientAddress: sampleAddress,
            secret,
            hashAlgorithm: 'hash_160',
            proof: new symbolSdk.ByteArray(4, 'C1ECFDFC').bytes,
        },
    ];
};

const metadata = () => {
    const sampleAddress = 'TASYMBOLLK6FSL7GSEMQEAWN7VW55ZSZU2Q2Q5Y';
    const sampleNamespaceId = 0xc01dfee7feeddeadn;
    const sampleMosaicId = 0x7edcba90fedcba90n;
    const value1 = 'much coffe, such wow';
    const value2 = 'Once upon a midnight dreary';
    const value3 = 'while I pondered, weak and weary';

    const templates = [
        {
            type: 'account_metadata_transaction_v1',
            targetAddress: sampleAddress,
            scopedMetadataKey: 0xc0ffen,
        },

        {
            type: 'mosaic_metadata_transaction_v1',
            targetMosaicId: sampleMosaicId,
            targetAddress: sampleAddress,
            scopedMetadataKey: 0xfacaden,
        },

        {
            type: 'namespace_metadata_transaction_v1',
            targetNamespaceId: sampleNamespaceId,
            targetAddress: sampleAddress,
            scopedMetadataKey: 0xc1cadan,
        },
    ];

    return [
        { ...templates[0], valueSizeDelta: value1.length, value: value1 },
        { ...templates[0], valueSizeDelta: -5, value: value1.substring(0, value1.length - 5) },

        { ...templates[1], valueSizeDelta: value2.length, value: value2 },
        { ...templates[1], valueSizeDelta: -5, value: value2.substring(0, value2.length - 5) },

        { ...templates[2], valueSizeDelta: value3.length, value: value3 },
        { ...templates[2], valueSizeDelta: -5, value: value3.substring(0, value3.length - 5) },
    ];
};

const mosaic = () => {
    const sampleAddress = new symbol.Address('TASYMBOLLK6FSL7GSEMQEAWN7VW55ZSZU2Q2Q5Y');

    return [
        {
            type: 'mosaic_definition_transaction_v1',
            duration: 1n,
            nonce: 123,
            flags: 'transferable restrictable',
            divisibility: 2,
        },

        {
            type: 'mosaic_supply_change_transaction_v1',
            mosaicId: symbol.generateMosaicId(sampleAddress, 123),
            delta: 1000n * 100n, // assuming divisibility = 2
            action: 'increase',
        },
    ];
};

const namespace = () => [
    {
        type: 'namespace_registration_transaction_v1',
        registrationType: 'root',
        duration: 123n,
        name: 'roger',
    },

    {
        type: 'namespace_registration_transaction_v1',
        registrationType: 'child',
        parentId: symbol.generateNamespaceId('roger'),
        name: 'charlie',
    },
];

const restrictionAccount = () => {
    const sampleAddress = 'TASYMBOLLK6FSL7GSEMQEAWN7VW55ZSZU2Q2Q5Y';
    const sampleMosaicId = 0x7edcba90fedcba90n;

    return [
        // allow incoming transactions only from address below
        {
            type: 'account_address_restriction_transaction_v1',
            restrictionFlags: 'address',
            restrictionAdditions: [sampleAddress],
        },

        // block transactions outgoing to given address
        // note: block and allow restrictions are mutually exclusive, documentation
        // https://docs.symbol.dev/concepts/account-restriction.html#account-restriction
        {
            type: 'account_address_restriction_transaction_v1',
            restrictionFlags: 'address outgoing block',
            restrictionAdditions: [sampleAddress],
        },

        {
            type: 'account_mosaic_restriction_transaction_v1',
            restrictionFlags: 'mosaic_id',
            restrictionAdditions: [sampleMosaicId],
        },

        // allow only specific transaction types
        {
            type: 'account_operation_restriction_transaction_v1',
            restrictionFlags: 'outgoing',
            restrictionAdditions: ['transfer', 'account_key_link', 'vrf_key_link', 'voting_key_link', 'node_key_link'],
        },
    ];
};

const restrictionMosaic = () => {
    const sampleAddress = 'TASYMBOLLK6FSL7GSEMQEAWN7VW55ZSZU2Q2Q5Y';
    const sampleMosaicId = 0x7edcba90fedcba90n;

    return [
        {
            type: 'mosaic_global_restriction_transaction_v1',
            mosaicId: sampleMosaicId,
            referenceMosaicId: 0n,
            restrictionKey: 0x0a0d474e5089n,
            previousRestrictionValue: 0n,
            newRestrictionValue: 2n,
            previousRestrictionType: 0,
            newRestrictionType: 'ge',
        },

        {
            type: 'mosaic_address_restriction_transaction_v1',
            mosaicId: sampleMosaicId,
            restrictionKey: 0x0a0d474e5089n,
            previousRestrictionValue: 0n,
            newRestrictionValue: 5n,
            targetAddress: sampleAddress,
        },
    ];
};

const transfer = () => {
    const sampleAddress = 'TASYMBOLLK6FSL7GSEMQEAWN7VW55ZSZU2Q2Q5Y';
    const sampleMosaicId = 0x7edcba90fedcba90n;

    return [
        // mosaics but no message
        {
            type: 'transfer_transaction_v1',
            recipientAddress: sampleAddress,
            mosaics: [{ mosaicId: sampleMosaicId, amount: 12345_000000n }],
        },

        // message but no mosaics
        {
            type: 'transfer_transaction_v1',
            recipientAddress: sampleAddress,
            message: 'Wayne Gretzky',
        },

        // mosaics and message
        {
            type: 'transfer_transaction_v1',
            recipientAddress: sampleAddress,
            mosaics: [{ mosaicId: sampleMosaicId, amount: 12345_000000n }],
            message: 'You miss 100%% of the shots you don’t take',
        },
    ];
};

export const txs = {
    alias,
    keyLink,
    lock,
    metadata,
    mosaic,
    namespace,
    restrictionAccount,
    restrictionMosaic,
    transfer,
};
