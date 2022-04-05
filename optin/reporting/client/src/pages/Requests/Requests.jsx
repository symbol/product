import config from '../../config';
import { addressTemplate, transactionHashTemplate } from '../../utils/pageUtils';
import { Button } from 'primereact/button';
import { Column } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
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
	const [filterSearch, setFilterSearch] = useState('');
	const [filterStatus, setFilterStatus] = useState('');
	
	const fetchOptinRequests = async ({pageSize = 25, pageNumber = 1}) => {
		const [nemAddress, transactionHash] = parseFilterSearch(filterSearch);
		return await fetch(`/api/requests?pageSize=${pageSize}&pageNumber=${pageNumber}
      &nemAddress=${nemAddress}&transactionHash=${transactionHash}&status=${filterStatus ?? ''}`).then(res => res.json());
	};

	const parseFilterSearch = filterSearch => {
		if (40 === filterSearch.length) 
			return [filterSearch, ''];
		else if (64 === filterSearch.length) 
			return ['', filterSearch];
		return ['', ''];
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

	const onFilterChange = e => {
		const {value} = e.target;
		setFilterSearch(value);
	};

	const onFilterSubmit = async () => {
		await handlePageChange({page: 1, rows: 25, first: 1});
	};

	const statuses = [{label: 'Pending', value: 'Pending'}, {label: 'Sent', value: 'Sent'}, {label: 'Error', value: 'Error'}];
	const renderHeader = () => {
		return (
			<div className="formgroup-inline">
				<span className="p-input-icon-left field">
					<i className="pi pi-search" />
					<span className="p-input-icon-right">
						<i className="pi pi-times" onClick={() => setFilterSearch('')}/>
						<InputText value={filterSearch} onChange={onFilterChange} placeholder="Nem Address or Transaction Hash" 
							className='w-24rem' />
					</span>
				</span>
				<div className='field'>
					<SelectButton optionLabel="label" optionValue="value" value={filterStatus} options={statuses} 
						onChange={e => setFilterStatus(e.value)}></SelectButton>
				</div>
				<Button type="button" icon="pi pi-search" className="p-button-outlined" onClick={onFilterSubmit} />

			</div>
		);
	};
	const header = renderHeader();

	return (
		<DataTable lazy value={requests.data} stripedRows showGridlines responsiveLayout="stack" breakpoint="960px" paginator
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" rows={requests.pagination.pageSize} 
			rowsPerPageOptions={[10,25,50]}	onPage={handlePageChange} 
			loading={loading} totalRecords={requests.pagination.totalRecord} first={first} header={header}>
			<Column field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<Column field="optinTransactionHash" header="Optin Transaction Hash" body={optinTransactionHashTemplate} align="left"/>
			<Column field="status" header="Status" body={statusTemplate} align="center"/>
			<Column field="message" header="Message" align="left"/>
		</DataTable>
	);
};

export default Requests;
