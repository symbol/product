import { ethers } from 'ethers';

/**
 * @typedef {Object} JsonRpcSuccess
 * @property {'2.0'} jsonrpc
 * @property {number|string} id
 * @property {any} result
 */

/**
 * @callback MakeRequest
 * A function that performs an HTTP POST request to a JSON-RPC endpoint.
 * Should resolve with a successful JSON-RPC response object.
 * @param {string} url - The JSON-RPC endpoint URL.
 * @param {object} init - The request init/options (method, headers, body, etc).
 * @returns {Promise<JsonRpcSuccess>}
 */

/**
 * Performs a JSON-RPC 2.0 call against an Ethereum node and returns the `result` field.
 *
 * @param {MakeRequest} makeRequest - Function to perform the HTTP request.
 * @param {string} nodeUrl - Ethereum JSON-RPC endpoint URL.
 * @param {string} method - JSON-RPC method name (e.g., 'eth_call', 'eth_getBalance').
 * @param {any[]} [params] - Parameters for the JSON-RPC method.
 * @returns {Promise<any>} Resolves with the JSON-RPC `result` value.
 */
export const makeEthereumJrpcCall = async (makeRequest, nodeUrl, method, params) => {
	const response = await makeRequest(nodeUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method,
			params
		})
	});

	return response.result;
};

/**
 * Creates an ethers JsonRpcProvider pinned to a static network (by chainId).
 * Avoids an extra network request to fetch chainId.
 *
 * @param {{ nodeUrl: string, chainId: number | string }} options
 * @param {string} options.nodeUrl - Ethereum JSON-RPC endpoint URL.
 * @param {number | string} options.chainId - Target chain id (e.g., 1 for mainnet).
 * @returns {import('ethers').JsonRpcProvider}
 */
export const createEthereumJrpcProvider = ({ nodeUrl, chainId }) => new ethers.JsonRpcProvider(
	nodeUrl,
	null,
	{ staticNetwork: ethers.Network.from(chainId) }
);

/**
 * Creates an ethers Contract instance bound to a provider/runner.
 *
 * @param {import('ethers').InterfaceAbi} abi - Contract ABI.
 * @param {string} address - Contract address.
 * @param {import('ethers').ContractRunner} provider - Provider or Signer to run contract calls.
 * @returns {import('ethers').Contract}
 */
export const createContract = (abi, address, provider) => new ethers.Contract(address, abi, provider);
