const { getDatabase } = require('./database');
const { QueryTypes } = require('sequelize');

const optinRequestDB = {
	async getOptinRequestPagination({
		pageNumber, pageSize, nemAddressBytes, transactionHashBytes, status, sortBy, sortDirection
	}) {
		// set default sort
		let fieldSort = 'ORDER BY optin_transaction_height DESC';

		if (sortBy && sortDirection && 'none' !== sortDirection) {
			if ('payoutTransactionHash' === sortBy)
				fieldSort = `ORDER BY payoutTimestamp ${sortDirection}`;
			else if ('optinTransactionHash' === sortBy)
				fieldSort = `ORDER BY optinTimestamp ${sortDirection}`;
		}

		const offset = (pageNumber - 1) * pageSize;

		const { in_progress } = getDatabase();

		try {
			const result = await in_progress.query(
				`SELECT optin_transaction_height AS optinTransactionHeight, address AS nemAddressBytes,
					HEX(optin_transaction_hash) AS optinTransactionHashHex,
					payout_transaction.height AS payoutTransactionHeight,
					HEX(payout_transaction_hash) AS payoutTransactionHash, payout_status AS payoutStatus, message,
					nem_block_timestamps.timestamp AS optinTimestamp, payout_transaction.timestamp AS payoutTimestamp
				FROM optin_request
					LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = optin_request.optin_transaction_height
					LEFT JOIN payout_transaction ON payout_transaction.transaction_hash = optin_request.payout_transaction_hash
					WHERE payout_status IN (0, 1, 3, 4) AND (address = $1 OR $1 IS NULL) AND (optin_transaction_hash = $2 OR $2 IS NULL)
						AND (payout_status = $3 OR $3 IS NULL)
				UNION ALL
				SELECT optin_transaction_height AS optinTransactionHeight, address AS nemAddressBytes,
					HEX(optin_transaction_hash) AS optinTransactionHashHex,	'' AS payoutTransactionHeight, '' AS payoutTransactionHash, 4,
					message, nem_block_timestamps.timestamp AS optinTimestamp, NULL AS payoutTimestamp
					FROM optin_error
					LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = optin_error.optin_transaction_height
					WHERE (address = $1 OR $1 IS NULL) AND (optin_transaction_hash = $2 OR $2 IS NULL) AND ($3 = 4 OR $3 IS NULL)
				${fieldSort}
				LIMIT $4 OFFSET $5`,
				{ bind: [nemAddressBytes, transactionHashBytes, status, pageSize, offset], type: QueryTypes.SELECT }
			);

			return result;
		} catch (error) {
			throw new Error(`Database error :${error.message}`);
		}
	},
	async getTotalRecord({ nemAddressBytes, transactionHashBytes, status }) {
		const result = await this.getOptinRequestPagination({
			pageNumber: 1, pageSize: -1, nemAddressBytes, transactionHashBytes, status
		});
		return result.length;
	}
};

module.exports = optinRequestDB;
