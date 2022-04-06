import Table from '../../components/Table';
import TableColumn from '../../components/Table/TableColumn';
import config from '../../config';
import Helper from '../../utils/helper';
import { addressTemplate, balanceTemplate } from '../../utils/pageUtils';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { SelectButton } from 'primereact/selectbutton';
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
	const [filterSearch, setFilterSearch] = useState('');
	const [filterOptinType, setFilterOptinType] = useState('');
	const [downloading, setDownloading] = useState(false);

	const fetchCompleted = async ({pageSize = 25, pageNumber = 1}) => {
		return await fetch(`/api/completed?pageSize=${pageSize}&pageNumber=${pageNumber}`).then(res => res.json());
	};

	// TODO use this in the API call
	const parseFilterSearch = filterSearch => {
		if (40 === filterSearch.length) // NEM Address 
			return [filterSearch, '', ''];
		else if (39 === filterSearch.length) // Symbol Address
			return ['', filterSearch, ''];	
		else if (64 === filterSearch.length) // Transaction Hash
			return ['', '', filterSearch];
		return ['', ''];
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

	const onFilterChange = e => {
		const {value} = e.target;
		setFilterSearch(value);
	};

	const onFilterSubmit = async () => {
		await handlePageChange({page: 1, rows: 25, first: 1});
	};

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

	const optinTypes = [{label: 'Pre-launch', value: 'pre-launch'}, {label: 'Post-launch', value: 'post-launch'}];

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
						onChange={e => setFilterOptinType(e.value)}></SelectButton>
				</div>
				<Button type="button" icon="pi pi-search" className="p-button-outlined" onClick={onFilterSubmit} />

			</div>
			<div className="formgroup-inline">
				<Button type="button" icon="pi pi-download" className="p-button-outlined" onClick={downloadAllAsCSV} 
					loading={downloading} tooltip="Download All Data as CSV File" tooltipOptions={{position: 'top'}}/>
			</div>
		</div>
	);

	return (
		<Table value={completed.data} paginator rows={completed.pagination.pageSize} 
			onPage={handlePageChange} loading={loading} totalRecords={completed.pagination.totalRecord}
			first={first} header={header}>
			<TableColumn field="optin_id" header="Opt-in ID" align="left"/>
			<TableColumn field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"/>
			<TableColumn field="nemBalance" header="NEM Balance" body={nemBalanceTemplate} align="right"/>
			<TableColumn field="symbolAddress" header="Symbol Address" body={symbolAddressTemplate} align="left"/>
			<TableColumn field="symbolBalance" header="Symbol Balance" body={symbolBalanceTemplate} align="right"/>
		</Table>
	);
};

export default Completed;
