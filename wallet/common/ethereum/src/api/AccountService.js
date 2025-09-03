import { NETWORK_CURRENCY_DIVISIBILITY, NETWORK_CURRENCY_ID, NETWORK_CURRENCY_NAME } from '../constants';
import { ethers } from 'ethers';
import { absoluteToRelativeAmount } from 'wallet-common-core';

/** @typedef {import('../types/Account').AccountInfo} AccountInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class AccountService {
	#config;

	constructor(options) {
		this.#config = options.config;
	}

	/**
     * Fetches account information from the node.
     * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string} address - The address of the account to fetch information for.
     * @returns {Promise<AccountInfo>} - The account information.
     */
	fetchAccountInfo = async (networkProperties, address) => {
		const provider = new ethers.JsonRpcProvider(networkProperties.nodeUrl);
		const erc20TokensAddresses = this.#config.erc20TokensAddresses[networkProperties.networkIdentifier] || [];
		const erc20Abi = [
			'function balanceOf(address) view returns (uint256)',
			'function decimals() view returns (uint8)',
			'function symbol() view returns (string)'
		];
		const erc20TokensFetches = erc20TokensAddresses.map(async tokenAddress => {
			const contract = new ethers.Contract(tokenAddress, erc20Abi, provider);
			const [balanceRaw, decimals, symbol] = await Promise.all([
				contract.balanceOf(address),
				contract.decimals(),
				contract.symbol()
			]);
			const divisibility = Number(decimals);
			const amount = absoluteToRelativeAmount(balanceRaw.toString(), divisibility);
            
			return {
				id: tokenAddress,
				amount,
				name: symbol,
				divisibility
			};
		});

		const [balance, ...tokens] = await Promise.all([
			this.fetchAccountBalance(networkProperties, address),
			...erc20TokensFetches
		]);

		return {
			address,
			balance,
			tokens: [
				{
					id: NETWORK_CURRENCY_ID,
					name: NETWORK_CURRENCY_NAME,
					amount: balance,
					divisibility: NETWORK_CURRENCY_DIVISIBILITY
				},
				...tokens
			]
		};
	};

	/**
     * Fetches the native currency balance of an account from the node.
     * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string} address - Requested account address.
     * @returns {Promise<number>} - The account balance.
     */
	fetchAccountBalance = async (networkProperties, address) => {
		const provider = new ethers.JsonRpcProvider(networkProperties.nodeUrl);
		const balance = await provider.getBalance(address);

		return absoluteToRelativeAmount(balance.toString(), NETWORK_CURRENCY_DIVISIBILITY);
	};
}
