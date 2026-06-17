import { BridgeTransactionWorkflowStatus } from '../constants';
import { TransactionWorkflowStatus } from '@/app/components/templates/TransactionScreenTemplate/constants';
import { useStandardTransactionWorkflow } from '@/app/components/templates/TransactionScreenTemplate/hooks';
import { useEffect } from 'react';

/** @typedef {import('@/app/screens/bridge/types/Bridge').SwapWorkflowManager} SwapWorkflowManager */
/** @typedef {import('@/app/types/Network').ChainName} ChainName */
/** @typedef {import('@/app/types/Network').NetworkIdentifier} NetworkIdentifier */
/** @typedef {import('@/app/types/Token').TokenInfo} TokenInfo */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTiers} TransactionFeeTiers */
/** @typedef {import('@/app/types/Transaction').TransactionFeeTierLevel} TransactionFeeTierLevel */
/** @typedef {import('@/app/types/Transaction').TransactionBundle} TransactionBundle */
/** @typedef {function(number): Promise<TransactionBundle>} CreateTransactionCallback */

/**
 * Metadata describing one side (source or target) of a workflow step.
 * @typedef {object} WorkflowMetaSide
 * @property {TokenInfo|null} tokenInfo - Token info for this side.
 * @property {ChainName} chainName - The blockchain name.
 * @property {NetworkIdentifier} networkIdentifier - The network identifier.
 */

/**
 * Metadata for a single-step workflow.
 * @typedef {object} SingleWorkflowMeta
 * @property {WorkflowMetaSide} source - Source side metadata.
 * @property {WorkflowMetaSide} target - Target side metadata.
 */

/**
 * Metadata for one step within a dual-step workflow.
 * @typedef {object} WorkflowStepMeta
 * @property {WorkflowMetaSide} source - Source side metadata.
 * @property {WorkflowMetaSide} target - Target side metadata.
 */

/**
 * Metadata for a dual-step workflow.
 * @typedef {object} DualWorkflowMeta
 * @property {WorkflowStepMeta} step1 - First step metadata.
 * @property {WorkflowStepMeta} step2 - Second step metadata.
 */

const EMPTY_SETUP = {
	createTransaction: () => {
		throw new Error('createTransaction callback is required');
	},
	walletController: null,
	transactionFeeTiers: null,
	transactionFeeTierLevel: null
};

/**
 * React hook for managing the full bridge transaction send workflow.
 * Selects between single-step and dual-step workflows based on the bridge configuration.
 * @param {object} params - The parameters object.
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {CreateTransactionCallback} params.createTransaction - Callback to create the transaction bundle for a given step index.
 * @param {TransactionFeeTiers[]} [params.transactionFeeTiers] - Optional fee tiers per transaction.
 * @param {TransactionFeeTierLevel} [params.transactionFeeTierLevel] - Optional fee tier level to apply.
 * @returns {object} The active workflow (single or dual step).
 */
export const useBridgeTransactionWorkflow = params => {
	const isDualStepWorkflow = params.bridge?.steps === 2;
	const singleStepWorkflow = useSingleStepWorkflow({ ...params, isActive: !isDualStepWorkflow });
	const dualStepWorkflow = useDualStepWorkflow({ ...params, isActive: isDualStepWorkflow });

	return isDualStepWorkflow ? dualStepWorkflow : singleStepWorkflow;
};

/**
 * React hook for managing a single-step bridge transaction workflow.
 * @param {object} params - The parameters object.
 * @param {boolean} params.isActive - Whether this workflow is currently active.
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {CreateTransactionCallback} params.createTransaction - Callback to create the transaction bundle.
 * @param {TransactionFeeTiers[]} [params.transactionFeeTiers] - Optional fee tiers per transaction.
 * @param {TransactionFeeTierLevel} [params.transactionFeeTierLevel] - Optional fee tier level to apply.
 * @returns {object} The workflow object extended with {@link SingleWorkflowMeta} on the `meta` property.
 */
export const useSingleStepWorkflow = ({
	isActive,
	bridge,
	createTransaction,
	transactionFeeTiers,
	transactionFeeTierLevel
}) => {
	let workflowConfig = EMPTY_SETUP;
	/** @type {SingleWorkflowMeta|undefined} */
	let meta;

	if (isActive) {
		const pair = bridge?.getPairForStep(0);

		workflowConfig = {
			createTransaction: () => createTransaction(0),
			walletController: pair?.sourceWalletController,
			transactionFeeTiers,
			transactionFeeTierLevel
		};

		meta = {
			source: {
				tokenInfo: pair?.sourceTokenInfo ?? null,
				chainName: pair?.sourceWalletController.chainName,
				networkIdentifier: pair?.sourceWalletController.networkIdentifier
			},
			target: {
				tokenInfo: pair?.targetTokenInfo ?? null,
				chainName: pair?.targetWalletController.chainName,
				networkIdentifier: pair?.targetWalletController.networkIdentifier
			}
		};
	}

	const workflow = useStandardTransactionWorkflow(workflowConfig);
	workflow.steps = 1;
	workflow.meta = meta;

	return workflow;
};

/**
 * React hook for managing a dual-step bridge transaction workflow.
 * @param {object} params - The parameters object.
 * @param {boolean} params.isActive - Whether this workflow is currently active.
 * @param {SwapWorkflowManager|null} params.bridge - The bridge manager instance.
 * @param {CreateTransactionCallback} params.createTransaction - Callback to create the transaction bundle for a given step index.
 * @param {TransactionFeeTiers[]} [params.transactionFeeTiers] - Optional fee tiers per transaction.
 * @param {TransactionFeeTierLevel} [params.transactionFeeTierLevel] - Optional fee tier level to apply.
 * @returns {object} The workflow object extended with {@link DualWorkflowMeta} on the `meta` property.
 */
const useDualStepWorkflow = ({
	isActive,
	bridge,
	createTransaction: createTransactionCallback,
	transactionFeeTiers,
	transactionFeeTierLevel
}) => {
	let configWorkflow1 = EMPTY_SETUP;
	let configWorkflow2 = EMPTY_SETUP;
	/** @type {DualWorkflowMeta|undefined} */
	let meta;

	if (isActive) {
		const firstPair = bridge?.getPairForStep(0);
		const secondPair = bridge?.getPairForStep(1);

		configWorkflow1 = {
			createTransaction: () => createTransactionCallback(0),
			walletController: firstPair?.sourceWalletController,
			transactionFeeTiers,
			transactionFeeTierLevel
		};
		configWorkflow2 = {
			createTransaction: () => createTransactionCallback(1),
			walletController: secondPair?.sourceWalletController,
			transactionFeeTiers,
			transactionFeeTierLevel
		};
		meta = {
			step1: {
				source: {
					tokenInfo: firstPair?.sourceTokenInfo ?? null,
					chainName: firstPair?.sourceWalletController.chainName,
					networkIdentifier: firstPair?.sourceWalletController.networkIdentifier
				},
				target: {
					tokenInfo: firstPair?.targetTokenInfo ?? null,
					chainName: firstPair?.targetWalletController.chainName,
					networkIdentifier: firstPair?.targetWalletController.networkIdentifier
				}
			},
			step2: {
				source: {
					tokenInfo: secondPair?.sourceTokenInfo ?? null,
					chainName: secondPair?.sourceWalletController.chainName,
					networkIdentifier: secondPair?.sourceWalletController.networkIdentifier
				},
				target: {
					tokenInfo: secondPair?.targetTokenInfo ?? null,
					chainName: secondPair?.targetWalletController.chainName,
					networkIdentifier: secondPair?.targetWalletController.networkIdentifier
				}
			}
		};
	}

	const transactionWorkflow1 = useStandardTransactionWorkflow(configWorkflow1);
	const transactionWorkflow2 = useStandardTransactionWorkflow(configWorkflow2);

	const createTransaction = async () => {
		await transactionWorkflow1.createTransaction();
		await transactionWorkflow2.createTransaction();
	};
	const reset = () => {
		transactionWorkflow1.reset();
		transactionWorkflow2.reset();
	};

	const startSecondStep = async () => {
		transactionWorkflow2.transaction.transactions.forEach(tx => {
			if (tx.nonce)
				tx.nonce ++;
		});
		await transactionWorkflow2.executeSignAndAnnounce();
	};

	useEffect(() => {
		const isWorkflow2ReadyToSign = transactionWorkflow2.status === TransactionWorkflowStatus.IDLE
            || transactionWorkflow2.status === TransactionWorkflowStatus.CREATED;

		if (transactionWorkflow1.status === TransactionWorkflowStatus.CONFIRMED && isWorkflow2ReadyToSign)
			startSecondStep();

	}, [transactionWorkflow1.status, transactionWorkflow2.status]);


	const managersList = [
		transactionWorkflow1.managers.createManager,
		transactionWorkflow1.managers.signManager,
		transactionWorkflow1.managers.announceManager,
		transactionWorkflow2.managers.createManager,
		transactionWorkflow2.managers.signManager,
		transactionWorkflow2.managers.announceManager
	];
	const isActiveSending = managersList.some(manager => manager.isLoading);
	const isFailed = managersList.some(manager => manager.error);
	const isSent = managersList.every(manager => manager.isCompleted);
	const isAwaitingFirstStepConfirmation = transactionWorkflow1.status === TransactionWorkflowStatus.ANNOUNCED;
	const isSending = isActiveSending || (isAwaitingFirstStepConfirmation && !isFailed);

	const status = createStatus(transactionWorkflow1.status, transactionWorkflow2.status);

	return {
		steps: 2,
		status,
		isSending,
		isFailed,
		isSent,
		transaction: [transactionWorkflow1.transaction, transactionWorkflow2.transaction],
		managers: {
			createManager1: transactionWorkflow1.managers.createManager,
			signManager1: transactionWorkflow1.managers.signManager,
			announceManager1: transactionWorkflow1.managers.announceManager,
			createManager2: transactionWorkflow2.managers.createManager,
			signManager2: transactionWorkflow2.managers.signManager,
			announceManager2: transactionWorkflow2.managers.announceManager
		},
		hash: {
			signed1: transactionWorkflow1.hashes.signed,
			confirmed1: transactionWorkflow1.hashes.confirmed,
			failed1: transactionWorkflow1.hashes.failed,
			partial1: transactionWorkflow1.hashes.partial,
			signed2: transactionWorkflow2.hashes.signed,
			confirmed2: transactionWorkflow2.hashes.confirmed,
			failed2: transactionWorkflow2.hashes.failed,
			partial2: transactionWorkflow2.hashes.partial
		},
		meta,
		createTransaction,
		executeSignAndAnnounce: transactionWorkflow1.executeSignAndAnnounce,
		reset
	};
};

const createStatus = (workflow1Status, workflow2Status) => {
	const {
		IDLE, CREATING, CREATE_ERROR, CREATED,
		SIGNING, SIGN_ERROR, SIGNED,
		ANNOUNCING, ANNOUNCE_ERROR, ANNOUNCED,
		CONFIRMED, FAILED_TRANSACTIONS
	} = TransactionWorkflowStatus;

	const isCreatePhaseStatus = status => status === IDLE || status === CREATED;

	// Combined create-phase states
	if (workflow1Status === IDLE && workflow2Status === IDLE)
		return BridgeTransactionWorkflowStatus.IDLE;
	if (workflow1Status === CREATING || workflow2Status === CREATING)
		return BridgeTransactionWorkflowStatus.CREATING;
	if (workflow1Status === CREATE_ERROR || workflow2Status === CREATE_ERROR)
		return BridgeTransactionWorkflowStatus.CREATE_ERROR;
	if (isCreatePhaseStatus(workflow1Status) && isCreatePhaseStatus(workflow2Status))
		return BridgeTransactionWorkflowStatus.CREATED;

	// Step 1 in-progress states
	const step1Map = {
		[SIGNING]: BridgeTransactionWorkflowStatus.SIGNING_1,
		[SIGN_ERROR]: BridgeTransactionWorkflowStatus.SIGN_ERROR_1,
		[SIGNED]: BridgeTransactionWorkflowStatus.SIGNED_1,
		[ANNOUNCING]: BridgeTransactionWorkflowStatus.ANNOUNCING_1,
		[ANNOUNCE_ERROR]: BridgeTransactionWorkflowStatus.ANNOUNCE_ERROR_1,
		[ANNOUNCED]: BridgeTransactionWorkflowStatus.ANNOUNCED_1,
		[FAILED_TRANSACTIONS]: BridgeTransactionWorkflowStatus.FAILED_1
	};

	if (workflow1Status in step1Map)
		return step1Map[workflow1Status];

	if (workflow1Status === CONFIRMED && isCreatePhaseStatus(workflow2Status))
		return BridgeTransactionWorkflowStatus.CONFIRMED_1;

	// Step 2 in-progress states
	const step2Map = {
		[SIGNING]: BridgeTransactionWorkflowStatus.SIGNING_2,
		[SIGN_ERROR]: BridgeTransactionWorkflowStatus.SIGN_ERROR_2,
		[SIGNED]: BridgeTransactionWorkflowStatus.SIGNED_2,
		[ANNOUNCING]: BridgeTransactionWorkflowStatus.ANNOUNCING_2,
		[ANNOUNCE_ERROR]: BridgeTransactionWorkflowStatus.ANNOUNCE_ERROR_2,
		[ANNOUNCED]: BridgeTransactionWorkflowStatus.ANNOUNCED_2,
		[FAILED_TRANSACTIONS]: BridgeTransactionWorkflowStatus.FAILED_2,
		[CONFIRMED]: BridgeTransactionWorkflowStatus.CONFIRMED_2
	};

	return step2Map[workflow2Status] ?? BridgeTransactionWorkflowStatus.IDLE;
};


