const { in_progress } = require('./database');
const { QueryTypes } = require('sequelize');

const optinRequestDB = {
	getOptinRequestPagination: async ({ pageNumber, pageSize, nemAddressBytes }) => {
		const result = await in_progress.query(
			`select	optin_transaction_height, address as nemAddressBytes, hex(optin_transaction_hash) as optinTransactionHashHex,
					payout_status as payoutStatus, '' as message
				from optin_request 
				where payout_status in (0, 1, 5) and (address = $1 or $1 is null)
			union all
			select	optin_transaction_height, address as nemAddressBytes, hex(optin_transaction_hash) as optinTransactionHashHex,
					5, message
				from optin_error
				where address = $1 or $1 is null
			order by optin_transaction_height DESC
            limit ${pageSize} offset ${(pageNumber - 1) * pageSize}`,
			{ bind: [nemAddressBytes], type: QueryTypes.SELECT }
		);

		return result;
	},
	getTotalRecord: async () => {
		const result = await in_progress.query(
			`select count(*) as totalRecord
            from optin_request`,
			{ type: QueryTypes.SELECT }
		);

		return result[0].totalRecord;
	}
};

module.exports = optinRequestDB;
