const { balances } = require('./database');
const { QueryTypes } = require('sequelize');

const balancesDB = {
	getBalancesPagination: async ({ pageNumber, pageSize }) => {
		const result = await balances.query(
			`select address as nemAddress, balance as nemBalance
            from snapshot_balances
            LIMIT ${pageSize} OFFSET ${(pageNumber - 1) * pageSize}`,
			{ type: QueryTypes.SELECT }
		);

		return result;
	},
	getTotalRecord: async () => {
		const result = await balances.query(
			`select count(*) as totalRecord
            from snapshot_balances`,
			{ type: QueryTypes.SELECT }
		);

		return result[0].totalRecord;
	}
};

module.exports = balancesDB;
