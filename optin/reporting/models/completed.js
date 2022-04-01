const { completed } = require('./database');
const { QueryTypes } = require('sequelize');

const completedDB = {
	getCompletedPagination: async ({ pageNumber, pageSize }) => {
		const result = await completed.query(
			`SELECT opt.id as optin_id,
			(SELECT json_group_array(json_object('address', hex(address)))
			 FROM nem_source
			 WHERE optin_id = opt.id
			) AS nemAddress,
			(SELECT json_group_array(json_object('balance', balance))
			 FROM nem_source
			 WHERE optin_id = opt.id
			) AS nemBalance,
			(SELECT json_group_array(json_object('address', hex(address)))
			 FROM symbol_destination
			 WHERE optin_id = opt.id
			) AS symbolAddress,
			(SELECT json_group_array(json_object('balance', balance))
			 FROM symbol_destination
			 WHERE optin_id = opt.id
			) AS symbolBalance
		  	FROM optin_id opt
            LIMIT ${pageSize} OFFSET ${(pageNumber - 1) * pageSize}`,
			{ type: QueryTypes.SELECT }
		);

		return result.map(item => ({
			...item,
			nemAddress: JSON.parse(item.nemAddress),
			nemBalance: JSON.parse(item.nemBalance),
			symbolAddress: JSON.parse(item.symbolAddress),
			symbolBalance: JSON.parse(item.symbolBalance)
		}));
	},
	getTotalRecord: async () => {
		const result = await completed.query(
			`select count(*) as totalRecord
            from optin_id`,
			{ type: QueryTypes.SELECT }
		);

		return result[0].totalRecord;
	}
};

module.exports = completedDB;
