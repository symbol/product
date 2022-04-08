import Table from '../../components/Table';
import TableColumn from '../../components/Table/TableColumn';
import config from '../../config';
import Helper from '../../utils/helper';
import { addressTemplate, transactionHashTemplate } from '../../utils/pageUtils';
import { Button } from 'primereact/button';
import { InputSwitch } from 'primereact/inputswitch';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import React, { useEffect, useState } from 'react';

const Requests = ({defaultPaginationType}) => {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);
	const [paginationType, setPaginationType] = useState(defaultPaginationType);

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
	const [downloading, setDownloading] = useState(false);

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
		const nextPage = 	page ?? (requests.pagination.pageNumber || 0) + 1;
		setLoading(true);
		setFirst(first);
		const result = await fetchOptinRequests({
			pageNumber: nextPage,
			pageSize: rows
		});

		if ('scroll' === paginationType && 1 !== nextPage) 
			setRequests({data: [...requests.data, ...result.data], pagination: result.pagination});  
		else
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

	const onFilterChange = e => {
		const {value} = e.target;
		setFilterSearch(value);
	};

	const onFilterSubmit = async () => {
		await handlePageChange({page: 1, rows: 25});
	};

	const downloadAllAsCSV = async () => {
		await Helper.downloadAllAsCSV({apiUrl: '/api/requests/download', fileName: 'optin-requests.csv', setDownloading});
	};

	const onPaginationTypeChange = async e => {
		setPaginationType(e.value ? 'scroll' : 'paginator');
		await onFilterSubmit();
	};

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

	const statuses = [{label: 'Pending', value: 'Pending'}, {label: 'Sent', value: 'Sent'}, {label: 'Error', value: 'Error'}];
	
	const header = (
		<div className='flex justify-content-between'>
			<div className="formgroup-inline">
				<span className="p-input-icon-left field">
					<i className="pi pi-search" />
					<span className="p-input-icon-right">
						<i className="pi pi-times" onClick={() => setFilterSearch('')}/>
						<InputText value={filterSearch} onChange={onFilterChange} placeholder="NEM Address / Transaction Hash" 
							className='w-28rem' />
					</span>
				</span>
				<div className='field'>
					<SelectButton optionLabel="label" optionValue="value" value={filterStatus} options={statuses} 
						onChange={e => setFilterStatus(e.value)}></SelectButton>
				</div>
				<Button type="button" icon="pi pi-search" className="p-button-outlined" onClick={onFilterSubmit} />

			</div>
			<div className="formgroup-inline">
				<div className="card" style={{marginRight: '20px'}}>
					<h5 style={{margin: 0, marginLeft: '-15px', color: '#b4b2b2'}}>Infinite Scroll</h5>
					<InputSwitch checked={'scroll' === paginationType} 
						onChange={onPaginationTypeChange}/>
				</div>
				<Button type="button" icon="pi pi-download" className="p-button-outlined" onClick={downloadAllAsCSV} 
					loading={downloading} tooltip="Download All Data as CSV File" tooltipOptions={{position: 'top'}}/>
			</div>
		</div>
	);

	return (
		<Table value={requests.data} rows={requests.pagination.pageSize} onPage={handlePageChange}
			loading={loading} totalRecords={requests.pagination.totalRecord} paginator={'paginator' === paginationType}
			first={first} header={header}>
			<TableColumn field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<TableColumn field="optinTransactionHash" header="Optin Transaction Hash" body={optinTransactionHashTemplate} align="left"/>
			<TableColumn field="status" header="Status" body={statusTemplate} align="center"/>
			<TableColumn field="message" header="Message" align="left"/>
		</Table>
	);
};

Requests.defaultProps = {
	defaultPaginationType: 'scroll'
};

export default Requests;
