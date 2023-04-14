import './Completed.scss';
import Table from '../../components/Table';
import ColumnHeader from '../../components/Table/ColumnHeader';
import config from '../../config';
import { addressTemplate, balanceTemplate, dateTransactionHashTemplate } from '../../utils/pageUtils';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import React, { useEffect, useRef, useState} from 'react';
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
	const [invalidFilterSearch, setInvalidFilterSearch] = useState(false);
	const [filterSearchCleared, setFilterSearchCleared] = useState(false);

	const [sortBy, setSortBy] = useState('');
	const [sortDirection, setSortDirection] = useState('');
	const [sortBySubmit, setSortBySubmit] = useState(false);
	const initialRender = useRef(true);
	const tableRef = useRef();

	const fetchCompleted = async ({pageSize = config.defaultPageSize, pageNumber}) => {
		const [nemAddress, symbolAddress, transactionHash] = parseFilterSearch(filterSearch?.trim());
		return await fetch(`/api/completed?pageSize=${pageSize}&pageNumber=${pageNumber}` +
		`&nemAddress=${nemAddress}&symbolAddress=${symbolAddress}&transactionHash=${transactionHash}` +
		`&optinType=${filterOptinType}&sortBy=${sortBy}&sortDirection=${sortDirection}`)
			.then(res => res.json());
	};

	const parseFilterSearch = filterSearch => {
		const searchVal = filterSearch.trim().toUpperCase();
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

	const handlePageChange = async ({page, rows, first}) => {
		const nextPage = page ?? completed.pagination.pageNumber + 1;
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

	const clearFilterSearchAndSubmit = () => {
		clearFilterSearch();
		setFilterSearchCleared(true);
	};

	const clearFilterSearch = async () => {
		onFilterSearchChange({target: ''});
	};

	const resetTableScroll = () => {
		document.querySelector('.p-datatable-wrapper').scrollTop = 0;
	};

	const onFilterOptinChange = e => {
		clearFilterSearch();
		setFilterOptinType(e.value);
		setFilterOptinTypeSubmit(true);
		resetTableScroll();
	};

	const onFilterSubmit = async e => {
		if (e)
			e.preventDefault();
		await handlePageChange({page: 1, rows: config.defaultPageSize});
		setFilterOptinTypeSubmit(false);
		setFilterSearchCleared(false);
		setSortBySubmit(false);
	};

	useEffect(() => {
		if (!initialRender.current && (filterOptinTypeSubmit || filterSearchCleared))
			onFilterSubmit();
		initialRender.current = false;
	}, [filterOptinTypeSubmit, filterSearchCleared]);

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

	const nemDateHashesTemplate = rowData => {
		return dateTransactionHashTemplate(rowData, 'nemHashes', 'nemTimestamps', config);
	};

	const symbolDateHashesTemplate = rowData => {
		return dateTransactionHashTemplate(rowData, 'symbolHashes', 'symbolTimestamps' , config);
	};

	const isPostoptinTemplate = rowData => {
		const isPostoptin = rowData['isPostoptin'] ? 'POST' : 'PRE';

		const badgeType = 'POST' === isPostoptin ? 'warning' : '';
		const badgeClass = `p-badge p-badge-${badgeType}`;

		return (<div> <span className={badgeClass}>{isPostoptin}</span> </div>);
	};

	const labelTemplate = rowData => {
		const labels = [...new Set(rowData['label'])];

		return (
			labels.filter(label => label).map(info =>
				<div>
					{ info }
				</div>)
		);
	};

	const optinTypes = [{label: 'PRE', value: 'pre'}, {label: 'POST', value: 'post'}];

	const header = (
		<form onSubmit={onFilterSubmit}>
			<div className="flex flex-row w-full">
				<span className="p-input-icon-right w-9">
					<i className="pi pi-times" role="button" aria-label="Clear" onClick={clearFilterSearchAndSubmit}/>
					<InputText id="filterSearch" value={filterSearch} onChange={onFilterSearchChange} className="w-full"
						placeholder="NEM Address / Symbol Address / Tx Hash" aria-describedby="filterSearch-help" />
				</span>
				<span className="w-3 ml-5">
					<SelectButton optionLabel="label" optionValue="value" value={filterOptinType} options={optinTypes}
						onChange={onFilterOptinChange}></SelectButton>
				</span>
			</div>
			{
				invalidFilterSearch &&
					<small id="filterSearch-help" className="p-error block">
						Invalid NEM / Symbol Address or Transaction Hash.
					</small>
			}
		</form>
	);
	const nemHashesField = 'nemHashes';
	const symbolHashesField = 'symbolHashes';
	const [nemHashesHeaderSortDirection, setNemHashesHeaderSortDirection] = useState('none');
	const [symbolHashesHeaderSortDirection, setSymbolHashesHeaderSortDirection] = useState('none');
	const headerSortHandler = (_sortField, _sortDirection) => {
		resetTableScroll();
		if(_sortField === nemHashesField) {
			setNemHashesHeaderSortDirection(_sortDirection);
			setSymbolHashesHeaderSortDirection('none');
			setSortBy('nemHashes');
			setSortDirection(_sortDirection);
			setSortBySubmit(true);
		} else {
			setSymbolHashesHeaderSortDirection(_sortDirection);
			setNemHashesHeaderSortDirection('none');
			setSortBy('symbolHashes');
			setSortDirection(_sortDirection);
			setSortBySubmit(true);
		}
	};

	useEffect(() => {
		if (!initialRender.current && (sortBySubmit))
			onFilterSubmit();
	}, [sortBySubmit]);

	const nemHashesHeader = <ColumnHeader field={nemHashesField}  title="Hash"
		sortDirection={nemHashesHeaderSortDirection} onSort={headerSortHandler}/>;
	const symbolHashesHeader = <ColumnHeader field={symbolHashesField} title="Hash"
		sortDirection={symbolHashesHeaderSortDirection} onSort={headerSortHandler}/>;

	return (
		<Table ref={tableRef} value={completed.data} rows={completed.pagination.pageSize}
			onPage={handlePageChange} loading={loading} totalRecords={completed.pagination.totalRecord}
			allPagesLoaded={allPagesLoaded} loadingMessage="Loading more items..."
			first={first} header={header} paginator={'paginator' === paginationType}>
			<Column field="isPostoptin" header="Type" body={isPostoptinTemplate} align="center"/>
			<Column field="label" header="Label" body={labelTemplate} align="left" className="labelCol"/>
			<Column field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<Column field="nemHashes" header={nemHashesHeader} body={nemDateHashesTemplate} align="left"/>
			<Column field="nemBalance" header="Balance" body={nemBalanceTemplate} align="right"/>
			<Column field="symbolAddress" header="Symbol Address" body={symbolAddressTemplate} align="left"/>
			<Column field="symbolHashes" header={symbolHashesHeader} body={symbolDateHashesTemplate} align="left"/>
			<Column field="symbolBalance" header="Balance" body={symbolBalanceTemplate} align="right"/>
		</Table>
	);
};

Completed.defaultProps = {
	defaultPaginationType: 'scroll'
};
export default Completed;
