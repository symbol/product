const getDatabase = require('./database');
const { QueryTypes } = require('sequelize');

const completedDB = {
	async getCompletedPagination({
		pageNumber, pageSize, nemAddressHex, symbolAddressHex, txHash, optinType, sortBy, sortDirection
	}) {
		// set default sort
		let fieldSort = 'Order by id DESC';

		if (sortBy && sortDirection && 'none' !== sortDirection) {
			if ('nemHashes' === sortBy)
				fieldSort = `order by nemTimestamp ${sortDirection}`;
			else if ('symbolHashes' === sortBy)
				fieldSort = `order by symbolTimestamp ${sortDirection}`;
		}

		const bindLike = value => (value ? `%${value}%` : null);

		const offset = (pageNumber - 1) * pageSize;

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
				) AS nemSource,
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
				) AS symbolDestination,
				(
					SELECT max(timestamp)
					FROM nem_source
					LEFT JOIN nem_transaction ON nem_transaction.address = nem_source.address
					LEFT JOIN nem_block_timestamps ON nem_block_timestamps.height = nem_transaction.height
					where optin_id = opt.id
				) as nemTimestamp,
				(
					SELECT max(timestamp)
					FROM symbol_destination
					where optin_id = opt.id
				) as symbolTimestamp
			FROM optin_id opt
			WHERE (is_postoptin = $1 OR $1 is null)
				AND (nemSource Like $2 or $2 is null)
				AND (symbolDestination Like $3 or $3 is null)
				AND ((nemSource Like $4 OR symbolDestination Like $4) or $4 is null)
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
