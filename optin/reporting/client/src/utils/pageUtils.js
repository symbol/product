import Helper from './helper';
import PopUpDialog from '../components/PopUpDialog';
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

	const buildTransactionHashLink = (key, item) => {
		return (
			<a href={config.keyRedirects[key] + item.toLowerCase()}
				target="_blank"
				rel="noreferrer">
				{Helper.truncString(item.toLowerCase())}
			</a>
		);
	};

	return (
		<React.Fragment>
			{
				list.map(hash =>
					<div>
						{
							null !== hash ?
								Array.isArray(hash) ?
									( <PopUpDialog title="Multiple Transactions"
										content={
											hash.map(item =>
												<div>
													{ buildTransactionHashLink(key, item) }
												</div>)
										} />)
									: buildTransactionHashLink(key, hash)

								: '(off chain)'
						}
					</div>)
			}
		</React.Fragment>
	);
};

export const optinTypeTemplate = (rowData, key) => {
	const isPostoptin = rowData[key] ? 'Post-launch' : 'Pre-launch';
	return (<div> { isPostoptin } </div>);
};

export const infoTemplate = (rowData, key) => {
	const labels = Array.isArray(rowData[key]) ? [...new Set(rowData[key])] : [rowData[key]];

	return (
		labels.map(info =>
			<div>
				{ info }
			</div>)
	);
};
