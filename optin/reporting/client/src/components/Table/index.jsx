import "./Table.scss";
import PropTypes from "prop-types";
import React from "react";

const Table = function ({ dataList, formatting }) {
  const renderTableHeader = () => {
    return Object.keys(dataList.data[0]).map((key, index) => {
      return (<th key={"header_" + index}>{formatting.language[key]}</th>)
    })
  }

  const renderItem = () => {
    return dataList.data.map((item, index) => {
      return (
        <tr key={"row_" + index}>
          {Object.keys(item).map((key, index) => {
            if (Array.isArray(item[key])) {
              // Todo: handle Array data

            } else {
              return (<td key={"item_" + index}>
                {
                  (formatting.keyRedirects[key]) ?
                  <a href={formatting.keyRedirects[key] + item[key]} target="_blank">{item[key]}</a> :
                  item[key]
                }
              </td>)
            }
          })}
        </tr>
      )
    })
  }

  return (
    <>
    <table className="tableContainer">
      {0 < dataList.data.length ?
      <div>
        <thead>
          <tr>{ renderTableHeader() }</tr>
        </thead>
        <tbody>
          { renderItem() }
        </tbody>
      </div>
      : "No data available"}
    </table>
      </>
  );
};

Table.propTypes = {
  dataList: PropTypes.exact({
    data: PropTypes.array.isRequired,
    pagination: PropTypes.shape({
      pageNumber: PropTypes.number.isRequired,
      pageSize: PropTypes.number.isRequired,
      totalRecord: PropTypes.number.isRequired,
    })
  }).isRequired,
  formatting: PropTypes.object
};

export default Table;
