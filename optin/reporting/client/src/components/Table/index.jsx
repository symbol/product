import "./Table.scss";
import PropTypes from "prop-types";
import React from "react";

const Table = function ({ dataList, dataHeader }) {
  const renderTableHeader = () =>
    dataHeader.map((header, key) => <th key={key}>{header}</th>);

  const renderItem = () =>
    dataList.data.map((balance, key) => (
      <tr key={key}>
        <td>
          <a
            href={`https://explorer.nemtool.com/#/s_account?account=${balance.address}`}
          >
            {balance.address}
          </a>
        </td>
        <td>{balance.balance}</td>
      </tr>
    ));

  return (
    <table className="tableContainer">
      <thead>
        <tr>{renderTableHeader()}</tr>
      </thead>
      <tbody>
        {0 < dataList.data.length ? renderItem() : "No data available"}
      </tbody>
    </table>
  );
};

Table.propTypes = {
  dataList: PropTypes.exact({
    data: PropTypes.array.isRequired,
    success: PropTypes.bool.isRequired,
  }).isRequired,
  dataHeader: PropTypes.array.isRequired,
};

export default Table;
