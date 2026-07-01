import { HarvestingAction } from '@/app/screens/harvesting/types/Harvesting';
import { objectToTableData } from '@/app/utils';
import { useCallback } from 'react';

/** @typedef {import('@/app/types/Wallet').MainWalletController} MainWalletController */
/** @typedef {import('@/app/types/Account').HarvesterAccountInfo} HarvesterAccountInfo */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {import('@/app/types/Transaction').TransactionConfirmationDialogSection} TransactionConfirmationDialogSection */

/**
 * Return type for useHarvestingTransaction hook.
 * @typedef {object} UseHarvestingTransactionReturnType
 * @property {() => Promise<TransactionBundle>} createStartTransaction - Creates start harvesting transaction.
 * @property {() => TransactionBundle} createStopTransaction - Creates stop harvesting transaction.
 * @property {(transactionBundle: TransactionBundle) => TransactionConfirmationDialogSection[]} getConfirmationPreview
 *   - Generates the transaction confirmation dialog.
 */

/**
 * React hook for creating harvesting transactions and generating preview data.
 * @param {object} params - Hook parameters.
 * @param {MainWalletController} params.walletController - The wallet controller instance.
 * @param {string} [params.selectedNodeUrl] - Selected node URL for starting harvesting.
 * @param {string|null} [params.actionType] - Current harvesting action ('start' or 'stop').
 * @param {HarvesterAccountInfo} [params.harvesterAccountInfo] - The selected multisig account info, when harvesting
 *   from a multisig account. Omitted for the current account.
 * @returns {UseHarvestingTransactionReturnType}
 */
export const useHarvestingTransaction = ({ walletController, selectedNodeUrl, actionType, harvesterAccountInfo }) => {
	const { modules, networkApi } = walletController;

	/**
	 * Creates a start harvesting transaction.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createStartTransaction = useCallback(async () => {
		if (!selectedNodeUrl)
			throw new Error('Node URL is required to start harvesting');

		const nodeInfo = await networkApi.harvesting.fetchNodeInfo(selectedNodeUrl);

		return modules.harvesting.createStartHarvestingTransaction({
			nodePublicKey: nodeInfo.nodePublicKey,
			harvesterAccountInfo
		});
	}, [modules.harvesting, networkApi.harvesting, selectedNodeUrl, harvesterAccountInfo]);

	/**
	 * Creates a stop harvesting transaction.
	 * @returns {Promise<TransactionBundle>}
	 */
	const createStopTransaction = useCallback(() => {
		return modules.harvesting.createStopHarvestingTransaction({ harvesterAccountInfo });
	}, [modules.harvesting, harvesterAccountInfo]);

	/**
	 * Generates confirmation sections for the transaction confirmation dialog.
	 * @returns {TransactionConfirmationDialogSection[]}
	 */
	const getConfirmationPreview = useCallback(() => {
		if (actionType === HarvestingAction.STOP)
			return [];

		const { chainName, networkIdentifier, modules: { addressBook }, accounts } = walletController;

		return [{
			id: 'section_0',
			title: '',
			chainName,
			networkIdentifier,
			addressBook,
			walletAccounts: accounts,
			tableData: objectToTableData({ nodeUrl: selectedNodeUrl })
		}];
	}, [walletController, selectedNodeUrl, actionType]);

	return {
		createStartTransaction,
		createStopTransaction,
		getConfirmationPreview
	};
};
