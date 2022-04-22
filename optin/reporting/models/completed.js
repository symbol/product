const getDatabase = require('./database');
const { QueryTypes } = require('sequelize');

const completedDB = {
	async getCompletedPagination({
		pageNumber, pageSize, nemAddressHex, symbolAddressHex, txHash, optinType
	}) {
		let condition = '';

		if (nemAddressHex)
			condition += `AND (nem_source LIKE '%${nemAddressHex}%')`;

		if (symbolAddressHex)
			condition += `AND (symbol_destination LIKE '%${symbolAddressHex}%')`;

		if (txHash)
			condition += `AND (nem_source LIKE '%${txHash}%' OR symbol_destination LIKE '%${txHash}%')`;

		const { completed } = getDatabase();
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
						'label', nem_label.label,
						'timestamps', GROUP_CONCAT(
							CASE WHEN nem_block_timestamps.timestamp IS NULL THEN NULL ELSE nem_block_timestamps.timestamp END, ';')
					) as nem_address_object
					FROM nem_source
					LEFT JOIN nem_transaction ON nem_transaction.address = nem_source.address
					LEFT JOIN nem_label ON nem_label.address = nem_source.address
					LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = nem_transaction.height
					where optin_id = opt.id
					GROUP BY nem_source.address, nem_source.balance
					) temp
				) AS nem_source,
				(
					SELECT json_group_array(
						json_object(
							'address', hex(address),
							'balance', balance,
							'hashes', hex(hash),
							'height', height,
							'timestamps',timestamp)
					)
					FROM symbol_destination
					WHERE optin_id = opt.id
				) AS symbol_destination
			FROM optin_id opt
			WHERE (is_postoptin = $1 OR $1 is null) ${condition}
			Order by id DESC
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
	async getTotalRecord({
		nemAddressHex, symbolAddressHex, txHash, optinType
	}) {
		const result = await this.getCompletedPagination({
			pageNumber: 1, pageSize: -1, nemAddressHex, symbolAddressHex, txHash, optinType
		});

		return result.length;
	}
};

module.exports = completedDB;
