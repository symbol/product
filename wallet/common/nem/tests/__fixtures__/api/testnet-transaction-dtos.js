/* eslint-disable max-len */

// NEM testnet transactions exactly as a node returned them. Each one keeps the hash the network gave it
// (meta.hash.data), so together they are the reference for calculating the hash of a transaction DTO.

// Version 1 transfer with a plain message.
const transferVersion1DTO = {
	meta: {
		innerHash: {},
		id: 3680,
		hash: { data: '94ce812161b06da35a618ce548f8756c4db2fe397b0dcf5dc3b44fb1df5003f0' },
		height: 645297
	},
	transaction: {
		timeStamp: 353079947,
		amount: 1000000000,
		signature: '444c960835af8ecbc041c780fa3c1d7df8221cda06e24871741c4d7ab77a902fb5d30fd58cc8af1aaf729ea7782d798157c854ccc2a2ca1a370b192d4aa41e07',
		fee: 100000,
		recipient: 'TDQIZK6LUOYP7VXPZRLQKPW4Z2BZMSVAVY57C4VD',
		type: 257,
		deadline: 353083547,
		message: { payload: '476f6f64204c75636b21', type: 1 },
		version: -1744830463,
		signer: 'a5b92b846d935808c95b4c38f77e27d809aad08837ccd74be5e523127f6f9739'
	}
};

// Version 2 transfer without a message.
const transferDTO = {
	meta: {
		innerHash: {},
		id: 3683,
		hash: { data: '214696dd71a8ba25425f47dd2c6203f01515026df4aee8990116f3f87cec9ade' },
		height: 645773
	},
	transaction: {
		timeStamp: 353108768,
		amount: 2000000,
		signature: '70f837b29511431d7fe05a6e8c076052f27dbc008d168f26c2aa1eead985798f2e275f05b2102be996cff08d32c104ae2fccd989dee0aecbff08c1eca8cec90e',
		fee: 50000,
		recipient: 'TAXGMIE2ZRJZ7US5U6Q75ECMRNOFLK35LKBOWV5C',
		mosaics: [],
		type: 257,
		deadline: 353115968,
		message: {},
		version: -1744830462,
		signer: 'f258e050e917f983c806ec3cb24409ec2417ca16d1aff4e5a35a0813afeb0820'
	}
};

// Version 2 transfer with an encrypted message.
const encryptedTransferDTO = {
	meta: {
		innerHash: {},
		id: 3692,
		hash: { data: 'd8aa571ab09a55d9bf55ceddfd4ef01e680077838288e91b5123c36579e96ca6' },
		height: 645851
	},
	transaction: {
		timeStamp: 353113146,
		amount: 1000000,
		signature: '8cd5518daa305e5a1fe4893b2ef3a1cc9f6d78cf54ce5e0170df0cbf138fc869ce8d61de0ade0237ce2ca0f4ea456db21ee65e8bdb567481f93e0ffb26ad5d06',
		fee: 200000,
		recipient: 'TAXGMIE2ZRJZ7US5U6Q75ECMRNOFLK35LKBOWV5C',
		mosaics: [],
		type: 257,
		deadline: 353120346,
		message: {
			payload: '3a7d93731936aedab6e88365026c9151d9b6dcefecf64cfc13df442c75b3d70aabf2aac5dce8601a5ba83efe3c3c11abe5d28ee9dee4b63bddff80a067a4cd72',
			type: 2
		},
		version: -1744830462,
		signer: 'f258e050e917f983c806ec3cb24409ec2417ca16d1aff4e5a35a0813afeb0820'
	}
};

// Version 2 transfer with a mosaic.
const mosaicTransferDTO = {
	meta: {
		innerHash: {},
		id: 5079,
		hash: { data: 'f4856aeb6210380f55b44078c28dbda72fb84f5c64bab029118bdf69bc692597' },
		height: 879419
	},
	transaction: {
		timeStamp: 367250938,
		amount: 1500000,
		signature: '17755201c3e6366038dbcbef2c6bda3db09db0af93f1675087217ed68a73181bcb424b2b91f058ba5ddc9c5389096882f813ecfb6211815f7db8e43030b3870e',
		fee: 50000,
		recipient: 'TCLGJSPIJK7U2AKMRXJ5CNWQQMLUZPXZUFFHCR2M',
		mosaics: [{ quantity: 1000001, mosaicId: { namespaceId: 'nem', name: 'xem' } }],
		type: 257,
		deadline: 367258138,
		message: {},
		version: -1744830462,
		signer: 'f258e050e917f983c806ec3cb24409ec2417ca16d1aff4e5a35a0813afeb0820'
	}
};

// Importance transfer that links a remote account.
const importanceTransferDTO = {
	meta: {
		innerHash: {},
		id: 3688,
		hash: { data: 'f5a3801d9a16afe6cfdac350c6a5d27c9fd5dcd2e9b39e5790c00eb2ee4fbca2' },
		height: 645812
	},
	transaction: {
		timeStamp: 353111022,
		mode: 1,
		signature: '3d384b1aaa8b93ad2f109d4c1daa1195d7784451db8d2bab3ab046780559b86f7cde8195a8e506756f506e050d5d6a60cd3f2f1fd0472a90aaeef31147c93407',
		fee: 150000,
		remoteAccount: 'ea9e4d7dd140bd88cd18707560f260980f1cbd657b2fc5481f764a8b12a47ffe',
		type: 2049,
		deadline: 353118222,
		version: -1744830463,
		signer: 'f258e050e917f983c806ec3cb24409ec2417ca16d1aff4e5a35a0813afeb0820'
	}
};

// Version 2 multisig account modification that adds two cosignatories.
const multisigModificationDTO = {
	meta: {
		innerHash: {},
		id: 3684,
		hash: { data: '415a5cf4a0af6076bfc8959170f9da1bfb1743a733d08538736656a11fc3eb6c' },
		height: 645785
	},
	transaction: {
		timeStamp: 353109411,
		signature: '0f5649cbc8d696f29282f135a7279095b424931e2991d308de5155d880c8edf878ad393928937953bb5b61ee284be96cd98641c848c428f3f278a8656b48100d',
		fee: 500000,
		minCosignatories: { relativeChange: 2 },
		type: 4097,
		deadline: 353195811,
		version: -1744830462,
		signer: 'c8b81390399a3229dbf842991d29a5fd4f0d39df6ece793b8b7bb9a4f061ae45',
		modifications: [
			{
				modificationType: 1,
				cosignatoryAccount: '8a715bec156c1490c769e31ba6288cf9074a4987b8f0d5095ceea0460a60f74a'
			},
			{
				modificationType: 1,
				cosignatoryAccount: 'f258e050e917f983c806ec3cb24409ec2417ca16d1aff4e5a35a0813afeb0820'
			}
		]
	}
};

// Multisig transfer with one cosignature.
const multisigTransferDTO = {
	meta: {
		innerHash: { data: 'e386346483e28ae4604e1f9ec2aed45939e9c2fc99ca730529d42a701f5c3acb' },
		id: 5094,
		hash: { data: '72bdb8a3d84be81853868269b7f504a24975cd4cdbb76e8df882c918208bf7d1' },
		height: 893704
	},
	transaction: {
		timeStamp: 368115739,
		signature: '148f22159991da137787760a1d7e69ae5a3d8f8fc11b223c603787e12d6bfd28d821c132a335dd490e752756eabe7807494a36e362b764b9410b0b83bef90e03',
		fee: 150000,
		type: 4100,
		deadline: 368202139,
		version: -1744830463,
		signatures: [
			{
				timeStamp: 368115824,
				otherHash: { data: 'e386346483e28ae4604e1f9ec2aed45939e9c2fc99ca730529d42a701f5c3acb' },
				otherAccount: 'TCLXLP37WC7L3UUUW4FFFOFGT4DBEHMLIKSSZCJR',
				signature: '1423f41db4eba84a85df486d40d82035d9586f81f012f666549dbeff0950006adcf9070b9afd098310d2bd077e46fa18f82603e32351e1b4752555d1e44e8608',
				fee: 150000,
				type: 4098,
				deadline: 368123024,
				version: -1744830463,
				signer: '8a715bec156c1490c769e31ba6288cf9074a4987b8f0d5095ceea0460a60f74a'
			}
		],
		signer: 'f258e050e917f983c806ec3cb24409ec2417ca16d1aff4e5a35a0813afeb0820',
		otherTrans: {
			timeStamp: 368115739,
			amount: 10000,
			fee: 50000,
			recipient: 'TCLGJSPIJK7U2AKMRXJ5CNWQQMLUZPXZUFFHCR2M',
			mosaics: [],
			type: 257,
			deadline: 368202139,
			message: {},
			version: -1744830462,
			signer: 'c8b81390399a3229dbf842991d29a5fd4f0d39df6ece793b8b7bb9a4f061ae45'
		}
	}
};

// Sub-namespace registration.
const subNamespaceRegistrationDTO = {
	meta: {
		innerHash: {},
		id: 3582,
		hash: { data: '48be7c58763934a978bf27d4a07f27a0e3b677ac31dc68dd842b2fa346690524' },
		height: 601220
	},
	transaction: {
		timeStamp: 350412066,
		parent: 'mycompany',
		signature: '0a9a47b0f1f2b99b2565c9920271a28e24bc7778b527bb610901f5500543160f00f0b5264790a62b7bedd3584add1f8335544c1328ba777b599b34b8f19b1e09',
		fee: 150000,
		rentalFeeSink: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
		rentalFee: 10000000,
		newPart: 'tokens',
		type: 8193,
		deadline: 350415666,
		version: -1744830463,
		signer: 'b25708cbdcfdf3932ee4104c9392819bafbcdfe66019667b62161c1902164a4b'
	}
};

// Mosaic definition with an absolute levy.
const mosaicDefinitionWithLevyDTO = {
	meta: {
		innerHash: {},
		id: 4233,
		hash: { data: '8f5679541232f1c771f16a6c2c9f7ea3ddf5a4cafda302d73ef35043d2249dd3' },
		height: 712141
	},
	transaction: {
		timeStamp: 357125052,
		creationFee: 10000000,
		mosaicDefinition: {
			creator: 'bede475ab591752a095af818e529f5b405a92be58f52d89a40db6425ca5248dd',
			description: 'test3',
			id: { namespaceId: 'testnamespace1', name: 'test2' },
			properties: [
				{ name: 'divisibility', value: '2' },
				{ name: 'initialSupply', value: '1000' },
				{ name: 'supplyMutable', value: 'true' },
				{ name: 'transferable', value: 'true' }
			],
			levy: {
				fee: 321,
				recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
				type: 1,
				mosaicId: { namespaceId: 'nem', name: 'xem' }
			}
		},
		signature: '1241136ba9a8fabc4bd4102ab65e6f5732138b750288b8c2f06a5b337003fd945e3e80fc943bb5acec9b3622cacbfbe65f89e1559f1bd3a47ac9285fb6af7b02',
		fee: 150000,
		creationFeeSink: 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC',
		type: 16385,
		deadline: 357128652,
		version: -1744830463,
		signer: 'bede475ab591752a095af818e529f5b405a92be58f52d89a40db6425ca5248dd'
	}
};

// Mosaic supply increase.
const mosaicSupplyChangeDTO = {
	meta: {
		innerHash: {},
		id: 4179,
		hash: { data: 'dab4f5f52af398ee64929af442807e2a9a762ea6f4890c5c19d4cbc02287a37b' },
		height: 700656
	},
	transaction: {
		timeStamp: 356429724,
		signature: '5f56d76fcebe03017bb45236de9236fc4c1711dc5e015ead31de11c44d25b4660a7021c19f331f60cc295da8e35b57f0bed620a2ae2e2c50536e66f5ac746c0e',
		fee: 150000,
		supplyType: 1,
		delta: 500,
		type: 16386,
		deadline: 356436924,
		mosaicId: { namespaceId: 'my_namespace', name: 'token_1784016991' },
		version: -1744830463,
		signer: '462ee976890916e54fa825d26bdd0235f5eb5b6a143c199ab0ae5ee9328e08ce'
	}
};

// Cases for calculating the hash of a transaction DTO: each pairs a DTO with the hash the network gave it.
// The inner transfer and the cosignature come from the multisig transfer, where the node keeps them.
export const transactionDTOHashCases = [
	{
		name: 'version 1 transfer with a plain message',
		transactionDTO: transferVersion1DTO,
		expected: '94ce812161b06da35a618ce548f8756c4db2fe397b0dcf5dc3b44fb1df5003f0'
	},
	{
		name: 'transfer',
		transactionDTO: transferDTO,
		expected: '214696dd71a8ba25425f47dd2c6203f01515026df4aee8990116f3f87cec9ade'
	},
	{
		name: 'transfer with an encrypted message',
		transactionDTO: encryptedTransferDTO,
		expected: 'd8aa571ab09a55d9bf55ceddfd4ef01e680077838288e91b5123c36579e96ca6'
	},
	{
		name: 'transfer with a mosaic',
		transactionDTO: mosaicTransferDTO,
		expected: 'f4856aeb6210380f55b44078c28dbda72fb84f5c64bab029118bdf69bc692597'
	},
	{
		name: 'importance transfer',
		transactionDTO: importanceTransferDTO,
		expected: 'f5a3801d9a16afe6cfdac350c6a5d27c9fd5dcd2e9b39e5790c00eb2ee4fbca2'
	},
	{
		name: 'multisig account modification',
		transactionDTO: multisigModificationDTO,
		expected: '415a5cf4a0af6076bfc8959170f9da1bfb1743a733d08538736656a11fc3eb6c'
	},
	{
		name: 'multisig transfer',
		transactionDTO: multisigTransferDTO,
		expected: '72bdb8a3d84be81853868269b7f504a24975cd4cdbb76e8df882c918208bf7d1'
	},
	{
		name: 'inner transfer of a multisig transfer',
		transactionDTO: { transaction: multisigTransferDTO.transaction.otherTrans },
		expected: 'e386346483e28ae4604e1f9ec2aed45939e9c2fc99ca730529d42a701f5c3acb'
	},
	{
		name: 'cosignature of a multisig transfer',
		transactionDTO: { transaction: multisigTransferDTO.transaction.signatures[0] },
		expected: '814293f661e9778fed1b8dac495ef0a576f229d75364e81ae3cdc375a107d50c'
	},
	{
		name: 'sub-namespace registration',
		transactionDTO: subNamespaceRegistrationDTO,
		expected: '48be7c58763934a978bf27d4a07f27a0e3b677ac31dc68dd842b2fa346690524'
	},
	{
		name: 'mosaic definition with a levy',
		transactionDTO: mosaicDefinitionWithLevyDTO,
		expected: '8f5679541232f1c771f16a6c2c9f7ea3ddf5a4cafda302d73ef35043d2249dd3'
	},
	{
		name: 'mosaic supply change',
		transactionDTO: mosaicSupplyChangeDTO,
		expected: 'dab4f5f52af398ee64929af442807e2a9a762ea6f4890c5c19d4cbc02287a37b'
	}
];
