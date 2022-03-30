const { completed } = require('./database');
const { QueryTypes } = require('sequelize');

const completedDB = {
	getCompletedPagination: async ({ pageNumber, pageSize }) => {
		const result = await completed.query(
			`select optin_id.id, nem.address as nemAddress, nem.balance as nemBalance,
            symbol.address as symbolAddress, symbol.balance as symbolBalance
            from optin_id
            join nem_source as nem on optin_id.id = nem.optin_id
            join symbol_destination as symbol on optin_id.id = symbol.optin_id
            ORDER BY optin_id.id
            LIMIT ${pageSize} OFFSET ${(pageNumber - 1) * pageSize}`,
			{ type: QueryTypes.SELECT }
		);

		return result;
	},
	getTotalRecord: async () => {
		const result = await completed.query(
			`select count(*) as totalRecord
            from optin_id
            join nem_source as nem on optin_id.id = nem.optin_id
            join symbol_destination as symbol on optin_id.id = symbol.optin_id`,
			{ type: QueryTypes.SELECT }
		);

		return result[0].totalRecord;
	}
};

module.exports = completedDB;
