const completedDB = require('../models/completed');
const { hexStringToByte, formatStringSplit } = require('../utils/ServerUtils');
const { NemFacade, SymbolFacade } = require('symbol-sdk').facade;

const controller = {
	getCompleted: async (req, res) => {
		const pageSize = parseInt(req.query.pageSize || 1000, 10);
		const pageNumber = parseInt(req.query.pageNumber || 1, 10);

		try {
			const totalRecord = await completedDB.getTotalRecord();

			const response = await completedDB.getCompletedPagination({ pageNumber, pageSize });

			// TODO enchance the way create an Address object from hex string, check Gimre's solution
			const result = response.map(item => ({
				optin_id: item.id,
				isPostoptin: item.is_postoptin,
				label: item.nem_source.map(props => props.label),
				nemAddress: item.nem_source.map(props => new NemFacade.Address(hexStringToByte(props.address))
					.toString()),
				nemBalance: item.nem_source.map(props => props.balance),
				nemHashes: item.nem_source.map(props => formatStringSplit(props.hashes)),
				symbolAddress: item.symbol_destination.map(props => new SymbolFacade.Address(hexStringToByte(props.address))
					.toString()),
				symbolHashes: item.symbol_destination.map(props => formatStringSplit(props.hashes)),
				symbolBalance: item.symbol_destination.map(props => props.balance)
			}));

			res.json({
				data: result,
				pagination: {
					pageNumber,
					pageSize,
					totalRecord
				}
			});
		} catch (error) {
			res.json({ data: [], error: error.message });
		}
	}
};

module.exports = controller;
