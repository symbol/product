/* eslint-disable max-len */
export const transferConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	timestamp: '2026-11-22 03:10:54',
	deadline: '2026-11-22 04:59:24',
	signer: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
	height: 3912970,
	signature: '75014F7352D8898D032FE5AF6088C454BE320C632520830AA15FC7330AF0B8921723195F32FCF110632B12810CBDE61A6C7314A0F113DBB620CA8A171CD4C200',
	fee: 0.49987,
	amount: 20.601464,
	value: [
		{
			amount: 20.601464,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
			recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
			message: {
				type: 'plain',
				text: 'Refund-2'
			},
			mosaics: [
				{
					amount: 20.601464,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	],
	size: 185,
	version: 1,
	signatures: [],
	accountStateChange: [
		{
			address: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
			action: ['send'],
			mosaic: [
				{
					amount: -20.601464,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		},
		{
			address: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
			action: ['receive'],
			mosaic: [
				{
					amount: 20.601464,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	]
};

export const transferEncryptedMessageConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '56FEB2764AEE189F754330AB8494B89EC6B3D8664BB207B09EC9E3F2A5F96F89',
	timestamp: '2026-11-16 00:42:27',
	deadline: '2026-11-16 02:42:20',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
	height: 3895411,
	signature: '22954DA44C79E24830144E7849E4527602AFDD22BC2667DBEC3B6397AF9EFE61CD0554E36213ED3E85114EF746757CD49EAC5CAD0A08670A21FF6DCE42F11B00',
	fee: 0.0229,
	amount: 7,
	value: [
		{
			amount: 7,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
			message: {
				type: 'encrypted',
				text: '91618DBE000D3361B192FE9C07E33C2E8BF896D5C610055BFDD951CE8FF4B782D40DE05A9277FDAE76E302D2D8FCD9235A957041'
			},
			mosaics: [
				{
					amount: 7,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	],
	size: 229,
	version: 1,
	signatures: [],
	accountStateChange: [
		{
			address: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			action: ['send'],
			mosaic: [
				{
					amount: -7,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		},
		{
			address: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
			action: ['receive'],
			mosaic: [
				{
					amount: 7,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	]
};

export const transferDelegatedHarvestingMessageConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '55CA9605FF5FC2DE9A0FE3392FC4785DD1CDFBC98DB22018D151FDBBFC2B7FC5',
	timestamp: '2026-11-24 11:48:39',
	deadline: '2026-11-24 13:48:02',
	signer: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
	sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
	recipient: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
	height: 3919761,
	signature: '33AD8FD1C527DAA29FC11E9F3287A01DB97EF4F1ACCD6C02814508BC7F52198C89E6B32D6744372DC8A71611EA748FE1EB02C5CA716A6B72BD66FC243F36E30E',
	fee: 0.999808,
	amount: 0,
	value: [],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
			recipient: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
			message: {
				type: 'persistentDelegationHarvesting',
				text: '7A890175AA2EBE340865BB7D935023B9E913544422881ADE46E4D1E246071B5CC041E7D9145C2B4E24444000BC517746F803F896283C1002E4A6D4150677EEA5D64DB30A29356CBE3FD15125ABD9B50633E3F2B0C519EEA82293931B90A6B2CF1EC364C4EBAF745B6B3268E727C530ABEEDD06836D826F5FAFAE5857'
			},
			mosaics: []
		}
	],
	size: 292,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const transferRawMessageConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '860AF8FDE99A20C1AAAA88DE643B09C65077BD71D80D61CDA654F68C413023A1',
	timestamp: '2026-11-24 09:58:24',
	deadline: '2026-11-24 11:57:55',
	signer: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	recipient: 'TC4P25P32VW76NDZZFYDCRJOCS7LMBQRYXQFVXY',
	height: 3919540,
	signature: '96E85FA218A8F8004B7452B575EA84C7731DA59B7954ED9F548FBE53F40831C39CDC46210B22AAC30616E9AD2D327E1B9CCC24DAF5E4AD59F812D0FAFB7F0A0E',
	fee: 0.035752,
	amount: 100,
	value: [
		{
			amount: 100,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			recipient: 'TC4P25P32VW76NDZZFYDCRJOCS7LMBQRYXQFVXY',
			message: {
				type: 'raw',
				text: '307830663032656536356535313065613330303036653633616163633636383432386164376139393865'
			},
			mosaics: [
				{
					amount: 100,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	],
	size: 218,
	version: 1,
	signatures: [],
	accountStateChange: [
		{
			address: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			action: ['send'],
			mosaic: [
				{
					amount: -100,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		},
		{
			address: 'TC4P25P32VW76NDZZFYDCRJOCS7LMBQRYXQFVXY',
			action: ['receive'],
			mosaic: [
				{
					amount: 100,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	]
};

export const transferCustomMosaicOnlyConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '29BF971A66BDF82C90A8AF0EDD32E63328045CD226871AB3B9FA45B48C3B88C0',
	timestamp: '2026-11-25 00:31:59',
	deadline: '2026-11-25 01:31:39',
	signer: 'TA3GCBHJBTRCEHVYVHCNUCULY2NB76W7MVECFUY',
	sender: 'TA3GCBHJBTRCEHVYVHCNUCULY2NB76W7MVECFUY',
	recipient: 'TAKSZ42GO35ENLHYRUBKE6EMSM4UUQAKUACXB5A',
	height: 3921284,
	signature: 'AD0740F681EBCC6C4F6BBF66ADC2238EA8CDE0408CD15C31FA6DDA6B7CFEE3C9C34F3371D6C8F1A0E1C273FBBF8CCA371C07F1B5004367A591FBA04C5583440B',
	fee: 0.999856,
	amount: 0,
	value: [
		{
			amount: 100,
			id: '4EB0A0590FF41C2D',
			name: '4EB0A0590FF41C2D'
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TA3GCBHJBTRCEHVYVHCNUCULY2NB76W7MVECFUY',
			recipient: 'TAKSZ42GO35ENLHYRUBKE6EMSM4UUQAKUACXB5A',
			message: null,
			mosaics: [
				{
					amount: 100,
					id: '4EB0A0590FF41C2D',
					name: '4EB0A0590FF41C2D'
				}
			]
		}
	],
	size: 176,
	version: 1,
	signatures: [],
	accountStateChange: [
		{
			address: 'TA3GCBHJBTRCEHVYVHCNUCULY2NB76W7MVECFUY',
			action: ['send'],
			mosaic: [
				{
					amount: -100,
					id: '4EB0A0590FF41C2D',
					name: '4EB0A0590FF41C2D'
				}
			]
		},
		{
			address: 'TAKSZ42GO35ENLHYRUBKE6EMSM4UUQAKUACXB5A',
			action: ['receive'],
			mosaic: [
				{
					amount: 100,
					id: '4EB0A0590FF41C2D',
					name: '4EB0A0590FF41C2D'
				}
			]
		}
	]
};

export const namespaceRegistrationConfirmedTransaction = {
	type: 'NAMESPACE_REGISTRATION',
	group: 'confirmed',
	hash: '5B67DF51A1602A270AF89EA3AAB53B7FEBFC3A3D5412D858B8A53FCCC96FD17E',
	timestamp: '2026-11-19 11:04:01',
	deadline: '2026-11-19 13:03:44',
	signer: 'TCHGVWS3QBN464X3KVK7RSLZECXTBNXNW3YP43I',
	sender: 'TCHGVWS3QBN464X3KVK7RSLZECXTBNXNW3YP43I',
	recipient: null,
	height: 3905285,
	signature: '78D9C3445A934B7DBDF16ADE4ED8DFEF3E0BDADCBC76AD9FC3A088E5496376BE0DA82B42500F9E971DEF293174973AE6509426D9BEB1A3A7AEA3D2B6029A0303',
	fee: 0.0152,
	amount: 0,
	value: [],
	body: [
		{
			type: 'NAMESPACE_REGISTRATION',
			sender: 'TCHGVWS3QBN464X3KVK7RSLZECXTBNXNW3YP43I',
			recipient: null,
			duration: '86400',
			namespaceId: 'BCB88A9E05A4936E',
			namespaceName: 'barber',
			parentId: null,
			registrationType: 'root'
		}
	],
	size: 152,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const subNamespaceRegistrationConfirmedTransaction = {
	type: 'NAMESPACE_REGISTRATION',
	group: 'confirmed',
	hash: '68535E3FCFE574180F7D77694941BC5A1D4CBBA7FF69981B9F15673FCBFEFDF9',
	timestamp: '2026-11-20 04:46:00',
	deadline: '2026-11-20 06:45:48',
	signer: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
	sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
	recipient: null,
	height: 3907406,
	signature: '7F634267283E0B81A0AD7C8F0C7AB8045ECF2E8DE7542E0EA254CCA20787077D9E9B9D8A911AE77E056B2A3DC4811E6C4103C8CA37D3A19DE775C16DC2A51809',
	fee: 0.015,
	amount: 0,
	value: [],
	body: [
		{
			type: 'NAMESPACE_REGISTRATION',
			sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
			recipient: null,
			duration: null,
			namespaceId: 'F3C31C1D0F7DD7D2',
			namespaceName: 'coin',
			parentId: '804CA0D4C39086CF',
			registrationType: 'sub'
		}
	],
	size: 150,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const addressAliasConfirmedTransaction = {
	type: 'ADDRESS_ALIAS',
	group: 'confirmed',
	hash: '64524403AF3A23DDCEEAC0995737B54ADF0BD316ACDC8A395966153EC6FA3501',
	timestamp: '2026-11-19 06:18:41',
	deadline: '2026-11-19 08:18:12',
	signer: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
	sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
	recipient: null,
	height: 3904718,
	signature: '8F5FE6672C08F96ABAEBC88188B3C65D1234A50ADEDAACE46463B6D3042A1A845046B230177FC355667D1DFD8536CBBD319361CAD54176B76539B4448E334805',
	fee: 0.0161,
	amount: 0,
	value: [],
	body: [
		{
			type: 'ADDRESS_ALIAS',
			sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
			recipient: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
			address: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
			aliasAction: 'link',
			namespaceId: '804CA0D4C39086CF',
			namespaceName: 'warashibe'
		}
	],
	size: 161,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicAliasConfirmedTransaction = {
	type: 'MOSAIC_ALIAS',
	group: 'confirmed',
	hash: '7A3051A802B93DAD7A9B7D5EFC5EE66E6E0A0C66060ADB69E571482F248F5CDB',
	timestamp: '2026-11-20 04:46:31',
	deadline: '2026-11-20 06:45:59',
	signer: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
	sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
	recipient: null,
	height: 3907407,
	signature: '07D65E34FA5FE11C67C7EBE2367C264E3FB61FC681B862FBB84A97A34DF601B9B7CE10E7E5B839DFE4992810249EDE6FCBCC54B98149DBB09409CE9CBF2F4108',
	fee: 0.0145,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MOSAIC_ALIAS',
			sender: 'TCDQV3TWKNS2T3ADKH6UJTMORVI3CQYNLTC6PCY',
			recipient: null,
			aliasAction: 'link',
			mosaicId: '50158CBDDAC0E894',
			namespaceId: 'F3C31C1D0F7DD7D2',
			namespaceName: 'warashibe.coin'
		}
	],
	size: 145,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicDefinitionConfirmedTransaction = {
	type: 'MOSAIC_DEFINITION',
	group: 'confirmed',
	hash: '9D70BEEDEAD9BE028F51CF279E509E5180D41858E1DE98CA466E5CD131B686A8',
	timestamp: '2026-11-25 02:53:23',
	deadline: '2026-11-25 04:53:09',
	signer: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	recipient: null,
	height: 3921571,
	signature: '42C6B91B4A914D836D31FA29242E4C28A55D3092CE24469D9BE80D9B708ED7AEA97EA8D4963F7E033F2BD2B85C9E0D3927BC028403A9ED17F831E7510B54CD0A',
	fee: 0.015,
	amount: 0,
	value: [
		{
			amount: 0,
			id: '406FE5941F06BCBE',
			name: '406FE5941F06BCBE'
		}
	],
	body: [
		{
			type: 'MOSAIC_DEFINITION',
			sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
			recipient: null,
			divisibility: 0,
			duration: '0',
			mosaicId: '406FE5941F06BCBE',
			nonce: 15243112,
			restrictable: false,
			revokable: true,
			supplyMutable: true,
			transferable: true
		}
	],
	size: 150,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicSupplyChangeConfirmedTransaction = {
	type: 'MOSAIC_SUPPLY_CHANGE',
	group: 'confirmed',
	hash: 'B4AE1FC741E9B04538C06C2D8B6A71A5E85CC94AA852A75676E7D5B6B3A42814',
	timestamp: '2026-11-25 02:53:56',
	deadline: '2026-11-25 04:53:45',
	signer: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	recipient: null,
	height: 3921572,
	signature: '0FB62E80FA17676314FB2ACE3C1C018B8135A5334BC6537206D145028B35AE6C7C36BF26E9118EB3D863E426B8549798C68B4DCEF88EFFF07C6749B63018ED0D',
	fee: 0.0145,
	amount: 0,
	value: [
		{
			amount: 1000000,
			id: '406FE5941F06BCBE',
			name: '406FE5941F06BCBE'
		}
	],
	body: [
		{
			type: 'MOSAIC_SUPPLY_CHANGE',
			sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
			recipient: null,
			mosaicId: '406FE5941F06BCBE',
			delta: 1000000
		}
	],
	size: 145,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicSupplyDecreaseConfirmedTransaction = {
	type: 'MOSAIC_SUPPLY_CHANGE',
	group: 'confirmed',
	hash: 'B4AE1FC741E9B04538C06C2D8B6A71A5E85CC94AA852A75676E7D5B6B3A42814',
	timestamp: '2026-11-25 02:53:56',
	deadline: '2026-11-25 04:53:45',
	signer: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	recipient: null,
	height: 3921572,
	signature: '0FB62E80FA17676314FB2ACE3C1C018B8135A5334BC6537206D145028B35AE6C7C36BF26E9118EB3D863E426B8549798C68B4DCEF88EFFF07C6749B63018ED0D',
	fee: 0.0145,
	amount: 0,
	value: [
		{
			amount: 1000000,
			id: '406FE5941F06BCBE',
			name: '406FE5941F06BCBE'
		}
	],
	body: [
		{
			type: 'MOSAIC_SUPPLY_CHANGE',
			sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
			recipient: null,
			mosaicId: '406FE5941F06BCBE',
			delta: -1000000
		}
	],
	size: 145,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicSupplyRevocationConfirmedTransaction = {
	type: 'MOSAIC_SUPPLY_REVOCATION',
	group: 'confirmed',
	hash: 'E84E5BAB09B5BC3161B3436462856404A537FFE137C616565D6C254C777601BE',
	timestamp: '2026-11-19 17:37:01',
	deadline: '2026-11-19 19:36:21',
	signer: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	recipient: null,
	height: 3906067,
	signature: '41D2A77EA54AB5B3B4EBED863D1DDC24B7966187E8026D66175610453C97A5332F732DB9D5EDDF5A21BB72BF40603F8DD41055F292B081D9B7A0A4859D462305',
	fee: 0.02772,
	amount: 0,
	value: [
		{
			amount: 1,
			id: '45C9281AB204E3B9',
			name: '45C9281AB204E3B9'
		}
	],
	body: [
		{
			type: 'MOSAIC_SUPPLY_REVOCATION',
			sender: 'TBUB4ODMAIAZBTNI4T5YYBANLFJAKNJD4PY2SOI',
			recipient: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			address: 'TBUB4ODMAIAZBTNI4T5YYBANLFJAKNJD4PY2SOI',
			mosaics: [
				{
					amount: 1,
					id: '45C9281AB204E3B9',
					name: '45C9281AB204E3B9'
				}
			]
		}
	],
	size: 168,
	version: 1,
	signatures: [],
	accountStateChange: [
		{
			address: 'TBUB4ODMAIAZBTNI4T5YYBANLFJAKNJD4PY2SOI',
			action: ['send'],
			mosaic: [
				{
					amount: -1,
					id: '45C9281AB204E3B9',
					name: '45C9281AB204E3B9'
				}
			]
		},
		{
			address: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
			action: ['receive'],
			mosaic: [
				{
					amount: 1,
					id: '45C9281AB204E3B9',
					name: '45C9281AB204E3B9'
				}
			]
		}
	]
};

export const hashLockConfirmedTransaction = {
	type: 'HASH_LOCK',
	group: 'confirmed',
	hash: '6D2A21E0D436A84F3374A4E6D4ADC4879B5FAF0E480ABBC5EBBA3604EC1B9C6D',
	timestamp: '2026-11-24 13:31:17',
	deadline: '2026-11-24 15:30:02',
	signer: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	sender: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
	recipient: null,
	height: 3919965,
	signature: 'F93F567A9D49168EC9F2C4E7540B42079C1AD6122A8CC534638B01D6B511E33F2917B650E27292032120E815C793957E69F3B293EFA60E24930EF24D4392BC02',
	fee: 0.0276,
	amount: 0,
	value: [
		{
			amount: 10,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	],
	body: [
		{
			type: 'HASH_LOCK',
			sender: 'TB3QU2P6QYN3BQVTIBK5BKPLLXKNDNO4RLQ7C3Q',
			recipient: null,
			duration: '480',
			hash: 'A3007DC5119C73CBB55B92002C8B0A7E621ED31A131B9EDFDE89AA93A4C21DCF',
			mosaics: [
				{
					amount: 10,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	],
	size: 184,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const secretLockConfirmedTransaction = {
	type: 'SECRET_LOCK',
	group: 'confirmed',
	hash: 'DE43DFA3B23A6009E93C455F223932995A79D6F9F4E31B483BFD56942D943D3C',
	timestamp: '2026-11-16 00:43:57',
	deadline: '2026-11-16 02:43:41',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
	height: 3895414,
	signature: '23073941438311410F0EC4FEFAEECDE21C79A435037DF069AD2FBB907E405E3CD52D7449DBAD8256DA75D3769D7A80853F813F10E1453575CF5AFD52AC748008',
	fee: 0.0209,
	amount: 0,
	value: [
		{
			amount: 7,
			id: '72C0212E67A08BCE',
			name: 'symbol.xym'
		}
	],
	body: [
		{
			type: 'SECRET_LOCK',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
			duration: '111',
			hashAlgorithm: 'hash256',
			mosaics: [
				{
					amount: 7,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			],
			secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB'
		}
	],
	size: 209,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const secretProofConfirmedTransaction = {
	type: 'SECRET_PROOF',
	group: 'confirmed',
	hash: '545A948E3EF451C9C41B8872AA0CC88C4A7D502DF0C7364467B705EF8A972332',
	timestamp: '2026-11-16 00:44:27',
	deadline: '2026-11-16 02:44:01',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
	height: 3895415,
	signature: 'F5B8D291C2659E1B1290CF92E082D2688C5BABE55E5A77A3C2DBDC664AAC4A16CFACE0671F51713CC7A81281BEC2DA316132F3DEC32D8B455E9F76BA7D1AF90C',
	fee: 0.0215,
	amount: 0,
	value: [],
	body: [
		{
			type: 'SECRET_PROOF',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: 'TD7YSZQQA5MGZYASYSZG7EY4T4OF3EF34SZZO3A',
			hashAlgorithm: 'hash256',
			proof: '636F727265637420686F727365206261747465727920737461706C65',
			secret: 'B867DB875479BCC0287352CDAA4A1755689B8338777D0915E9ACD9F6EDBC96CB'
		}
	],
	size: 215,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const accountAddressRestrictionConfirmedTransaction = {
	type: 'ACCOUNT_ADDRESS_RESTRICTION',
	group: 'confirmed',
	hash: '7AD890E4572FF9D7F286ABC07221DC93C747BD9639D99B90A855B5194C3CD80A',
	timestamp: '2026-11-22 03:10:12',
	deadline: '2026-11-22 04:59:24',
	signer: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	recipient: null,
	height: 3912969,
	signature: 'FC26B66DC95464ACFBBE5934D5C76D99A04A8BF586EA6A42E49DD0FE3FF2403E6A21C86EE7370624E034ADADCA34A71A4B1761D562792535325067909ED4180D',
	fee: 0.37024,
	amount: 0,
	value: [],
	body: [
		{
			type: 'ACCOUNT_ADDRESS_RESTRICTION',
			sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
			recipient: null,
			restrictionAddressAdditions: ['TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI'],
			restrictionAddressDeletions: [],
			restrictionFlags: 1,
			restrictionType: 'Allow Incoming Address'
		}
	],
	size: 160,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const accountMosaicRestrictionConfirmedTransaction = {
	type: 'ACCOUNT_MOSAIC_RESTRICTION',
	group: 'confirmed',
	hash: '7A166FBD1404726DDAA0FB54E7DD100C296E07E3E6895568B479202FD71CC73D',
	timestamp: '2026-08-30 07:39:11',
	deadline: '2026-08-30 09:38:52',
	signer: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
	sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
	recipient: null,
	height: 3674322,
	signature: '69E99DFF8B9D4B5501746F00CFB9D0D39189B672297312E0AFBED8D64BA892960A90F474365B2DBD0C25812F0D03F3F1CB60D69E5BA6F471303981A9C311E309',
	fee: 0.0144,
	amount: 0,
	value: [],
	body: [
		{
			type: 'ACCOUNT_MOSAIC_RESTRICTION',
			sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
			recipient: null,
			restrictionFlags: 2,
			restrictionMosaicAdditions: [],
			restrictionMosaicDeletions: ['72C0212E67A08BCE'],
			restrictionType: 'Allow Incoming Mosaic'
		}
	],
	size: 144,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const accountOperationRestrictionConfirmedTransaction = {
	type: 'ACCOUNT_OPERATION_RESTRICTION',
	group: 'confirmed',
	hash: '0DE99A62D17909D4F320377DA1BFDDA0F9796E19A646AFA85D42C2E294BD651C',
	timestamp: '2026-08-30 07:40:23',
	deadline: '2026-08-30 09:39:57',
	signer: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
	sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
	recipient: null,
	height: 3674324,
	signature: 'B1FF4C126FFC95DAF6F3624E88C4E42E68A30DD3D2D00645BAF2BF2960045BB308FB8E60D231C6529551508E8666F208ECC25128F671E7E0BE8EBD0A3269A200',
	fee: 0.0138,
	amount: 0,
	value: [],
	body: [
		{
			type: 'ACCOUNT_OPERATION_RESTRICTION',
			sender: 'TAPCJU724ZZUGBIUPITUKWOROELNGVCOODGXQXA',
			recipient: null,
			restrictionFlags: 49156,
			restrictionOperationAdditions: [],
			restrictionOperationDeletions: ['TRANSFER'],
			restrictionType: 'Block Outgoing Operation'
		}
	],
	size: 138,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const accountKeyLinkConfirmedTransaction = {
	type: 'ACCOUNT_KEY_LINK',
	group: 'confirmed',
	hash: '1C2007C50A3AAEA85483E52F75A88E57A2A91194BF0BF4718B38121ADE948BA6',
	timestamp: '2026-11-16 00:58:29',
	deadline: '2026-11-16 02:58:04',
	signer: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
	sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
	recipient: null,
	height: 3895445,
	signature: '5ED40FF84B3099FF26E2E7D0728B42005B63C30C43F4637138AA4AE4C25DFB7BDD6A9E75CD2A9FDF5C523B18B00DA4A38F1B0C9C583779411A1F405EA3A7280E',
	fee: 0.0161,
	amount: 0,
	value: [],
	body: [
		{
			type: 'ACCOUNT_KEY_LINK',
			sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
			recipient: null,
			linkAction: 'unlink',
			linkedAccountAddress: 'TDCDE3QUURO6CQEK4QFG3FC6UELDXNDHBKSMYWA',
			linkedPublicKey: '1047A03CED38AC76A75C7DB395DB5F6B9D803A8E249C762B663DF6ADD4136406'
		}
	],
	size: 161,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const votingKeyLinkConfirmedTransaction = {
	type: 'VOTING_KEY_LINK',
	group: 'confirmed',
	hash: '60E0740208621ACDF0D85E90D83D662166DEF867276575512FEE9A2E67FE6952',
	timestamp: '2026-11-16 00:59:15',
	deadline: '2026-11-16 02:59:05',
	signer: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
	sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
	recipient: null,
	height: 3895447,
	signature: '578026D6F5D76645C17512FAF3A288B113F6B1CD41C8ACAADED54F22C31E9DF7987AD8904FFB186771E1E5FF6F1560268F9E347D1903479596ACD385B6BB5E04',
	fee: 0.0169,
	amount: 0,
	value: [],
	body: [
		{
			type: 'VOTING_KEY_LINK',
			sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
			recipient: null,
			endEpoch: 150,
			linkAction: 'unlink',
			linkedAccountAddress: 'TCEI4ZLYHIH7ONVEOQF63WOCNIZLZ2BIDKICTGA',
			linkedPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E19455670346500000000',
			startEpoch: 10
		}
	],
	size: 169,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const nodeKeyLinkConfirmedTransaction = {
	type: 'NODE_KEY_LINK',
	group: 'confirmed',
	hash: 'D0654D1462B98688422D30EB2AAEA825AF5EAD005044958309741AEE69922D70',
	timestamp: '2026-11-16 00:59:59',
	deadline: '2026-11-16 02:59:25',
	signer: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
	sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
	recipient: null,
	height: 3895448,
	signature: '1A9D27443B519421DCCEE418FF91F31FEA566E8C4084140BDFDE51B0F9152F0F60D85126FB7BDD441094DC6F8D591B9C603586F41BBD1C50FC3F7412796CA409',
	fee: 0.0161,
	amount: 0,
	value: [],
	body: [
		{
			type: 'NODE_KEY_LINK',
			sender: 'TAX5E44QBYWSUEL52YDFOCFBATVDRRAPAQ4CEOA',
			recipient: null,
			linkAction: 'unlink',
			linkedAccountAddress: 'TCEI4ZLYHIH7ONVEOQF63WOCNIZLZ2BIDKICTGA',
			linkedPublicKey: '7DAE745AFEA3A990958985B5CD3643C570E85102A14E19455670346500000000'
		}
	],
	size: 161,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicAddressRestrictionConfirmedTransaction = {
	type: 'MOSAIC_ADDRESS_RESTRICTION',
	group: 'confirmed',
	hash: '6F277AD272FAD8906AB4239F301740691A8CC0DB48000C2AB1423D4EDFEF7FCB',
	timestamp: '2026-11-16 00:54:50',
	deadline: '2026-11-16 02:54:24',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: null,
	height: 3895435,
	signature: 'FA12DF9B3048D58765B492688C02E81687855DC262C64D508F2000D736B8A6D9FE279CC0751683F6FA5BDA21394D1D87B9AE2587724F5A12713FF1EEA193B304',
	fee: 0.0184,
	amount: 0,
	value: [
		{
			amount: 0,
			id: '743856D441B7A239',
			name: '743856D441B7A239'
		}
	],
	body: [
		{
			type: 'MOSAIC_ADDRESS_RESTRICTION',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: null,
			mosaicAliasNames: [],
			mosaicId: '743856D441B7A239',
			newRestrictionValue: '2',
			previousRestrictionValue: '18446744073709551615',
			restrictionKey: '00000000000C0FFE',
			targetAddress: 'TALICECI35BNIJQA5CNUKI2DY3SXNEHPZJSOVAA'
		}
	],
	size: 184,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicGlobalRestrictionConfirmedTransaction = {
	type: 'MOSAIC_GLOBAL_RESTRICTION',
	group: 'confirmed',
	hash: 'CB397613EE27C2ADA4BFD5B9FE6BE5B043EFA8C3BC3F7AA8E5D2A052C734C4C2',
	timestamp: '2026-11-16 00:55:29',
	deadline: '2026-11-16 02:55:04',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: null,
	height: 3895436,
	signature: '80B4CB5B48A41626EFAF79DEB3531123EE0BE399D87CF7E1D3D9E74EB12A85E42C4528AB0DEFA110293F6B6FDADEE413FE3B54B6AE888202A1C01422DEE18707',
	fee: 0.017,
	amount: 0,
	value: [
		{
			amount: 0,
			id: '743856D441B7A239',
			name: '743856D441B7A239'
		}
	],
	body: [
		{
			type: 'MOSAIC_GLOBAL_RESTRICTION',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: null,
			mosaicAliasNames: [],
			mosaicId: '743856D441B7A239',
			newRestrictionType: 'GE',
			newRestrictionValue: '2',
			previousRestrictionType: 'GE',
			previousRestrictionValue: '1',
			referenceMosaicId: null,
			restrictionKey: '00000000000C0FFE'
		}
	],
	size: 170,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const mosaicGlobalRestrictionWithReferenceConfirmedTransaction = {
	type: 'MOSAIC_GLOBAL_RESTRICTION',
	group: 'confirmed',
	hash: 'CB397613EE27C2ADA4BFD5B9FE6BE5B043EFA8C3BC3F7AA8E5D2A052C734C4C2',
	timestamp: '2026-11-16 00:55:29',
	deadline: '2026-11-16 02:55:04',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: null,
	height: 3895436,
	signature: '80B4CB5B48A41626EFAF79DEB3531123EE0BE399D87CF7E1D3D9E74EB12A85E42C4528AB0DEFA110293F6B6FDADEE413FE3B54B6AE888202A1C01422DEE18707',
	fee: 0.017,
	amount: 0,
	value: [
		{
			amount: 0,
			id: '743856D441B7A239',
			name: '743856D441B7A239'
		}
	],
	body: [
		{
			type: 'MOSAIC_GLOBAL_RESTRICTION',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: null,
			mosaicAliasNames: [],
			mosaicId: '743856D441B7A239',
			newRestrictionType: 'GE',
			newRestrictionValue: '2',
			previousRestrictionType: 'GE',
			previousRestrictionValue: '1',
			referenceMosaicId: '72C0212E67A08BCE',
			restrictionKey: '00000000000C0FFE'
		}
	],
	size: 170,
	version: 1,
	signatures: [],
	accountStateChange: []
};

export const aggregateCompleteConfirmedTransaction = {
	type: 'AGGREGATE_COMPLETE',
	group: 'confirmed',
	hash: '48392EC5F9ED8E7F40A946C5E5617654A8B3EC0014CE0C972FEBEB1C82E8118C',
	timestamp: '2026-11-25 11:07:54',
	deadline: '2026-11-25 13:07:48',
	signer: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
	recipient: null,
	height: 3922560,
	signature: '69A40A30A1F4208480CF88F9F78A2B872E203D4C62A14B2E639815DC9DCBE571CD7CA06F35EFC99A2C28EFA31B98C417A29B725B1CA1BF5E1D31C9EB39C5EC02',
	fee: 0.187704,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MULTISIG_ACCOUNT_MODIFICATION',
			sender: 'TDAAG7HUZI7NUWTFCLHQFODTPJ5AQRJ7XJ4LDXQ',
			recipient: null,
			addressAdditions: [
				'TCWN3SBHE4XMHEJLY2N4DSKFPM64QA7TYW4FYJI',
				'TBSKJ6AHSPRBWVVZGRTTWXENKI2E4VZJNU5GWXQ',
				'TCSOO6SGMBS4VICZS3Z3MBMN7T7YEFFZG6FCEII'
			],
			addressDeletions: [],
			minApprovalDelta: 2,
			minRemovalDelta: 2
		},
		{
			type: 'TRANSFER',
			sender: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
			recipient: 'TCBUIWCPGX5KS7YKGYUX6ZVW7V2JMP7KYK3MSBY',
			message: null,
			mosaics: []
		}
	],
	size: 792,
	version: 3,
	signatures: [
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
	accountStateChange: []
};

export const aggregateBondedConfirmedTransaction = {
	type: 'AGGREGATE_BONDED',
	group: 'confirmed',
	hash: '803B26DD1BCA4650893E9D4256DC9C2D999F2E655828685182177EFFD2B11FF1',
	timestamp: '2026-11-24 10:30:45',
	deadline: '2026-11-26 10:28:55',
	signer: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	sender: 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
	recipient: null,
	height: 3919605,
	signature: 'A2B4A9BB4DAD7BD470208B31FA9D7ABBAA61CA78B88D1F294AEE2AF0CA353A42674F838E720217CE248C28AADCD8910F961E7770A34F5729814EBEF4A7E3120F',
	fee: 0.040832,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MULTISIG_ACCOUNT_MODIFICATION',
			sender: 'TDDLMWQTTZVG2HL46MOLKAG5B6CXRXWYAW5MMPA',
			recipient: null,
			addressAdditions: [],
			addressDeletions: ['TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY'],
			minApprovalDelta: -1,
			minRemovalDelta: -1
		}
	],
	size: 352,
	version: 3,
	signatures: [
		{
			signature: '550BAFA295C523429FFDA1FCF88B264E374AC4DFC5C5FF7E2D57492637B46DF7308FD928CCA3F9BE7CC6C6CE038D2685D5144FA8B5ACEBA82292DB8A5AE8EE0C',
			signer: 'TBEVVMMNVR5E3YKAEPHVP7EXAID45XDYYYMBKOQ'
		}
	],
	accountStateChange: []
};

export const aggregateKeyLinkConfirmedTransaction = {
	type: 'AGGREGATE_COMPLETE',
	group: 'confirmed',
	hash: 'C633FCB7D8A839A39F574E63EAFF79BA3684565252303888BA3FD71D283CEE6F',
	timestamp: '2026-11-24 11:48:01',
	deadline: '2026-11-24 13:47:56',
	signer: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
	sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
	recipient: null,
	height: 3919760,
	signature: '7C40A49AD1ED377300E29674FC00718C32A5A5A9807E9712DA1C87FC8A7E842433F262D99A2401DFDC9AFBFED5C60BBAFCA62ECB999BD71735DB14FE2CFDEE0E',
	fee: 0.999648,
	amount: 0,
	value: [],
	body: [
		{
			type: 'VRF_KEY_LINK',
			sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
			recipient: null,
			linkAction: 'link',
			linkedAccountAddress: 'TAJPK537EHCV6U7LKZAG5V6YFKJBQ7L3DYPKGDI',
			linkedPublicKey: '3F331A5BECFE30ED26D742B93CB7E8D62D57A4F91E1D5655D4C1EC4168901043'
		},
		{
			type: 'ACCOUNT_KEY_LINK',
			sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
			recipient: null,
			linkAction: 'link',
			linkedAccountAddress: 'TA7XBZLV44Y2IF3MTC4R2HUKOMZGZ7MOD72JT4A',
			linkedPublicKey: '6CED9404176FF48132D019FC0E65B541F6715AE9875227C94E1BE5EE5427CE96'
		},
		{
			type: 'NODE_KEY_LINK',
			sender: 'TCIKLNAQTN3TA53GIIKHDRMAC47BAQYKRNCCJAA',
			recipient: null,
			linkAction: 'link',
			linkedAccountAddress: 'TAQMDOWE5RYIOYLVOJNRE4OJMAEDNPLSKMGJWHA',
			linkedPublicKey: '76391C08DB220BC3368ADA7FE935CCC5562928E0BA628B30FFE2BCCC431703DC'
		}
	],
	size: 432,
	version: 3,
	signatures: [],
	accountStateChange: []
};

export const aggregateMosaicSupplyRevocationConfirmedTransaction = {
	type: 'AGGREGATE_COMPLETE',
	group: 'confirmed',
	hash: 'DFF89FB0B71EFEF6B2F08677FE2F29C8E93C808DA13093B66909C3B30E9F829C',
	timestamp: '2026-11-25 08:19:44',
	deadline: '2026-11-25 10:19:13',
	signer: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
	recipient: null,
	height: 3922222,
	signature: '28B9F5721EBE980D700CD78B4E52677E7A150843D0AE19FB7485B940834C043410F6525AEF059E049CD5FFD6C3FBE092F7284B0CAF8EA95F27E0BEF893093B00',
	fee: 0.0768,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MOSAIC_SUPPLY_REVOCATION',
			sender: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
			recipient: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
			address: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
			mosaics: [
				{
					amount: 100,
					id: '7D8C6B32AC25D160',
					name: '7D8C6B32AC25D160'
				}
			]
		},
		{
			type: 'TRANSFER',
			sender: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
			recipient: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
			message: {
				type: 'plain',
				text: 'TICKET_ISSUE:TKT-MWVUR6YJ'
			},
			mosaics: [
				{
					amount: 1,
					id: '406FE5941F06BCBE',
					name: '406FE5941F06BCBE'
				}
			]
		}
	],
	size: 384,
	version: 3,
	signatures: [],
	accountStateChange: [
		{
			address: 'TAHB5KPLP5BHLKOVOS3TZP44CBHGBQARPCASRFA',
			action: ['send', 'receive'],
			mosaic: [
				{
					amount: -100,
					id: '7D8C6B32AC25D160',
					name: '7D8C6B32AC25D160'
				},
				{
					amount: 1,
					id: '406FE5941F06BCBE',
					name: '406FE5941F06BCBE'
				}
			]
		},
		{
			address: 'TB4VO2VMNCLN7EJQB26XG55GPDKR27DHWIHD7QY',
			action: ['receive', 'send'],
			mosaic: [
				{
					amount: 100,
					id: '7D8C6B32AC25D160',
					name: '7D8C6B32AC25D160'
				},
				{
					amount: -1,
					id: '406FE5941F06BCBE',
					name: '406FE5941F06BCBE'
				}
			]
		}
	]
};

export const aggregateAccountMetadataConfirmedTransaction = {
	type: 'AGGREGATE_COMPLETE',
	group: 'confirmed',
	hash: 'DB988866D460C6CD8BBC4AEA5746AF279FBAFBF54838610F88C6BA7A0D9BF91C',
	timestamp: '2026-11-16 00:43:37',
	deadline: '2026-11-16 02:43:20',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: null,
	height: 3895413,
	signature: 'BF31F18A85CB5CF95C8DC621A2FD39E006EEB932D388E3B66A368EB66F3757857A41479D622CB4E267A8CE21D7EC7DA0DAC8F4C3FBCC330CA1F1479131EF8601',
	fee: 0.0296,
	amount: 0,
	value: [],
	body: [
		{
			type: 'ACCOUNT_METADATA',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: null,
			scopedMetadataKey: '0072657474697774',
			targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			valueDelta: '00000000000000000000000000000000000000007E3B796B7F767E79757A626F7B65716D616C666F726D6564',
			valueSizeDelta: -9
		}
	],
	size: 296,
	version: 3,
	signatures: [],
	accountStateChange: []
};

export const aggregateMosaicMetadataConfirmedTransaction = {
	type: 'AGGREGATE_COMPLETE',
	group: 'confirmed',
	hash: '6C0126F16E6572D0696AFE5F25D91E95979C3A7EFC99721E0C410041FC626E3D',
	timestamp: '2026-11-16 00:52:33',
	deadline: '2026-11-16 02:51:43',
	signer: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
	sender: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
	recipient: null,
	height: 3895431,
	signature: 'DEFCE0D9A64D7E7C1C2A022A8202A0058213A6619248A2A168F375BAC2D12A6E59CF9F8C554B2ABC6B15DD53EDAF31AD9DC37D596B7B2C52BFD02E3902238600',
	fee: 0.0368,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MOSAIC_METADATA',
			sender: 'TCMLUSXLYB4ACXQ7ROY3PQZFZBKB7KY2LN33LRI',
			recipient: null,
			scopedMetadataKey: '0000676E69746172',
			targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			targetMosaicAliasNames: [],
			targetMosaicId: '743856D441B7A239',
			valueDelta: '91220000',
			valueSizeDelta: 0
		}
	],
	size: 368,
	version: 3,
	signatures: [
		{
			signature: 'C536CBFE8024283B9790161A93E793C3D08E4A5AF3C9F63F95260A5154DE85C07DD063A11DD547B5D2C08A7C064ECBE6EE65DBDFDF7882BFFBD875F012E44B0E',
			signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA'
		}
	],
	accountStateChange: []
};

export const aggregateNamespaceMetadataConfirmedTransaction = {
	type: 'AGGREGATE_COMPLETE',
	group: 'confirmed',
	hash: 'C5015746DA6073F643501387B4B4B72B2353C1165F40028F6585539B8D8D687C',
	timestamp: '2026-11-16 00:46:24',
	deadline: '2026-11-16 02:46:01',
	signer: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
	recipient: null,
	height: 3895419,
	signature: '2FB9FC9AD2F3262FB8A4B489DFCFD41A369E5D3EA964C4EFB07394BC8BDAA2F4FF7656A8A03BB88860C48C8E4D9B3C7636C54E270666CB0891FC3EF7A55EC50D',
	fee: 0.028,
	amount: 0,
	value: [],
	body: [
		{
			type: 'NAMESPACE_METADATA',
			sender: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			recipient: null,
			namespaceName: 'who_taozkxx6vhcbqvvyswxfbdcfr5uvjeqgcvswwca.killed',
			scopedMetadataKey: '00000000656D616E',
			targetAddress: 'TAOZKXX6VHCBQVVYSWXFBDCFR5UVJEQGCVSWWCA',
			targetNamespaceId: '9D9D80B6AF2186BF',
			valueDelta: '0F00011A0452390F094D28137274656C6C',
			valueSizeDelta: 5
		}
	],
	size: 280,
	version: 3,
	signatures: [],
	accountStateChange: []
};

export const transferUnconfirmedTransaction = {
	type: 'TRANSFER',
	group: 'unconfirmed',
	hash: '4BE56A3185E7748434C33D96F54EB0B1867FA5365797B32038D96CE2D065FB86',
	timestamp: null,
	deadline: '2026-11-22 04:59:24',
	signer: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
	recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
	height: null,
	signature: '75014F7352D8898D032FE5AF6088C454BE320C632520830AA15FC7330AF0B8921723195F32FCF110632B12810CBDE61A6C7314A0F113DBB620CA8A171CD4C200',
	fee: 0.5,
	amount: 0,
	value: [],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
			recipient: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
			message: {
				type: 'plain',
				text: 'Refund-2'
			},
			mosaics: [
				{
					amount: 20.601464,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	],
	size: 185,
	version: 1,
	signatures: [],
	accountStateChange: [
		{
			address: 'TC7BU3AHNSU7YMFRBLHT4RKSMIZJSV7PICZEKTA',
			action: ['send'],
			mosaic: [
				{
					amount: -20.601464,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		},
		{
			address: 'TDLFTRT76CQ4PWO4CQGEGC3ML2MZQ7TN2H6EVTI',
			action: ['receive'],
			mosaic: [
				{
					amount: 20.601464,
					id: '72C0212E67A08BCE',
					name: 'symbol.xym'
				}
			]
		}
	]
};
