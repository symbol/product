/* eslint-disable max-len */
export const transferConfirmedTransactionResponse = {
	deadline: '2026-10-07 17:45:34',
	embeddedTransactions: null,
	fee: 0.1,
	fromAddress: 'TCSMSAMGFNWZVWFTJ34GKIZKYQNDJOVICWIRMVQY',
	height: 822435,
	signature:
		'8A2575B95A4F48A065D3A066A2ACFFA38C17BD3A0453481AC94A0C94866ADDD3880D846064312377F923B709E443EB5CEE6539904BDDB29AC975597978D27F02',
	size: 202,
	timestamp: '2026-10-07 16:45:34',
	toAddress: 'TBCJO54GA42OLIKPIM2MLAQWLFCGJOZPN4NILBCJ',
	transactionHash: '4DA0B89353C4C8DBA6FC42EACED93DD414D1A9DB3F55BC24A25725FE3242D5BB',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '476f6f64204c75636b21',
				type: 1
			}
		},
		{
			amount: 100,
			namespace: 'nem.xem'
		}
	],
	version: 1
};

export const transferNoMessageConfirmedTransactionResponse = {
	deadline: '2026-09-22 15:10:07',
	embeddedTransactions: null,
	fee: 0.05,
	fromAddress: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	height: 800807,
	signature:
		'EF3E5A05DBA70F4B916A219E1A900392FAC09C8AD570DE2975FFD50F4C633551A67674DCB02ECF10524B18B3C9A13BAA543345FBD66ECCE1A3BBC85CF3684E08',
	size: 188,
	timestamp: '2026-09-22 13:10:07',
	toAddress: 'TBULEAUG2CZQISUR442HWA6UAKGWIXHDABJVIPS4',
	transactionHash: '82F4457CCE6EC0C4D6457A855A784FC2EFECAA15AC03CEEB084172EC060BAE5F',
	transactionType: 'TRANSFER',
	value: [
		{
			amount: 1,
			namespace: 'nem.xem'
		}
	],
	version: 2
};

export const transferEncryptedMessageConfirmedTransactionResponse = {
	deadline: '2026-07-07 17:41:07',
	embeddedTransactions: null,
	fee: 0.2,
	fromAddress: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	height: 691160,
	signature:
		'15F35C8179098661EC58C775DB8B4BDAA792AC648B23871D974F9E5B0D4204ABFD1CB8CC227B0EA5976417A4DF7280BF8B1D278D7B87FD8513297EF15F5E210C',
	size: 256,
	timestamp: '2026-07-07 16:41:07',
	toAddress: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	transactionHash: '06BAD70100BF98946D827454235E5F916848B10E82EEC70AED405D23271B4068',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload:
					'd213419ea20a3b08aef51bee5941484dc274341fcc2a6c1344aea6750c54386238b5305d0e5bd16dfbbf590b2ad485892573466346a75cf9d9a71da31ae6e169',
				type: 2
			}
		},
		{
			amount: 3,
			namespace: 'nem.xem'
		}
	],
	version: 1
};

export const transferMultipleMosaicsConfirmedTransactionResponse = {
	deadline: '2026-06-25 17:14:37',
	embeddedTransactions: null,
	fee: 0.15,
	fromAddress: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	height: 674003,
	signature:
		'49B573435E3E888151573074423E683FF43EFF57E86421ED627CAE85BDA9391A65949F92878D190CB212DCB64AC2D1D80C82716DB5E62A4F998C50D540634F09',
	size: 292,
	timestamp: '2026-06-25 16:14:37',
	toAddress: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	transactionHash: '064467E72CA6B960F174CCA76CDF2B59FCB9DA538DE995E3CAA9732871555097',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '6361736534207632206d756c7432202b6d6f73616963',
				type: 1
			}
		},
		{
			amount: 2,
			namespace: 'nem.xem'
		},
		{
			amount: 2,
			namespace: 'testnamespace1.mosaic'
		}
	],
	version: 2
};

export const transferCustomMosaicOnlyConfirmedTransactionResponse = {
	deadline: '2026-06-25 17:16:50',
	embeddedTransactions: null,
	fee: 0.1,
	fromAddress: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	height: 674006,
	signature:
		'20E6E0F15D9C21487D6D06D3D0E1C1B36EB9B7ECE9FE6A2444A30FB94F4C22612879E88A32526B07D7CF69DE0660543D1EC27CF59A0661F3914643B819DB6303',
	size: 244,
	timestamp: '2026-06-25 16:16:50',
	toAddress: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	transactionHash: '86C1488E00BF6088488837F938B6678EADA6F11B4F107783E6CCB50D15510414',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '74657374',
				type: 1
			}
		},
		{
			amount: 11,
			namespace: 'testnamespace1.mosaic'
		}
	],
	version: 2
};

export const transferDecimalAmountConfirmedTransactionResponse = {
	deadline: '2026-06-25 17:14:34',
	embeddedTransactions: null,
	fee: 0.1,
	fromAddress: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	height: 674003,
	signature:
		'69C5DFC768392795E97E2304E175AE2080303DD6188954F77FE44A823F91DC524CA55F8D1F9ACF65F03D14D1467409211FD45CE5270E7A3C7E3A0EB7E5F34306',
	size: 218,
	timestamp: '2026-06-25 16:14:34',
	toAddress: 'TAYFGZ5O7HIVF3P4FDLKMBAYPN3HPINM4B6HAVTA',
	transactionHash: '2E77E0266ED6AF545A17B35226D51C2C0225A9A1A0AB09E8115DB79B978DF424',
	transactionType: 'TRANSFER',
	value: [
		{
			message: {
				payload: '636173653220763220656d707479206d6f7361696373',
				type: 1
			}
		},
		{
			amount: 1.5,
			namespace: 'nem.xem'
		}
	],
	version: 2
};

export const mosaicDefinitionConfirmedTransactionResponse = {
	deadline: '2026-09-22 14:01:23',
	embeddedTransactions: null,
	fee: 0.15,
	fromAddress: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	height: 800741,
	signature:
		'C7BC5BCB6A952E99100D016FCBB05D9BB2D90849EEA81E15F902F199842BC262925DC5FF0C07E8D66AD62F17770A00F5B83E5EBA8A33DF73F04718CF0697D200',
	size: 401,
	timestamp: '2026-09-22 12:01:23',
	toAddress: 'TBMOSAICOD4F54EE5CDMR23CCBGOAM2XSJBR5OLC',
	transactionHash: 'AEA945053F3473F5908C1A9574D65CFA17C833C74DA64FD3EC1C72B2C28C5869',
	transactionType: 'MOSAIC_DEFINITION',
	value: [
		{
			mosaicNamespaceName: 'my_namespace.token_1790078483',
			sinkFee: 10
		}
	],
	version: 1
};

export const mosaicSupplyChangeConfirmedTransactionResponse = {
	deadline: '2026-07-14 10:21:49',
	embeddedTransactions: null,
	fee: 0.15,
	fromAddress: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	height: 700656,
	signature:
		'5F56D76FCEBE03017BB45236DE9236FC4C1711DC5E015EAD31DE11C44D25B4660A7021C19F331F60CC295DA8E35B57F0BED620A2AE2E2C50536E66F5AC746C0E',
	size: 180,
	timestamp: '2026-07-14 08:21:49',
	toAddress: null,
	transactionHash: 'DAB4F5F52AF398EE64929AF442807E2A9A762EA6F4890C5C19D4CBC02287A37B',
	transactionType: 'MOSAIC_SUPPLY_CHANGE',
	value: [
		{
			delta: 500,
			namespaceName: 'my_namespace.token_1784016991',
			supplyType: 1
		}
	],
	version: 1
};

export const namespaceRegistrationConfirmedTransactionResponse = {
	deadline: '2026-09-22 14:10:05',
	embeddedTransactions: null,
	fee: 0.15,
	fromAddress: 'TBONKWCOWBZYZB2I5JD3LSDBQVBYHB757VN3SKPP',
	height: 800747,
	signature:
		'223D64CAAD5B7A06D1095289273AC423CEEB443C341ED535F70A807B71E03E72BF34E2472C632F372329880A41204D7EE2D6A9588B6A3706998A57DDBB5CE90B',
	size: 201,
	timestamp: '2026-09-22 12:10:05',
	toAddress: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
	transactionHash: 'F81B439FB9BA77EC96DD3AE3070F566B0AB54B88F67ECA95660DEAD0BEB78FF7',
	transactionType: 'NAMESPACE_REGISTRATION',
	value: [
		{
			namespaceName: 'ns_1790079005',
			parent: null,
			sinkFee: 100
		}
	],
	version: 1
};

export const multisigAccountModificationConfirmedTransactionResponse = {
	deadline: '2026-09-22 09:54:00',
	embeddedTransactions: null,
	fee: 0.5,
	fromAddress: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
	height: 800495,
	signature:
		'AF43F68593865E50EF1C02E7701F28791099120490C7ACFBF02FC44C7F0E6CFC4A03F178415BE675A2AC425CC5396ED64CF464884CAA0AA9086783AC113C8006',
	size: 228,
	timestamp: '2026-09-22 07:54:00',
	toAddress: null,
	transactionHash: '1A1D7057AB538C2357C18C13A006080B6BE76AD93D5FF10CC0DB6FA74970B0C9',
	transactionType: 'MULTISIG_ACCOUNT_MODIFICATION',
	value: [
		{
			minCosignatories: 1,
			modifications: [
				{
					cosignatoryAccount: 'TAWOQNIMCCFO6MT7JLLFER746HKBBUVU7KQUSDJX',
					modificationType: 1
				},
				{
					cosignatoryAccount: 'TC7BQFXISQEOPN2PCPPPOM3V4R3XDPNVEHEQLID4',
					modificationType: 1
				}
			]
		}
	],
	version: 2
};

export const accountKeyLinkConfirmedTransactionResponse = {
	deadline: '2026-08-13 12:58:31',
	embeddedTransactions: null,
	fee: 0.15,
	fromAddress: 'TDGHJE2WWCC74PLTUVCEMWZJ23SLIXNTAQI5VXCQ',
	height: 743684,
	signature:
		'E11E67D5C128A97FD9FC2C3C45F6B3BB7C55EFC3EB3905259FB56ACC2E317548F4E61A3E9C5BCBA816D7DBE417424D8A1380D80127FD7354FEB52FC9DEAE2D05',
	size: 168,
	timestamp: '2026-08-13 11:58:31',
	toAddress: null,
	transactionHash: 'AD2D06A9F5224255F8BCD496BA6CD82254277E3BCD9FE917939C8A2FE8911E90',
	transactionType: 'ACCOUNT_KEY_LINK',
	value: [
		{
			mode: 1,
			remoteAccount: 'FE68F61CF3B6B4E533F5CF2E01D782B736CDF1EE20871F00A4C37D023F72A149',
			remoteAddress: 'TCWCU7VAL62QSQDOEOGW5AZ3IFVEAWRFX5DYCO5K'
		}
	],
	version: 1
};

export const multisigConfirmedTransactionResponse = {
	deadline: '2026-07-07 17:54:12',
	embeddedTransactions: [
		{
			fee: 0.1,
			initiator: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			signatures: [
				{
					fee: 0.15,
					signature:
						'c9905ba8224e23404f2ae6e0b505930d2764bf49ea3701706c2ab3ee048c7be10dc8a344902e1cadf80069b177d24f84a9527182fc6698a10098f97e876da605',
					signer: 'TBKIDM6TBYI4VERBD2YF44UKPKHVYHITUSWEZFPV'
				}
			],
			transactionHash: 'A26371706BB04185E28200B5057C09D8DE26E69913C9B6DE6AD07D5C32230F22',
			transactionType: 'TRANSFER',
			value: [
				{
					message: {
						payload: '74657374',
						type: 1
					}
				},
				{
					amount: 4,
					namespace: 'nem.xem'
				}
			]
		}
	],
	fee: 0.15,
	fromAddress: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
	height: 691167,
	signature:
		'EBC4CE26BAF26B3423A6B55735EE0F0567C963121FF637BE313EC52AEF748ED3B3408DCF00480057EB79E10640621C4829847935571703CBE69B10C4443BD101',
	size: 480,
	timestamp: '2026-07-07 16:54:12',
	toAddress: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
	transactionHash: '5DAE2C66745FC32E3A82350ECB980CDEEF5C8B5CF71FEDE6D3E6F598A5938C2A',
	transactionType: 'MULTISIG',
	value: null,
	version: 1
};

export const multisigNamespaceRegistrationConfirmedTransactionResponse = {
	deadline: '2026-07-02 21:44:34',
	embeddedTransactions: [
		{
			fee: 0.15,
			initiator: 'TB4ZDE2DJPB7UEG3FJXMI5EDXVW7LFBDZJAUCVIM',
			signatures: [
				{
					fee: 0.15,
					signature:
						'6b54d43259a43143bc8c3777ac010addad3fdeed63a1470b1fc72485ead48ebffc1de95234130f3ac854c407cd8966244cb77490edb4368a3fd306747b51fb0f',
					signer: 'TBKIDM6TBYI4VERBD2YF44UKPKHVYHITUSWEZFPV'
				}
			],
			transactionHash: 'A4A33DF197E3F37A4D298D3F9C6DA1AA325700F4A14CB1CD3593035E4D784807',
			transactionType: 'NAMESPACE_REGISTRATION',
			value: [
				{
					namespaceName: 'aaaadd',
					parent: null,
					sinkFee: 100
				}
			]
		}
	],
	fee: 0.15,
	fromAddress: 'TAXKL5K3OYZDRG7IPYULEPMUW7BBPIQ5LC5S3VFI',
	height: 684261,
	signature:
		'39201DC14F909056820CF703619DF669D666A083E57213AC95E9F6FA17A512FAF4666B31500C8F3BB51312B89630B7AFADAC14756AD4A91A5A3F8D60CEE68601',
	size: 478,
	timestamp: '2026-07-02 20:44:34',
	toAddress: 'TAMESPACEWH4MKFMBCVFERDPOOP4FK7MTDJEYP35',
	transactionHash: 'A156C1538FC81B84EDF54C6D09657E75673B11E05366C4A59BC0FEE2365BF321',
	transactionType: 'MULTISIG',
	value: null,
	version: 1
};

export const multisigMultisigAccountModificationConfirmedTransactionResponse = {
	deadline: '2026-09-22 09:55:36',
	embeddedTransactions: [
		{
			fee: 0.5,
			initiator: 'TAWOQNIMCCFO6MT7JLLFER746HKBBUVU7KQUSDJX',
			signatures: [],
			transactionHash: 'C66A2FEAC1F907B1FBC9AEA3E3DC57CF72B5CDF5B48B6B74377647AD5C698E08',
			transactionType: 'MULTISIG_ACCOUNT_MODIFICATION',
			value: [
				{
					minCosignatories: -1,
					modifications: [
						{
							cosignatoryAccount: 'TAWOQNIMCCFO6MT7JLLFER746HKBBUVU7KQUSDJX',
							modificationType: 2
						}
					]
				}
			]
		}
	],
	fee: 0.15,
	fromAddress: 'TBLXIOUO4EP5YR74HYXS3BFBGONZBUHP3NIS2HJ6',
	height: 800498,
	signature:
		'178B3434EC223275AF3C220128912F05109B0E3E82FE5816812F95270B3AEB2DF3F89A5C10E453685A9D6CB64443057B3363884D60B4370A9DF1B1DA52F30306',
	size: 252,
	timestamp: '2026-09-22 07:55:36',
	toAddress: null,
	transactionHash: '37B7332A9D9BDFFDE1489BFF90F6DB0E5BBE26ADBBB734880C050EB98F9AC533',
	transactionType: 'MULTISIG',
	value: null,
	version: 1
};
