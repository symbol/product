const { in_progress } = require('./database');
const { QueryTypes } = require('sequelize');

const optinRequestDB = {
	async getOptinRequestPagination({
		pageNumber, pageSize, nemAddressBytes, transactionHashBytes, status
	}) {
		const result = await in_progress.query(
			`select	optin_transaction_height, address as nemAddressBytes, hex(optin_transaction_hash) as optinTransactionHashHex,
					payout_status as payoutStatus, '' as message
				from optin_request 
				where payout_status in (0, 1, 5) and (address = $1 or $1 is null) and (optin_transaction_hash = $2 or $2 is null) 
					and (payout_status = $3 or $3 is null)
			union all
			select	optin_transaction_height, address as nemAddressBytes, hex(optin_transaction_hash) as optinTransactionHashHex,
					5, message
				from optin_error
				where (address = $1 or $1 is null) and (optin_transaction_hash = $2 or $2 is null) and ($3 = 5 or $3 is null)
			order by optin_transaction_height DESC
            limit ${pageSize} offset ${(pageNumber - 1) * pageSize}`,
			{ bind: [nemAddressBytes, transactionHashBytes, status], type: QueryTypes.SELECT }
		);

		return result;
	},
	async getTotalRecord({ nemAddressBytes, transactionHashBytes, status }) {
		// TODO pass empty pageSize instead?
		const result = await this.getOptinRequestPagination({
			pageNumber: 1, pageSize: Number.MAX_SAFE_INTEGER, nemAddressBytes, transactionHashBytes, status
		});
		return result.length;
	}
};

module.exports = optinRequestDB;
