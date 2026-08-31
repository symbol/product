/**
 * Expected result of mapping `unconfirmedTransactionPageResponse`, aligned by index with it
 */
export const unconfirmedWalletTransactions = [
	{
		'type': 16724,
		'deadline': {
			'timestamp': 1779179651811,
			'adjusted': 111929184811
		},
		'timestamp': NaN,
		'height': 0,
		'hash': '1CABCFA63934926B3E1C646716C4D212867F3BC86DDB83C265D86BDFB3B64260',
		'fee': {
			'token': {
				'amount': '0.029268',
				'divisibility': 6,
				'id': '72C0212E67A08BCE',
				'name': 'symbol.xym'
			}
		},
		'signerAddress': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
		'signerPublicKey': 'F9214C919AB21E14385107FE17E1BE6B95D8598C8BD1413B951D65D76ABA1A6C',
		'recipientAddress': 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
		'mosaics': [
			{
				'id': '72C0212E67A08BCE',
				'divisibility': 6,
				'names': [
					'symbol.xym'
				],
				'duration': 0,
				'startHeight': 1,
				'endHeight': 1,
				'isUnlimitedDuration': true,
				'creator': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
				'supply': '8247523206.660532',
				'isSupplyMutable': false,
				'isTransferable': true,
				'isRestrictable': false,
				'isRevokable': false,
				'amount': '123',
				'name': 'symbol.xym'
			}
		],
		'amount': '-123'
	},
	{
		'type': 16961,
		'deadline': {
			'timestamp': 1779179651811,
			'adjusted': 111929184811
		},
		'timestamp': NaN,
		'height': 0,
		'hash': 'B077AD3289BD9B173727A990676BF3ED7D06FB0083937DD9523DEF50AEADC6D9',
		'fee': {
			'token': {
				'amount': '0.0472',
				'divisibility': 6,
				'id': '72C0212E67A08BCE',
				'name': 'symbol.xym'
			}
		},
		'signerAddress': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
		'signerPublicKey': 'F9214C919AB21E14385107FE17E1BE6B95D8598C8BD1413B951D65D76ABA1A6C',
		'amount': '-5',
		'innerTransactions': [
			{
				'type': 16724,
				'signerAddress': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ',
				'signerPublicKey': 'F9214C919AB21E14385107FE17E1BE6B95D8598C8BD1413B951D65D76ABA1A6C',
				'recipientAddress': 'TCJCFUWF6GIGFDZAR3DFFWJB33HWPHKRZIESUVY',
				'mosaics': [
					{
						'id': '72C0212E67A08BCE',
						'divisibility': 6,
						'names': [
							'symbol.xym'
						],
						'duration': 0,
						'startHeight': 1,
						'endHeight': 1,
						'isUnlimitedDuration': true,
						'creator': 'TCEUGLPCMO5Y72EEISSNUKGTMCN5RO4PVYMK5FI',
						'supply': '8247523206.660532',
						'isSupplyMutable': false,
						'isTransferable': true,
						'isRestrictable': false,
						'isRevokable': false,
						'amount': '5',
						'name': 'symbol.xym'
					}
				],
				'amount': '-5'
			}
		],
		'cosignatures': [],
		'receivedCosignatures': []
	}
];
