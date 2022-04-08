const optinRequestDB = require('../models/optinRequests');
const ServerUtils = require('../utils/ServerUtils');
const { Parser } = require('json2csv');
const { NemFacade } = require('symbol-sdk').facade;

const processData = items => {
	// TODO convert these to mappings?
	const statusIntToString = statusInt => {
		switch (statusInt) {
		case 0:
			return 'Pending';
		case 1:
			return 'Sent';
		case 5:
			return 'Error';
		default:
			return 'Unknown';
		}
	};

	return items.map(item => ({
		optinTransactionHeight: item.optinTransactionHeight,
		nemAddress: new NemFacade.Address(item.nemAddressBytes).toString(),
		optinTransactionHash: item.optinTransactionHashHex?.toLowerCase(),
		payoutTransactionHash: item.payoutTransactionHash?.toLowerCase(),
		status: statusIntToString(item.payoutStatus),
		message: item.message
	}));
};

const controller = {
	getOptinRequests: async (req, res) => {
		const pageSize = parseInt(req.query.pageSize || 25, 10);
		const pageNumber = parseInt(req.query.pageNumber || 1, 10);
		const nemAddressBase32 = req.query.nemAddress;
		const statusFilter = req.query.status;
		const transactionHashHex = req.query.transactionHash;

		const statusStringToInt = statusString => {
			switch (statusString) {
			case 'Pending':
				return 0;
			case 'Sent':
				return 1;
			case 'Error':
				return 5;
			default:
				return null;
			}
		};

		const status = statusStringToInt(statusFilter);

		try {
			const nemAddressBytes = nemAddressBase32 ? new NemFacade.Address(nemAddressBase32).bytes : null;
			const transactionHashBytes = transactionHashHex ? ServerUtils.hexStringToByte(transactionHashHex) : null;
			const totalRecord = await optinRequestDB.getTotalRecord({ nemAddressBytes, transactionHashBytes, status });

			const response = await optinRequestDB.getOptinRequestPagination({
				pageNumber, pageSize, nemAddressBytes, transactionHashBytes, status
			});

			const result = processData(response);

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
	},
	exportCsv: async (_, res) => {
		const response = await optinRequestDB.getOptinRequestPagination({
			pageNumber: 1,
			pageSize: -1,
			nemAddressBytes: null,
			transactionHashBytes: null,
			status: null
		});

		const result = processData(response);

		const fields = [{
			label: 'Nem Address',
			value: 'nemAddress'
		}, {
			label: 'Status',
			value: 'status'
		}, {
			label: 'Hash',
			value: 'optinTransactionHash'
		}, {
			label: 'Message',
			value: 'message'
		}];

		const json2csv = new Parser({ fields });
		const csv = json2csv.parse(result);

		res.header('Content-Type', 'text/csv');
		res.attachment('request.csv');

		res.send(csv);
	}
};

module.exports = controller;
