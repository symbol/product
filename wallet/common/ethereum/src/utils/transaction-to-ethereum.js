import { networkIdentifierToChainId } from './network';
import { TransactionType } from '../constants';
import { ethers } from 'ethers';

/** @typedef {import('../types/Transaction').Transaction} Transaction */
/** @typedef {import('../types/Transaction').EthersTransaction} EthersTransaction */

/**
 * Converts a transaction to the ethers format.
 * @param {Transaction} transaction - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {string} config.networkIdentifier - The network identifier.
 * @returns {EthersTransaction} The ethers format transaction.
 */
export const transactionToEthereum = (transaction, config) => {
	switch (transaction.type) {
	case TransactionType.TRANSFER:
		return transferTransactionToEthereum(transaction, config);
	case TransactionType.ERC_20_TRANSFER:
		return erc20TransferTransactionToEthereum(transaction, config);
	}

	return null;
};

const createBaseEthereumTransaction = (transaction, networkIdentifier) => {
	const baseTransaction = {
		from: transaction.signerAddress,
		chainId: networkIdentifierToChainId(networkIdentifier),
		nonce: transaction.nonce
	};

	if (transaction.fee) {
		const { gasLimit, maxFeePerGas, maxPriorityFeePerGas} = transaction.fee;

		baseTransaction.gasLimit = BigInt(gasLimit);
		baseTransaction.maxFeePerGas = ethers.parseUnits(maxFeePerGas);
		baseTransaction.maxPriorityFeePerGas = ethers.parseUnits(maxPriorityFeePerGas);
	}

	return baseTransaction;
};

const transferTransactionToEthereum = (transaction, config) => {
	const { recipientAddress, tokens } = transaction;
	const { amount } = tokens[0];
	const baseTransaction = createBaseEthereumTransaction(transaction, config.networkIdentifier);

	return {
		...baseTransaction,
		to: recipientAddress,
		value: ethers.parseEther(amount)
	};
};

const erc20TransferTransactionToEthereum = (transaction, config) => {
	const { recipientAddress, tokens } = transaction;
	const token = tokens[0];
	const baseTransaction = createBaseEthereumTransaction(transaction, config.networkIdentifier);

	const erc20Interface = new ethers.Interface([
		'function transfer(address to, uint256 value) public returns (bool)'
	]);

	return {
		...baseTransaction,
		to: token.id,
		value: 0n,
		data: erc20Interface.encodeFunctionData('transfer', [
			recipientAddress,
			ethers.parseUnits(token.amount, token.divisibility)
		])
	};
};
