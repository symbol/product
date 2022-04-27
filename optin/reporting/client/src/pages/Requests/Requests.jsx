import Table from '../../components/Table';
import TableColumn from '../../components/Table/TableColumn';
import ColumnHeader from '../../components/Table/TableColumn/ColumnHeader';
import config from '../../config';
import { addressTemplate, dateTransactionHashTemplate } from '../../utils/pageUtils';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import React, { useEffect, useState, useRef } from 'react';
const { NemFacade } = require('symbol-sdk').facade;
const { Hash256 } = require('symbol-sdk').nem;

const Requests = ({defaultPaginationType}) => {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);
	const [paginationType] = useState(defaultPaginationType);
	const [allPagesLoaded, setAllPagesLoaded] = useState(false);

	const [requests, setRequests] = useState({
		data: [],
		pagination: {
			pageNumber: 0,
			pageSize: config.defaultPageSize,
			totalRecord: 0
		}
	});
	const [filterSearch, setFilterSearch] = useState('');
	const [filterStatus, setFilterStatus] = useState('');
	const [filterStatusSubmit, setFilterStatusSubmit] = useState(false);
	const [invalidFilterSearch, setInvalidFilterSearch] = useState(false);
	const [filterSearchCleared, setFilterSearchCleared] = useState(false);
	
	const [sortBy, setSortBy] = useState('');
	const [sortDirection, setSortDirection] = useState('');
	const [sortBySubmit, setSortBySubmit] = useState(false);

	const initialRender = useRef(true);
	const tableRef = useRef();

	const fetchOptinRequests = async ({pageSize = config.defaultPageSize, pageNumber = 1}) => {
		const [nemAddress, transactionHash] = parseFilterSearch(filterSearch?.trim());
		return await fetch(`/api/requests?pageSize=${pageSize}&pageNumber=${pageNumber}` +
		`&nemAddress=${nemAddress}&transactionHash=${transactionHash}` +
		`&status=${filterStatus ?? ''}&sortBy=${sortBy}&sortDirection=${sortDirection}`).then(res => res.json());
	};

	const parseFilterSearch = filterSearch => {
		const searchVal = filterSearch?.trim().toUpperCase();
		try {
			const address = new NemFacade.Address(searchVal);
			return [address.toString(), ''];
		} catch (e) {
		}
		try {
			const hash = new Hash256(searchVal);
			return ['', hash.toString()];
		} catch (e) {
		}
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

	const shouldDoInitalFetch = initialRender.current;
	useEffect(() => {
		if (shouldDoInitalFetch) {
			const getOptinRequests = async () => {
				const result = await fetchOptinRequests({
					pageNumber: 1
				});
				setRequests(result);
			};

			getOptinRequests().then(() => {setLoading(false);});
		}
	}, [shouldDoInitalFetch]);

	const validateFilterSearch = value => {
		return !parseFilterSearch(value).every(v => '' === v);
	};

	const onFilterSearchChange = e => {
		const {value} = e.target;

		setInvalidFilterSearch(value ? !validateFilterSearch(value) : false);
		setFilterSearch(value ?? '');
		setFilterStatus(''); // reset filter status
	};

	const clearFilterSearchAndSubmit = () => {
		clearFilterSearch();
		setFilterSearchCleared(true);
	};

	const clearFilterSearch = () => {
		onFilterSearchChange({target: ''});
	};

	const onFilterStatusChange = e => {
		clearFilterSearch();
		setFilterStatus(e.value);
		setFilterStatusSubmit(true);
		tableRef.current.resetScroll();
	};

	const onFilterSubmit = async e => {
		if (e)
			e.preventDefault();
		await handlePageChange({page: 1, rows: config.defaultPageSize});
		setFilterStatusSubmit(false);
		setFilterSearchCleared(false);
		setSortBySubmit(false);
	};

	useEffect(() => {
		if (!initialRender.current && (filterStatusSubmit || filterSearchCleared))
			onFilterSubmit();
		initialRender.current = false;
	}, [filterStatusSubmit, filterSearchCleared]);

	const nemAddressTemplate = rowData => {
		return addressTemplate(rowData, 'nemAddress', config);
	};

	const optinTransactionHashTemplate = rowData => {
		return dateTransactionHashTemplate(rowData, 'optinTransactionHash', 'optinTimestamp', config);
	};

	const payoutTransactionHashTemplate = rowData => {
		return dateTransactionHashTemplate(rowData, 'payoutTransactionHash', 'payoutTimestamp', config);
	};

	const statusTemplate = rowData => {
		const {status} = rowData;
		const badgeType = 'Pending' === status ? 'warning' : 'Sent' === status ? 'success' : 'Duplicate' === status? 'info' : 'danger';
		const badgeClass = `p-badge p-badge-${badgeType}`;
		return <React.Fragment>
			<div>
				<span className={badgeClass}>{status}</span>
			</div>
		</React.Fragment>;
	};

	const statuses = [{label: 'Pend', value: 'Pending'}, {label: 'Sent', value: 'Sent'}, 
		{label: 'Dup', value: 'Duplicate'}, {label: 'Err', value: 'Error'}];

	const header = (
		<form onSubmit={onFilterSubmit}>
			<div className='flex flex-wrap md:justify-content-between'>
				<div className="flex flex-row w-full">
					<span className="p-input-icon-right w-6">
						<i className="pi pi-times" onClick={clearFilterSearchAndSubmit}/>
						<InputText id="filterSearch" value={filterSearch} onChange={onFilterSearchChange} className="w-full"
							placeholder="NEM Address / Tx Hash" aria-describedby="filterSearch-help" />
					</span>
					<span className="w-6 ml-5">
						<SelectButton optionLabel="label" optionValue="value" value={filterStatus} options={statuses}
							onChange={onFilterStatusChange}></SelectButton>
					</span>
				</div>
				{
					invalidFilterSearch &&
							<small id="filterSearch-help" className="p-error block">Invalid NEM Address or Transaction Hash.</small>
				}
			</div>
		</form>
	);

	const optinTransactionHashField = 'optinTransactionHash';
	const payoutTransactionHashField = 'payoutTransactionHash';
	const [optinHashHeaderSortDirection, setOptinHashHeaderSortDirection] = useState('none');
	const [payoutHashHeaderSortDirection, setPayoutHashHeaderSortDirection] = useState('none');
	const headerSortHandler = (_sortField, _sortDirection) => {
		tableRef.current.resetScroll();
		if(_sortField === optinTransactionHashField) {
			setOptinHashHeaderSortDirection(_sortDirection);
			setPayoutHashHeaderSortDirection('none');
			setSortBy('optinTransactionHash');
			setSortDirection(_sortDirection);
			setSortBySubmit(true);
		} else if(_sortField === payoutTransactionHashField) {
			setPayoutHashHeaderSortDirection(_sortDirection);
			setOptinHashHeaderSortDirection('none');
			setSortBy('payoutTransactionHash');
			setSortDirection(_sortDirection);
			setSortBySubmit(true);
		}
	};

	useEffect(() => {
		if (!initialRender.current && (sortBySubmit))
			onFilterSubmit();
	}, [sortBySubmit]);


	const optinHashHeader = <ColumnHeader field={optinTransactionHashField}  title="Opt-in Hash" 
		sortDirection={optinHashHeaderSortDirection} onSort={headerSortHandler}/>;
	const payoutHashHeader = <ColumnHeader field={payoutTransactionHashField} title="Payout Hash" 
		sortDirection={payoutHashHeaderSortDirection} onSort={headerSortHandler}/>;

	return (
		<Table ref={tableRef} value={requests.data} rows={requests.pagination.pageSize} onPage={handlePageChange}
			loading={loading} allPagesLoaded={allPagesLoaded} loadingMessage="Loading more items..."
			totalRecords={requests.pagination.totalRecord} paginator={'paginator' === paginationType}
			first={first} header={header}>
			<TableColumn field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<TableColumn field={optinTransactionHashField} header={optinHashHeader} body={optinTransactionHashTemplate} align="left"/>
			<TableColumn field={payoutTransactionHashField} header={payoutHashHeader} body={payoutTransactionHashTemplate} align="left"/>
			<TableColumn field="status" header="Status" body={statusTemplate} align="center"/>
			<TableColumn field="message" header="Message" align="left"/>
		</Table>
	);
};

Requests.defaultProps = {
	defaultPaginationType: 'scroll'
};

export default Requests;
