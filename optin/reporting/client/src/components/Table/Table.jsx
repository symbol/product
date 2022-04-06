import './Table.scss';
import { DataTable } from 'primereact/datatable';
import PropTypes from 'prop-types';
import React from 'react';

const Table = props => {
	return  (
		<DataTable lazy={props.lazy} value={props.value} stripedRows showGridlines responsiveLayout="stack" 
			breakpoint={props.breakpoint} paginator={props.paginator}
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" rows={props.rows} 
			rowsPerPageOptions={props.rowsPerPageOptions}	onPage={props.onPage} 
			loading={props.loading} totalRecords={props.totalRecords} first={props.first} header={props.header} 
			emptyMessage={props.emptyMessage}>
			{props.children}
		</DataTable>
	);
};

Table.propTypes = {
  
};

Table.defaultProps = {
	breakpoint: '960px',
	rowsPerPageOptions: [10,25,50],
	lazy: true,
	emptyMessage: 'No data to display'
};
export default Table;
