/* eslint-disable max-len */
import { ethers } from 'ethers';

const erc20Interface = new ethers.Interface([
	'function transfer(address to, uint256 value) public returns (bool)'
]);
const signerPublicKey = '0x04d180bfa90bb100d21df55b10cc535b392e87d595593afa9de219f4bd006bd2893d80827f43c47794029a8b4218699e65d837a6beb95b5b2f95a31b52f3e93b13';
const signerAddress = '0xb1b2145b7d2ba5AB20Ee0Bcb0F7FAd08a1BfC7A4';
const recipientAddress1 = '0xC5D9cF0eE687e357Aea5d26592F8bC9fe32aBAA2';
const recipientAddress2 = '0xE61c8ba605B4A808dD8138c990e941feAe532307';
const erc20ContractAddress = '0x6fE1f90116fd1225c4B713a6EFb3f87DCe77b445';
const chainId = 3151908;
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
	}
];
