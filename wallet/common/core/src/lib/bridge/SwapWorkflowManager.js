/** @typedef {import('../controller/WalletController').WalletController} WalletController */
/** @typedef {import('../../types/Token').TokenInfo} TokenInfo */
/** @typedef {import('../models/TransactionBundle').TransactionBundle} TransactionBundle */

/**
 * @typedef {Object} PairManager
 * @property {string} mode - Fixed swap direction: 'wrap' or 'unwrap'.
 * @property {boolean} isReady - Whether the manager is ready to create transactions.
 * @property {boolean} hasHistory - Whether the manager tracks transaction history.
 * @property {WalletController} nativeWalletController - Wallet controller for the native side of the pair.
 * @property {WalletController} wrappedWalletController - Wallet controller for the wrapped side of the pair.
 * @property {WalletController} sourceWalletController - Wallet controller for the source side (determined by mode).
 * @property {WalletController} targetWalletController - Wallet controller for the target side (determined by mode).
 * @property {TokenInfo|null} nativeTokenInfo - Token info for the native side of the pair.
 * @property {TokenInfo|null} wrappedTokenInfo - Token info for the wrapped side of the pair.
 * @property {TokenInfo|null} sourceTokenInfo - Token info for the source side (determined by mode).
 * @property {TokenInfo|null} targetTokenInfo - Token info for the target side (determined by mode).
 * @property {function(): Promise<void>} load - Loads manager data (config, token info, etc.).
 * @property {function(number): Promise<Array>} fetchRecentHistory - Fetches recent transaction history up to the given count.
 * @property {function(string): Promise<object>} estimateRequest - Estimates the output amount for a given input amount in relative units.
 * @property {function(object): Promise<TransactionBundle>} createTransaction - Creates a signed transaction bundle.
 */

/**
 * @typedef {Object} SwapWorkflowConfig
 * @property {PairManager[]} pairManagers - Ordered pair managers, each representing one swap step.
 */

export class SwapWorkflowManager {
	/** @type {PairManager[]} */
	#pairManagers;

	/**
	 * Create a SwapWorkflowManager.
	 * @param {SwapWorkflowConfig} options
	 * @param {PairManager[]} options.pairManagers - Ordered pair managers (each represents one swap step).
	 */
	constructor({ pairManagers }) {
		if (!pairManagers || pairManagers.length === 0)
			throw new Error('SwapWorkflowManager requires at least one pair manager');

		this.#pairManagers = pairManagers;
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
		return this.#pairManagers.some(m => m.hasHistory);
	}

	/**
	 * Token info at the source of the workflow (input token of the first step).
	 * @returns {TokenInfo|null}
	 */
	get sourceTokenInfo() {
		const first = this.#pairManagers[0];

		return first.sourceTokenInfo;
	};

	/**
	 * Token info at the destination of the workflow (output token of the last step).
	 * @returns {TokenInfo|null}
	 */
	get targetTokenInfo() {
		const last = this.#pairManagers[this.#pairManagers.length - 1];

		return last.targetTokenInfo;
	};

	/**
	 * Wallet controller for the source chain (start of the workflow).
	 * @returns {WalletController}
	 */
	get sourceWalletController() {
		return this.#pairManagers[0].sourceWalletController;
	}

	/**
	 * Wallet controller for the target chain (end of the workflow).
	 * @returns {WalletController}
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
	 * Runs each pair manager's estimateRequest in sequence, passing each step's receiveAmount as the next input.
	 * @param {string} amount - Input amount in relative units.
	 * @returns {Promise<Array>} Array of estimation objects, one per step.
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
	 * Get the pair manager responsible for a specific step.
	 * @param {number} stepIndex - Zero-based index of the step.
	 * @returns {PairManager}
	 */
	getPairForStep = stepIndex => {
		const manager = this.#pairManagers[stepIndex];

		if (!manager)
			throw new Error(`SwapWorkflowManager: no step at index ${stepIndex}`);

		return manager;
	};

	/**
	 * Create a transaction for a specific step in the workflow.
	 * @param {number} stepIndex - Zero-based index of the step.
	 * @param {object} options - Options forwarded to the pair manager's createTransaction.
	 * @returns {Promise<TransactionBundle>}
	 */
	createTransactionForStep = async (stepIndex, options) => {
		return this.getPairForStep(stepIndex).createTransaction(options);
	};
}

