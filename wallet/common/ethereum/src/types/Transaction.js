/** @typedef {import('./Token').Token} Token */

/**
 * @typedef {Object} TransactionFee
 * @property {string} gasLimit - The gas limit for the transaction. BigInt string.
 * @property {string} maxFeePerGas - The maximum fee per gas for the transaction. Relative amount string in Ethers.
 * @property {string} maxPriorityFeePerGas - The maximum priority fee per gas for the transaction. Relative amount string in Ethers.
 * @property {Token} token - The total fee amount to pay for a transaction in the network currency token representation.
 * Relative amount string in Ethers.
 */

/**
 * @typedef {Object} TransactionFeeTires
 * @property {TransactionFee} slow - The slow fee tier.
 * @property {TransactionFee} medium - The medium fee tier.
 * @property {TransactionFee} fast - The fast fee tier.
 */

/**
 * @typedef {Object} Transaction
 * @property {string} type - The transaction type.
 * @property {string} signerPublicKey - The public key of the transaction signer.
 * @property {string} signerAddress - The address of the transaction signer.
 * @property {string} recipientAddress - The address of the transaction recipient.
 * @property {Token[]} tokens - The tokens involved in the transaction (e.g. ETH, ERC-20).
 * @property {TransactionFee} [fee] - The transaction fee.
 * @property {number} [timestamp] - Timestamp the transaction is confirmed.
 * @property {number} [height] - The block height the transaction is included in.
 * @property {string} [hash] - The transaction hash.
 */

/**
 * @typedef {Object} SignedTransactionDTO
 * @property {string} payload - The transaction payload.
 */

/**
 * @typedef {Object} SignedTransaction
 * @property {SignedTransactionDTO} dto - Transaction data transfer object.
 * @property {string} hash - The transaction hash.
 */

/**
 * @typedef {Object} EthersTransaction
 * @property {string} from - The sender's address.
 * @property {string} to - The recipient's address or contract address.
 * @property {string} value - The amount of Ether to send.transaction.
 * @property {string} nonce - The transaction nonce.
 * @property {string} chainId - The ID of the Ethereum chain.
 * @property {string} [data] - The function call data.
 * @property {string} [gasLimit] - The maximum amount of gas to use for the transaction.
 * @property {string} [maxFeePerGas] - The maximum fee per gas for the transaction.
 * @property {string} [maxPriorityFeePerGas] - The maximum priority fee per gas for the transaction.
 */

export default {};
