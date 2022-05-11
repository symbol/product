import Address from '../components/Address';
import Balance from '../components/Balance';
import DateTransacationHash from '../components/DateTransacationHash';
import React from 'react';

export const addressTemplate = (rowData, key, config) => {
	const addresses = Array.isArray(rowData[key]) ? [...rowData[key]] : [rowData[key]];
	if (1 < addresses.length)
		addresses.push('');
	return <Address values={addresses} linkBaseUrl={config.keyRedirects[key] || ''} />;
};

export const balanceTemplate = (rowData, key, renderTotal = true) => {
	const balances = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];
	return <Balance values={balances} renderTotal={renderTotal}/>;
};

export const dateTransactionHashTemplate = (rowData, key, timestampKey, config) => {
	const hashes = Array.isArray(rowData[key]) ? rowData[key].flat(Infinity) : [rowData[key]];
	const timestamps = Array.isArray(rowData[timestampKey]) ? rowData[timestampKey].flat(Infinity) : [rowData[timestampKey]];

	return <DateTransacationHash values={hashes} timestamps={timestamps} linkBaseUrl={config.keyRedirects[key] || ''} />;
};
