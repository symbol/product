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
		case 3:
			return 'Duplicate';
		case 4:
			return 'Error';
		default:
			return 'Unknown';
		}
	};

	return items.map(item => ({
		optinTransactionHeight: item.optinTransactionHeight,
		nemAddress: new NemFacade.Address(item.nemAddressBytes).toString(),
		optinTransactionHash: item.optinTransactionHashHex?.toLowerCase(),
		payoutTransactionHeight: item.payoutTransactionHeight,
		payoutTransactionHash: item.payoutTransactionHash?.toLowerCase(),
		status: statusIntToString(item.payoutStatus),
		message: item.message,
		optinTimestamp: item.optinTimestamp,
		payoutTimestamp: item.payoutTimestamp
	}));
};

const controller = {
	getOptinRequests: async (req, res) => {
		const pageSize = parseInt(req.query.pageSize || 100, 10);
		const pageNumber = parseInt(req.query.pageNumber || 1, 10);
		const nemAddressBase32 = req.query.nemAddress;
		const statusFilter = req.query.status;
		const transactionHashHex = req.query.transactionHash;
		const { sortBy, sortDirection } = req.query;

		const statusStringToInt = statusString => {
			switch (statusString) {
			case 'pending':
				return 0;
			case 'sent':
				return 1;
			case 'duplicate':
				return 3;
			case 'error':
				return 4;
			default:
				return null;
			}
		};

		const status = statusStringToInt(statusFilter.toLowerCase());

		try {
			const nemAddressBytes = nemAddressBase32 ? new NemFacade.Address(nemAddressBase32.toUpperCase().trim()).bytes : null;
			const transactionHashBytes = transactionHashHex ? ServerUtils.hexStringToByte(transactionHashHex.toUpperCase().trim()) : null;
			const totalRecord = await optinRequestDB.getTotalRecord({ nemAddressBytes, transactionHashBytes, status });

			const response = await optinRequestDB.getOptinRequestPagination({
				pageNumber, pageSize, nemAddressBytes, transactionHashBytes, status, sortBy, sortDirection
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
	exportCsv: async (req, res) => {
		const timezone = req.query.tz;

		const response = await optinRequestDB.getOptinRequestPagination({
			pageNumber: 1,
			pageSize: -1,
			nemAddressBytes: null,
			transactionHashBytes: null,
			status: null
		});

		const result = processData(response);

		const csvFormat = result.map(item => ({
			optinTransactionHeight: item.optinTransactionHeight,
			nemAddress: item.nemAddress,
			optinTransactionHash: item.optinTransactionHash,
			payoutTransactionHeight: item.payoutTransactionHeight,
			payoutTransactionHash: item.payoutTransactionHash,
			status: item.status,
			message: item.message,
			optinTimestampLocal: ServerUtils.convertTimestampToDate(item.optinTimestamp, timezone),
			optinTimestampUTC: ServerUtils.convertTimestampToDate(item.optinTimestamp),
			payoutTimestampLocal: ServerUtils.convertTimestampToDate(item.payoutTimestamp, timezone),
			payoutTimestampUTC: ServerUtils.convertTimestampToDate(item.payoutTimestamp)
		}));

		const fields = [{
			label: 'Nem Address',
			value: 'nemAddress'
		}, {
			label: 'Opt-in Hash',
			value: 'optinTransactionHash'
		}, {
			label: 'Opt-in Height',
			value: 'optinTransactionHeight'
		},
		{
			label: 'Timestamp',
			value: 'optinTimestampLocal'
		}, {
			label: 'Timestamp [UTC]',
			value: 'optinTimestampUTC'
		}, {
			label: 'Payout Hash',
			value: 'payoutTransactionHash'
		}, {
			label: 'Payout Height',
			value: 'payoutTransactionHeight'
		}, {
			label: 'Timestamp',
			value: 'payoutTimestampLocal'
		}, {
			label: 'Timestamp [UTC]',
			value: 'payoutTimestampUTC'
		}, {
			label: 'Status',
			value: 'status'
		}, {
			label: 'Message',
			value: 'message'
		}];

		const json2csv = new Parser({ fields });
		const csv = json2csv.parse(csvFormat);

		res.header('Content-Type', 'text/csv');
		res.attachment('request.csv');

		res.send(csv);
	}
};

module.exports = controller;
