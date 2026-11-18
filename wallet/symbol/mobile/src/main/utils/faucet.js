import { config } from '@/app/config';

/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */

/**
 * Create a URL to the chain's testnet faucet. Faucet is used to obtain tokens for testing purposes.
 * URL includes the account address, so it will be prefilled if faucet supports it.
 * @param {ChainName} chainName - The name of the blockchain (e.g., 'symbol', 'nem').
 * @param {NetworkIdentifier} networkIdentifier - The network identifier (e.g., 'testnet').
 * @param {string} address - The recipient account address.
 * @returns {string} The faucet URL.
 */
export const createFaucetUrl = (chainName, networkIdentifier, address) => {
	const baseUrl = config.chains[chainName].faucetURL[networkIdentifier];

	return `${baseUrl}/?recipient=${address}`;
};
