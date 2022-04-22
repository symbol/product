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
	items.map(item => ({
		optin_id: item.id,
		isPostoptin: item.is_postoptin,
		label: item.nem_source.map(props => props.label),
		nemAddress: item.nem_source.map(props => new NemFacade.Address(hexStringToByte(props.address))
			.toString()),
		nemBalance: item.nem_source.map(props => props.balance),
		nemHeights: item.nem_source.map(props => formatStringSplit(props.height)),
		nemHashes: item.nem_source.map(props => formatStringSplit(props.hashes)),
		nemTimestamps: item.nem_source.map(props => formatStringSplit(props.timestamps)),
		symbolAddress: item.symbol_destination.map(props => new SymbolFacade.Address(hexStringToByte(props.address))
			.toString()),
		symbolHeights: item.symbol_destination.map(props => props.height),
		symbolHashes: item.symbol_destination.map(props => props.hashes),
		symbolTimestamps: item.symbol_destination.map(props => props.timestamps),
		symbolBalance: item.symbol_destination.map(props => props.balance)
	}));

const findMaxInArray = arr => arr.reduce((m, e) => (e > m ? e : m));

const getLatestTimestamps = timestamps => {
	if (Array.isArray(timestamps))
		return findMaxInArray(timestamps.map(timestamp => Number(timestamp)));
	return timestamps ? parseInt(timestamps, 10) : null;
};

const getLatestHeight = heights => {
	if (Array.isArray(heights))
		return findMaxInArray(heights.map(height => BigInt(height))).toString();
	return heights ? BigInt(heights).toString() : null;
};

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

			const totalRecord = await completedDB.getTotalRecord({
				nemAddressHex,
				symbolAddressHex,
				txHash,
				optinType
			});

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
	exportCsv: async (req, res) => {
		const timezone = req.query.tz;

		const fields = [{
			label: '#',
			value: 'optin_id'
		},
		{
			label: 'Type',
			value: 'optinType'
		},
		{
			label: 'Label',
			value: 'label'
		},
		{
			label: 'NEM Address',
			value: 'nemAddress'
		},
		{
			label: 'Hash',
			value: 'nemHashes'
		},
		{
			label: 'Height',
			value: 'nemHeights'
		},
		{
			label: 'Timestamp',
			value: 'nemTimestampsLocal'
		},
		{
			label: 'Timestamp [UTC]',
			value: 'nemTimestampsUTC'
		},
		{
			label: 'Balance',
			value: 'nemBalance'
		},
		{
			label: 'Symbol Address',
			value: 'symbolAddress'
		},
		{
			label: 'Hash',
			value: 'symbolHashes'
		},
		{
			label: 'Height',
			value: 'symbolHeights'
		},
		{
			label: 'Timestamp',
			value: 'symbolTimestampsLocal'
		},
		{
			label: 'Timestamp [UTC]',
			value: 'symbolTimestampsUTC'
		},
		{
			label: 'Balance',
			value: 'symbolBalance'
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
					nemHeights: getLatestHeight(row.nemHeights[j]),
					nemHashes: (Array.isArray(row.nemHashes[j]) ? row.nemHashes[j].join(';') : row.nemHashes[j])
						?? '(off-chain)',
					nemTimestampsUTC: convertTimestampToDate(getLatestTimestamps(row.nemTimestamps[j])),
					nemTimestampsLocal: convertTimestampToDate(getLatestTimestamps(row.nemTimestamps[j]), timezone),
					nemBalance: toRelativeAmount(row.nemBalance[j]) ?? '',
					symbolAddress: row.symbolAddress[j] ?? '',
					symbolHeights: getLatestHeight(row.symbolHeights[j]),
					symbolHashes: (Array.isArray(row.symbolHashes[j]) ? row.symbolHashes[j].join(';') : row.symbolHashes[j])
						?? '',
					symbolTimestampsUTC: convertTimestampToDate(getLatestTimestamps(row.symbolTimestamps[j])),
					symbolTimestampsLocal: convertTimestampToDate(getLatestTimestamps(row.symbolTimestamps[j]), timezone),
					symbolBalance: toRelativeAmount(row.symbolBalance[j]) ?? '',
					optinType: row.isPostoptin ? 'POST' : 'PRE'
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
