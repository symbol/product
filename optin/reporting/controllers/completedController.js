const completedDB = require('../models/completed');
const { NemFacade, SymbolFacade } = require('symbol-sdk').facade;

const controller = {
	getCompleted: async (req, res) => {
		const pageSize = parseInt(req.query.pageSize || 25, 10);
		const pageNumber = parseInt(req.query.pageNumber || 1, 10);

		try {
			const totalRecord = await completedDB.getTotalRecord();

			const response = await completedDB.getCompletedPagination({ pageNumber, pageSize });

			const result = response.map(item => ({
				...item,
				nemAddress: new NemFacade.Address(item.nemAddress).toString(),
				symbolAddress: new SymbolFacade.Address(item.symbolAddress).toString()
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
