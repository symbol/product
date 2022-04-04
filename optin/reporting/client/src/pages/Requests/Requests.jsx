import config from '../../config';
import { addressTemplate, transactionHashTemplate } from '../../utils/pageUtils';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import React, { useState, useEffect } from 'react';

const Requests = function () {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);
	const [requests, setRequests] = useState({
		data: [],
		pagination: {
			pageNumber: 1,
			pageSize: 25,
			totalRecord: 0
		}
	});

	const fetchOptinRequests = async ({pageSize = 25, pageNumber = 1}) => {
		return await fetch(`/api/requests?pageSize=${pageSize}&pageNumber=${pageNumber}`).then(res => res.json());
	};

	const handlePageChange = async ({page, rows, first}) => {
		setLoading(true);
		setFirst(first);
		const result = await fetchOptinRequests({
			pageNumber: page,
			pageSize: rows
		});

		setRequests(result);
		setLoading(false);
	};


	useEffect(() => {
		const getOptinRequests = async () => {
			const result = await fetchOptinRequests({
				pageNumber: 1
			});
			setRequests(result);
		};

		getOptinRequests();
		setLoading(false);
	}, []);

	const nemAddressTemplate = rowData => {
		return addressTemplate(rowData, 'nemAddress', config);
	};

	const optinTransactionHashTemplate = rowData => {
		return transactionHashTemplate(rowData, 'optinTransactionHash', config);
	};

	const statusTemplate = rowData => {
		const {status} = rowData;
		const badgeType = 'Pending' === status ? 'warning' : 'Sent' === status ? 'success' : 'danger';
		const badgeClass = `p-badge p-badge-${badgeType}`;
		return <React.Fragment>
			<div>
				<span className={badgeClass}>{status}</span>
			</div>
		</React.Fragment>;
	};
	return (
		<DataTable lazy value={requests.data} stripedRows showGridlines responsiveLayout="stack" breakpoint="960px" paginator
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" rows={requests.pagination.pageSize} 
			rowsPerPageOptions={[10,25,50]}	onPage={handlePageChange} 
			loading={loading} totalRecords={requests.pagination.totalRecord} first={first}>
			<Column field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<Column field="optinTransactionHash" header="Optin Transaction Hash" body={optinTransactionHashTemplate} align="left"/>
			<Column field="status" header="Status" body={statusTemplate} align="center"/>
			<Column field="message" header="Message" align="left"/>
		</DataTable>
	);
};

export default Requests;
