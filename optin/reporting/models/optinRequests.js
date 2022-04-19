const { in_progress } = require('./database');
const { QueryTypes } = require('sequelize');

const optinRequestDB = {
	async getOptinRequestPagination({
		pageNumber, pageSize, nemAddressBytes, transactionHashBytes, status
	}) {
		const result = await in_progress.query(
			`select optin_transaction_height as optinTransactionHeight, address as nemAddressBytes,
					hex(optin_transaction_hash) as optinTransactionHashHex, 
					payout_transaction.height as payoutTransactionHeight, 
					hex(payout_transaction_hash) as payoutTransactionHash, payout_status as payoutStatus, '' as message,
					nem_block_timestamps.timestamp as optinTimestamp, payout_transaction.timestamp as payoutTimestamp
				from optin_request
				LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = optin_request.optin_transaction_height
				LEFT JOIN payout_transaction ON payout_transaction.transaction_hash = optin_request.payout_transaction_hash
				where payout_status in (0, 1, 5) and (address = $1 or $1 is null) and (optin_transaction_hash = $2 or $2 is null)
					and (payout_status = $3 or $3 is null)
			union all
			select	optin_transaction_height as optinTransactionHeight, address as nemAddressBytes,
					hex(optin_transaction_hash) as optinTransactionHashHex,	'' as payoutTransactionHeight, '' as payoutTransactionHash, 5, 
					message, nem_block_timestamps.timestamp as optinTimestamp, null as payoutTimestamp
				from optin_error
				LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = optin_error.optin_transaction_height
				where (address = $1 or $1 is null) and (optin_transaction_hash = $2 or $2 is null) and ($3 = 5 or $3 is null)
			order by optin_transaction_height DESC
            limit ${pageSize} offset ${(pageNumber - 1) * pageSize}`,
			{ bind: [nemAddressBytes, transactionHashBytes, status], type: QueryTypes.SELECT }
		);

		return result;
	},
	async getTotalRecord({ nemAddressBytes, transactionHashBytes, status }) {
		const result = await this.getOptinRequestPagination({
			pageNumber: 1, pageSize: -1, nemAddressBytes, transactionHashBytes, status
		});
		return result.length;
	}
};

module.exports = optinRequestDB;
