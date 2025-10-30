import { TransactionGroup } from '../constants';
import { createEthereumJrpcProvider } from '../utils';
import { WebSocketProvider } from 'ethers';
import { ApiError } from 'wallet-common-core';

/** @typedef {import('../types/Network').NetworkProperties} NetworkProperties */

const isAccountRelatedTransaction = (transaction, accountAddress) => {
	const from = transaction.from?.toLowerCase();
	const to = transaction.to?.toLowerCase();

	return from === accountAddress || to === accountAddress;
};

export class Listener {
	/**
	 * Constructor Listener
	 * @param {NetworkProperties} networkProperties - The network properties.
	 * @param {string} accountAddress - The account address to listen for transactions.
	 * @param {WebSocket} [websocketInjected] - The injected websocket.
	 */
	constructor(networkProperties, accountAddress, websocketInjected) {
		this.networkProperties = networkProperties;
		this.accountAddress = accountAddress.toLowerCase();
		this.websocketInjected = websocketInjected;
		this.wsProvider = null;
		this.jrpcProvider = null;
		this.uid = 'eth-listener';
		this.SIGINT = false;
	}

	/**
	 * Open a websocket connection.
	 * @param {function({ client: string, code: number, reason: string }): void} [onUnsolicitedCloseCallback] - The callback function.
	 * @returns {Promise<void>} - A promise that resolves when the connection is open.
	 */
	async open(onUnsolicitedCloseCallback) {
		try {
			this.jrpcProvider = createEthereumJrpcProvider(this.networkProperties);
			this.wsProvider = new WebSocketProvider(this.networkProperties.wsUrl);
			this.wsProvider.on('error', error => {
				if (this.SIGINT)
					return;

				const closeEvent = {
					client: this.uid,
					code: -1,
					reason: error?.message || 'WebSocket provider error'
				};

				if (onUnsolicitedCloseCallback)
					onUnsolicitedCloseCallback(closeEvent);
			});
		} catch (error) {
			throw new ApiError(`Failed to open Listener. ${error.message}`);
		}
	}

	/**
	 * Close the websocket connection.
	 */
	async close() {
		if (!this.wsProvider)
			return;

		this.SIGINT = true;

		await this.wsProvider.removeAllListeners();

		this.wsProvider = null;
		this.jrpcProvider = null;
	}

	/**
	 * Subscribe to new transactions.
	 * @param {'confirmed' | 'unconfirmed' | 'partial'} group - The transaction group.
	 * @param {function({ hash: string }): void} callback - The callback function.
	 */
	listenAddedTransactions(group, callback) {
		if (group === TransactionGroup.CONFIRMED)
			this._listenConfirmedTransactions(callback);
		else if (group === TransactionGroup.UNCONFIRMED)
			this._listenPendingTransactions(callback);
	}

	_listenPendingTransactions(callback) {
		this.wsProvider.on('pending', async transactionHash => {
			const transaction = await this.jrpcProvider.getTransaction(transactionHash);

			if (!transaction)
				return;

			if (isAccountRelatedTransaction(transaction, this.accountAddress))
				callback({ hash: transaction.hash });
		});
	}

	_listenConfirmedTransactions(callback) {
		this.wsProvider.on('block', async blockHeight => {
			const block = await this.jrpcProvider.getBlock(blockHeight, true);

			if (!block || !block.prefetchedTransactions)
				return;

			block.prefetchedTransactions.forEach(transaction => {
				if (isAccountRelatedTransaction(transaction, this.accountAddress))
					callback({ hash: transaction.hash });
			});
		});
	}

	/**
	 * Subscribe to new blocks.
	 * @param {function(Object): void} callback - The callback function.
	 */
	listenNewBlock(callback) {
		this.wsProvider.on('block', async blockHeight => {
			callback({ height: blockHeight });
		});
	}
}
