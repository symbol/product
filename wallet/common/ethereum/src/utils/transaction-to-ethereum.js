import { networkIdentifierToChainId } from './network';
import { NETWORK_CURRENCY_ID, TransactionType } from '../constants';
import { ethers } from 'ethers';
import { relativeToAbsoluteAmount } from 'wallet-common-core';

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
	case TransactionType.ERC_20_BRIDGE_TRANSFER:
		return erc20BridgeTransferTransactionToEthereum(transaction, config);
	case TransactionType.UNISWAP_SWAP:
		return uniswapSwapToEthereum(transaction, config);
	case TransactionType.ERC_20_APPROVE:
		return erc20ApproveTransactionToEthereum(transaction, config);
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

const erc20BridgeTransferTransactionToEthereum = (transaction, config) => {
	const erc20Transfer = erc20TransferTransactionToEthereum(transaction, config);
	const erc20DataWithMessage = erc20Transfer.data + transaction.message.payload;

	return {
		...erc20Transfer,
		data: erc20DataWithMessage
	};
};

const ERC_20_APPROVE_ABI = ['function approve(address spender, uint256 value) public returns (bool)'];

const erc20ApproveTransactionToEthereum = (transaction, config) => {
	const baseTransaction = createBaseEthereumTransaction(transaction, config.networkIdentifier);
	const erc20Interface = new ethers.Interface(ERC_20_APPROVE_ABI);

	return {
		...baseTransaction,
		to: transaction.tokenId,
		value: 0n,
		data: erc20Interface.encodeFunctionData('approve', [
			transaction.spenderAddress,
			ethers.parseUnits(transaction.amount, transaction.divisibility)
		])
	};
};

const SWAP_ROUTER_EXACT_INPUT_SINGLE_SIGNATURE =
	// eslint-disable-next-line max-len
	'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)';

const SWAP_ROUTER_ABI = [SWAP_ROUTER_EXACT_INPUT_SINGLE_SIGNATURE];

const uniswapSwapToEthereum = (transaction, config) => {
	const baseTransaction = createBaseEthereumTransaction(transaction, config.networkIdentifier);

	const routerInterface = new ethers.Interface(SWAP_ROUTER_ABI);
	const absoluteAmountIn = relativeToAbsoluteAmount(transaction.sourceToken.amount, transaction.sourceToken.divisibility);
	const absoluteAmountOut = relativeToAbsoluteAmount(transaction.targetToken.amount, transaction.targetToken.divisibility);

	let value = 0n;
	let tokenIn = transaction.sourceToken.id;

	if (transaction.sourceToken.id === NETWORK_CURRENCY_ID) {
		value = BigInt(absoluteAmountIn);
		tokenIn = transaction.wethTokenId;
	};

	return {
		...baseTransaction,
		to: transaction.routerAddress,
		value,
		data: routerInterface.encodeFunctionData('exactInputSingle', [{
			tokenIn,
			tokenOut: transaction.targetToken.id,
			fee: transaction.poolFee,
			recipient: transaction.recipientAddress,
			deadline: transaction.deadline,
			amountIn: BigInt(absoluteAmountIn),
			amountOutMinimum: BigInt(absoluteAmountOut),
			sqrtPriceLimitX96: BigInt(transaction.sqrtPriceLimitX96)
		}])
	};
};
