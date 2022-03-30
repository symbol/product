const balancesDB = require('../models/snapshotBalances');
const { NemFacade } = require('symbol-sdk').facade;

const controller = {
	getBalance: async (req, res) => {
		const pageSize = parseInt(req.query.pageSize || 25, 10);
		const pageNumber = parseInt(req.query.pageNumber || 1, 10);

		try {
			const totalRecord = await balancesDB.getTotalRecord();

			const response = await balancesDB.getBalancesPagination({ pageNumber, pageSize });

			const result = response.map(item => ({
				...item,
				nemAddress: new NemFacade.Address(item.nemAddress).toString()
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
