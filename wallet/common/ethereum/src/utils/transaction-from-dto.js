import { to0x } from './account';
import { createFee } from './fee';
import { TransactionType } from '../constants';
import { absoluteToRelativeAmount, hexToBase32 } from 'wallet-common-core';

const ERC_20_TRANSFER_SIGNATURE = '0xa9059cbb';

/** @typedef {import('../types/Account').PublicAccount} PublicAccount */
/** @typedef {import('../types/Block').Block} Block */
/** @typedef {import('../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */
/** @typedef {import('../types/Transaction').Transaction} Transaction */

/**
 * Converts a transaction DTO to a transaction object.
 * @param {object} transactionDTO - The transaction to convert.
 * @param {object} config - The configuration object.
 * @param {NetworkProperties} config.networkProperties - The network properties.
 * @param {PublicAccount} config.currentAccount - The current account.
 * @param {object.<string, Block>} config.blocks - The block height to block map.
 * @param {object.<string, TokenInfo>} config.tokenInfos - The token contract address to info map.
 * @returns {Transaction} The transaction object.
 */
export const transactionFromDTO = (transactionDTO, config) => {
	const erc20LikeTransaction = !!transactionDTO.input && transactionDTO.input.startsWith(ERC_20_TRANSFER_SIGNATURE);

	if (erc20LikeTransaction) 
		return erc20LikeTransactionFromDTO(transactionDTO, config);
	

	return transferTransactionFromDTO(transactionDTO, config);
};

const baseTransactionFromDTO = (transactionDTO, config) => {
	const transaction = {
		height: transactionDTO.blockNumber ? BigInt(transactionDTO.blockNumber).toString() : null,
		hash: transactionDTO.hash ? transactionDTO.hash.toLowerCase() : null,
		nonce: transactionDTO.nonce ? BigInt(transactionDTO.nonce).toString() : null,
		signerAddress: transactionDTO.from.toLowerCase(),
		fee: createFee({
			maxFeePerGas: absoluteToRelativeAmount(
				BigInt(transactionDTO.maxFeePerGas).toString(),
				config.networkProperties.networkCurrency.divisibility
			),
			maxPriorityFeePerGas: absoluteToRelativeAmount(
				BigInt(transactionDTO.maxPriorityFeePerGas).toString(),
				config.networkProperties.networkCurrency.divisibility
			)
		}, BigInt(transactionDTO.gas).toString(), config.networkProperties.networkCurrency)
	};

	if (config.blocks && config.blocks[transaction.height]) {
		const block = config.blocks[transaction.height];
		transaction.timestamp = block.timestamp;
	}

	return transaction;
};

const transferTransactionFromDTO = (transactionDTO, config) => {
	const amountAbsolute = transactionDTO.value ? BigInt(transactionDTO.value).toString() : '0';
	const token = {
		...config.networkProperties.networkCurrency,
		amount: absoluteToRelativeAmount(amountAbsolute, config.networkProperties.networkCurrency.divisibility)
	};

	return {
		...baseTransactionFromDTO(transactionDTO, config),
		type: TransactionType.TRANSFER,
		tokens: [token],
		recipientAddress: transactionDTO.to ? transactionDTO.to.toLowerCase() : null
	};
};

const erc20LikeTransactionFromDTO = (transactionDTO, config) => {
	const data = transactionDTO.input.slice(10);
	const amountHex = data.slice(64, 128);
	const amountAbsolute = BigInt(to0x(amountHex)).toString();
	const contractAddress = transactionDTO.to.toLowerCase();
	const tokenInfo = config.tokenInfos[contractAddress];
	const token = {
		...tokenInfo,
		amount: absoluteToRelativeAmount(amountAbsolute, tokenInfo.divisibility)
	};
	const erc20Transaction = {
		...baseTransactionFromDTO(transactionDTO, config),
		type: TransactionType.ERC_20_TRANSFER,
		tokens: [token],
		recipientAddress: to0x(data.slice(24, 64).toLowerCase())
	};

	// If input data has more than just the recipient and amount, treat it as a message
	// Used in bridge transactions
	const additionalData = data.slice(128);
	if (additionalData && additionalData !== '0'.repeat(additionalData.length)) {
		erc20Transaction.type = TransactionType.ERC_20_BRIDGE_TRANSFER;
		erc20Transaction.message = {
			payload: additionalData,
			text: hexToBase32(additionalData)
		};
	}

	return erc20Transaction;
};


/**
 * Extracts unresolved block heights, and token contract addresses from transaction DTOs.
 * @param {object[]} transactionDTOs - The transaction DTOs.
 * @returns {{blockHeights: string[], tokenContractAddresses: string[]}} The unresolved IDs.
 */
export const getUnresolvedIdsFromTransactionDTOs = transactionDTOs => {
	const blockHeights = new Set();
	const tokenContractAddresses = new Set();

	transactionDTOs.forEach(tx => {
		if (tx.blockNumber)
			blockHeights.add(BigInt(tx.blockNumber).toString());

		if (tx.input && tx.input.startsWith(ERC_20_TRANSFER_SIGNATURE) && tx.to)
			tokenContractAddresses.add(tx.to.toLowerCase());
	});

	return {
		blockHeights: Array.from(blockHeights),
		tokenContractAddresses: Array.from(tokenContractAddresses)
	};
};
