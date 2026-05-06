import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeManager} BridgeManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeModeType} BridgeModeType */
/** @typedef {import('@/app/types/Table').TableData} TableData */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

/**
 * Return type for useBridgeTransaction hook.
 * @typedef {object} UseBridgeTransactionReturnType
 * @property {() => Promise<Transaction>} createTransaction - Creates a bridge transaction.
 * @property {(transaction: Transaction) => TableData} getTransactionPreviewTable - Generates preview table data.
 */

/**
 * React hook for creating bridge transactions and generating transaction preview data.
 * @param {object} params - Hook parameters.
 * @param {BridgeManager|null} params.bridge - The bridge manager instance.
 * @param {BridgeModeType|null} params.mode - The bridge operation mode.
 * @param {SwapSide|null} params.source - The source swap side.
 * @param {SwapSide|null} params.target - The target swap side.
 * @param {string} params.amount - The amount to transfer.
 * @returns {UseBridgeTransactionReturnType}
 */
export const useBridgeTransaction = ({ bridge, mode, source, target, amount }) => {
	const createTransaction = async () => {
		const transaction = await bridge.createTransaction(mode, {
			recipientAddress: target.walletController.currentAccount.address,
			amount
		});

		return transaction;
	};

	const getTransactionPreviewTable = transaction => {
		const swapData = {
			signerAddress: transaction.signerAddress,
			recipientAddress: transaction.message.text,
			mosaics: transaction.mosaics || transaction.tokens,
			fee: transaction.fee
		};

		return objectToTableData(swapData);
	};

	return {
		createTransaction,
		getTransactionPreviewTable
	};
};
