import Helper from './helper';
import React from 'react';

export const addressTemplate = (rowData, key, config) => {
	const list = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];
	return (
		<React.Fragment>
			{
				list.map(address => <div>
					<a href={config.keyRedirects[key] + address} target="_blank" rel="noreferrer">
						{address}
					</a>
				</div>)
			}
		</React.Fragment>
	);
};

export const balanceTemplate = (rowData, key, renderTotal = true) => {
	const list = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];

	return (
		<React.Fragment>
			{
				list.map(balance =>
					<div>
						{Helper.toRelativeAmount(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
					</div>)
			}
			<React.Fragment>
				{renderTotal && renderTotalValue(rowData[key])}
			</React.Fragment>
		</React.Fragment>
	);
};

export const renderTotalValue = values => {
	if (!Array.isArray(values) || 2 > values.length)
		return null;

	const total = values.reduce((value, currentValue) => value + currentValue, 0);
	const formattedValue = Helper.toRelativeAmount(total).toLocaleString('en-US', { minimumFractionDigits: 2 });
	return (<div className="sub-total-value">{formattedValue}</div>);

};

export const transactionHashTemplate = (rowData, key, config) => {
	const list = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];
	return (
		<React.Fragment>
			{
				list.map(address => 
					<div>
						<a href={config.keyRedirects[key] + address.toLowerCase()} target="_blank" rel="noreferrer">
							{address.toLowerCase()}
						</a>
					</div>)
			}
		</React.Fragment>
	);
};