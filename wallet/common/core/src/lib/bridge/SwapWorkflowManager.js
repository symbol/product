/**
 * @typedef {Object} PairManager
 * @property {string} id - Unique identifier.
 * @property {string} mode - Fixed swap direction: 'wrap' or 'unwrap'.
 * @property {boolean} isReady - Whether the manager is ready to create transactions.
 * @property {boolean} hasHistory - Whether the manager tracks transaction history.
 * @property {import('../controller/WalletController').WalletController} nativeWalletController
 * @property {import('../controller/WalletController').WalletController} wrappedWalletController
 * @property {import('../controller/WalletController').WalletController} sourceWalletController
 * @property {import('../controller/WalletController').WalletController} targetWalletController
 * @property {import('../../types/Token').TokenInfo|null} nativeTokenInfo
 * @property {import('../../types/Token').TokenInfo|null} wrappedTokenInfo
 * @property {function(): Promise<void>} load
 * @property {function(number): Promise<Array>} fetchRecentHistory
 * @property {function(string): Promise<object>} estimateRequest
 * @property {function(object): Promise<import('../models/TransactionBundle').TransactionBundle>} createTransaction
 */

/**
 * @typedef {Object} SwapWorkflowConfig
 * @property {string} [id] - Optional ID. Defaults to concatenation of pair manager IDs.
 * @property {PairManager[]} pairManagers - Ordered pair managers, each representing one swap step.
 */

export class SwapWorkflowManager {
	/** @type {PairManager[]} */
	#pairManagers;

	/** @type {string} */
	#id;

	/**
	 * Create a SwapWorkflowManager.
	 * @param {SwapWorkflowConfig} options
	 * @param {PairManager[]} options.pairManagers - Ordered pair managers (each represents one swap step).
	 * @param {string} [options.id] - Optional unique ID.
	 */
	constructor({ id, pairManagers }) {
		if (!pairManagers || pairManagers.length === 0)
			throw new Error('SwapWorkflowManager requires at least one pair manager');

		this.#pairManagers = pairManagers;
		this.#id = id ?? pairManagers.map(m => m.id).join('+');
	}

	/**
	 * Unique identifier of this workflow.
	 * @returns {string}
	 */
	get id() {
		return this.#id;
	}

	/**
	 * Number of swap steps in this workflow.
	 * @returns {number}
	 */
	get steps() {
		return this.#pairManagers.length;
	}

	/**
	 * Whether all underlying pair managers are ready.
	 * @returns {boolean}
	 */
	get isReady() {
		return this.#pairManagers.every(m => m.isReady);
	}

	/**
	 * Whether all underlying pair managers support transaction history.
	 * @returns {boolean}
	 */
	get hasHistory() {
		return this.#pairManagers.every(m => m.hasHistory);
	}

	/**
	 * Token info at the source of the workflow (input token of the first step).
	 * Exposed as nativeTokenInfo for PairManager interface compatibility.
	 * @returns {import('../../types/Token').TokenInfo|null}
	 */
	get nativeTokenInfo() {
		const first = this.#pairManagers[0];

		return first.mode === 'wrap' ? first.nativeTokenInfo : first.wrappedTokenInfo;
	}

	/**
	 * Token info at the destination of the workflow (output token of the last step).
	 * Exposed as wrappedTokenInfo for PairManager interface compatibility.
	 * @returns {import('../../types/Token').TokenInfo|null}
	 */
	get wrappedTokenInfo() {
		const last = this.#pairManagers[this.#pairManagers.length - 1];

		return last.mode === 'wrap' ? last.wrappedTokenInfo : last.nativeTokenInfo;
	}

	/**
	 * Wallet controller for the source chain (start of the workflow).
	 * @returns {import('../controller/WalletController').WalletController}
	 */
	get sourceWalletController() {
		return this.#pairManagers[0].sourceWalletController;
	}

	/**
	 * Wallet controller for the target chain (end of the workflow).
	 * @returns {import('../controller/WalletController').WalletController}
	 */
	get targetWalletController() {
		return this.#pairManagers[this.#pairManagers.length - 1].targetWalletController;
	}

	/**
	 * Load all underlying pair managers.
	 * @returns {Promise<void>}
	 */
	load = async () => {
		await Promise.all(this.#pairManagers.map(m => m.load()));
	};

	/**
	 * Fetch recent history from all pair managers that support it.
	 * Results are merged and sorted by timestamp descending.
	 * @param {number} count - Maximum number of items to return.
	 * @returns {Promise<Array>}
	 */
	fetchRecentHistory = async count => {
		const historicManagers = this.#pairManagers.filter(m => m.hasHistory);
		const results = await Promise.all(historicManagers.map(m => m.fetchRecentHistory(count)));
		const allData = results.flat();
		const sorted = allData.sort((a, b) => b.requestTransaction.timestamp - a.requestTransaction.timestamp);

		return sorted.slice(0, count);
	};

	/**
	 * Estimate the output amount for a given input.
	 * @param {string} amount - Input amount in relative units.
	 * @returns {Promise<object>}
	 */
	estimateRequest = async amount => {
		const estimations = [];
		let currentAmount = amount;

		for (const manager of this.#pairManagers) {
			const estimation = await manager.estimateRequest(currentAmount);
			estimations.push(estimation);
			currentAmount = estimation.receiveAmount;
		}

		return estimations;
	};

	/**
	 * Create a transaction for a specific step in the workflow.
	 * @param {number} stepIndex - Zero-based index of the step.
	 * @param {object} options - Options forwarded to the pair manager's createTransaction.
	 * @returns {Promise<import('../models/TransactionBundle').TransactionBundle>}
	 */
	createTransactionForStep = async (stepIndex, options) => {
		const manager = this.#pairManagers[stepIndex];

		if (!manager)
			throw new Error(`SwapWorkflowManager: no step at index ${stepIndex}`);

		return manager.createTransaction(options);
	};
}

