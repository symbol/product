import Helper from './helper';
import React from 'react';

export const addressTemplate = (rowData, key, config) => {
	const single = address => (<div>
		<a href={config.keyRedirects[key] + address} target="_blank" rel="noreferrer">
			{address}
		</a>
	</div>);
	return (
		<React.Fragment>
			{
				Array.isArray(rowData[key]) ? rowData[key].map(address => single(address)) : single(rowData[key])
			}
			<React.Fragment>
				{renderTotalText(rowData[key])}
			</React.Fragment>
		</React.Fragment>
	);
};

export const balanceTemplate = (rowData, key) => {
	const list = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];

	return (
		<React.Fragment>
			{
				list.map(balance => 
					<div>
						{Helper.toRelativeAmount(balance).toLocaleString('en-US', { minimumFractionDigits: 6 })}
					</div>)
			}
			<React.Fragment>
				{renderTotalValue(rowData[key])}
			</React.Fragment>
		</React.Fragment>
	);
};


export const renderTotalText = values => {
	if (!Array.isArray(values) || 2 > values.length)
		return null;

	return (<div className="sub-total-text">Total:</div>);
    
};

export const renderTotalValue = values => {
	if (!Array.isArray(values) || 2 > values.length)
		return null;

	const total = values.reduce((value, currentValue) => value + currentValue, 0);
	const formattedValue = Helper.toRelativeAmount(total).toLocaleString('en-US', { minimumFractionDigits: 6 });
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