import config from '../../config';
import { addressTemplate, balanceTemplate } from '../../utils/pageUtils';
import { Column } from 'primereact/column';
import { DataTable} from 'primereact/datatable';
import React, { useState, useEffect } from 'react';

const Completed = () => {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);

	const [completed, setCompleted] = useState({
		data: [],
		pagination: {
			pageNumber: 1,
			pageSize: 25,
			totalRecord: 0
		}
	});

	const fetchCompleted = async ({pageSize = 25, pageNumber = 1}) => {
		return await fetch(`/api/completed?pageSize=${pageSize}&pageNumber=${pageNumber}`).then(res => res.json());
	};

	const handlePageChange = async ({page, rows, first}) =>{
		setLoading(true);
		setFirst(first);
		const result = await fetchCompleted({
			pageNumber: page + 1,
			pageSize: rows
		});

		setCompleted(result);
		setLoading(false);
	};


	useEffect(() => {
		const getCompleted = async () => {
			const result = await fetchCompleted({
				pageNumber: 1
			});
			setCompleted(result);
		};

		getCompleted();
		setLoading(false);
	}, []);

	

	const nemAddressTemplate = rowData => {
		return addressTemplate(rowData, 'nemAddress', config);
	};
  
	const symbolAddressTemplate = rowData => {
		return addressTemplate(rowData, 'symbolAddress', config);
	};

	const nemBalanceTemplate = rowData => {
		return balanceTemplate(rowData, 'nemBalance');
	};

	const symbolBalanceTemplate = rowData => {
		return balanceTemplate(rowData, 'symbolBalance');
	};
	


	return (
		<DataTable lazy value={completed.data} stripedRows showGridlines responsiveLayout="stack" breakpoint="960px" paginator
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" rows={completed.pagination.pageSize} 
			rowsPerPageOptions={[10,25,50]}	onPage={handlePageChange} 
			loading={loading} totalRecords={completed.pagination.totalRecord} first={first}>
			<Column field="optin_id" header="Opt-in ID" align="left"/>
			<Column field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<Column field="nemBalance" header="NEM Balance" body={nemBalanceTemplate} align="right"/>
			<Column field="symbolAddress" header="Symbol Address" body={symbolAddressTemplate} align="left"/>
			<Column field="symbolBalance" header="Symbol Balance" body={symbolBalanceTemplate} align="right"/>
		</DataTable>
	);
};

export default Completed;
