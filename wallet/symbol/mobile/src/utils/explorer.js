import { config } from '@/app/config'

/**
 * Create a URL to view a transaction on the blockchain explorer.
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {string} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} transactionHash - The transaction hash.
 * @returns {string} The URL to view the transaction on the explorer.
 */
export const createExplorerTransactionUrl = (chainName, networkIdentifier, transactionHash) => {
    const baseUrl = config.chains[chainName].explorerURL[networkIdentifier];

    if (chainName === 'symbol')
        return `${baseUrl}/transactions/${transactionHash}`;

    if (chainName === 'ethereum')
        return `${baseUrl}/tx/${transactionHash}`;

    throw new Error(`Cannot create explorer URL for transaction on chain "${chainName}"`);
};

/**
 * Create a URL to view an account on the blockchain explorer.
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {string} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} address - The account address.
 * @returns {string} The URL to view the account on the explorer.
 */
export const createExplorerAccountUrl = (chainName, networkIdentifier, address) => {
    const baseUrl = config.chains[chainName].explorerURL[networkIdentifier];

    if (chainName === 'symbol')
        return `${baseUrl}/accounts/${address}`;

    if (chainName === 'ethereum')
        return `${baseUrl}/address/${address}`;

    throw new Error(`Cannot create explorer URL for account on chain "${chainName}"`);
};

/**
 * Create a URL to view a token/mosaic on the blockchain explorer.
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol', 'ethereum').
 * @param {string} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} tokenId - The token or mosaic identifier.
 * @returns {string} The URL to view the token/mosaic on the explorer.
 */
export const createTokenExplorerUrl = (chainName, networkIdentifier, tokenId) => {
    const baseUrl = config.chains[chainName].explorerURL[networkIdentifier];

    if (chainName === 'symbol')
        return `${baseUrl}/mosaics/${tokenId}`;

    if (chainName === 'ethereum')
        return `${baseUrl}/address/${tokenId}`;
};

/**
 * Create a URL to view a namespace on the blockchain explorer.
 * @param {string} chainName - The name of the blockchain (e.g., 'symbol').
 * @param {string} networkIdentifier - The network identifier (e.g., 'mainnet', 'testnet').
 * @param {string} namespaceId - The namespace identifier.
 * @returns {string} The URL to view the namespace on the explorer.
 */
export const createExplorerNamespaceUrl = (chainName, networkIdentifier, namespaceId) => {
    const baseUrl = config.chains[chainName].explorerURL[networkIdentifier];

    if (chainName === 'symbol')
        return `${baseUrl}/namespaces/${namespaceId}`;

    throw new Error(`Cannot create explorer URL for namespace on chain "${chainName}"`);
}
