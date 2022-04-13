import Table from '../../components/Table';
import TableColumn from '../../components/Table/TableColumn';
import config from '../../config';
import Helper from '../../utils/helper';
import { addressTemplate, transactionHashTemplate } from '../../utils/pageUtils';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import React, { useEffect, useState } from 'react';

const Requests = ({defaultPaginationType}) => {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);
	const [paginationType] = useState(defaultPaginationType);
	const [allPagesLoaded, setAllPagesLoaded] = useState(false);

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
	const [invalidFilterSearch, setInvalidFilterSearch] = useState(false);

	const fetchOptinRequests = async ({pageSize = 25, pageNumber = 1}) => {
		const [nemAddress, transactionHash] = parseFilterSearch(filterSearch?.trim());
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
		const nextPage = page ?? (requests.pagination.pageNumber || 0) + 1;
		setLoading(true);
		setFirst(first);
		const result = await fetchOptinRequests({
			pageNumber: nextPage,
			pageSize: rows
		});
		setAllPagesLoaded(!result.data || 0 === result.data.length);
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

	const validateFilterSearch = value => {
		return !parseFilterSearch(value).every(v => '' === v);
	};
	
	const onFilterSearchChange = e => {
		const {value} = e.target;
		
		setInvalidFilterSearch(value ? !validateFilterSearch(value) : false);
		setFilterSearch(value ?? '');
		setFilterStatus(''); // reset filter status
	};

	const clearFilterSearch = () => {
		onFilterSearchChange({target: ''});
	};
	
	const onFilterStatusChange = e => {
		clearFilterSearch();
		setFilterStatus(e.value);
	};
	
	const onFilterSubmit = async e => {
		if (e)
			e.preventDefault();
		await handlePageChange({page: 1, rows: 25});
	};
	
	useEffect(() => {
		onFilterSubmit();
	}, [filterStatus]);

	const downloadAllAsCSV = async () => {
		await Helper.downloadAllAsCSV({apiUrl: '/api/requests/download', fileName: 'optin-requests.csv', setDownloading});
	};

	const nemAddressTemplate = rowData => {
		return addressTemplate(rowData, 'nemAddress', config);
	};

	const optinTransactionHashTemplate = rowData => {
		return transactionHashTemplate(rowData, 'optinTransactionHash', config);
	};

	const payoutTransactionHashTemplate = rowData => {
		return transactionHashTemplate(rowData, 'payoutTransactionHash', config);
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
		<form onSubmit={onFilterSubmit}>
			<div className='flex flex-wrap md:justify-content-between'>
				<div className="flex-row w-full lg:w-8 xl:w-6">
					<span className="p-input-icon-right w-10">
						<i className="pi pi-times" onClick={clearFilterSearch}/>
						<InputText id="filterSearch" value={filterSearch} onChange={onFilterSearchChange} className="w-full"
							placeholder="NEM Address / Transaction Hash" aria-describedby="filterSearch-help"/>
					</span>
					<span className="ml-1 w-2">
						<Button type="submit" icon="pi pi-search" className="p-button-outlined" disabled={invalidFilterSearch}/>
					</span>
					{
						invalidFilterSearch && 
							<small id="filterSearch-help" className="p-error block">Invalid NEM Address or Transaction Hash.</small>
					}
				</div>
				<div>
					<div className="flex flex-wrap justify-content-between">
						<SelectButton optionLabel="label" optionValue="value" value={filterStatus} options={statuses} 
							onChange={onFilterStatusChange}></SelectButton>
						<Button type="button" icon="pi pi-download" className="ml-6 p-button-outlined download-button"
							onClick={downloadAllAsCSV} loading={downloading} tooltip="Download All Data as CSV File" 
							tooltipOptions={{position: 'top'}} />
					</div>
				</div>
			</div>
		</form>
	);

	return (
		<Table value={requests.data} rows={requests.pagination.pageSize} onPage={handlePageChange}
			loading={loading} allPagesLoaded={allPagesLoaded} loadingMessage="Loading more items..." 
			totalRecords={requests.pagination.totalRecord} paginator={'paginator' === paginationType}
			first={first} header={header}>
			<TableColumn field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<TableColumn field="optinTransactionHash" header="Optin Hash" body={optinTransactionHashTemplate} align="left"/>
			<TableColumn field="payoutTransactionHash" header="Payout Hash" body={payoutTransactionHashTemplate} align="left"/>
			<TableColumn field="status" header="Status" body={statusTemplate} align="center"/>
			<TableColumn field="message" header="Message" align="left"/>
		</Table>
	);
};

Requests.defaultProps = {
	defaultPaginationType: 'scroll'
};

export default Requests;
