/* eslint-disable max-len */
export const transferConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '4DA0B89353C4C8DBA6FC42EACED93DD414D1A9DB3F55BC24A25725FE3242D5BB',
	timestamp: '2026-10-07 16:45:34',
	deadline: '2026-10-07 17:45:34',
	signer: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
	sender: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
	recipient: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
	account: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
	direction: null,
	height: 822435,
	signature:
		'8A2575B95A4F48A065D3A066A2ACFFA38C17BD3A0453481AC94A0C94866ADDD3880D846064312377F923B709E443EB5CEE6539904BDDB29AC975597978D27F02',
	fee: 0.1,
	amount: 100,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 100
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
			recipient: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
			mosaics: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 100
				}
			],
			message: {
				type: 'plain',
				text: 'Good Luck!'
			}
		}
	],
	size: 202,
	version: 1,
	accountStateChange: [
		{
			address: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
			action: ['send'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: -100
				}
			]
		},
		{
			address: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
			action: ['receive'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 100
				}
			]
		}
	]
};

export const transferNoMessageConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '82F4457CCE6EC0C4D6457A855A784FC2EFECAA15AC03CEEB084172EC060BAE5F',
	timestamp: '2026-09-22 13:10:07',
	deadline: '2026-09-22 15:10:07',
	signer: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	recipient: 'TBULEAUG2CZQISUR442HWA6UAKGWIXHDABJVIPS4',
	account: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	direction: null,
	height: 800807,
	signature:
		'EF3E5A05DBA70F4B916A219E1A900392FAC09C8AD570DE2975FFD50F4C633551A67674DCB02ECF10524B18B3C9A13BAA543345FBD66ECCE1A3BBC85CF3684E08',
	fee: 0.05,
	amount: 1,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 1
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
			recipient: 'TBULEAUG2CZQISUR442HWA6UAKGWIXHDABJVIPS4',
			mosaics: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 1
				}
			],
			message: null
		}
	],
	size: 188,
	version: 2,
	accountStateChange: [
		{
			address: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
			action: ['send'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: -1
				}
			]
		},
		{
			address: 'TBULEAUG2CZQISUR442HWA6UAKGWIXHDABJVIPS4',
			action: ['receive'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 1
				}
			]
		}
	]
};

export const transferEncryptedMessageConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '06BAD70100BF98946D827454235E5F916848B10E82EEC70AED405D23271B4068',
	timestamp: '2026-07-07 16:41:07',
	deadline: '2026-07-07 17:41:07',
	signer: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	account: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	direction: null,
	height: 691160,
	signature:
		'15F35C8179098661EC58C775DB8B4BDAA792AC648B23871D974F9E5B0D4204ABFD1CB8CC227B0EA5976417A4DF7280BF8B1D278D7B87FD8513297EF15F5E210C',
	fee: 0.2,
	amount: 3,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 3
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			mosaics: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 3
				}
			],
			message: {
				type: 'encrypted',
				text:
					'd213419ea20a3b08aef51bee5941484dc274341fcc2a6c1344aea6750c54386238b5305d0e5bd16dfbbf590b2ad485892573466346a75cf9d9a71da31ae6e169'
			}
		}
	],
	size: 256,
	version: 1,
	accountStateChange: [
		{
			address: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			action: ['send'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: -3
				}
			]
		},
		{
			address: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			action: ['receive'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 3
				}
			]
		}
	]
};

export const transferMultipleMosaicsConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '064467E72CA6B960F174CCA76CDF2B59FCB9DA538DE995E3CAA9732871555097',
	timestamp: '2026-06-25 16:14:37',
	deadline: '2026-06-25 17:14:37',
	signer: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	account: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	direction: null,
	height: 674003,
	signature:
		'49B573435E3E888151573074423E683FF43EFF57E86421ED627CAE85BDA9391A65949F92878D190CB212DCB64AC2D1D80C82716DB5E62A4F998C50D540634F09',
	fee: 0.15,
	amount: 2,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 2
		},
		{
			id: 'testnamespace1.mosaic',
			name: 'testnamespace1.mosaic',
			amount: 2
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			mosaics: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 2
				},
				{
					id: 'testnamespace1.mosaic',
					name: 'testnamespace1.mosaic',
					amount: 2
				}
			],
			message: {
				type: 'plain',
				text: 'case4 v2 mult2 +mosaic'
			}
		}
	],
	size: 292,
	version: 2,
	accountStateChange: [
		{
			address: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			action: [
				'send',
				'send'
			],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: -2
				},
				{
					id: 'testnamespace1.mosaic',
					name: 'testnamespace1.mosaic',
					amount: -2
				}
			]
		},
		{
			address: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			action: [
				'receive',
				'receive'
			],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 2
				},
				{
					id: 'testnamespace1.mosaic',
					name: 'testnamespace1.mosaic',
					amount: 2
				}
			]
		}
	]
};

export const transferCustomMosaicOnlyConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '86C1488E00BF6088488837F938B6678EADA6F11B4F107783E6CCB50D15510414',
	timestamp: '2026-06-25 16:16:50',
	deadline: '2026-06-25 17:16:50',
	signer: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	account: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	direction: null,
	height: 674006,
	signature:
		'20E6E0F15D9C21487D6D06D3D0E1C1B36EB9B7ECE9FE6A2444A30FB94F4C22612879E88A32526B07D7CF69DE0660543D1EC27CF59A0661F3914643B819DB6303',
	fee: 0.1,
	amount: 0,
	value: [
		{
			id: 'testnamespace1.mosaic',
			name: 'testnamespace1.mosaic',
			amount: 11
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			mosaics: [
				{
					id: 'testnamespace1.mosaic',
					name: 'testnamespace1.mosaic',
					amount: 11
				}
			],
			message: {
				type: 'plain',
				text: 'test'
			}
		}
	],
	size: 244,
	version: 2,
	accountStateChange: [
		{
			address: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			action: ['send'],
			mosaic: [
				{
					id: 'testnamespace1.mosaic',
					name: 'testnamespace1.mosaic',
					amount: -11
				}
			]
		},
		{
			address: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			action: ['receive'],
			mosaic: [
				{
					id: 'testnamespace1.mosaic',
					name: 'testnamespace1.mosaic',
					amount: 11
				}
			]
		}
	]
};

export const transferDecimalAmountConfirmedTransaction = {
	type: 'TRANSFER',
	group: 'confirmed',
	hash: '2E77E0266ED6AF545A17B35226D51C2C0225A9A1A0AB09E8115DB79B978DF424',
	timestamp: '2026-06-25 16:14:34',
	deadline: '2026-06-25 17:14:34',
	signer: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	account: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	direction: null,
	height: 674003,
	signature:
		'69C5DFC768392795E97E2304E175AE2080303DD6188954F77FE44A823F91DC524CA55F8D1F9ACF65F03D14D1467409211FD45CE5270E7A3C7E3A0EB7E5F34306',
	fee: 0.1,
	amount: 1.5,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 1.5
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			recipient: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			mosaics: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 1.5
				}
			],
			message: {
				type: 'plain',
				text: 'case2 v2 empty mosaics'
			}
		}
	],
	size: 218,
	version: 2,
	accountStateChange: [
		{
			address: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			action: ['send'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: -1.5
				}
			]
		},
		{
			address: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
			action: ['receive'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 1.5
				}
			]
		}
	]
};

export const transferUnconfirmedTransaction = {
	type: 'TRANSFER',
	group: 'unconfirmed',
	hash: null,
	timestamp: '2026-10-07 16:47:38',
	deadline: '2026-10-07 17:47:38',
	signer: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
	sender: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
	recipient: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
	account: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
	direction: null,
	height: null,
	signature:
		'2FEE2368EA576F563391D01065973028576263C8CFB161B4E39CAA26E035513A03EEB4D6E13DF2C5506BB50FCCEEEF494F96AA101830A9161FB3C9806C75800B',
	fee: 0.1,
	amount: 12,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 12
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
			recipient: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
			mosaics: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 12
				}
			],
			message: {
				type: 'plain',
				text: 'Hello!'
			}
		}
	],
	size: 198,
	version: 1,
	accountStateChange: [
		{
			address: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
			action: ['send'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: -12
				}
			]
		},
		{
			address: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
			action: ['receive'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 12
				}
			]
		}
	]
};

export const mosaicDefinitionConfirmedTransaction = {
	type: 'MOSAIC_DEFINITION',
	group: 'confirmed',
	hash: 'AEA945053F3473F5908C1A9574D65CFA17C833C74DA64FD3EC1C72B2C28C5869',
	timestamp: '2026-09-22 12:01:23',
	deadline: '2026-09-22 14:01:23',
	signer: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	recipient: 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC',
	account: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	direction: null,
	height: 800741,
	signature:
		'C7BC5BCB6A952E99100D016FCBB05D9BB2D90849EEA81E15F902F199842BC262925DC5FF0C07E8D66AD62F17770A00F5B83E5EBA8A33DF73F04718CF0697D200',
	fee: 0.15,
	amount: 10,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 10
		}
	],
	body: [
		{
			type: 'MOSAIC_DEFINITION',
			sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
			recipient: 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC',
			mosaic: {
				name: 'my_namespace.token_1790078483',
				id: 'my_namespace.token_1790078483'
			},
			rentalFee: 10
		}
	],
	size: 401,
	version: 1,
	accountStateChange: []
};

export const mosaicSupplyChangeConfirmedTransaction = {
	type: 'MOSAIC_SUPPLY_CHANGE',
	group: 'confirmed',
	hash: 'DAB4F5F52AF398EE64929AF442807E2A9A762EA6F4890C5C19D4CBC02287A37B',
	timestamp: '2026-07-14 08:21:49',
	deadline: '2026-07-14 10:21:49',
	signer: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	recipient: null,
	account: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	direction: null,
	height: 700656,
	signature:
		'5F56D76FCEBE03017BB45236DE9236FC4C1711DC5E015EAD31DE11C44D25B4660A7021C19F331F60CC295DA8E35B57F0BED620A2AE2E2C50536E66F5AC746C0E',
	fee: 0.15,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MOSAIC_SUPPLY_CHANGE',
			sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
			targetMosaic: {
				name: 'my_namespace.token_1784016991',
				id: 'my_namespace.token_1784016991'
			},
			delta: 500,
			supplyAction: 1
		}
	],
	size: 180,
	version: 1,
	accountStateChange: []
};

export const namespaceRegistrationConfirmedTransaction = {
	type: 'NAMESPACE_REGISTRATION',
	group: 'confirmed',
	hash: 'F81B439FB9BA77EC96DD3AE3070F566B0AB54B88F67ECA95660DEAD0BEB78FF7',
	timestamp: '2026-09-22 12:10:05',
	deadline: '2026-09-22 14:10:05',
	signer: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	recipient: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
	account: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	direction: null,
	height: 800747,
	signature:
		'223D64CAAD5B7A06D1095289273AC423CEEB443C341ED535F70A807B71E03E72BF34E2472C632F372329880A41204D7EE2D6A9588B6A3706998A57DDBB5CE90B',
	fee: 0.15,
	amount: 100,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 100
		}
	],
	body: [
		{
			type: 'NAMESPACE_REGISTRATION',
			sender: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
			recipient: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
			namespace: {
				name: 'ns_1790079005',
				id: 'ns_1790079005'
			},
			rentalFee: 100
		}
	],
	size: 201,
	version: 1,
	accountStateChange: []
};

export const multisigAccountModificationConfirmedTransaction = {
	type: 'MULTISIG_ACCOUNT_MODIFICATION',
	group: 'confirmed',
	hash: '1A1D7057AB538C2357C18C13A006080B6BE76AD93D5FF10CC0DB6FA74970B0C9',
	timestamp: '2026-09-22 07:54:00',
	deadline: '2026-09-22 09:54:00',
	signer: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
	sender: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
	recipient: null,
	account: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
	direction: null,
	height: 800495,
	signature:
		'AF43F68593865E50EF1C02E7701F28791099120490C7ACFBF02FC44C7F0E6CFC4A03F178415BE675A2AC425CC5396ED64CF464884CAA0AA9086783AC113C8006',
	fee: 0.5,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MULTISIG_ACCOUNT_MODIFICATION',
			sender: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
			targetAccount: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
			cosignatoryAdditions: [
				'TAWOQNIMCCFO6MT7JLLFER746HKBBUVU7KQUSDJX',
				'TC7BQFXISQEOPN2PCPPPOM3V4R3XDPNVEHEQLID4'
			],
			cosignatoryDeletions: [],
			minCosignatories: 1
		}
	],
	size: 228,
	version: 2,
	accountStateChange: []
};

export const accountKeyLinkConfirmedTransaction = {
	type: 'ACCOUNT_KEY_LINK',
	group: 'confirmed',
	hash: 'AD2D06A9F5224255F8BCD496BA6CD82254277E3BCD9FE917939C8A2FE8911E90',
	timestamp: '2026-08-13 11:58:31',
	deadline: '2026-08-13 12:58:31',
	signer: 'TDGHJE2WWCC74PLTUVCEMWZJ23SLIXNTAQI5VXCQ',
	sender: 'TDGHJE2WWCC74PLTUVCEMWZJ23SLIXNTAQI5VXCQ',
	recipient: null,
	account: 'TDGHJE2WWCC74PLTUVCEMWZJ23SLIXNTAQI5VXCQ',
	direction: null,
	height: 743684,
	signature:
		'E11E67D5C128A97FD9FC2C3C45F6B3BB7C55EFC3EB3905259FB56ACC2E317548F4E61A3E9C5BCBA816D7DBE417424D8A1380D80127FD7354FEB52FC9DEAE2D05',
	fee: 0.15,
	amount: 0,
	value: [],
	body: [
		{
			type: 'ACCOUNT_KEY_LINK',
			sender: 'TDGHJE2WWCC74PLTUVCEMWZJ23SLIXNTAQI5VXCQ',
			targetAccount: 'TDGHJE2WWCC74PLTUVCEMWZJ23SLIXNTAQI5VXCQ',
			keyLinkAction: 1,
			linkedPublicKey: 'FE68F61CF3B6B4E533F5CF2E01D782B736CDF1EE20871F00A4C37D023F72A149',
			linkedAddress: 'TCWCU7VAL62QSQDOEOGW5AZ3IFVEAWRFX5DYCO5K'
		}
	],
	size: 168,
	version: 1,
	accountStateChange: []
};

export const multisigConfirmedTransaction = {
	type: 'MULTISIG',
	group: 'confirmed',
	hash: '5DAE2C66745FC32E3A82350ECB980CDEEF5C8B5CF71FEDE6D3E6F598A5938C2A',
	timestamp: '2026-07-07 16:54:12',
	deadline: '2026-07-07 17:54:12',
	signer: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	sender: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
	recipient: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	account: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
	direction: null,
	height: 691167,
	signature:
		'EBC4CE26BAF26B3423A6B55735EE0F0567C963121FF637BE313EC52AEF748ED3B3408DCF00480057EB79E10640621C4829847935571703CBE69B10C4443BD101',
	fee: 0.4,
	amount: 4,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 4
		}
	],
	body: [
		{
			type: 'TRANSFER',
			sender: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
			recipient: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			mosaics: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 4
				}
			],
			message: {
				type: 'plain',
				text: 'test'
			}
		}
	],
	size: 480,
	version: 1,
	signatures: [
		{
			fee: 0.15,
			signature:
				'c9905ba8224e23404f2ae6e0b505930d2764bf49ea3701706c2ab3ee048c7be10dc8a344902e1cadf80069b177d24f84a9527182fc6698a10098f97e876da605',
			signer: 'TBKIDM6TBYI4VERBD2YF44UKPKHVYHITUSWEZFPV'
		}
	],
	feesBreakdown: [
		{
			type: 'multisigFee',
			amount: 0.15
		},
		{
			type: 'embeddedTransactionsFee',
			amount: 0.1
		},
		{
			type: 'signaturesFee',
			amount: 0.15
		},
		{
			type: 'totalFee',
			amount: 0.4
		}
	],
	accountStateChange: [
		{
			address: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
			action: ['send'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: -4
				}
			]
		},
		{
			address: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			action: ['receive'],
			mosaic: [
				{
					id: 'nem.xem',
					name: 'nem.xem',
					amount: 4
				}
			]
		}
	]
};

export const multisigNamespaceRegistrationConfirmedTransaction = {
	type: 'MULTISIG',
	group: 'confirmed',
	hash: 'A156C1538FC81B84EDF54C6D09657E75673B11E05366C4A59BC0FEE2365BF321',
	timestamp: '2026-07-02 20:44:34',
	deadline: '2026-07-02 21:44:34',
	signer: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	sender: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
	recipient: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
	account: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
	direction: null,
	height: 684261,
	signature:
		'39201DC14F909056820CF703619DF669D666A083E57213AC95E9F6FA17A512FAF4666B31500C8F3BB51312B89630B7AFADAC14756AD4A91A5A3F8D60CEE68601',
	fee: 0.45,
	amount: 100,
	value: [
		{
			id: 'nem.xem',
			name: 'nem.xem',
			amount: 100
		}
	],
	body: [
		{
			type: 'NAMESPACE_REGISTRATION',
			sender: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
			recipient: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
			namespace: {
				name: 'aaaadd',
				id: 'aaaadd'
			},
			rentalFee: 100
		}
	],
	size: 478,
	version: 1,
	signatures: [
		{
			fee: 0.15,
			signature:
				'6b54d43259a43143bc8c3777ac010addad3fdeed63a1470b1fc72485ead48ebffc1de95234130f3ac854c407cd8966244cb77490edb4368a3fd306747b51fb0f',
			signer: 'TBKIDM6TBYI4VERBD2YF44UKPKHVYHITUSWEZFPV'
		}
	],
	feesBreakdown: [
		{
			type: 'multisigFee',
			amount: 0.15
		},
		{
			type: 'embeddedTransactionsFee',
			amount: 0.15
		},
		{
			type: 'signaturesFee',
			amount: 0.15
		},
		{
			type: 'totalFee',
			amount: 0.45
		}
	],
	accountStateChange: []
};

export const multisigMultisigAccountModificationConfirmedTransaction = {
	type: 'MULTISIG',
	group: 'confirmed',
	hash: '37B7332A9D9BDFFDE1489BFF90F6DB0E5BBE26ADBBB734880C050EB98F9AC533',
	timestamp: '2026-09-22 07:55:36',
	deadline: '2026-09-22 09:55:36',
	signer: 'TAWOQNIMCCFO6MT7JLLFER746HKBBUVU7KQUSDJX',
	sender: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
	recipient: null,
	account: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
	direction: null,
	height: 800498,
	signature:
		'178B3434EC223275AF3C220128912F05109B0E3E82FE5816812F95270B3AEB2DF3F89A5C10E453685A9D6CB64443057B3363884D60B4370A9DF1B1DA52F30306',
	fee: 0.65,
	amount: 0,
	value: [],
	body: [
		{
			type: 'MULTISIG_ACCOUNT_MODIFICATION',
			sender: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
			targetAccount: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
			cosignatoryAdditions: [],
			cosignatoryDeletions: ['TAWOQNIMCCFO6MT7JLLFER746HKBBUVU7KQUSDJX'],
			minCosignatories: -1
		}
	],
	size: 252,
	version: 1,
	signatures: [],
	feesBreakdown: [
		{
			type: 'multisigFee',
			amount: 0.15
		},
		{
			type: 'embeddedTransactionsFee',
			amount: 0.5
		},
		{
			type: 'signaturesFee',
			amount: 0
		},
		{
			type: 'totalFee',
			amount: 0.65
		}
	],
	accountStateChange: []
};
