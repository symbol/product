import Table from '../../components/Table';
import TableColumn from '../../components/Table/TableColumn';
import config from '../../config';
import Helper from '../../utils/helper';
import { addressTemplate, balanceTemplate, transactionHashTemplate, optinTypeTemplate, infoTemplate } from '../../utils/pageUtils';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import React, { useState, useEffect, useRef} from 'react';
const { NemFacade, SymbolFacade } = require('symbol-sdk').facade;
const { Hash256 } = require('symbol-sdk').nem;

const Completed = ({defaultPaginationType}) => {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);
	const [paginationType] = useState(defaultPaginationType);
	const [allPagesLoaded, setAllPagesLoaded] = useState(false);

	const [completed, setCompleted] = useState({
		data: [],
		pagination: {
			pageNumber: 0,
			pageSize: config.defaultPageSize,
			totalRecord: 0
		}
	});
	const [filterSearch, setFilterSearch] = useState('');
	const [filterOptinType, setFilterOptinType] = useState('');
	const [filterOptinTypeSubmit, setFilterOptinTypeSubmit] = useState(false);
	const [downloading, setDownloading] = useState(false);
	const [invalidFilterSearch, setInvalidFilterSearch] = useState(false);
	const initialRender = useRef(true);

	const fetchCompleted = async ({pageSize = config.defaultPageSize, pageNumber = 1}) => {
		const [nemAddress, symbolAddress, transactionHash] = parseFilterSearch(filterSearch?.trim());
		return await fetch(`/api/completed?pageSize=${pageSize}&pageNumber=${pageNumber}` +
		`&nemAddress=${nemAddress}&symbolAddress=${symbolAddress}&transactionHash=${transactionHash}&optinType=${filterOptinType}`)
			.then(res => res.json());
	};

	const parseFilterSearch = filterSearch => {
		const searchVal = filterSearch?.trim().toUpperCase();
		try {
			const address = new NemFacade.Address(searchVal);
			return [address.toString(), '', ''];
		} catch (e) {
		}
		try {
			const address = new SymbolFacade.Address(searchVal);
			return ['', address.toString(), ''];
		} catch (e) {
		}
		try {
			const hash = new Hash256(searchVal);
			return ['', '', hash.toString()];
		} catch (e) {
		}
		return ['', '', ''];
	};

	const handlePageChange = async ({page, rows, first}) =>{
		const nextPage = page ?? (completed.pagination.pageNumber || 0) + 1;
		setLoading(true);
		setFirst(first);
		const result = await fetchCompleted({
			pageNumber: nextPage,
			pageSize: rows
		});

		setAllPagesLoaded(!result.data || 0 === result.data.length);

		if ('scroll' === paginationType && 1 !== nextPage)
			setCompleted({data: [...completed.data, ...result.data], pagination: result.pagination});
		else
		  setCompleted(result);
		setLoading(false);
	};

	const shouldDoInitalFetch = initialRender.current;
	useEffect(() => {
		if (shouldDoInitalFetch) {
			const getCompleted = async () => {
				const result = await fetchCompleted({
					pageNumber: 1
				});
				setCompleted(result);
			};

			getCompleted().then(() => {setLoading(false);});
		}
	}, [shouldDoInitalFetch]);

	const validateFilterSearch = value => {
		return !parseFilterSearch(value).every(v => '' === v);
	};

	const onFilterSearchChange = e => {
		const {value} = e.target;

		setInvalidFilterSearch(value ? !validateFilterSearch(value) : false);
		setFilterSearch(value ?? '');
		setFilterOptinType('');
	};

	const clearFilterSearch = () => {
		onFilterSearchChange({target: ''});
	};

	const onFilterOptinChange = e => {
		clearFilterSearch();
		setFilterOptinType(e.value);
		setFilterOptinTypeSubmit(true);
	};

	const onFilterSubmit = async e => {
		if (e)
			e.preventDefault();
		await handlePageChange({page: 1, rows: config.defaultPageSize});
		setFilterOptinTypeSubmit(false);
	};

	useEffect(() => {
		if (!initialRender.current && filterOptinTypeSubmit) 
			onFilterSubmit();
		initialRender.current = false;
	}, [filterOptinTypeSubmit]);

	const downloadAllAsCSV = async () => {
		await Helper.downloadAllAsCSV({apiUrl: '/api/completed/download', fileName: 'optin-completed.csv', setDownloading});
	};

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

	const nemHashesTemplate = rowData => {
		return transactionHashTemplate(rowData, 'nemHashes', config);
	};

	const symbolHashesTemplate = rowData => {
		return transactionHashTemplate(rowData, 'symbolHashes', config);
	};

	const isPostoptinTemplate = rowData => {
		return optinTypeTemplate(rowData, 'isPostoptin');
	};

	const labelTemplate = rowData => {
		return infoTemplate(rowData, 'label');
	};

	const optinTypes = [{label: 'Pre-launch', value: 'pre'}, {label: 'Post-launch', value: 'post'}];

	const header = (
		<form onSubmit={onFilterSubmit}>
			<div className='flex flex-wrap md:justify-content-between'>
				<div className="flex-row w-full lg:w-8 xl:w-6">
					<span className="p-input-icon-right w-10">
						<i className="pi pi-times" onClick={clearFilterSearch}/>
						<InputText id="filterSearch" value={filterSearch} onChange={onFilterSearchChange} className="w-full"
							placeholder="NEM Address / Symbol Address / Transaction Hash" aria-describedby="filterSearch-help" />
					</span>
					<span className="ml-1 w-2">
						<Button type="submit" icon="pi pi-search" className="p-button-outlined" disabled={invalidFilterSearch}/>
					</span>
					{
						invalidFilterSearch &&
							<small id="filterSearch-help" className="p-error block">
								Invalid NEM / Symbol Address or Transaction Hash.
							</small>
					}
				</div>
				<div>
					<div className="flex flex-wrap justify-content-between">
						<SelectButton optionLabel="label" optionValue="value" value={filterOptinType} options={optinTypes}
							onChange={onFilterOptinChange}></SelectButton>
						<Button type="button" icon="pi pi-download" className="ml-6 p-button-outlined download-button"
							onClick={downloadAllAsCSV} loading={downloading} tooltip="Download All Data as CSV File"
							tooltipOptions={{position: 'top'}} />
					</div>
				</div>
			</div>
		</form>
	);

	return (
		<Table value={completed.data} rows={completed.pagination.pageSize}
			onPage={handlePageChange} loading={loading} totalRecords={completed.pagination.totalRecord}
			allPagesLoaded={allPagesLoaded} loadingMessage="Loading more items..."
			first={first} header={header} paginator={'paginator' === paginationType}>
			<TableColumn field="optin_id" header="#" align="left"/>
			<TableColumn field="isPostoptin" header="Opt-in Type" body={isPostoptinTemplate} align="center"/>
			<TableColumn field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<TableColumn field="label" header="Info" body={labelTemplate} align="left"/>
			<TableColumn field="nemHashes" header="Hash" body={nemHashesTemplate} align="left"/>
			<TableColumn field="nemBalance" header="Balance" body={nemBalanceTemplate} align="right"/>
			<TableColumn field="symbolAddress" header="Symbol Address" body={symbolAddressTemplate} align="left"/>
			<TableColumn field="symbolHashes" header="Hash" body={symbolHashesTemplate} align="left"/>
			<TableColumn field="symbolBalance" header="Balance" body={symbolBalanceTemplate} align="right"/>
			<TableColumn field="isPostoptin" header="Opt-in Type" body={isPostoptinTemplate} align="right"/>
		</Table>
	);
};

Completed.defaultProps = {
	defaultPaginationType: 'scroll'
};
export default Completed;
