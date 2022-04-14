import Helper from './helper';
import ResponsiveText from '../components/ResponsiveText';
import {Button} from 'primereact/button';
import React from 'react';

const copyButton = value => {
	const onCopyHandler = () => {
		Helper.copyToClipboard(value);
	};
	if (!value)
		return undefined;
	return (
		<React.Fragment>
			<Button icon="pi pi-copy" className="p-button-text copy-button"
				tooltip='Copy' onClick={onCopyHandler} />
		</React.Fragment>
	);
};
export const addressTemplate = (rowData, key, config) => {
	const list = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];
	return (
		<React.Fragment>
			<div>
				{
					list.map(address => <div className='flex flex-row list-item'>
						<a href={config.keyRedirects[key] + address} target="_blank" rel="noreferrer">
							<ResponsiveText value={address} />
						</a>
						{copyButton(address)}
					</div>)
				}
			</div>
		</React.Fragment>
	);
};

export const balanceTemplate = (rowData, key, renderTotal = true) => {
	const list = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];

	return (
		<React.Fragment>
			{
				list.map(balance =>
					<div className='list-item'>
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
			<div className='flex flex-row list-item'>
				<a href={config.keyRedirects[key] + item.toLowerCase()}
					target="_blank"
					rel="noreferrer">
					<ResponsiveText value={item.toLowerCase()} />
				</a>
				{copyButton(item.toLowerCase())}
			</div>
		);
	};

	return (
		<React.Fragment>
			{
				list.flat(Infinity).map(hash =>
					<div>
						{
							null !== hash
								? buildTransactionHashLink(key, hash)
								: '(off chain)'
						}
					</div>)
			}
			<React.Fragment>
				{ 1 < list.flat(Infinity).length && <div className='list-item' />}
			</React.Fragment>
		</React.Fragment>
	);
};

export const optinTypeTemplate = (rowData, key) => {
	const isPostoptin = rowData[key] ? 'Post-launch' : 'Pre-launch';

	const badgeType = 'Post-launch' === isPostoptin ? 'info' : '';
	const badgeClass = `p-badge p-badge-${badgeType}`;

	return (<div> <span className={badgeClass}>{isPostoptin}</span> </div>);
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
