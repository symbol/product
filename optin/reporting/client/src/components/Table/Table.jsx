import './Table.scss';
import Helper from '../../utils/helper';
import PropTypes from 'prop-types';
import React from 'react';

const Table = function ({ dataList, formatting }) {
	/**
   * Format value in table.
   * @param {string} key Object key.
   * @param {string} value Value need to be format.
   * @returns {string} Formatted value.
   */
	const formatValue = (key, value) => {
		if ('relative' === formatting.keyFormat[key]) 
			return Helper.toRelativeAmount(value).toLocaleString('en-US', { minimumFractionDigits: 6 });
	  else if ('uppercase' === formatting.keyFormat[key]) 
			return value.toUpperCase();
	

		return value;
	};

	/**
   * Dynamic render table header by object.
   * @returns {HTMLTableHeaderCellElement} HTML table header.
   */
	const renderTableHeader = () => {
		return Object.keys(dataList.data[0]).map((key, index) => {
			return (<th key={'header_' + index}>{formatting.language[key] || key}</th>);
		});
	};

	/**
   * Render array item in table column.
   * @param {array} items List of items.
   * @param {string} key Object key.
   * @returns {HTMLDivElement} HTML element.
   */
	const renderArrayItem = (items, key) => {
		return items.map(item => {
			return (<div>
				{
					(formatting.keyRedirects[key]) ?
						<a href={formatting.keyRedirects[key] + item} target="_blank" rel="noreferrer">
							{formatValue(key, item)}
						</a> :

						formatValue(key, item)
				}
			</div>);
		});
	};

	/**
   * Render single item in table column.
   * @param {string} item value.
   * @param {string} key Object key.
   * @returns {HTMLDivElement} HTML element.
   */
	const renderItem = (item, key) => {
		return (<div>
			{
				(formatting.keyRedirects[key]) ?
					<a href={formatting.keyRedirects[key] + item} target="_blank" rel="noreferrer">
						{formatValue(key, item)}
					</a> :

					formatValue(key, item)
			}
		</div>);
	};

	/**
   * Render total balance.
   * @param {string} key Object key.
   * @param {array} balances Balances of address.
   * @returns {HTMLElement} HTML element.
   */
	const renderTotal = (key, balances) => {
		if (2 > balances.length) 
			return null;
    

		if ('nemAddress' === key || 'symbolAddress' === key) 
			return (<b>Total</b>);
    

		if ('nemBalance' === key || 'symbolBalance' === key) {
			const total = balances.reduce((balance, currentBalance) => balance + currentBalance, 0);
			const formatBalance = Helper.toRelativeAmount(total).toLocaleString('en-US', { minimumFractionDigits: 6 });
			return (<b>{formatBalance}</b>);
		}
	};

	/**
   * Render table row.
   * @returns {HTMLTableRowElement} HTML element.
   */
	const renderContent = () => {
		return dataList.data.map((item, index) => {
			return (
				<tr key={'row_' + index}>
					{Object.keys(item).map((key, index) => {
						return (<td key={'item_' + index}>
							{
								(Array.isArray(item[key])) ? (
									<>
										{ renderArrayItem(item[key], key) }

										{ renderTotal(key, item[key]) }
									</>
								) : renderItem(item[key], key)
							}
						</td>);
					})}
				</tr>
			);
		});
	};

	return (
		<table className="tableContainer">
			{0 < dataList.data.length ?
				<div>
					<thead>
						<tr>{ renderTableHeader() }</tr>
					</thead>
					<tbody>
						{ renderContent() }
					</tbody>
				</div>
				: 'No data available'}
		</table>
	);
};

Table.propTypes = {
	dataList: PropTypes.exact({
		data: PropTypes.array.isRequired,
		pagination: PropTypes.shape({
			pageNumber: PropTypes.number.isRequired,
			pageSize: PropTypes.number.isRequired,
			totalRecord: PropTypes.number.isRequired
		})
	}).isRequired,
	formatting: PropTypes.object
};

export default Table;
