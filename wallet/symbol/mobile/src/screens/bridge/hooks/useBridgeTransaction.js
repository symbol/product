import { objectToTableData } from '@/app/utils';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapSide} SwapSide */
/** @typedef {import('@/app/screens/bridge/types/Bridge').BridgeEstimation} BridgeEstimation */
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
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {SwapSide|null} params.target - The target swap side.
 * @param {string} params.amount - The amount to transfer.
 * @param {BridgeEstimation} params.estimation - The estimation data for the transaction.
 * @returns {UseBridgeTransactionReturnType}
 */
export const useBridgeTransaction = ({ bridge, target, amount, estimation }) => {
	const createTransaction = async () => {
		const transaction = await bridge.createTransactionForStep(0, {
			recipientAddress: target.walletController.currentAccount.address,
			amount,
			amountOutMinimum: estimation?.receiveAmount
		});

		return transaction;
	};

	const getTransactionPreviewTable = transaction => {
		const swapData = {
			signerAddress: transaction.signerAddress,
			recipientAddress: transaction.message?.text ?? transaction.recipientAddress,
			tokens: transaction.mosaics || transaction.tokens || (transaction.sourceToken ? [transaction.sourceToken] : []),
			fee: transaction.fee
		};

		return objectToTableData(swapData);
	};

	return {
		createTransaction,
		getTransactionPreviewTable
	};
};
