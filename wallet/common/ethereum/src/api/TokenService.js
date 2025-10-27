import { createContract, createEthereumJrpcProvider } from '../utils';

/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

export class TokenService {
	constructor() {}

	/**
     * Fetches token info from the node.
     * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string} tokenId - Requested token id or contract address.
     * @returns {Promise<TokenInfo>} - The token info.
     */
	fetchTokenInfo = async (networkProperties, tokenId) => {
		const provider = createEthereumJrpcProvider(networkProperties);
		const erc20Abi = [
			'function balanceOf(address) view returns (uint256)',
			'function decimals() view returns (uint8)',
			'function symbol() view returns (string)'
		];
		const contract = createContract(tokenId, erc20Abi, provider);
		const [decimals, symbol] = await Promise.all([
			contract.decimals(),
			contract.symbol()
		]);

		return {
			id: tokenId,
			name: symbol,
			divisibility: Number(decimals)
		};
	};

	/**
     * Fetches token infos for the list of ids from the node.
     * @param {NetworkProperties} networkProperties - Network properties.
     * @param {string[]} tokenIds - Requested token ids.
     * @returns {Promise<Record<string, TokenInfo>>} - The token infos map.
     */
	fetchTokenInfos = async (networkProperties, tokenIds) => {
		const fetches = tokenIds.map(tokenId => this.fetchTokenInfo(networkProperties, tokenId));
		const tokens = await Promise.all(fetches);
		const tokenMap = {};
		tokens.forEach(token => {
			tokenMap[token.id] = token;
		});

		return tokenMap;
	};
}
