const snapshotBalances = require('../models/snapshotBalances');
const { NemFacade } = require('symbol-sdk').facade;

const controller = {
	balances: async (_, res) => {
		const response = await snapshotBalances.findAll()
			.then(data => {
				const result = data.map(item => ({
					...item.dataValues,
					address: new NemFacade.Address(item.dataValues.address).toString()
				}));

				return { success: true, data: result };
			})
			.catch(error => ({ success: false, error }));

		res.json(response);
	}
};

module.exports = controller;
