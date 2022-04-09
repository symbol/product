import Table from '../../components/Table';
import TableColumn from '../../components/Table/TableColumn';
import config from '../../config';
import Helper from '../../utils/helper';
import { addressTemplate, balanceTemplate, transactionHashTemplate, optinTypeTemplate, infoTemplate } from '../../utils/pageUtils';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
import React, { useState, useEffect } from 'react';

const Completed = ({defaultPaginationType}) => {
	const [loading, setLoading] = useState(true);
	const [first, setFirst] = useState(1);
	const [paginationType, setPaginationType] = useState(defaultPaginationType);

	const [completed, setCompleted] = useState({
		data: [],
		pagination: {
			pageNumber: 1,
			pageSize: 25,
			totalRecord: 0
		}
	});
	const [filterSearch, setFilterSearch] = useState('');
	const [filterOptinType, setFilterOptinType] = useState('');
	const [downloading, setDownloading] = useState(false);

	const fetchCompleted = async ({pageSize = 25, pageNumber = 1}) => {
		const [nemAddress, symbolAddress, transactionHash] = parseFilterSearch(filterSearch);
		return await fetch(`/api/completed?pageSize=${pageSize}&pageNumber=${pageNumber}
		&nemAddress=${nemAddress}&symbolAddress=${symbolAddress}&transactionHash=${transactionHash}&optinType=${filterOptinType}`)
		.then(res => res.json());
	};

	const parseFilterSearch = filterSearch => {
		if (40 === filterSearch.length) // NEM Address
			return [filterSearch, '', ''];
		else if (39 === filterSearch.length) // Symbol Address
			return ['', filterSearch, ''];
		else if (64 === filterSearch.length) // Transaction Hash
			return ['', '', filterSearch];
		return ['', '', ''];
	};

	const handlePageChange = async ({page, rows, first}) =>{
		const nextPage = 	page ?? (completed.pagination.pageNumber || 0) + 1;
		setLoading(true);
		setFirst(first);
		const result = await fetchCompleted({
			pageNumber: nextPage,
			pageSize: rows
		});

		if ('scroll' === paginationType && 1 !== nextPage)
			setCompleted({data: [...completed.data, ...result.data], pagination: result.pagination});
		else
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

	const onFilterChange = e => {
		const {value} = e.target;
		setFilterSearch(value);
	};

	const onFilterSubmit = async () => {
		await handlePageChange({page: 1, rows: 25});
	};

	const downloadAllAsCSV = async () => {
		await Helper.downloadAllAsCSV({apiUrl: '/api/completed/download', fileName: 'optin-completed.csv', setDownloading});
	};

	// const onPaginationTypeChange = async e => {
	// 	setPaginationType(e.value ? 'scroll' : 'paginator');
	// 	await onFilterSubmit();
	// };

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
		<div className='flex justify-content-between'>
			<div className="formgroup-inline">
				<span className="p-input-icon-left field">
					<i className="pi pi-search" />
					<span className="p-input-icon-right">
						<i className="pi pi-times" onClick={() => setFilterSearch('')}/>
						<InputText value={filterSearch} onChange={onFilterChange}
							placeholder="NEM Address / Symbol Address / Transaction Hash" className='w-28rem' />
					</span>
				</span>
				<div className='field'>
					<SelectButton optionLabel="label" optionValue="value" value={filterOptinType} options={optinTypes}
						onChange={e => setFilterOptinType(e.value)}>
					</SelectButton>
				</div>
				<Button type="button" icon="pi pi-search" className="p-button-outlined" onClick={onFilterSubmit} />

			</div>
			<div className="formgroup-inline">
				{/* <div className="card" style={{marginRight: '20px'}}>
					<h5 style={{margin: 0, marginLeft: '-15px', color: '#b4b2b2'}}>Infinite Scroll</h5>
					<InputSwitch checked={'scroll' === paginationType}
						onChange={onPaginationTypeChange}/>
				</div> */}
				<Button type="button" icon="pi pi-download" className="p-button-outlined" onClick={downloadAllAsCSV}
					loading={downloading} tooltip="Download All Data as CSV File" tooltipOptions={{position: 'top'}}/>
			</div>
		</div>
	);

	return (
		<Table value={completed.data} rows={completed.pagination.pageSize}
			onPage={handlePageChange} loading={loading} totalRecords={completed.pagination.totalRecord}
			first={first} header={header} paginator={'paginator' === paginationType}>
			<TableColumn field="optin_id" header="#" align="left"/>
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
