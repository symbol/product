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
