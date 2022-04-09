const { completed } = require('./database');
const { QueryTypes } = require('sequelize');

const completedDB = {
	getCompletedPagination: async ({
		pageNumber, pageSize, nemAddressHex, symbolAddressHex, txHash, optinType
	}) => {
		let condition = '';

		if (nemAddressHex)
			condition += `AND (nem_source LIKE '%${nemAddressHex}%')`;

		if (symbolAddressHex)
			condition += `AND (symbol_destination LIKE '%${symbolAddressHex}%')`;

		if (txHash)
			condition += `AND (nem_source LIKE '%${txHash}%' OR symbol_destination LIKE '%${txHash}%')`;

		const result = await completed.query(
			`SELECT
				opt.id,
				opt.is_postoptin,
				(SELECT json_group_array(nem_address_object)
					FROM (
						SELECT json_object(
						'address', hex(nem_source.address),
						'balance', nem_source.balance,
						'hashes', GROUP_CONCAT(CASE WHEN nem_transaction.hash IS NULL THEN NULL ELSE hex(nem_transaction.hash) END, ';'),
						'height', GROUP_CONCAT(CASE WHEN nem_transaction.height IS NULL THEN NULL ELSE nem_transaction.height END, ';'),
						'label', nem_label.label
					) as nem_address_object
					FROM nem_source
					LEFT JOIN nem_transaction ON nem_transaction.address = nem_source.address
					LEFT JOIN nem_label ON nem_label.address = nem_source.address
					where optin_id = opt.id
					GROUP BY nem_source.address, nem_source.balance
					) temp
				) AS nem_source,
				(SELECT json_group_array(json_object('address', hex(address), 'balance', balance, 'hashes', hash, 'height', height))
				FROM symbol_destination
				WHERE optin_id = opt.id
				) AS symbol_destination
			FROM optin_id opt
			WHERE (is_postoptin = $1 OR $1 is null) ${condition}
            LIMIT ${pageSize} OFFSET ${(pageNumber - 1) * pageSize}`,
			{
				bind: [optinType],
				type: QueryTypes.SELECT
			}
		);

		return result.map(item => ({
			...item,
			nem_source: JSON.parse(item.nem_source),
			symbol_destination: JSON.parse(item.symbol_destination)
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
