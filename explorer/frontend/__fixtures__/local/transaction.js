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
