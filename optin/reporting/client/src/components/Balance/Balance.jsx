import Helper from '../../utils/helper';
import ResponsiveList from '../ResponsiveList';
import React from 'react';
import './Balance.scss';

export const renderTotalValue = (values, minimumFractionDigits) => {
	if (!Array.isArray(values) || 2 > values.length)
		return null;

	const total = values.reduce((value, currentValue) => value + currentValue, 0);
	const formattedValue = Helper.toRelativeAmount(total).toLocaleString('en-US', { minimumFractionDigits });
	return (<div className="list-item sub-total-value" data-testid="sub-total-value">{formattedValue}</div>);
};

const Balance = ({values, renderTotal, minimumFractionDigits = 2, listTitle = 'Balance List'}) => {
	const resultList = values.map(balance =>
		<div className='list-item'>
			{Helper.toRelativeAmount(balance).toLocaleString('en-US', { minimumFractionDigits })}
		</div>);
	if (renderTotal) {
		const total = renderTotalValue(values, minimumFractionDigits);
		if (total)
			resultList.push(total);
	}

	return (
		<ResponsiveList visible={resultList[resultList.length - 1]} title={listTitle}>
			{ React.Children.toArray(resultList) }
		</ResponsiveList>
	);
};

export default Balance;
