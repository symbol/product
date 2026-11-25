/* eslint-disable max-len */
export const transferConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		message: {
			text: 'Refund-2',
			type: 'plain'
		},
		mosaics: [
			{
				amount: 20.601464,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		],
		recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					message: {
						text: 'Refund-2',
						type: 'plain'
					},
					mosaics: [
						{
							amount: 20.601464,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					],
					recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI'
				},
				recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
				sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
				type: 'TRANSFER'
			}
		]
	},
	group: 'confirmed',
	hash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	hashLock: null,
	info: {
		amount: 20.601464,
		block: {
			feeMultiplier: 2702,
			hash: 'C2600A3A20F8041945AD6C95AF16E7A0D6CA09635C9BC1A820246EF9F88CD8CE',
			height: 3912970,
			timestamp: '2026-11-22 03:10:54'
		},
		deadline: '2026-11-22 04:59:24',
		fee: 0.49987,
		height: 3912970,
		maxFee: 0.5,
		recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
		sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
		signature: '75014F7352D8898D032FE5AF6088C454BE320C632520830AA15FC7330AF0B8921723195F32FCF110632B12810CBDE61A6C7314A0F113DBB620CA8A171CD4C200',
		signerPublicKey: '470446A0431053018961AF02461B440DC192AAD78EBC994D615B6174580BBBFA',
		size: 185,
		timestamp: '2026-11-22 03:10:54',
		value: [
			{
				amount: 20.601464,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		]
	},
	isEmbedded: false,
	type: 'TRANSFER',
	version: 1
};

export const transferEncryptedMessageConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		message: {
			text: '91618DBE000D3361B192FE9C07E33C2E8BF896D5C610055BFDD951CE8FF4B782D40DE05A9277FDAE76E302D2D8FCD9235A957041',
			type: 'encrypted'
		},
		mosaics: [
			{
				amount: 7,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		],
		recipient: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					message: {
						text: '91618DBE000D3361B192FE9C07E33C2E8BF896D5C610055BFDD951CE8FF4B782D40DE05A9277FDAE76E302D2D8FCD9235A957041',
						type: 'encrypted'
					},
					mosaics: [
						{
							amount: 7,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					],
					recipient: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI'
				},
				recipient: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'TRANSFER'
			}
		]
	},
	group: 'confirmed',
	hash: '56FEB2764AEE189F754330AB8494B89EC6B3D8664BB207B09EC9E3F2A5F96F89',
	hashLock: null,
	info: {
		amount: 7,
		block: {
			feeMultiplier: 100,
			hash: '86F926FB79B91F2A6BAEB4F9D3E97A5A75ECB97B1CA9121286542600E41A972D',
			height: 3895411,
			timestamp: '2026-11-16 00:42:27'
		},
		deadline: '2026-11-16 02:42:20',
		fee: 0.0229,
		height: 3895411,
		maxFee: 0.0229,
		recipient: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: '22954DA44C79E24830144E7849E4527602AFDD22BC2667DBEC3B6397AF9EFE61CD0554E36213ED3E85114EF746757CD49EAC5CAD0A08670A21FF6DCE42F11B00',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 229,
		timestamp: '2026-11-16 00:42:27',
		value: [
			{
				amount: 7,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		]
	},
	isEmbedded: false,
	type: 'TRANSFER',
	version: 1
};

export const transferDelegatedHarvestingMessageConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		message: {
			text: '7A890175AA2EBE340865BB7D935023B9E913544422881ADE46E4D1E246071B5CC041E7D9145C2B4E24444000BC517746F803F896283C1002E4A6D4150677EEA5D64DB30A29356CBE3FD15125ABD9B50633E3F2B0C519EEA82293931B90A6B2CF1EC364C4EBAF745B6B3268E727C530ABEEDD06836D826F5FAFAE5857',
			type: 'persistentDelegationHarvesting'
		},
		mosaics: [],
		recipient: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					message: {
						text: '7A890175AA2EBE340865BB7D935023B9E913544422881ADE46E4D1E246071B5CC041E7D9145C2B4E24444000BC517746F803F896283C1002E4A6D4150677EEA5D64DB30A29356CBE3FD15125ABD9B50633E3F2B0C519EEA82293931B90A6B2CF1EC364C4EBAF745B6B3268E727C530ABEEDD06836D826F5FAFAE5857',
						type: 'persistentDelegationHarvesting'
					},
					mosaics: [],
					recipient: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA'
				},
				recipient: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
				sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
				type: 'TRANSFER'
			}
		]
	},
	group: 'confirmed',
	hash: '55CA9605FF5FC2DE9A0FE3392FC4785DD1CDFBC98DB22018D151FDBBFC2B7FC5',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 3424,
			hash: '904A53FAC32154837DD52EB059368038697E816AAA8E94F9E2D60D1E898AE9FB',
			height: 3919761,
			timestamp: '2026-11-24 11:48:39'
		},
		deadline: '2026-11-24 13:48:02',
		fee: 0.999808,
		height: 3919761,
		maxFee: 1,
		recipient: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
		sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
		signature: '33AD8FD1C527DAA29FC11E9F3287A01DB97EF4F1ACCD6C02814508BC7F52198C89E6B32D6744372DC8A71611EA748FE1EB02C5CA716A6B72BD66FC243F36E30E',
		signerPublicKey: '2D8C021EE4D5CEE859E69467345E8761293725512C1DD4C25A50541DB44C6EEE',
		size: 292,
		timestamp: '2026-11-24 11:48:39',
		value: []
	},
	isEmbedded: false,
	type: 'TRANSFER',
	version: 1
};

export const transferRawMessageConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		message: {
			text: '307830663032656536356535313065613330303036653633616163633636383432386164376139393865',
			type: null
		},
		mosaics: [
			{
				amount: 100,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		],
		recipient: 'TC4P25P32VW76NDZZFYDCRJOCS7LMBQRYXQFVXY'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					message: {
						text: '307830663032656536356535313065613330303036653633616163633636383432386164376139393865',
						type: null
					},
					mosaics: [
						{
							amount: 100,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					],
					recipient: 'TC4P25P32VW76NDZZFYDCRJOCS7LMBQRYXQFVXY'
				},
				recipient: 'TC4P25P32VW76NDZZFYDCRJOCS7LMBQRYXQFVXY',
				sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
				type: 'TRANSFER'
			}
		]
	},
	group: 'confirmed',
	hash: '860AF8FDE99A20C1AAAA88DE643B09C65077BD71D80D61CDA654F68C413023A1',
	hashLock: null,
	info: {
		amount: 100,
		block: {
			feeMultiplier: 164,
			hash: '2002B1B74FA286F2F82C859AAB3DF1665542C0D996C496C95E4452EACC0713FD',
			height: 3919540,
			timestamp: '2026-11-24 09:58:24'
		},
		deadline: '2026-11-24 11:57:55',
		fee: 0.035752,
		height: 3919540,
		maxFee: 0.035828,
		recipient: 'TC4P25P32VW76NDZZFYDCRJOCS7LMBQRYXQFVXY',
		sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		signature: '96E85FA218A8F8004B7452B575EA84C7731DA59B7954ED9F548FBE53F40831C39CDC46210B22AAC30616E9AD2D327E1B9CCC24DAF5E4AD59F812D0FAFB7F0A0E',
		signerPublicKey: '721D9ACD9070737382B11B2A1F8FF04374F42B9F190A8015B207A225BD1C462F',
		size: 218,
		timestamp: '2026-11-24 09:58:24',
		value: [
			{
				amount: 100,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		]
	},
	isEmbedded: false,
	type: 'TRANSFER',
	version: 1
};

export const transferCustomMosaicOnlyConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		message: null,
		mosaics: [
			{
				amount: 100,
				id: '4EB0A0590FF41C2D',
				name: '4EB0A0590FF41C2D'
			}
		],
		recipient: 'TAKSZ42GO35ENLHYRUBKE6EMSM4UUQAKUACXB5A'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					message: null,
					mosaics: [
						{
							amount: 100,
							id: '4EB0A0590FF41C2D',
							name: '4EB0A0590FF41C2D'
						}
					],
					recipient: 'TAKSZ42GO35ENLHYRUBKE6EMSM4UUQAKUACXB5A'
				},
				recipient: 'TAKSZ42GO35ENLHYRUBKE6EMSM4UUQAKUACXB5A',
				sender: 'TA3GCBHJBTRCEHVYVHCNUCULY2NB76W7MVECFUY',
				type: 'TRANSFER'
			}
		]
	},
	group: 'confirmed',
	hash: '29BF971A66BDF82C90A8AF0EDD32E63328045CD226871AB3B9FA45B48C3B88C0',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 5681,
			hash: '558CAE9794DE4E1D9811ECF74AC90672D91C2F0D777F1E1A76A923561E3A4D51',
			height: 3921284,
			timestamp: '2026-11-25 00:31:59'
		},
		deadline: '2026-11-25 01:31:39',
		fee: 0.999856,
		height: 3921284,
		maxFee: 1,
		recipient: 'TAKSZ42GO35ENLHYRUBKE6EMSM4UUQAKUACXB5A',
		sender: 'TA3GCBHJBTRCEHVYVHCNUCULY2NB76W7MVECFUY',
		signature: 'AD0740F681EBCC6C4F6BBF66ADC2238EA8CDE0408CD15C31FA6DDA6B7CFEE3C9C34F3371D6C8F1A0E1C273FBBF8CCA371C07F1B5004367A591FBA04C5583440B',
		signerPublicKey: 'F8D6857FBE59B1E30C6EF73C208E3082AB0102352C8B67175E24B83D371DF3F7',
		size: 176,
		timestamp: '2026-11-25 00:31:59',
		value: [
			{
				amount: 100,
				id: '4EB0A0590FF41C2D',
				name: '4EB0A0590FF41C2D'
			}
		]
	},
	isEmbedded: false,
	type: 'TRANSFER',
	version: 1
};

export const namespaceRegistrationConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		duration: '86400',
		namespaceId: 'BCB88A9E05A4936E',
		namespaceName: 'barber',
		parentId: null,
		registrationType: 'root'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					duration: '86400',
					namespaceId: 'BCB88A9E05A4936E',
					namespaceName: 'barber',
					parentId: null,
					registrationType: 'root'
				},
				recipient: null,
				sender: 'TCHGVWS3QBN464X3KVK7RSLZECXTBNXNW3YP43I',
				type: 'NAMESPACE_REGISTRATION'
			}
		]
	},
	group: 'confirmed',
	hash: '5B67DF51A1602A270AF89EA3AAB53B7FEBFC3A3D5412D858B8A53FCCC96FD17E',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'B49EA0A47C2E6CA5CFB78EF0F3772074D71B45D858920DA1E966B335B371B5F4',
			height: 3905285,
			timestamp: '2026-11-19 11:04:01'
		},
		deadline: '2026-11-19 13:03:44',
		fee: 0.0152,
		height: 3905285,
		maxFee: 0.0152,
		recipient: null,
		sender: 'TCHGVWS3QBN464X3KVK7RSLZECXTBNXNW3YP43I',
		signature: '78D9C3445A934B7DBDF16ADE4ED8DFEF3E0BDADCBC76AD9FC3A088E5496376BE0DA82B42500F9E971DEF293174973AE6509426D9BEB1A3A7AEA3D2B6029A0303',
		signerPublicKey: 'F493F72B3E3FBECD25334DD6225ACE334EB1A50AFFB7EA9D2374F4695FE30AA2',
		size: 152,
		timestamp: '2026-11-19 11:04:01',
		value: []
	},
	isEmbedded: false,
	type: 'NAMESPACE_REGISTRATION',
	version: 1
};

export const subNamespaceRegistrationConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		duration: null,
		namespaceId: 'F3C31C1D0F7DD7D2',
		namespaceName: 'coin',
		parentId: '804CA0D4C39086CF',
		registrationType: 'sub'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					duration: null,
					namespaceId: 'F3C31C1D0F7DD7D2',
					namespaceName: 'coin',
					parentId: '804CA0D4C39086CF',
					registrationType: 'sub'
				},
				recipient: null,
				sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
				type: 'NAMESPACE_REGISTRATION'
			}
		]
	},
	group: 'confirmed',
	hash: '68535E3FCFE574180F7D77694941BC5A1D4CBBA7FF69981B9F15673FCBFEFDF9',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'DA178E4793E43ED75B43EA1ACB0B6BCF9AF865671DEDDEB1366D21FD5FC40FD3',
			height: 3907406,
			timestamp: '2026-11-20 04:46:00'
		},
		deadline: '2026-11-20 06:45:48',
		fee: 0.015,
		height: 3907406,
		maxFee: 0.015,
		recipient: null,
		sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
		signature: '7F634267283E0B81A0AD7C8F0C7AB8045ECF2E8DE7542E0EA254CCA20787077D9E9B9D8A911AE77E056B2A3DC4811E6C4103C8CA37D3A19DE775C16DC2A51809',
		signerPublicKey: '2D1E3317B8D2A89E3E2C873D26AA565907967BB69EE914C7FB1ACF3E888DAF34',
		size: 150,
		timestamp: '2026-11-20 04:46:00',
		value: []
	},
	isEmbedded: false,
	type: 'NAMESPACE_REGISTRATION',
	version: 1
};

export const addressAliasConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		address: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
		aliasAction: 'link',
		namespaceId: '804CA0D4C39086CF',
		namespaceName: 'warashibe'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					address: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
					aliasAction: 'link',
					namespaceId: '804CA0D4C39086CF',
					namespaceName: 'warashibe'
				},
				recipient: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
				sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
				type: 'ADDRESS_ALIAS'
			}
		]
	},
	group: 'confirmed',
	hash: '64524403AF3A23DDCEEAC0995737B54ADF0BD316ACDC8A395966153EC6FA3501',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '6CBDC83F6D8BB4D9AC664626FACEDD192E3AD7637EB51A582E4DF464BA3C6A6D',
			height: 3904718,
			timestamp: '2026-11-19 06:18:41'
		},
		deadline: '2026-11-19 08:18:12',
		fee: 0.0161,
		height: 3904718,
		maxFee: 0.0161,
		recipient: null,
		sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
		signature: '8F5FE6672C08F96ABAEBC88188B3C65D1234A50ADEDAACE46463B6D3042A1A845046B230177FC355667D1DFD8536CBBD319361CAD54176B76539B4448E334805',
		signerPublicKey: '2D1E3317B8D2A89E3E2C873D26AA565907967BB69EE914C7FB1ACF3E888DAF34',
		size: 161,
		timestamp: '2026-11-19 06:18:41',
		value: []
	},
	isEmbedded: false,
	type: 'ADDRESS_ALIAS',
	version: 1
};

export const mosaicAliasConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		aliasAction: 'link',
		mosaicId: '50158CBDDAC0E894',
		namespaceId: 'F3C31C1D0F7DD7D2',
		namespaceName: 'warashibe.coin'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					aliasAction: 'link',
					mosaicId: '50158CBDDAC0E894',
					namespaceId: 'F3C31C1D0F7DD7D2',
					namespaceName: 'warashibe.coin'
				},
				recipient: null,
				sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
				type: 'MOSAIC_ALIAS'
			}
		]
	},
	group: 'confirmed',
	hash: '7A3051A802B93DAD7A9B7D5EFC5EE66E6E0A0C66060ADB69E571482F248F5CDB',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'DE9C4FFDA80C5B2F930C6F8744BAD74B2DE57B6AA63DA0A5983D05754B7629AB',
			height: 3907407,
			timestamp: '2026-11-20 04:46:31'
		},
		deadline: '2026-11-20 06:45:59',
		fee: 0.0145,
		height: 3907407,
		maxFee: 0.0145,
		recipient: null,
		sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
		signature: '07D65E34FA5FE11C67C7EBE2367C264E3FB61FC681B862FBB84A97A34DF601B9B7CE10E7E5B839DFE4992810249EDE6FCBCC54B98149DBB09409CE9CBF2F4108',
		signerPublicKey: '2D1E3317B8D2A89E3E2C873D26AA565907967BB69EE914C7FB1ACF3E888DAF34',
		size: 145,
		timestamp: '2026-11-20 04:46:31',
		value: []
	},
	isEmbedded: false,
	type: 'MOSAIC_ALIAS',
	version: 1
};

export const mosaicDefinitionConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		divisibility: 0,
		duration: '0',
		mosaicId: '406FE5941F06BCBE',
		nonce: 15243112,
		restrictable: false,
		revokable: true,
		supplyMutable: true,
		transferable: true
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					divisibility: 0,
					duration: '0',
					mosaicId: '406FE5941F06BCBE',
					nonce: 15243112,
					restrictable: false,
					revokable: true,
					supplyMutable: true,
					transferable: true
				},
				recipient: null,
				sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
				type: 'MOSAIC_DEFINITION'
			}
		]
	},
	group: 'confirmed',
	hash: '9D70BEEDEAD9BE028F51CF279E509E5180D41858E1DE98CA466E5CD131B686A8',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '65E33B4CEFDF574E9472873BBF4986DF13C7366B25A5860D6DBCDDB0856D3679',
			height: 3921571,
			timestamp: '2026-11-25 02:53:23'
		},
		deadline: '2026-11-25 04:53:09',
		fee: 0.015,
		height: 3921571,
		maxFee: 0.015,
		recipient: null,
		sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
		signature: '42C6B91B4A914D836D31FA29242E4C28A55D3092CE24469D9BE80D9B708ED7AEA97EA8D4963F7E033F2BD2B85C9E0D3927BC028403A9ED17F831E7510B54CD0A',
		signerPublicKey: '3550D7C3477F439101E6273DD0F25F1D67B712D0F07817AF190084DD29045CB5',
		size: 150,
		timestamp: '2026-11-25 02:53:23',
		value: [
			{
				amount: 0,
				id: '406FE5941F06BCBE',
				name: '406FE5941F06BCBE'
			}
		]
	},
	isEmbedded: false,
	type: 'MOSAIC_DEFINITION',
	version: 1
};

export const mosaicSupplyChangeConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		action: 'increase',
		delta: '1000000',
		mosaicId: '406FE5941F06BCBE'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					action: 'increase',
					delta: '1000000',
					mosaicId: '406FE5941F06BCBE'
				},
				recipient: null,
				sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
				type: 'MOSAIC_SUPPLY_CHANGE'
			}
		]
	},
	group: 'confirmed',
	hash: 'B4AE1FC741E9B04538C06C2D8B6A71A5E85CC94AA852A75676E7D5B6B3A42814',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '11EC385993B66B072114E74582EF698EEE9B739EE6151904F776901F915686DF',
			height: 3921572,
			timestamp: '2026-11-25 02:53:56'
		},
		deadline: '2026-11-25 04:53:45',
		fee: 0.0145,
		height: 3921572,
		maxFee: 0.0145,
		recipient: null,
		sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
		signature: '0FB62E80FA17676314FB2ACE3C1C018B8135A5334BC6537206D145028B35AE6C7C36BF26E9118EB3D863E426B8549798C68B4DCEF88EFFF07C6749B63018ED0D',
		signerPublicKey: '3550D7C3477F439101E6273DD0F25F1D67B712D0F07817AF190084DD29045CB5',
		size: 145,
		timestamp: '2026-11-25 02:53:56',
		value: [
			{
				amount: 1000000,
				id: '406FE5941F06BCBE',
				name: '406FE5941F06BCBE'
			}
		]
	},
	isEmbedded: false,
	type: 'MOSAIC_SUPPLY_CHANGE',
	version: 1
};

export const mosaicSupplyDecreaseConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		action: 'decrease',
		delta: '1000000',
		mosaicId: '406FE5941F06BCBE'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					action: 'decrease',
					delta: '1000000',
					mosaicId: '406FE5941F06BCBE'
				},
				recipient: null,
				sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
				type: 'MOSAIC_SUPPLY_CHANGE'
			}
		]
	},
	group: 'confirmed',
	hash: 'B4AE1FC741E9B04538C06C2D8B6A71A5E85CC94AA852A75676E7D5B6B3A42814',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '11EC385993B66B072114E74582EF698EEE9B739EE6151904F776901F915686DF',
			height: 3921572,
			timestamp: '2026-11-25 02:53:56'
		},
		deadline: '2026-11-25 04:53:45',
		fee: 0.0145,
		height: 3921572,
		maxFee: 0.0145,
		recipient: null,
		sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
		signature: '0FB62E80FA17676314FB2ACE3C1C018B8135A5334BC6537206D145028B35AE6C7C36BF26E9118EB3D863E426B8549798C68B4DCEF88EFFF07C6749B63018ED0D',
		signerPublicKey: '3550D7C3477F439101E6273DD0F25F1D67B712D0F07817AF190084DD29045CB5',
		size: 145,
		timestamp: '2026-11-25 02:53:56',
		value: [
			{
				amount: 1000000,
				id: '406FE5941F06BCBE',
				name: '406FE5941F06BCBE'
			}
		]
	},
	isEmbedded: false,
	type: 'MOSAIC_SUPPLY_CHANGE',
	version: 1
};

export const mosaicSupplyRevocationConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		address: 'TBUB4ODMAIAZBTNI4T5YYBANLFJAKNJD4PY2SOI',
		mosaics: [
			{
				amount: 1,
				id: '45C9281AB204E3B9',
				name: '45C9281AB204E3B9'
			}
		]
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					address: 'TBUB4ODMAIAZBTNI4T5YYBANLFJAKNJD4PY2SOI',
					mosaics: [
						{
							amount: 1,
							id: '45C9281AB204E3B9',
							name: '45C9281AB204E3B9'
						}
					]
				},
				recipient: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
				sender: 'TBUB4ODMAIAZBTNI4T5YYBANLFJAKNJD4PY2SOI',
				type: 'MOSAIC_SUPPLY_REVOCATION'
			}
		]
	},
	group: 'confirmed',
	hash: 'E84E5BAB09B5BC3161B3436462856404A537FFE137C616565D6C254C777601BE',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 165,
			hash: '18B663904DE00B32AE8B3C1B7628BAB96A69E45091C29902D06697AC21070149',
			height: 3906067,
			timestamp: '2026-11-19 17:37:01'
		},
		deadline: '2026-11-19 19:36:21',
		fee: 0.02772,
		height: 3906067,
		maxFee: 0.02772,
		recipient: null,
		sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		signature: '41D2A77EA54AB5B3B4EBED863D1DDC24B7966187E8026D66175610453C97A5332F732DB9D5EDDF5A21BB72BF40603F8DD41055F292B081D9B7A0A4859D462305',
		signerPublicKey: '721D9ACD9070737382B11B2A1F8FF04374F42B9F190A8015B207A225BD1C462F',
		size: 168,
		timestamp: '2026-11-19 17:37:01',
		value: [
			{
				amount: 1,
				id: '45C9281AB204E3B9',
				name: '45C9281AB204E3B9'
			}
		]
	},
	isEmbedded: false,
	type: 'MOSAIC_SUPPLY_REVOCATION',
	version: 1
};

export const hashLockConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		duration: '480',
		hash: 'A3007DC5119C73CBB55B92002C8B0A7E621ED31A131B9EDFDE89AA93A4C21DCF',
		mosaics: [
			{
				amount: 10,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		]
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					duration: '480',
					hash: 'A3007DC5119C73CBB55B92002C8B0A7E621ED31A131B9EDFDE89AA93A4C21DCF',
					mosaics: [
						{
							amount: 10,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					]
				},
				recipient: null,
				sender: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
				type: 'HASH_LOCK'
			}
		]
	},
	group: 'confirmed',
	hash: '6D2A21E0D436A84F3374A4E6D4ADC4879B5FAF0E480ABBC5EBBA3604EC1B9C6D',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 150,
			hash: 'AF63BADE8D612DB9FAC99E6264DD4C5BF4F4D56E2DB965E574181805FDFB4279',
			height: 3919965,
			timestamp: '2026-11-24 13:31:17'
		},
		deadline: '2026-11-24 15:30:02',
		fee: 0.0276,
		height: 3919965,
		maxFee: 0.0276,
		recipient: null,
		sender: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
		signature: 'F93F567A9D49168EC9F2C4E7540B42079C1AD6122A8CC534638B01D6B511E33F2917B650E27292032120E815C793957E69F3B293EFA60E24930EF24D4392BC02',
		signerPublicKey: '95DA4F2EBF5B86AAA7E475E04F9974D78A9484E193FF58E17D2A61AAF78FA0C7',
		size: 184,
		timestamp: '2026-11-24 13:31:17',
		value: [
			{
				amount: 10,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		]
	},
	isEmbedded: false,
	type: 'HASH_LOCK',
	version: 1
};

export const secretLockConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		duration: '111',
		hashAlgorithm: 'hash256',
		mosaics: [
			{
				amount: 7,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		],
		recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
		secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					duration: '111',
					hashAlgorithm: 'hash256',
					mosaics: [
						{
							amount: 7,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					],
					recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
					secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB'
				},
				recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'SECRET_LOCK'
			}
		]
	},
	group: 'confirmed',
	hash: 'DE43DFA3B23A6009E93C455F223932995A79D6F9F4E31B483BFD56942D943D3C',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '1FA584A8492F7053D76B10DCC4A9291E89BB7A2591D613D29908387CA63701FD',
			height: 3895414,
			timestamp: '2026-11-16 00:43:57'
		},
		deadline: '2026-11-16 02:43:41',
		fee: 0.0209,
		height: 3895414,
		maxFee: 0.0209,
		recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: '23073941438311410F0EC4FEFAEECDE21C79A435037DF069AD2FBB907E405E3CD52D7449DBAD8256DA75D3769D7A80853F813F10E1453575CF5AFD52AC748008',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 209,
		timestamp: '2026-11-16 00:43:57',
		value: [
			{
				amount: 7,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		]
	},
	isEmbedded: false,
	type: 'SECRET_LOCK',
	version: 1
};

export const secretProofConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		hashAlgorithm: 'hash256',
		proof: '636F727265637420686F727365206261747465727920737461706C65',
		recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
		secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					hashAlgorithm: 'hash256',
					proof: '636F727265637420686F727365206261747465727920737461706C65',
					recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
					secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB'
				},
				recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'SECRET_PROOF'
			}
		]
	},
	group: 'confirmed',
	hash: '545A948E3EF451C9C41B8872AA0CC88C4A7D502DF0C7364467B705EF8A972332',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '497739CE8274F50A279370EA687879110DC12810BCE3FAD202A86EADE126B87A',
			height: 3895415,
			timestamp: '2026-11-16 00:44:27'
		},
		deadline: '2026-11-16 02:44:01',
		fee: 0.0215,
		height: 3895415,
		maxFee: 0.0215,
		recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: 'F5B8D291C2659E1B1290CF92E082D2688C5BABE55E5A77A3C2DBDC664AAC4A16CFACE0671F51713CC7A81281BEC2DA316132F3DEC32D8B455E9F76BA7D1AF90C',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 215,
		timestamp: '2026-11-16 00:44:27',
		value: []
	},
	isEmbedded: false,
	type: 'SECRET_PROOF',
	version: 1
};

export const accountAddressRestrictionConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		restrictionAddressAdditions: ['TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI'],
		restrictionAddressDeletions: [],
		restrictionFlags: 1,
		restrictionType: 'Allow Incoming Address'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					restrictionAddressAdditions: ['TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI'],
					restrictionAddressDeletions: [],
					restrictionFlags: 1,
					restrictionType: 'Allow Incoming Address'
				},
				recipient: null,
				sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
				type: 'ACCOUNT_ADDRESS_RESTRICTION'
			}
		]
	},
	group: 'confirmed',
	hash: '7AD890E4572FF9D7F286ABC07221DC93C747BD9639D99B90A855B5194C3CD80A',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 2314,
			hash: '891DD2AC90E271B21AE48AEF0301769F4492A6C06B171C2D9BA2A1A779AE3590',
			height: 3912969,
			timestamp: '2026-11-22 03:10:12'
		},
		deadline: '2026-11-22 04:59:24',
		fee: 0.37024,
		height: 3912969,
		maxFee: 2,
		recipient: null,
		sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
		signature: 'FC26B66DC95464ACFBBE5934D5C76D99A04A8BF586EA6A42E49DD0FE3FF2403E6A21C86EE7370624E034ADADCA34A71A4B1761D562792535325067909ED4180D',
		signerPublicKey: '470446A0431053018961AF02461B440DC192AAD78EBC994D615B6174580BBBFA',
		size: 160,
		timestamp: '2026-11-22 03:10:12',
		value: []
	},
	isEmbedded: false,
	type: 'ACCOUNT_ADDRESS_RESTRICTION',
	version: 1
};

export const accountMosaicRestrictionConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		restrictionFlags: 2,
		restrictionMosaicAdditions: [],
		restrictionMosaicDeletions: ['72C0212E67A08BCE'],
		restrictionType: 'Allow Incoming Mosaic'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					restrictionFlags: 2,
					restrictionMosaicAdditions: [],
					restrictionMosaicDeletions: ['72C0212E67A08BCE'],
					restrictionType: 'Allow Incoming Mosaic'
				},
				recipient: null,
				sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
				type: 'ACCOUNT_MOSAIC_RESTRICTION'
			}
		]
	},
	group: 'confirmed',
	hash: '7A166FBD1404726DDAA0FB54E7DD100C296E07E3E6895568B479202FD71CC73D',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'FE253D734ADF140811AA97F0E2DA1BA9C456108AAE8CE1CCD3B2CC28432AD402',
			height: 3674322,
			timestamp: '2026-08-30 07:39:11'
		},
		deadline: '2026-08-30 09:38:52',
		fee: 0.0144,
		height: 3674322,
		maxFee: 0.0144,
		recipient: null,
		sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
		signature: '69E99DFF8B9D4B5501746F00CFB9D0D39189B672297312E0AFBED8D64BA892960A90F474365B2DBD0C25812F0D03F3F1CB60D69E5BA6F471303981A9C311E309',
		signerPublicKey: '1E1D8F1275308F0BBF2C32A1B2D9337349C3FA97C50696C1786DC7295C9CCC4F',
		size: 144,
		timestamp: '2026-08-30 07:39:11',
		value: []
	},
	isEmbedded: false,
	type: 'ACCOUNT_MOSAIC_RESTRICTION',
	version: 1
};

export const accountOperationRestrictionConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		restrictionFlags: 49156,
		restrictionOperationAdditions: [],
		restrictionOperationDeletions: ['TRANSFER'],
		restrictionType: 'Block Outgoing Operation'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					restrictionFlags: 49156,
					restrictionOperationAdditions: [],
					restrictionOperationDeletions: ['TRANSFER'],
					restrictionType: 'Block Outgoing Operation'
				},
				recipient: null,
				sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
				type: 'ACCOUNT_OPERATION_RESTRICTION'
			}
		]
	},
	group: 'confirmed',
	hash: '0DE99A62D17909D4F320377DA1BFDDA0F9796E19A646AFA85D42C2E294BD651C',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '13135A523CEE4AFFD26062930D2F7911AF5710B2921F6D90AB6FAC42B83DEB63',
			height: 3674324,
			timestamp: '2026-08-30 07:40:23'
		},
		deadline: '2026-08-30 09:39:57',
		fee: 0.0138,
		height: 3674324,
		maxFee: 0.0138,
		recipient: null,
		sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
		signature: 'B1FF4C126FFC95DAF6F3624E88C4E42E68A30DD3D2D00645BAF2BF2960045BB308FB8E60D231C6529551508E8666F208ECC25128F671E7E0BE8EBD0A3269A200',
		signerPublicKey: '1E1D8F1275308F0BBF2C32A1B2D9337349C3FA97C50696C1786DC7295C9CCC4F',
		size: 138,
		timestamp: '2026-08-30 07:40:23',
		value: []
	},
	isEmbedded: false,
	type: 'ACCOUNT_OPERATION_RESTRICTION',
	version: 1
};

export const accountKeyLinkConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		linkAction: 'unlink',
		linkedAccountAddress: 'TDCDE3QUURO6CQEK4QFG3FC6UELDXNDHBKSMYWA',
		linkedPublicKey: '1047A03CED38AC76A75C7DB395DB5F6B9D803A8E249C762B663DF6ADD4136406'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					linkAction: 'unlink',
					linkedAccountAddress: 'TDCDE3QUURO6CQEK4QFG3FC6UELDXNDHBKSMYWA',
					linkedPublicKey: '1047A03CED38AC76A75C7DB395DB5F6B9D803A8E249C762B663DF6ADD4136406'
				},
				recipient: null,
				sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
				type: 'ACCOUNT_KEY_LINK'
			}
		]
	},
	group: 'confirmed',
	hash: '1C2007C50A3AAEA85483E52F75A88E57A2A91194BF0BF4718B38121ADE948BA6',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'A688607D5B6AA2ADEF89134D8D9F4F137CD60A6307D12CA89FA29F1D56D1D3C7',
			height: 3895445,
			timestamp: '2026-11-16 00:58:29'
		},
		deadline: '2026-11-16 02:58:04',
		fee: 0.0161,
		height: 3895445,
		maxFee: 0.0161,
		recipient: null,
		sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
		signature: '5ED40FF84B3099FF26E2E7D0728B42005B63C30C43F4637138AA4AE4C25DFB7BDD6A9E75CD2A9FDF5C523B18B00DA4A38F1B0C9C583779411A1F405EA3A7280E',
		signerPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E194556703465E39D535E',
		size: 161,
		timestamp: '2026-11-16 00:58:29',
		value: []
	},
	isEmbedded: false,
	type: 'ACCOUNT_KEY_LINK',
	version: 1
};

export const votingKeyLinkConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		endEpoch: 150,
		linkAction: 'unlink',
		linkedAccountAddress: 'TCEI4ZLYHIH7ONVEOQF63WOCNIZLZ2BIDKICTGA',
		linkedPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E19455670346500000000',
		startEpoch: 10
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					endEpoch: 150,
					linkAction: 'unlink',
					linkedAccountAddress: 'TCEI4ZLYHIH7ONVEOQF63WOCNIZLZ2BIDKICTGA',
					linkedPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E19455670346500000000',
					startEpoch: 10
				},
				recipient: null,
				sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
				type: 'VOTING_KEY_LINK'
			}
		]
	},
	group: 'confirmed',
	hash: '60E0740208621ACDF0D85E90D83D662166DEF867276575512FEE9A2E67FE6952',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '48A06668A8AC97013FD7F4E02C4DBC720E280AC6558BC70C13B93258E6436A90',
			height: 3895447,
			timestamp: '2026-11-16 00:59:15'
		},
		deadline: '2026-11-16 02:59:05',
		fee: 0.0169,
		height: 3895447,
		maxFee: 0.0169,
		recipient: null,
		sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
		signature: '578026D6F5D76645C17512FAF3A288B113F6B1CD41C8ACAADED54F22C31E9DF7987AD8904FFB186771E1E5FF6F1560268F9E347D1903479596ACD385B6BB5E04',
		signerPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E194556703465E39D535E',
		size: 169,
		timestamp: '2026-11-16 00:59:15',
		value: []
	},
	isEmbedded: false,
	type: 'VOTING_KEY_LINK',
	version: 1
};

export const nodeKeyLinkConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		linkAction: 'unlink',
		linkedAccountAddress: 'TCEI4ZLYHIH7ONVEOQF63WOCNIZLZ2BIDKICTGA',
		linkedPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E19455670346500000000'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					linkAction: 'unlink',
					linkedAccountAddress: 'TCEI4ZLYHIH7ONVEOQF63WOCNIZLZ2BIDKICTGA',
					linkedPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E19455670346500000000'
				},
				recipient: null,
				sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
				type: 'NODE_KEY_LINK'
			}
		]
	},
	group: 'confirmed',
	hash: 'D0654D1462B98688422D30EB2AAEA825AF5EAD005044958309741AEE69922D70',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '0F538C909622B1812C9A176EFAB5238462BCB6C4E9630CE1E28C31ABDA7E699D',
			height: 3895448,
			timestamp: '2026-11-16 00:59:59'
		},
		deadline: '2026-11-16 02:59:25',
		fee: 0.0161,
		height: 3895448,
		maxFee: 0.0161,
		recipient: null,
		sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
		signature: '1A9D27443B519421DCCEE418FF91F31FEA566E8C4084140BDFDE51B0F9152F0F60D85126FB7BDD441094DC6F8D591B9C603586F41BBD1C50FC3F7412796CA409',
		signerPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E194556703465E39D535E',
		size: 161,
		timestamp: '2026-11-16 00:59:59',
		value: []
	},
	isEmbedded: false,
	type: 'NODE_KEY_LINK',
	version: 1
};

export const mosaicAddressRestrictionConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		mosaicAliasNames: [],
		mosaicId: '743856D441B7A239',
		newRestrictionValue: '2',
		previousRestrictionValue: '18446744073709551615',
		restrictionKey: '00000000000C0FFE',
		targetAddress: 'TALICECI35BNIJQA5CNUKI2DY3SXNEHPZJSOVAA'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					mosaicAliasNames: [],
					mosaicId: '743856D441B7A239',
					newRestrictionValue: '2',
					previousRestrictionValue: '18446744073709551615',
					restrictionKey: '00000000000C0FFE',
					targetAddress: 'TALICECI35BNIJQA5CNUKI2DY3SXNEHPZJSOVAA'
				},
				recipient: null,
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'MOSAIC_ADDRESS_RESTRICTION'
			}
		]
	},
	group: 'confirmed',
	hash: '6F277AD272FAD8906AB4239F301740691A8CC0DB48000C2AB1423D4EDFEF7FCB',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'C149AE9B2E34A9FE276E371E21E79999E46FD80B3E4517C665533E36713FF996',
			height: 3895435,
			timestamp: '2026-11-16 00:54:50'
		},
		deadline: '2026-11-16 02:54:24',
		fee: 0.0184,
		height: 3895435,
		maxFee: 0.0184,
		recipient: null,
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: 'FA12DF9B3048D58765B492688C02E81687855DC262C64D508F2000D736B8A6D9FE279CC0751683F6FA5BDA21394D1D87B9AE2587724F5A12713FF1EEA193B304',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 184,
		timestamp: '2026-11-16 00:54:50',
		value: [
			{
				amount: 0,
				id: '743856D441B7A239',
				name: '743856D441B7A239'
			}
		]
	},
	isEmbedded: false,
	type: 'MOSAIC_ADDRESS_RESTRICTION',
	version: 1
};

export const mosaicGlobalRestrictionConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		mosaicAliasNames: [],
		mosaicId: '743856D441B7A239',
		newRestrictionType: 'GE',
		newRestrictionValue: '2',
		previousRestrictionType: 'GE',
		previousRestrictionValue: '1',
		referenceMosaicId: '0000000000000000',
		restrictionKey: '00000000000C0FFE'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					mosaicAliasNames: [],
					mosaicId: '743856D441B7A239',
					newRestrictionType: 'GE',
					newRestrictionValue: '2',
					previousRestrictionType: 'GE',
					previousRestrictionValue: '1',
					referenceMosaicId: '0000000000000000',
					restrictionKey: '00000000000C0FFE'
				},
				recipient: null,
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'MOSAIC_GLOBAL_RESTRICTION'
			}
		]
	},
	group: 'confirmed',
	hash: 'CB397613EE27C2ADA4BFD5B9FE6BE5B043EFA8C3BC3F7AA8E5D2A052C734C4C2',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '585D15E6ED68DAF923C61BC8BABA67ADDCAD5138E50DCA7C7225DBF645C109DB',
			height: 3895436,
			timestamp: '2026-11-16 00:55:29'
		},
		deadline: '2026-11-16 02:55:04',
		fee: 0.017,
		height: 3895436,
		maxFee: 0.017,
		recipient: null,
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: '80B4CB5B48A41626EFAF79DEB3531123EE0BE399D87CF7E1D3D9E74EB12A85E42C4528AB0DEFA110293F6B6FDADEE413FE3B54B6AE888202A1C01422DEE18707',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 170,
		timestamp: '2026-11-16 00:55:29',
		value: [
			{
				amount: 0,
				id: '743856D441B7A239',
				name: '743856D441B7A239'
			}
		]
	},
	isEmbedded: false,
	type: 'MOSAIC_GLOBAL_RESTRICTION',
	version: 1
};

export const mosaicGlobalRestrictionWithReferenceConfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		mosaicAliasNames: [],
		mosaicId: '743856D441B7A239',
		newRestrictionType: 'GE',
		newRestrictionValue: '2',
		previousRestrictionType: 'GE',
		previousRestrictionValue: '1',
		referenceMosaicId: '72C0212E67A08BCE',
		restrictionKey: '00000000000C0FFE'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					mosaicAliasNames: [],
					mosaicId: '743856D441B7A239',
					newRestrictionType: 'GE',
					newRestrictionValue: '2',
					previousRestrictionType: 'GE',
					previousRestrictionValue: '1',
					referenceMosaicId: '72C0212E67A08BCE',
					restrictionKey: '00000000000C0FFE'
				},
				recipient: null,
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'MOSAIC_GLOBAL_RESTRICTION'
			}
		]
	},
	group: 'confirmed',
	hash: 'CB397613EE27C2ADA4BFD5B9FE6BE5B043EFA8C3BC3F7AA8E5D2A052C734C4C2',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '585D15E6ED68DAF923C61BC8BABA67ADDCAD5138E50DCA7C7225DBF645C109DB',
			height: 3895436,
			timestamp: '2026-11-16 00:55:29'
		},
		deadline: '2026-11-16 02:55:04',
		fee: 0.017,
		height: 3895436,
		maxFee: 0.017,
		recipient: null,
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: '80B4CB5B48A41626EFAF79DEB3531123EE0BE399D87CF7E1D3D9E74EB12A85E42C4528AB0DEFA110293F6B6FDADEE413FE3B54B6AE888202A1C01422DEE18707',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 170,
		timestamp: '2026-11-16 00:55:29',
		value: [
			{
				amount: 0,
				id: '743856D441B7A239',
				name: '743856D441B7A239'
			}
		]
	},
	isEmbedded: false,
	type: 'MOSAIC_GLOBAL_RESTRICTION',
	version: 1
};

export const aggregateCompleteConfirmedTransactionResponse = {
	aggregate: {
		cosignatures: [
			{
				signature: 'F86A09B6A683B15F85BFE1D6C12E3E9D9F40BD411BE313730FC6EC13711DEDCCB6500E07C71BBCC309C994BC19D3BF93894D6EEEA91ABBC720880863A955E707',
				signer: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ'
			},
			{
				signature: 'BDD2F6518E667F07ABB4207628B2B8795895E0D0E8844F29FE998E1910D74C1CBED7E8B78464A6A3902EC1538B460EFF98306016615679C7AAED7D0A9275E30C',
				signer: 'TCSOO6SGMBS4VICZS3Z3MBMN7T7YEFFZG6FCEII'
			},
			{
				signature: '04334024B5C88ABD38AC1BB2E6B0A1EF7EEFE77CC529C37EB0CC720410DF11149B4DC9427C0CBAF4B90DB6A6545832040E0344FBA6EDAD4E443DF4095893730D',
				signer: 'TCWN3SBHE4XMHEJLY2N4DSKFPM64QA7TYW4FYJI'
			},
			{
				signature: 'E46AA62904C12650CF3A30157AC4FE9DA0A6B619906F1A847421A8B41E0E84DC886D757BC5B55D4FA75031F59521959D0E679C4C971F393AB14F38F189FDA209',
				signer: 'TBSKJ6AHSPRBWVVZGRTTWXENKI2E4VZJNU5GWXQ'
			}
		],
		embeddedTransactions: [
			{
				aggregateHash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
				detail: {
					addressAdditions: [
						'TCWN3SBHE4XMHEJLY2N4DSKFPM64QA7TYW4FYJI',
						'TBSKJ6AHSPRBWVVZGRTTWXENKI2E4VZJNU5GWXQ',
						'TCSOO6SGMBS4VICZS3Z3MBMN7T7YEFFZG6FCEII'
					],
					addressDeletions: [],
					minApprovalDelta: 2,
					minRemovalDelta: 2
				},
				embeddedIndex: 0,
				graphic: {
					detail: {
						addressAdditions: [
							'TCWN3SBHE4XMHEJLY2N4DSKFPM64QA7TYW4FYJI',
							'TBSKJ6AHSPRBWVVZGRTTWXENKI2E4VZJNU5GWXQ',
							'TCSOO6SGMBS4VICZS3Z3MBMN7T7YEFFZG6FCEII'
						],
						addressDeletions: [],
						minApprovalDelta: 2,
						minRemovalDelta: 2
					},
					recipient: null,
					sender: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
					type: 'MULTISIG_ACCOUNT_MODIFICATION'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 237,
						hash: '685F06781646DDB694E8AC266772D004BA1690D8E68F76267F83E0C343567E5E',
						height: 3922560,
						timestamp: '2026-11-25 11:07:54'
					},
					deadline: null,
					fee: null,
					height: 3922560,
					maxFee: null,
					recipient: null,
					sender: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
					signature: null,
					signerPublicKey: 'EF68094FA454CCA9C0F3E445CDB3EC1652BF0E11FB947F34553F130775CAD4AA',
					size: null,
					timestamp: '2026-11-25 11:07:54',
					value: []
				},
				isEmbedded: true,
				type: 'MULTISIG_ACCOUNT_MODIFICATION',
				version: 1
			},
			{
				aggregateHash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
				detail: {
					message: null,
					mosaics: [],
					recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY'
				},
				embeddedIndex: 1,
				graphic: {
					detail: {
						message: null,
						mosaics: [],
						recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY'
					},
					recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
					sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
					type: 'TRANSFER'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 237,
						hash: '685F06781646DDB694E8AC266772D004BA1690D8E68F76267F83E0C343567E5E',
						height: 3922560,
						timestamp: '2026-11-25 11:07:54'
					},
					deadline: null,
					fee: null,
					height: 3922560,
					maxFee: null,
					recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
					sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
					signature: null,
					signerPublicKey: '9703DAE047A9162CD768130F85DEACA8A50B984BB64BCDE7DB9B781825953BA0',
					size: null,
					timestamp: '2026-11-25 11:07:54',
					value: []
				},
				isEmbedded: true,
				type: 'TRANSFER',
				version: 1
			}
		],
		hash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C'
	},
	aggregateHash: null,
	detail: {
		transactionsHash: '9BE3B434AB71A6A53E6CF41CB603354DD2BC3BBD5CD9CA8371FE018BE462F247'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					addressAdditions: [
						'TCWN3SBHE4XMHEJLY2N4DSKFPM64QA7TYW4FYJI',
						'TBSKJ6AHSPRBWVVZGRTTWXENKI2E4VZJNU5GWXQ',
						'TCSOO6SGMBS4VICZS3Z3MBMN7T7YEFFZG6FCEII'
					],
					addressDeletions: [],
					minApprovalDelta: 2,
					minRemovalDelta: 2
				},
				recipient: null,
				sender: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
				type: 'MULTISIG_ACCOUNT_MODIFICATION'
			},
			{
				detail: {
					message: null,
					mosaics: [],
					recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY'
				},
				recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
				sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
				type: 'TRANSFER'
			}
		]
	},
	group: 'confirmed',
	hash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 237,
			hash: '685F06781646DDB694E8AC266772D004BA1690D8E68F76267F83E0C343567E5E',
			height: 3922560,
			timestamp: '2026-11-25 11:07:54'
		},
		deadline: '2026-11-25 13:07:48',
		fee: 0.187704,
		height: 3922560,
		maxFee: 0.188,
		recipient: null,
		sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
		signature: '69A40A30A1F4208480CF88F9F78A2B872E203D4C62A14B2E639815DC9DCBE571CD7CA06F35EFC99A2C28EFA31B98C417A29B725B1CA1BF5E1D31C9EB39C5EC02',
		signerPublicKey: '9703DAE047A9162CD768130F85DEACA8A50B984BB64BCDE7DB9B781825953BA0',
		size: 792,
		timestamp: '2026-11-25 11:07:54',
		value: []
	},
	isEmbedded: false,
	type: 'AGGREGATE_COMPLETE',
	version: 3
};

export const aggregateBondedConfirmedTransactionResponse = {
	aggregate: {
		cosignatures: [
			{
				signature: '550BAFA295C523429FFDA1FCF88B264E374AC4DFC5C5FF7E2D57492637B46DF7308FD928CCA3F9BE7CC6C6CE038D2685D5144FA8B5ACEBA82292DB8A5AE8EE0C',
				signer: 'TBEVVMMNVR5E3YKAEPHVP7EXAID45XDYYYMBKOQ'
			}
		],
		embeddedTransactions: [
			{
				aggregateHash: '803B26DD1BCA4650893E9D4256DC9C2D999F2E655828685182177EFFD2B11FF1',
				detail: {
					addressAdditions: [],
					addressDeletions: ['TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY'],
					minApprovalDelta: -1,
					minRemovalDelta: -1
				},
				embeddedIndex: 0,
				graphic: {
					detail: {
						addressAdditions: [],
						addressDeletions: ['TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY'],
						minApprovalDelta: -1,
						minRemovalDelta: -1
					},
					recipient: null,
					sender: 'TDDLMWQTTZVG2HL46MOLKAG5B6CXRXWYAW5MMPA',
					type: 'MULTISIG_ACCOUNT_MODIFICATION'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 116,
						hash: '4914B86C9027263A2BF7B4C83C90732E9E40C88049A4A6ADD39BCAC1D8AF986C',
						height: 3919605,
						timestamp: '2026-11-24 10:30:45'
					},
					deadline: null,
					fee: null,
					height: 3919605,
					maxFee: null,
					recipient: null,
					sender: 'TDDLMWQTTZVG2HL46MOLKAG5B6CXRXWYAW5MMPA',
					signature: null,
					signerPublicKey: '6B704BB1CE47780CFA7F474739750AC4F4AF62ABE03662B704E8F6F72B2F26FB',
					size: null,
					timestamp: '2026-11-24 10:30:45',
					value: []
				},
				isEmbedded: true,
				type: 'MULTISIG_ACCOUNT_MODIFICATION',
				version: 1
			}
		],
		hash: '803B26DD1BCA4650893E9D4256DC9C2D999F2E655828685182177EFFD2B11FF1'
	},
	aggregateHash: null,
	detail: {
		transactionsHash: '9C4FC0E3D658BBA758C582CD11ADA0345AF11D4C0E9AA9EC0D1A06E8BE80DCF2'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					addressAdditions: [],
					addressDeletions: ['TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY'],
					minApprovalDelta: -1,
					minRemovalDelta: -1
				},
				recipient: null,
				sender: 'TDDLMWQTTZVG2HL46MOLKAG5B6CXRXWYAW5MMPA',
				type: 'MULTISIG_ACCOUNT_MODIFICATION'
			}
		]
	},
	group: 'confirmed',
	hash: '803B26DD1BCA4650893E9D4256DC9C2D999F2E655828685182177EFFD2B11FF1',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 116,
			hash: '4914B86C9027263A2BF7B4C83C90732E9E40C88049A4A6ADD39BCAC1D8AF986C',
			height: 3919605,
			timestamp: '2026-11-24 10:30:45'
		},
		deadline: '2026-11-26 10:28:55',
		fee: 0.040832,
		height: 3919605,
		maxFee: 0.04092,
		recipient: null,
		sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		signature: 'A2B4A9BB4DAD7BD470208B31FA9D7ABBAA61CA78B88D1F294AEE2AF0CA353A42674F838E720217CE248C28AADCD8910F961E7770A34F5729814EBEF4A7E3120F',
		signerPublicKey: '721D9ACD9070737382B11B2A1F8FF04374F42B9F190A8015B207A225BD1C462F',
		size: 352,
		timestamp: '2026-11-24 10:30:45',
		value: []
	},
	isEmbedded: false,
	type: 'AGGREGATE_BONDED',
	version: 3
};

export const aggregateKeyLinkConfirmedTransactionResponse = {
	aggregate: {
		cosignatures: [],
		embeddedTransactions: [
			{
				aggregateHash: 'C633FCB7D8A839A39F574E63EAFF79BA3684565252303888BA3FD71D283CEE6F',
				detail: {
					linkAction: 'link',
					linkedAccountAddress: 'TAJPK537EHCV6U7LKZAG5V6YFKJBQ7L3DYPKGDI',
					linkedPublicKey: '3F331A5BECFE30ED26D742B93CB7E8D62D57A4F91E1D5655D4C1EC4168901043'
				},
				embeddedIndex: 0,
				graphic: {
					detail: {
						linkAction: 'link',
						linkedAccountAddress: 'TAJPK537EHCV6U7LKZAG5V6YFKJBQ7L3DYPKGDI',
						linkedPublicKey: '3F331A5BECFE30ED26D742B93CB7E8D62D57A4F91E1D5655D4C1EC4168901043'
					},
					recipient: null,
					sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
					type: 'VRF_KEY_LINK'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 2314,
						hash: '9F0C498F43D032021A7229E2E4AE9019D426900D7B89D87AA8ECE85FEB5DB244',
						height: 3919760,
						timestamp: '2026-11-24 11:48:01'
					},
					deadline: null,
					fee: null,
					height: 3919760,
					maxFee: null,
					recipient: null,
					sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
					signature: null,
					signerPublicKey: '2D8C021EE4D5CEE859E69467345E8761293725512C1DD4C25A50541DB44C6EEE',
					size: null,
					timestamp: '2026-11-24 11:48:01',
					value: []
				},
				isEmbedded: true,
				type: 'VRF_KEY_LINK',
				version: 1
			},
			{
				aggregateHash: 'C633FCB7D8A839A39F574E63EAFF79BA3684565252303888BA3FD71D283CEE6F',
				detail: {
					linkAction: 'link',
					linkedAccountAddress: 'TA7XBZLV44Y2IF3MTC4R2HUKOMZGZ7MOD72JT4A',
					linkedPublicKey: '6CED9404176FF48132D019FC0E65B541F6715AE9875227C94E1BE5EE5427CE96'
				},
				embeddedIndex: 1,
				graphic: {
					detail: {
						linkAction: 'link',
						linkedAccountAddress: 'TA7XBZLV44Y2IF3MTC4R2HUKOMZGZ7MOD72JT4A',
						linkedPublicKey: '6CED9404176FF48132D019FC0E65B541F6715AE9875227C94E1BE5EE5427CE96'
					},
					recipient: null,
					sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
					type: 'ACCOUNT_KEY_LINK'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 2314,
						hash: '9F0C498F43D032021A7229E2E4AE9019D426900D7B89D87AA8ECE85FEB5DB244',
						height: 3919760,
						timestamp: '2026-11-24 11:48:01'
					},
					deadline: null,
					fee: null,
					height: 3919760,
					maxFee: null,
					recipient: null,
					sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
					signature: null,
					signerPublicKey: '2D8C021EE4D5CEE859E69467345E8761293725512C1DD4C25A50541DB44C6EEE',
					size: null,
					timestamp: '2026-11-24 11:48:01',
					value: []
				},
				isEmbedded: true,
				type: 'ACCOUNT_KEY_LINK',
				version: 1
			},
			{
				aggregateHash: 'C633FCB7D8A839A39F574E63EAFF79BA3684565252303888BA3FD71D283CEE6F',
				detail: {
					linkAction: 'link',
					linkedAccountAddress: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
					linkedPublicKey: '76391C08DB220BC3368ADA7FE935CCC5562928E0BA628B30FFE2BCCC431703DC'
				},
				embeddedIndex: 2,
				graphic: {
					detail: {
						linkAction: 'link',
						linkedAccountAddress: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
						linkedPublicKey: '76391C08DB220BC3368ADA7FE935CCC5562928E0BA628B30FFE2BCCC431703DC'
					},
					recipient: null,
					sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
					type: 'NODE_KEY_LINK'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 2314,
						hash: '9F0C498F43D032021A7229E2E4AE9019D426900D7B89D87AA8ECE85FEB5DB244',
						height: 3919760,
						timestamp: '2026-11-24 11:48:01'
					},
					deadline: null,
					fee: null,
					height: 3919760,
					maxFee: null,
					recipient: null,
					sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
					signature: null,
					signerPublicKey: '2D8C021EE4D5CEE859E69467345E8761293725512C1DD4C25A50541DB44C6EEE',
					size: null,
					timestamp: '2026-11-24 11:48:01',
					value: []
				},
				isEmbedded: true,
				type: 'NODE_KEY_LINK',
				version: 1
			}
		],
		hash: 'C633FCB7D8A839A39F574E63EAFF79BA3684565252303888BA3FD71D283CEE6F'
	},
	aggregateHash: null,
	detail: {
		transactionsHash: 'E719EA25DA81B259B7249808DE4CAA4909220A4C0B70E8F48DB9F0A7A2A0F3FE'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					linkAction: 'link',
					linkedAccountAddress: 'TAJPK537EHCV6U7LKZAG5V6YFKJBQ7L3DYPKGDI',
					linkedPublicKey: '3F331A5BECFE30ED26D742B93CB7E8D62D57A4F91E1D5655D4C1EC4168901043'
				},
				recipient: null,
				sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
				type: 'VRF_KEY_LINK'
			},
			{
				detail: {
					linkAction: 'link',
					linkedAccountAddress: 'TA7XBZLV44Y2IF3MTC4R2HUKOMZGZ7MOD72JT4A',
					linkedPublicKey: '6CED9404176FF48132D019FC0E65B541F6715AE9875227C94E1BE5EE5427CE96'
				},
				recipient: null,
				sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
				type: 'ACCOUNT_KEY_LINK'
			},
			{
				detail: {
					linkAction: 'link',
					linkedAccountAddress: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
					linkedPublicKey: '76391C08DB220BC3368ADA7FE935CCC5562928E0BA628B30FFE2BCCC431703DC'
				},
				recipient: null,
				sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
				type: 'NODE_KEY_LINK'
			}
		]
	},
	group: 'confirmed',
	hash: 'C633FCB7D8A839A39F574E63EAFF79BA3684565252303888BA3FD71D283CEE6F',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 2314,
			hash: '9F0C498F43D032021A7229E2E4AE9019D426900D7B89D87AA8ECE85FEB5DB244',
			height: 3919760,
			timestamp: '2026-11-24 11:48:01'
		},
		deadline: '2026-11-24 13:47:56',
		fee: 0.999648,
		height: 3919760,
		maxFee: 1,
		recipient: null,
		sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
		signature: '7C40A49AD1ED377300E29674FC00718C32A5A5A9807E9712DA1C87FC8A7E842433F262D99A2401DFDC9AFBFED5C60BBAFCA62ECB999BD71735DB14FE2CFDEE0E',
		signerPublicKey: '2D8C021EE4D5CEE859E69467345E8761293725512C1DD4C25A50541DB44C6EEE',
		size: 432,
		timestamp: '2026-11-24 11:48:01',
		value: []
	},
	isEmbedded: false,
	type: 'AGGREGATE_COMPLETE',
	version: 3
};

export const aggregateMosaicSupplyRevocationConfirmedTransactionResponse = {
	aggregate: {
		cosignatures: [],
		embeddedTransactions: [
			{
				aggregateHash: 'DFF89FB0B71EFEF6B2F08677FE2F29C8E93C808DA13093B66909C3B30E9F829C',
				detail: {
					address: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
					mosaics: [
						{
							amount: 100,
							id: '7D8C6B32AC25D160',
							name: '7D8C6B32AC25D160'
						}
					]
				},
				embeddedIndex: 0,
				graphic: {
					detail: {
						address: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
						mosaics: [
							{
								amount: 100,
								id: '7D8C6B32AC25D160',
								name: '7D8C6B32AC25D160'
							}
						]
					},
					recipient: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
					sender: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
					type: 'MOSAIC_SUPPLY_REVOCATION'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 200,
						hash: 'F5F893F8CB391B7812D7DF150EB1333F1013E86E6424F515859714BC2C5BF5FA',
						height: 3922222,
						timestamp: '2026-11-25 08:19:44'
					},
					deadline: null,
					fee: null,
					height: 3922222,
					maxFee: null,
					recipient: null,
					sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
					signature: null,
					signerPublicKey: '3550D7C3477F439101E6273DD0F25F1D67B712D0F07817AF190084DD29045CB5',
					size: null,
					timestamp: '2026-11-25 08:19:44',
					value: [
						{
							amount: 100,
							id: '7D8C6B32AC25D160',
							name: '7D8C6B32AC25D160'
						}
					]
				},
				isEmbedded: true,
				type: 'MOSAIC_SUPPLY_REVOCATION',
				version: 1
			},
			{
				aggregateHash: 'DFF89FB0B71EFEF6B2F08677FE2F29C8E93C808DA13093B66909C3B30E9F829C',
				detail: {
					message: {
						text: 'TICKET_ISSUE:TKT-MWVUR6YJ',
						type: 'plain'
					},
					mosaics: [
						{
							amount: 1,
							id: '406FE5941F06BCBE',
							name: '406FE5941F06BCBE'
						}
					],
					recipient: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA'
				},
				embeddedIndex: 1,
				graphic: {
					detail: {
						message: {
							text: 'TICKET_ISSUE:TKT-MWVUR6YJ',
							type: 'plain'
						},
						mosaics: [
							{
								amount: 1,
								id: '406FE5941F06BCBE',
								name: '406FE5941F06BCBE'
							}
						],
						recipient: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA'
					},
					recipient: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
					sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
					type: 'TRANSFER'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 200,
						hash: 'F5F893F8CB391B7812D7DF150EB1333F1013E86E6424F515859714BC2C5BF5FA',
						height: 3922222,
						timestamp: '2026-11-25 08:19:44'
					},
					deadline: null,
					fee: null,
					height: 3922222,
					maxFee: null,
					recipient: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
					sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
					signature: null,
					signerPublicKey: '3550D7C3477F439101E6273DD0F25F1D67B712D0F07817AF190084DD29045CB5',
					size: null,
					timestamp: '2026-11-25 08:19:44',
					value: [
						{
							amount: 1,
							id: '406FE5941F06BCBE',
							name: '406FE5941F06BCBE'
						}
					]
				},
				isEmbedded: true,
				type: 'TRANSFER',
				version: 1
			}
		],
		hash: 'DFF89FB0B71EFEF6B2F08677FE2F29C8E93C808DA13093B66909C3B30E9F829C'
	},
	aggregateHash: null,
	detail: {
		transactionsHash: '8D2F29E52EB55537792C1D2FF4515FB5787DD179A4CE0C9E0C362293409B98D3'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					address: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
					mosaics: [
						{
							amount: 100,
							id: '7D8C6B32AC25D160',
							name: '7D8C6B32AC25D160'
						}
					]
				},
				recipient: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
				sender: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
				type: 'MOSAIC_SUPPLY_REVOCATION'
			},
			{
				detail: {
					message: {
						text: 'TICKET_ISSUE:TKT-MWVUR6YJ',
						type: 'plain'
					},
					mosaics: [
						{
							amount: 1,
							id: '406FE5941F06BCBE',
							name: '406FE5941F06BCBE'
						}
					],
					recipient: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA'
				},
				recipient: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
				sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
				type: 'TRANSFER'
			}
		]
	},
	group: 'confirmed',
	hash: 'DFF89FB0B71EFEF6B2F08677FE2F29C8E93C808DA13093B66909C3B30E9F829C',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 200,
			hash: 'F5F893F8CB391B7812D7DF150EB1333F1013E86E6424F515859714BC2C5BF5FA',
			height: 3922222,
			timestamp: '2026-11-25 08:19:44'
		},
		deadline: '2026-11-25 10:19:13',
		fee: 0.0768,
		height: 3922222,
		maxFee: 0.0768,
		recipient: null,
		sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
		signature: '28B9F5721EBE980D700CD78B4E52677E7A150843D0AE19FB7485B940834C043410F6525AEF059E049CD5FFD6C3FBE092F7284B0CAF8EA95F27E0BEF893093B00',
		signerPublicKey: '3550D7C3477F439101E6273DD0F25F1D67B712D0F07817AF190084DD29045CB5',
		size: 384,
		timestamp: '2026-11-25 08:19:44',
		value: []
	},
	isEmbedded: false,
	type: 'AGGREGATE_COMPLETE',
	version: 3
};

export const aggregateAccountMetadataConfirmedTransactionResponse = {
	aggregate: {
		cosignatures: [],
		embeddedTransactions: [
			{
				aggregateHash: 'DB988866D460C6CD8BBC4AEA5746AF279FBAFBF54838610F88C6BA7A0D9BF91C',
				detail: {
					scopedMetadataKey: '0072657474697774',
					targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					valueDelta: '00000000000000000000000000000000000000007E3B796B7F767E79757A626F7B65716D616C666F726D6564',
					valueSizeDelta: -9
				},
				embeddedIndex: 0,
				graphic: {
					detail: {
						scopedMetadataKey: '0072657474697774',
						targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
						valueDelta: '00000000000000000000000000000000000000007E3B796B7F767E79757A626F7B65716D616C666F726D6564',
						valueSizeDelta: -9
					},
					recipient: null,
					sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					type: 'ACCOUNT_METADATA'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 100,
						hash: 'F3E0CA1AA05090CCFB8C20273A73B2617592B9E4A5D53A37C3E0041C273AB9FB',
						height: 3895413,
						timestamp: '2026-11-16 00:43:37'
					},
					deadline: null,
					fee: null,
					height: 3895413,
					maxFee: null,
					recipient: null,
					sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					signature: null,
					signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
					size: null,
					timestamp: '2026-11-16 00:43:37',
					value: []
				},
				isEmbedded: true,
				type: 'ACCOUNT_METADATA',
				version: 1
			}
		],
		hash: 'DB988866D460C6CD8BBC4AEA5746AF279FBAFBF54838610F88C6BA7A0D9BF91C'
	},
	aggregateHash: null,
	detail: {
		transactionsHash: '2F9CD21C4C1E6E95159C9423C73360237CE6F26AC0C7F631A4913F70BAF98ADF'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					scopedMetadataKey: '0072657474697774',
					targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					valueDelta: '00000000000000000000000000000000000000007E3B796B7F767E79757A626F7B65716D616C666F726D6564',
					valueSizeDelta: -9
				},
				recipient: null,
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'ACCOUNT_METADATA'
			}
		]
	},
	group: 'confirmed',
	hash: 'DB988866D460C6CD8BBC4AEA5746AF279FBAFBF54838610F88C6BA7A0D9BF91C',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'F3E0CA1AA05090CCFB8C20273A73B2617592B9E4A5D53A37C3E0041C273AB9FB',
			height: 3895413,
			timestamp: '2026-11-16 00:43:37'
		},
		deadline: '2026-11-16 02:43:20',
		fee: 0.0296,
		height: 3895413,
		maxFee: 0.0296,
		recipient: null,
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: 'BF31F18A85CB5CF95C8DC621A2FD39E006EEB932D388E3B66A368EB66F3757857A41479D622CB4E267A8CE21D7EC7DA0DAC8F4C3FBCC330CA1F1479131EF8601',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 296,
		timestamp: '2026-11-16 00:43:37',
		value: []
	},
	isEmbedded: false,
	type: 'AGGREGATE_COMPLETE',
	version: 3
};

export const aggregateMosaicMetadataConfirmedTransactionResponse = {
	aggregate: {
		cosignatures: [
			{
				signature: 'C536CBFE8024283B9790161A93E793C3D08E4A5AF3C9F63F95260A5154DE85C07DD063A11DD547B5D2C08A7C064ECBE6EE65DBDFDF7882BFFBD875F012E44B0E',
				signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA'
			}
		],
		embeddedTransactions: [
			{
				aggregateHash: '6C0126F16E6572D0696AFE5F25D91E95979C3A7EFC99721E0C410041FC626E3D',
				detail: {
					scopedMetadataKey: '0000676E69746172',
					targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					targetMosaicAliasNames: [],
					targetMosaicId: '743856D441B7A239',
					valueDelta: '91220000',
					valueSizeDelta: 0
				},
				embeddedIndex: 0,
				graphic: {
					detail: {
						scopedMetadataKey: '0000676E69746172',
						targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
						targetMosaicAliasNames: [],
						targetMosaicId: '743856D441B7A239',
						valueDelta: '91220000',
						valueSizeDelta: 0
					},
					recipient: null,
					sender: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
					type: 'MOSAIC_METADATA'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 100,
						hash: 'E56B9CAFB837919CAB81A5F0A4E8A60BE0569204FE70EEC92C64127CEB6D8E09',
						height: 3895431,
						timestamp: '2026-11-16 00:52:33'
					},
					deadline: null,
					fee: null,
					height: 3895431,
					maxFee: null,
					recipient: null,
					sender: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
					signature: null,
					signerPublicKey: 'F8DA359E54678CCC77DE7578D806F24A71574D3EB835C3C431BFDCCE0F2FEAA2',
					size: null,
					timestamp: '2026-11-16 00:52:33',
					value: []
				},
				isEmbedded: true,
				type: 'MOSAIC_METADATA',
				version: 1
			}
		],
		hash: '6C0126F16E6572D0696AFE5F25D91E95979C3A7EFC99721E0C410041FC626E3D'
	},
	aggregateHash: null,
	detail: {
		transactionsHash: '00556A9AD4CBBFD1F63756FA4413AB59D017A4007D39FE4F2D669A3F3F1BD6DD'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					scopedMetadataKey: '0000676E69746172',
					targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					targetMosaicAliasNames: [],
					targetMosaicId: '743856D441B7A239',
					valueDelta: '91220000',
					valueSizeDelta: 0
				},
				recipient: null,
				sender: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
				type: 'MOSAIC_METADATA'
			}
		]
	},
	group: 'confirmed',
	hash: '6C0126F16E6572D0696AFE5F25D91E95979C3A7EFC99721E0C410041FC626E3D',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: 'E56B9CAFB837919CAB81A5F0A4E8A60BE0569204FE70EEC92C64127CEB6D8E09',
			height: 3895431,
			timestamp: '2026-11-16 00:52:33'
		},
		deadline: '2026-11-16 02:51:43',
		fee: 0.0368,
		height: 3895431,
		maxFee: 0.0368,
		recipient: null,
		sender: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
		signature: 'DEFCE0D9A64D7E7C1C2A022A8202A0058213A6619248A2A168F375BAC2D12A6E59CF9F8C554B2ABC6B15DD53EDAF31AD9DC37D596B7B2C52BFD02E3902238600',
		signerPublicKey: 'F8DA359E54678CCC77DE7578D806F24A71574D3EB835C3C431BFDCCE0F2FEAA2',
		size: 368,
		timestamp: '2026-11-16 00:52:33',
		value: []
	},
	isEmbedded: false,
	type: 'AGGREGATE_COMPLETE',
	version: 3
};

export const aggregateNamespaceMetadataConfirmedTransactionResponse = {
	aggregate: {
		cosignatures: [],
		embeddedTransactions: [
			{
				aggregateHash: 'C5015746DA6073F643501387B4B4B72B2353C1165F40028F6585539B8D8D687C',
				detail: {
					namespaceName: 'who_taozkxx6vhcbqvvyswxfbdcfr5uvjeqgcvswwca.killed',
					scopedMetadataKey: '00000000656D616E',
					targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					targetNamespaceId: '9D9D80B6AF2186BF',
					valueDelta: '0F00011A0452390F094D28137274656C6C',
					valueSizeDelta: 5
				},
				embeddedIndex: 0,
				graphic: {
					detail: {
						namespaceName: 'who_taozkxx6vhcbqvvyswxfbdcfr5uvjeqgcvswwca.killed',
						scopedMetadataKey: '00000000656D616E',
						targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
						targetNamespaceId: '9D9D80B6AF2186BF',
						valueDelta: '0F00011A0452390F094D28137274656C6C',
						valueSizeDelta: 5
					},
					recipient: null,
					sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					type: 'NAMESPACE_METADATA'
				},
				group: 'confirmed',
				hash: null,
				info: {
					amount: 0,
					block: {
						feeMultiplier: 100,
						hash: '0257D466F1EE93CE7A27CEE2DF386E2F46BE9D37B87E4877DF60FBB8F76E8E07',
						height: 3895419,
						timestamp: '2026-11-16 00:46:24'
					},
					deadline: null,
					fee: null,
					height: 3895419,
					maxFee: null,
					recipient: null,
					sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					signature: null,
					signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
					size: null,
					timestamp: '2026-11-16 00:46:24',
					value: []
				},
				isEmbedded: true,
				type: 'NAMESPACE_METADATA',
				version: 1
			}
		],
		hash: 'C5015746DA6073F643501387B4B4B72B2353C1165F40028F6585539B8D8D687C'
	},
	aggregateHash: null,
	detail: {
		transactionsHash: '2688BDF3ADD9EFF78E95C68F3E29B5CD5AFB2C98804E7750BCC5A54709D292E5'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					namespaceName: 'who_taozkxx6vhcbqvvyswxfbdcfr5uvjeqgcvswwca.killed',
					scopedMetadataKey: '00000000656D616E',
					targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
					targetNamespaceId: '9D9D80B6AF2186BF',
					valueDelta: '0F00011A0452390F094D28137274656C6C',
					valueSizeDelta: 5
				},
				recipient: null,
				sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
				type: 'NAMESPACE_METADATA'
			}
		]
	},
	group: 'confirmed',
	hash: 'C5015746DA6073F643501387B4B4B72B2353C1165F40028F6585539B8D8D687C',
	hashLock: null,
	info: {
		amount: 0,
		block: {
			feeMultiplier: 100,
			hash: '0257D466F1EE93CE7A27CEE2DF386E2F46BE9D37B87E4877DF60FBB8F76E8E07',
			height: 3895419,
			timestamp: '2026-11-16 00:46:24'
		},
		deadline: '2026-11-16 02:46:01',
		fee: 0.028,
		height: 3895419,
		maxFee: 0.028,
		recipient: null,
		sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
		signature: '2FB9FC9AD2F3262FB8A4B489DFCFD41A369E5D3EA964C4EFB07394BC8BDAA2F4FF7656A8A03BB88860C48C8E4D9B3C7636C54E270666CB0891FC3EF7A55EC50D',
		signerPublicKey: '824B68655909842F2D443C47DEEC4DE9CC9802493608FCB9C0719F611FB07E40',
		size: 280,
		timestamp: '2026-11-16 00:46:24',
		value: []
	},
	isEmbedded: false,
	type: 'AGGREGATE_COMPLETE',
	version: 3
};

export const transferUnconfirmedTransactionResponse = {
	aggregate: null,
	aggregateHash: null,
	detail: {
		message: {
			text: 'Refund-2',
			type: 'plain'
		},
		mosaics: [
			{
				amount: 20.601464,
				id: '72C0212E67A08BCE',
				name: 'symbol.xym'
			}
		],
		recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI'
	},
	embeddedIndex: null,
	graphic: {
		transactions: [
			{
				detail: {
					message: {
						text: 'Refund-2',
						type: 'plain'
					},
					mosaics: [
						{
							amount: 20.601464,
							id: '72C0212E67A08BCE',
							name: 'symbol.xym'
						}
					],
					recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI'
				},
				recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
				sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
				type: 'TRANSFER'
			}
		]
	},
	group: 'unconfirmed',
	hash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	hashLock: null,
	info: {
		amount: null,
		block: null,
		deadline: '2026-11-22 04:59:24',
		fee: null,
		height: null,
		maxFee: 0.5,
		recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
		sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
		signature: '75014F7352D8898D032FE5AF6088C454BE320C632520830AA15FC7330AF0B8921723195F32FCF110632B12810CBDE61A6C7314A0F113DBB620CA8A171CD4C200',
		signerPublicKey: '470446A0431053018961AF02461B440DC192AAD78EBC994D615B6174580BBBFA',
		size: 185,
		timestamp: null,
		value: null
	},
	isEmbedded: false,
	type: 'TRANSFER',
	version: 1
};
