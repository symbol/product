/* eslint-disable max-len */
import { ethers } from 'ethers';

const erc20Interface = new ethers.Interface([
	'function transfer(address to, uint256 value) public returns (bool)'
]);
const signerPublicKey = '0x04d180bfa90bb100d21df55b10cc535b392e87d595593afa9de219f4bd006bd2893d80827f43c47794029a8b4218699e65d837a6beb95b5b2f95a31b52f3e93b13';
const signerAddress = '0xb1b2145b7d2ba5ab20ee0bcb0f7fad08a1bfc7a4';
const recipientAddress1 = '0xc5d9cf0ee687e357aea5d26592f8bc9fe32abaa2';
const recipientAddress2 = '0xe61c8ba605b4a808dd8138c990e941feae532307';
const erc20ContractAddress = '0x6fe1f90116fd1225c4b713a6efb3f87dce77b445';
const chainId = 3151908;
const bridgePayload = '982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6';
const baseFee = {
	gasLimit: 21000,
	maxFeePerGas: '3',
	maxPriorityFeePerGas: '1'
};

export const walletTransactions = [
	{
		type: 1,
		signerPublicKey,
		signerAddress,
		recipientAddress: recipientAddress1,
		tokens: [
			{
				id: 'ETH',
				amount: '1.5',
				divisibility: 18
			}
		],
		nonce: 0,
		fee: baseFee
	},
	{
		type: 2,
		signerPublicKey,
		signerAddress,
		recipientAddress: recipientAddress2,
		tokens: [
			{
				id: erc20ContractAddress,
				amount: '10',
				divisibility: 6
			}
		],
		nonce: 1,
		fee: baseFee
	},
	{
		type: 3,
		signerPublicKey,
		signerAddress,
		recipientAddress: recipientAddress2,
		tokens: [
			{
				id: erc20ContractAddress,
				amount: '0.02',
				divisibility: 6
			}
		],
		message: {
			payload: bridgePayload
		},
		nonce: 2,
		fee: baseFee
	}
];

export const ethereumTransactions = [
	{
		from: signerAddress,
		to: recipientAddress1,
		value: 1500000000000000000n,
		gasLimit: 21000n,
		maxFeePerGas: 3000000000000000000n,
		maxPriorityFeePerGas: 1000000000000000000n,
		chainId,
		nonce: 0
	},
	{
		from: signerAddress,
		to: erc20ContractAddress,
		value: 0n,
		data: erc20Interface.encodeFunctionData('transfer', [
			recipientAddress2,
			10000000n
		]),
		gasLimit: 21000n,
		maxFeePerGas: 3000000000000000000n,
		maxPriorityFeePerGas: 1000000000000000000n,
		chainId,
		nonce: 1
	},
	{
		from: signerAddress,
		to: erc20ContractAddress,
		value: 0n,
		data: erc20Interface.encodeFunctionData('transfer', [
			recipientAddress2,
			20000n
		]) + bridgePayload,
		gasLimit: 21000n,
		maxFeePerGas: 3000000000000000000n,
		maxPriorityFeePerGas: 1000000000000000000n,
		chainId,
		nonce: 2
	}
];

export const signedTransactions = [
	{
		'dto': '0x02f87d8330182480880de0b6b3a76400008829a2241af62c000082520894c5d9cf0ee687e357aea5d26592f8bc9fe32abaa28814d1120d7b16000080c001a0d4d10f0e5c6f6b95e1afd7bbddae6d5e33c3000be1c147024547ca7341566294a00b216cdaceb421f13c9e7978f00d6271695311aeced9e2ba3ad64f1783fe37ea',
		'hash': '0x4707b91a2cddee42b96caf2de66a8b0645d02b96b4e44ba81dffffd198b8cff8'
	},
	{
		'dto': '0x02f8ba8330182401880de0b6b3a76400008829a2241af62c0000825208946fe1f90116fd1225c4b713a6efb3f87dce77b44580b844a9059cbb000000000000000000000000e61c8ba605b4a808dd8138c990e941feae5323070000000000000000000000000000000000000000000000000000000000989680c001a06d702fcdc50ae678e0e9017f1391fd3858d27c60d1b5bc45955d24c678f81989a05586df7919671215ac17c05b75f6a937fae826c5dbcc2d46b6d376d5427c667e',
		'hash': '0xd0c31e56e3e73cf88aab09a5ddff5f4536f7b907e81d7ad5a4f72a717dbc65ba'
	},
	{
		'dto': '0x02f8d28330182402880de0b6b3a76400008829a2241af62c0000825208946fe1f90116fd1225c4b713a6efb3f87dce77b44580b85ca9059cbb000000000000000000000000e61c8ba605b4a808dd8138c990e941feae5323070000000000000000000000000000000000000000000000000000000000004e20982c69a051a72bfbe31aeda7250ac6c747b7570b3e9c00b6c080a026fbcde77be5a1145c84b37a311aa5be7026f8003f98c0744ff70ae6da3c3e25a025b308a60d8f22522e91b651af687ff5ed6405222673565148ef20c1eed42a54',
		'hash': '0x4d41bb7b5c27dd5b9df9dfd9b8a5fb2f54f7ba5bff8c118c5a30b4f89f65e2bb'
	}
];


export const etherTransaction = {
	'height': '251023',
	'hash': '0x03adaec8595e907da0d19ad354ca4b67f94ddf79c79e40ad8b37a5ee3b1e7478',
	'nonce': '19',
	'signerAddress': signerAddress,
	'fee': {
		'gasLimit': '21000',
		'maxFeePerGas': '0.00000000000000001',
		'maxPriorityFeePerGas': '0',
		'token': {
			'amount': '0.00000000000021',
			'id': 'ETH',
			'name': 'ETH',
			'divisibility': 18
		}
	},
	'timestamp': 1759844024000,
	'type': 1,
	'tokens': [
		{
			'name': 'ETH',
			'id': 'ETH',
			'divisibility': 18,
			'amount': '0.1979990999942376'
		}
	],
	'recipientAddress': '0xcef7462dbdca4c19b66012c70d1541a33606e9ad'
};

export const erc20Transaction = {
	'height': '251181',
	'hash': '0xc778bb5dac6ab4b4c881cbe62941c152f39819ede4fe85517d237def2da0af3e',
	'nonce': '20',
	'signerAddress': signerAddress,
	'fee': {
		'gasLimit': '40069',
		'maxFeePerGas': '0.000000000000000014',
		'maxPriorityFeePerGas': '0',
		'token': {
			'amount': '0.000000000000560966',
			'id': 'ETH',
			'name': 'ETH',
			'divisibility': 18
		}
	},
	'timestamp': 1759845920000,
	'type': 2,
	'tokens': [
		{
			'id': '0x5e8343a455f03109b737b6d8b410e4ecce998cda',
			'name': 'wXYM',
			'divisibility': 6,
			'amount': '12'
		}
	],
	'recipientAddress': '0xcef7462dbdca4c19b66012c70d1541a33606e9ad'
};

export const bridgeTransaction = {
	'height': '249648',
	'hash': '0x3a99098a33bf68fcf41476dcf6adf58320700c7695d27fc4722b42d3bc118478',
	'nonce': '18',
	'signerAddress': signerAddress,
	'fee': {
		'gasLimit': '45908',
		'maxFeePerGas': '0.00000000000000001',
		'maxPriorityFeePerGas': '0',
		'token': {
			'amount': '0.00000000000045908',
			'id': 'ETH',
			'name': 'ETH',
			'divisibility': 18
		}
	},
	'timestamp': 1759827524000,
	'type': 3,
	'tokens': [
		{
			'id': '0x5e8343a455f03109b737b6d8b410e4ecce998cda',
			'name': 'wXYM',
			'divisibility': 6,
			'amount': '0.02'
		}
	],
	'recipientAddress': '0x9b5b717fec711af80050986d1306d5c8fb9fa953',
	'message': {
		'payload': '982C69A051A72BFBE31AEDA7250AC6C747B7570B3E9C00B6',
		'text': 'TAWGTICRU4V7XYY25WTSKCWGY5D3OVYLH2OABNQ'
	}
};
