const completedDB = require('../models/completed');
const { NemFacade, SymbolFacade } = require('symbol-sdk').facade;

const controller = {
	getCompleted: async (req, res) => {
		const pageSize = parseInt(req.query.pageSize || 25, 10);
		const pageNumber = parseInt(req.query.pageNumber || 1, 10);

		try {
			const totalRecord = await completedDB.getTotalRecord();

			const response = await completedDB.getCompletedPagination({ pageNumber, pageSize });

			// TODO enchance the way create an Address object from hex string, check Gimre's solution
			const result = response.map(item => ({
				...item,
				nemAddress: item.nemAddress.map(props => new NemFacade.Address(Uint8Array.from(Buffer.from(props.address, 'hex')))
					.toString()),
				nemBalance: item.nemBalance.map(props => props.balance),
				symbolAddress: item.symbolAddress.map(props => new SymbolFacade.Address(Uint8Array.from(Buffer.from(props.address, 'hex')))
					.toString()),
				symbolBalance: item.symbolBalance.map(props => props.balance)
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
