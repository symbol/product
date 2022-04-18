import './Table.scss';
import { DataTable } from 'primereact/datatable';
import {ProgressSpinner} from 'primereact/progressspinner';
import React from 'react';

const Table = props => {
	const ref = React.useRef();

	const allowLoadNextPage = !props.allPagesLoaded && props.rows <= props.value.length;

	const infiniteLoaderHandler = React.useCallback(event => {
		const bottom = Math.trunc(event.target.scrollHeight - event.target.scrollTop) <= event.target.clientHeight;
				
		if (bottom && allowLoadNextPage) 
			props.onPage({});
	}, [allowLoadNextPage]);

	React.useEffect(() => {
		if (ref) {
			const scrollableElement = ref.current.el.lastChild;
			scrollableElement.addEventListener('scroll', infiniteLoaderHandler);

			return () => {
				scrollableElement.removeEventListener('scroll', infiniteLoaderHandler);
			};
		}
	}, [ref, infiniteLoaderHandler]);

	const footer = (
		<React.Fragment>
			{props.footer}
			{
				props.loading && !props.paginator && 
					<td colSpan={12}>
						<div className="grid flex align-items-center w-100">
							<div className="col-2"><ProgressSpinner className="w-6"/></div>
							<div className="col-10">{props.loadingMessage}</div>
						</div>
					</td>
			}
		</React.Fragment>
	);

	return  (
		<DataTable 
			lazy={props.lazy} 
			value={props.value} 
			stripedRows 
			showGridlines 
			responsiveLayout="stack" 
			rowGroupMode="subheader" 
			groupRowsBy="___all"
			breakpoint={props.breakpoint} 
			paginator={props.paginator}
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" 
			rows={props.rows} 
			rowsPerPageOptions={props.rowsPerPageOptions}
			onPage={props.onPage} 
			loading={props.loading} 
			totalRecords={props.totalRecords} 
			first={props.first} 
			header={props.header} 
			emptyMessage={props.emptyMessage} 
			rowGroupFooterTemplate={footer} 
			ref={ref}
		>
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
