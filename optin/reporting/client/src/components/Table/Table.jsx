import './Table.scss';
import { DataTable } from 'primereact/datatable';
import {ProgressSpinner} from 'primereact/progressspinner';
import PropTypes from 'prop-types';
import React from 'react';
import VisibilitySensor from 'react-visibility-sensor';

const Table = props => {

	const checkVisible = async visible => {
		if (visible && !props.allPagesLoaded && props.rows <= props.value.length) 
			await props.onPage({});
	};

	const footer = (
		<React.Fragment>
			{props.footer}
			{
				!props.paginator && !props.allPagesLoaded && props.rows <= props.value.length && 
				<VisibilitySensor onChange={checkVisible}>
					<div class="grid flex align-items-center">
						<div class="col-2"><ProgressSpinner className="w-6"/></div>
						<div class="col-10">{props.loadingMessage}</div>
					</div>
				</VisibilitySensor>
			}
		</React.Fragment>
	);

	return  (
		<DataTable lazy={props.lazy} value={props.value} stripedRows showGridlines responsiveLayout="stack" 
			breakpoint={props.breakpoint} paginator={props.paginator}
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" rows={props.rows} 
			rowsPerPageOptions={props.rowsPerPageOptions}	onPage={props.onPage} 
			loading={props.loading && props.paginator} totalRecords={props.totalRecords} first={props.first} header={props.header} 
			emptyMessage={props.emptyMessage} footer={footer}>
			{props.children}
		</DataTable>
	);
};

Table.propTypes = {
	// TODO fill the propTypes?
};

Table.defaultProps = {
	breakpoint: '960px',
	rowsPerPageOptions: [10,25,50],
	lazy: true,
	emptyMessage: 'No data to display'
};
export default Table;
