import Helper from './helper';
import ResponsiveList from '../components/ResponsiveList';
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
			<Button icon="pi pi-copy" className="p-button-text copy-button" onClick={onCopyHandler} />
		</React.Fragment>
	);
};
export const addressTemplate = (rowData, key, config, fixResponsiveText=false) => {
	const list = Array.isArray(rowData[key]) ? [...rowData[key]] : [rowData[key]];
	if (1 < list.length)
		list.push('');
	return (
		<ResponsiveList title="Address List">
			{
				list.map(address => <div className='flex flex-row list-item'>
					<a href={config.keyRedirects[key] + address} target="_blank" rel="noreferrer">
						<ResponsiveText value={address} isFixLength={fixResponsiveText} />
					</a>
					{copyButton(address)}
				</div>)
			}
		</ResponsiveList>
	);
};

export const balanceTemplate = (rowData, key, renderTotal = true) => {
	const list = Array.isArray(rowData[key]) ? rowData[key] : [rowData[key]];

	const resultList = list.map(balance =>
		<div className='list-item'>
			{Helper.toRelativeAmount(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
		</div>);
	if (renderTotal) {
		const total = renderTotalValue(rowData[key]);
		if (total)
			resultList.push(total);
	}

	return (
		<ResponsiveList visible={resultList[resultList.length - 1]} title="Balance List">
			{ resultList }
		</ResponsiveList>
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
	const resultList = list.flat(Infinity).map(hash =>
		<div>
			{
				null !== hash
					? buildTransactionHashLink(key, hash)
					: '(off chain)'
			}
		</div>);
	if (1 < resultList.length)
		resultList.push(<div className='list-item' />);

	return (
		<ResponsiveList title="Hash List">
			{resultList}
		</ResponsiveList>
	);
};

export const dateTransactionHashTemplate = (rowData, key, timestampKey, config, fixResponsiveText=false) => {
	const list = Array.isArray(rowData[key]) ? rowData[key].flat(Infinity) : [rowData[key]];
	const timestamps = Array.isArray(rowData[timestampKey]) ? rowData[timestampKey].flat(Infinity) : [rowData[timestampKey]];

	const buildTransactionHashLink = (key, item, date) => {
		return (
			<div className='flex flex-row list-item'>
				{
					(item) ? (
						<>
							<span className='timestamp'> {date} |</span>
							<a href={config.keyRedirects[key] + item.toLowerCase()}
								target="_blank"
								rel="noreferrer">
								<ResponsiveText value={item.toLowerCase()} isFixLength={fixResponsiveText} />
							</a>
							{copyButton(item.toLowerCase())}
						</>
					) : null
				}
			</div>
		);
	};

	const resultList = list.map((hash, index) =>
		<div>
			{
				null !== hash
					? buildTransactionHashLink(key, hash, Helper.convertTimestampToDate(timestamps[index], true))
					: '(off chain)'
			}
		</div>);
	if (1 < resultList.length)
		resultList.push(<div className='list-item' />);

	return (
		<ResponsiveList title="Hash List">
			{resultList}
		</ResponsiveList>
	);
};

export const optinTypeTemplate = (rowData, key) => {
	const isPostoptin = rowData[key] ? 'POST' : 'PRE';

	const badgeType = 'POST' === isPostoptin ? 'warning' : '';
	const badgeClass = `p-badge p-badge-${badgeType}`;

	return (<div> <span className={badgeClass}>{isPostoptin}</span> </div>);
};

export const infoTemplate = (rowData, key) => {
	const labels = [...new Set(rowData[key])];

	return (
		labels.filter(label => label).map(info =>
			<div>
				{ info }
			</div>)
	);
};
