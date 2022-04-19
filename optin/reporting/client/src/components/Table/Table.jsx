import './Table.scss';
import { DataTable } from 'primereact/datatable';
import {ProgressSpinner} from 'primereact/progressspinner';
import React from 'react';

const NEXT_PAGE_LOAD_BOTTOM_MARGIN = 300; // the height from the bottom to trigger the next page load

const Table = React.forwardRef((props, ref) => {
	const defaultRef = React.useRef(null);
	const tableRef = ref ?? defaultRef;

	const allowLoadNextPage = !props.allPagesLoaded && props.rows <= props.value.length && !props.loading;

	const infiniteLoaderHandler = React.useCallback(event => {
		const wayToBottom = Math.trunc(event.target.scrollHeight - event.target.scrollTop) - event.target.clientHeight;

		if (NEXT_PAGE_LOAD_BOTTOM_MARGIN >= wayToBottom && allowLoadNextPage) 
			props.onPage({});
	}, [allowLoadNextPage, props.onPage]);

	React.useEffect(() => {
		if (tableRef) {
			const scrollableElement = tableRef.current.el.lastChild;
			scrollableElement.addEventListener('scroll', infiniteLoaderHandler);

			return () => {
				scrollableElement.removeEventListener('scroll', infiniteLoaderHandler);
			};
		}
	}, [tableRef, infiniteLoaderHandler]);

	if (props.resetScroll) 
		tableRef.current.resetScroll();	

	return  (
		<DataTable
			lazy={props.lazy} 
			value={props.value} 
			stripedRows 
			showGridlines 
			responsiveLayout="stack" 
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
			ref={tableRef}
		>
			{props.children}
		</DataTable>
	);
});

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
