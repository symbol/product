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
		optinId: item.id,
		isPostoptin: item.isPostoptin,
		label: item.nemSource.map(props => props.label),
		nemAddress: item.nemSource.map(props => new NemFacade.Address(hexStringToByte(props.address))
			.toString()),
		nemBalance: item.nemSource.map(props => props.balance),
		nemHeights: item.nemSource.map(props => formatStringSplit(props.height)),
		nemHashes: item.nemSource.map(props => formatStringSplit(props.hashes)),
		nemTimestamps: item.nemSource.map(props => formatStringSplit(props.timestamps)),
		symbolAddress: item.symbolDestination.map(props => new SymbolFacade.Address(hexStringToByte(props.address))
			.toString()),
		symbolHeights: item.symbolDestination.map(props => props.height),
		symbolHashes: item.symbolDestination.map(props => props.hashes),
		symbolTimestamps: item.symbolDestination.map(props => props.timestamps),
		symbolBalance: item.symbolDestination.map(props => props.balance)
	}));

const findMaxInArray = arr => arr.reduce((m, e) => (e > m ? e : m));

const getLatestValue = items => {
	if (Array.isArray(items))
		return findMaxInArray(items.map(item => BigInt(Math.trunc(item)))).toString();
	return items ? BigInt(Math.trunc(items)).toString() : null;
};

const controller = {
	getCompleted: async (req, res) => {
		const {
			pageSize, pageNumber, optinType, nemAddress, symbolAddress, transactionHash, sortBy, sortDirection
		} = req.query;

		try {
			const nemAddressHex = nemAddress
				? byteToHexString(new NemFacade.Address(nemAddress.toUpperCase().trim()).bytes)
				: null;
			const symbolAddressHex = symbolAddress
				? byteToHexString(new SymbolFacade.Address(symbolAddress.toUpperCase().trim()).bytes)
				: null;
			const txHash = transactionHash.toUpperCase().trim();

			const totalRecord = await completedDB.getTotalRecord({
				nemAddressHex,
				symbolAddressHex,
				txHash,
				optinType: isPostOptin(optinType)
			});

			const response = await completedDB.getCompletedPagination({
				pageNumber,
				pageSize,
				nemAddressHex,
				symbolAddressHex,
				txHash,
				optinType: isPostOptin(optinType),
				sortBy,
				sortDirection
			});

			const result = processData(response);

			res.json({
				data: result,
				pagination: {
					pageNumber: parseInt(pageNumber, 10),
					pageSize: parseInt(pageSize, 10),
					totalRecord
				}
			});
		} catch (error) {
			res.json({ data: [], error: error.message });
		}
	},
	exportCsv: async (req, res) => {
		const { timezone } = req.query;

		const fields = [{
			label: '#',
			value: 'optinId'
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
					optinId: row.optinId,
					nemAddress: row.nemAddress[j] ?? '',
					label: info[j] ?? '',
					nemHeights: getLatestValue(row.nemHeights[j]),
					nemHashes: (Array.isArray(row.nemHashes[j]) ? row.nemHashes[j].join(';') : row.nemHashes[j])
						?? '(off-chain)',
					nemTimestampsUTC: convertTimestampToDate(getLatestValue(row.nemTimestamps[j])),
					nemTimestampsLocal: convertTimestampToDate(getLatestValue(row.nemTimestamps[j]), timezone),
					nemBalance: toRelativeAmount(row.nemBalance[j]) ?? '',
					symbolAddress: row.symbolAddress[j] ?? '',
					symbolHeights: getLatestValue(row.symbolHeights[j]),
					symbolHashes: row.symbolHashes[j] ?? '',
					symbolTimestampsUTC: convertTimestampToDate(getLatestValue(row.symbolTimestamps[j])),
					symbolTimestampsLocal: convertTimestampToDate(getLatestValue(row.symbolTimestamps[j]), timezone),
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
