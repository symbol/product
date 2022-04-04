import config from '../../config';
import { addressTemplate, balanceTemplate } from '../../utils/pageUtils';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import React, { useState, useEffect } from 'react';

const Balances = function () {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);  
	const [balances, setBalances] = useState({
		data: [],
		pagination: {
			pageNumber: 1,
			pageSize: 25,
			totalRecord: 0
		}
	});

	const fetchBalances = async ({pageSize = 25, pageNumber = 1}) => {
		return await fetch(`/api/balances?pageSize=${pageSize}&pageNumber=${pageNumber}`).then(res => res.json());
	};

	const handlePageChange = async ({page, rows, first}) => {
		setLoading(true);
		setFirst(first);
		const result = await fetchBalances({
			pageNumber: page,
			pageSize: rows
		});

		setBalances(result);
		setLoading(false);
	};

	useEffect(() => {
		const getBalances = async () => {
			const result = await fetchBalances({
				pageNumber: 1
			});
			setBalances(result);
		};

		getBalances();
		setLoading(false);
	}, []);

	const nemAddressTemplate = rowData => {
		return addressTemplate(rowData, 'nemAddress', config);
	};

	const nemBalanceTemplate = rowData => {
		return balanceTemplate(rowData, 'nemBalance');
	};

	return (
		<DataTable lazy value={balances.data} stripedRows showGridlines responsiveLayout="stack" breakpoint="960px" paginator
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" rows={balances.pagination.pageSize} 
			rowsPerPageOptions={[10,25,50]}	onPage={handlePageChange} 
			loading={loading} totalRecords={balances.pagination.totalRecord} first={first}>
			<Column field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<Column field="nemBalance" header="NEM Balance" body={nemBalanceTemplate} align="right"/>
		</DataTable>
	);
};

export default Balances;
