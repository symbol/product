const snapshotBalances = require('../models/snapshotBalances')
const { NemFacade } = require('symbol-sdk').facade;

const controller = {
    balances: async (req,res) => {
        const response = await snapshotBalances.findAll()
        .then((data) => {
          const result = data.map((item) => ({
              ...item.dataValues,
              address: new NemFacade.Address(item.dataValues.address).toString(),
          }))

          const res = { success: true, data: result }
          return res;
        })
        .catch(error =>{
          const res = { success: false, error }
          return res;
        })

        res.json(response);
      },
}

module.exports = controller;
