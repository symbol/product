import { objectToTableData } from '@/app/utils';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Table').TableData} TableData */
/** @typedef {import('@/app/types/Transaction').Transaction} Transaction */

/**
 * Return type for useHarvestingTransaction hook.
 * @typedef {object} UseHarvestingTransactionReturnType
 * @property {(password: string) => Promise<Transaction>} createStartTransaction - Creates start harvesting transaction.
 * @property {() => Transaction} createStopTransaction - Creates stop harvesting transaction.
 * @property {() => TableData} getTransactionPreviewTable - Gets preview table for confirmation dialog.
 */

/**
 * React hook for creating harvesting transactions and generating preview data.
 * @param {object} params - Hook parameters.
 * @param {MainWalletController} params.walletController - The wallet controller instance.
 * @param {string} [params.selectedNodeUrl] - Selected node URL for starting harvesting.
 * @returns {UseHarvestingTransactionReturnType}
 */
export const useHarvestingTransaction = ({ walletController, selectedNodeUrl }) => {
	const { modules, networkApi } = walletController;

	/**
	 * Creates a start harvesting transaction.
	 * @param {string} password - Wallet password.
	 * @returns {Promise<Transaction>}
	 */
	const createStartTransaction = useCallback(async password => {
		if (!selectedNodeUrl)
			throw new Error('Node URL is required to start harvesting');

		const nodeInfo = await networkApi.harvesting.fetchNodeInfo(selectedNodeUrl);

		return modules.harvesting.createStartHarvestingTransaction(
			{ nodePublicKey: nodeInfo.nodePublicKey },
			password
		);
	}, [modules.harvesting, networkApi.harvesting, selectedNodeUrl]);

	/**
	 * Creates a stop harvesting transaction.
	 * @returns {Transaction}
	 */
	const createStopTransaction = useCallback(() => {
		return modules.harvesting.createStopHarvestingTransaction();
	}, [modules.harvesting]);

	/**
	 * Generates preview table data for the transaction confirmation dialog.
	 * @returns {TableData}
	 */
	const getTransactionPreviewTable = useCallback(() => {
		const previewData = {
			nodeUrl: selectedNodeUrl
		};

		return objectToTableData(previewData);
	}, [selectedNodeUrl]);

	return {
		createStartTransaction,
		createStopTransaction,
		getTransactionPreviewTable
	};
};
