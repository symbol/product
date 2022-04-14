const completedDB = require('../models/completed');
const {
	hexStringToByte, formatStringSplit, byteToHexString, toRelativeAmount, convertTimestampToDate
} = require('../utils/ServerUtils');
const { Parser } = require('json2csv');
const { NemFacade, SymbolFacade } = require('symbol-sdk').facade;

const isPostOptin = optinTypeFilter => {
	switch (optinTypeFilter) {
	case 'pre':
		return false;
	case 'post':
		return true;
	default:
		return null;
	}
};

const processData = items =>
	// TODO enchance the way create an Address object from hex string, check Gimre's solution
	items.map(item => ({
		optin_id: item.id,
		isPostoptin: item.is_postoptin,
		label: item.nem_source.map(props => props.label),
		nemAddress: item.nem_source.map(props => new NemFacade.Address(hexStringToByte(props.address))
			.toString()),
		nemBalance: item.nem_source.map(props => props.balance),
		nemHashes: item.nem_source.map(props => formatStringSplit(props.hashes)),
		nemTimestamps: item.nem_source.map(props => formatStringSplit(props.timestamps)),
		symbolAddress: item.symbol_destination.map(props => new SymbolFacade.Address(hexStringToByte(props.address))
			.toString()),
		symbolHashes: item.symbol_destination.map(props => formatStringSplit(props.hashes)),
		symbolTimestamps: item.symbol_destination.map(props => formatStringSplit(props.timestamps)),
		symbolBalance: item.symbol_destination.map(props => props.balance)
	}));

const getLatestTimestamps = timestamps => (Array.isArray(timestamps) ? timestamps.sort((a, b) => b - a)[0] : timestamps);

const controller = {
	getCompleted: async (req, res) => {
		const pageSize = parseInt(req.query.pageSize || 1000, 10);
		const pageNumber = parseInt(req.query.pageNumber || 1, 10);
		const optinType = isPostOptin(req.query.optinType);
		const { nemAddress, symbolAddress, transactionHash } = req.query;

		try {
			const nemAddressHex = nemAddress
				? byteToHexString(new NemFacade.Address(nemAddress.toUpperCase().trim()).bytes)
				: null;
			const symbolAddressHex = symbolAddress
				? byteToHexString(new SymbolFacade.Address(symbolAddress.toUpperCase().trim()).bytes)
				: null;
			const txHash = transactionHash.toUpperCase().trim() ?? null;

			const totalRecord = await completedDB.getTotalRecord();

			const response = await completedDB.getCompletedPagination({
				pageNumber,
				pageSize,
				nemAddressHex,
				symbolAddressHex,
				txHash,
				optinType
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
		const fields = [{
			label: '#',
			value: 'optin_id'
		},
		{
			label: 'NEM Address',
			value: 'nemAddress'
		},
		{
			label: 'Info',
			value: 'label'
		},
		{
			label: 'Hash',
			value: 'nemHashes'
		},
		{
			label: 'Balance',
			value: 'nemBalance'
		},
		{
			label: 'Timestamp',
			value: 'nemTimestamps'
		},
		{
			label: 'Symbol Address',
			value: 'symbolAddress'
		},
		{
			label: 'Hash',
			value: 'symbolHashes'
		}, {
			label: 'Balance',
			value: 'symbolBalance'
		},
		{
			label: 'Timestamp',
			value: 'symbolTimestamps'
		},
		{
			label: 'Opt-in Type',
			value: 'optinType'
		}];

		const response = await completedDB.getCompletedPagination({
			pageNumber: 1,
			pageSize: -1,
			nemAddressHex: null,
			symbolAddressHex: null,
			txHash: null,
			optinType: null
		});

		const result = processData(response);

		const csvFormat = [];

		for (let i = 0; i <= result.length - 1; ++i) {
			const row = result[i];
			const numberOfNemAddress = row.nemAddress.length;
			const numberOfSymbolAddress = row.symbolAddress.length;

			const buildCsvRow = Math.max(numberOfNemAddress, numberOfSymbolAddress);

			for (let j = 0; j < buildCsvRow; j++) {
				const info = [...new Set(row.label)];

				csvFormat.push({
					optin_id: row.optin_id,
					nemAddress: row.nemAddress[j] ?? '',
					label: info[j] ?? '',
					nemHashes: (Array.isArray(row.nemHashes[j]) ? row.nemHashes[j].join(';') : row.nemHashes[j])
						?? '(off-chain)',
					nemTimestamps: convertTimestampToDate('Nem', getLatestTimestamps(row.nemTimestamps[j]) ?? null),
					nemBalance: toRelativeAmount(row.nemBalance[j]) || '',
					symbolAddress: row.symbolAddress[j] ?? '',
					symbolHashes: (Array.isArray(row.symbolHashes[j]) ? row.symbolHashes[j].join(';') : row.symbolHashes[j])
						?? '(off-chain)',
					symbolTimestamps: convertTimestampToDate('Symbol', getLatestTimestamps(row.symbolTimestamps[j]) ?? null),
					symbolBalance: toRelativeAmount(row.symbolBalance[j]) || '',
					optinType: row.isPostoptin ? 'Post-launch' : 'Pre-launch'
				});
			}
		}

		const json2csv = new Parser({ fields });
		const csv = json2csv.parse(csvFormat);

		res.header('Content-Type', 'text/csv');
		res.attachment('completed.csv');

		res.send(csv);
	}
};

module.exports = controller;
