const getDatabase = require('./database');
const { QueryTypes } = require('sequelize');

const completedDB = {
	async getCompletedPagination({
		pageNumber, pageSize, nemAddressHex, symbolAddressHex, txHash, optinType, sortBy, sortDirection
	}) {
		// set default sort
		let fieldSort = 'ORDER BY id DESC';

		if (sortBy && sortDirection && 'none' !== sortDirection) {
			if ('nemHashes' === sortBy)
				fieldSort = `ORDER BY nemTimestamp ${sortDirection}`;
			else if ('symbolHashes' === sortBy)
				fieldSort = `ORDER BY symbolTimestamp ${sortDirection}`;
		}

		const bindLike = value => (value ? `%${value}%` : null);

		const offset = (pageNumber - 1) * pageSize;

		const { completed } = getDatabase();
		const result = await completed.query(
			`SELECT
				opt.id,
				opt.is_postoptin,
				(SELECT JSON_GROUP_ARRAY(nem_address_object)
					FROM (
						SELECT JSON_OBJECT(
						'address', HEX(nem_source.address),
						'balance', nem_source.balance,
						'hashes', GROUP_CONCAT(CASE WHEN nem_transaction.hash IS NULL THEN NULL ELSE HEX(nem_transaction.hash) END, ';'),
						'height', GROUP_CONCAT(CASE WHEN nem_transaction.height IS NULL THEN NULL ELSE nem_transaction.height END, ';'),
						'label', nem_label.label,
						'timestamps', GROUP_CONCAT(
							CASE WHEN nem_block_timestamps.timestamp IS NULL THEN NULL ELSE nem_block_timestamps.timestamp END, ';')
					) AS nem_address_object
					FROM nem_source
					LEFT JOIN nem_transaction ON nem_transaction.address = nem_source.address
					LEFT JOIN nem_label ON nem_label.address = nem_source.address
					LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = nem_transaction.height
					WHERE optin_id = opt.id
					GROUP BY nem_source.address, nem_source.balance) temp
				) AS nemSource,
				(
					SELECT JSON_GROUP_ARRAY(
						JSON_OBJECT(
							'address', HEX(address),
							'balance', balance,
							'hashes', HEX(hash),
							'height', height,
							'timestamps',timestamp)
					)
					FROM symbol_destination
					WHERE optin_id = opt.id
				) AS symbolDestination,
				(
					SELECT MAX(timestamp)
					FROM nem_source
					LEFT JOIN nem_transaction ON nem_transaction.address = nem_source.address
					LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = nem_transaction.height
					WHERE optin_id = opt.id
				) AS nemTimestamp,
				(
					SELECT MAX(timestamp)
					FROM symbol_destination
					WHERE optin_id = opt.id
				) AS symbolTimestamp
			FROM optin_id opt
			WHERE (is_postoptin = $1 OR $1 IS NULL)
				AND (nemSource LIKE $2 OR $2 IS NULL)
				AND (symbolDestination LIKE $3 OR $3 IS NULL)
				AND ((nemSource LIKE $4 OR symbolDestination LIKE $4) OR $4 IS NULL)
			${fieldSort}
			LIMIT $5 OFFSET $6`,
			{
				bind: [
					optinType,
					bindLike(nemAddressHex),
					bindLike(symbolAddressHex),
					bindLike(txHash),
					pageSize,
					offset
				],
				type: QueryTypes.SELECT
			}
		);

		return result.map(item => ({
			...item,
			nemSource: JSON.parse(item.nemSource),
			symbolDestination: JSON.parse(item.symbolDestination)
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
