import './Table.scss';
import PropTypes from 'prop-types';
import React from 'react';

const Table = function ({ dataList, dataHeader }) {
  const renderTableHeader = () => {
    return dataHeader.map((header, key) => {
      return(
          <th key={key}>{header}</th>
      )
    })
  }

  const renderItem = () => {
    return dataList.data.map((balance, key) => {
      return(
        <tr key={key}>
          <td><a href={`https://explorer.nemtool.com/#/s_account?account=${balance.address}`}>{balance.address}</a></td>
          <td>{balance.balance}</td>
        </tr>
      )
    })
  }

	return (
      <table className='tableContainer'>
      <thead>
        <tr>
          { renderTableHeader() }
        </tr>
      </thead>
        <tbody>
          { dataList.data.length > 0 ? renderItem() : 'No data available' }
        </tbody>
    </table>
	);
};

Table.propTypes = {
  dataList: PropTypes.exact({
		data: PropTypes.array.isRequired,
		success: PropTypes.bool.isRequired
	}).isRequired,
  dataHeader: PropTypes.array.isRequired
};

export default Table;
