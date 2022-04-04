import config from '../../config';
import Helper from '../../utils/helper';
import { Column } from 'primereact/column';
import { DataTable} from 'primereact/datatable';
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

	const fetchCompleted = async ({pageSize = 25, pageNumber = 1}) => {
		return await fetch(`/api/completed?pageSize=${pageSize}&pageNumber=${pageNumber}`).then(res => res.json());
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

	const addressTemplate = (rowData, key) => {
		return (
			<React.Fragment>
				{
					rowData[key].map(address => 
						<div>
							<a href={config.keyRedirects[key] + address} target="_blank" rel="noreferrer">
								{address}
							</a>
						</div>)
				}
				<React.Fragment>
					{renderTotalText(rowData[key])}
				</React.Fragment>
			</React.Fragment>
		);
	};

	const nemAddressTemplate = rowData => {
		return addressTemplate(rowData, 'nemAddress');
	};
  
	const symbolAddressTemplate = rowData => {
		return addressTemplate(rowData, 'symbolAddress');
	};

	const balanceTemplate = (rowData, key) => {
		return (
			<React.Fragment>
				{
					rowData[key].map(balance => 
						<div>
							{Helper.toRelativeAmount(balance).toLocaleString('en-US', { minimumFractionDigits: 6 })}
						</div>)
				}
				<React.Fragment>
					{renderTotalValue(rowData[key])}
				</React.Fragment>
			</React.Fragment>
		);
	};


	const nemBalanceTemplate = rowData => {
		return balanceTemplate(rowData, 'nemBalance');
	};

	const symbolBalanceTemplate = rowData => {
		return balanceTemplate(rowData, 'symbolBalance');
	};
	
	const renderTotalText = values => {
		if (2 > values.length)
			return null;
	
		return (<div className="sub-total-text">Total:</div>);
		
	};
	const renderTotalValue = balances => {
		if (2 > balances.length)
			return null;
	
		const total = balances.reduce((balance, currentBalance) => balance + currentBalance, 0);
		const formattedBalance = Helper.toRelativeAmount(total).toLocaleString('en-US', { minimumFractionDigits: 6 });
		return (<div className="sub-total-value">{formattedBalance}</div>);
		
	};

	return (
		<DataTable lazy value={completed.data} stripedRows showGridlines responsiveLayout="stack" breakpoint="960px" paginator
			paginatorTemplate="CurrentPageReport FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
			currentPageReportTemplate="Showing {first}-{last} of {totalRecords}" rows={completed.pagination.pageSize} 
			rowsPerPageOptions={[10,25,50]}	onPage={handlePageChange} 
			loading={loading} totalRecords={completed.pagination.totalRecord} first={first}>
			<Column field="optin_id" header="Opt-in ID" align="left"></Column>
			<Column field="nemAddress" header="NEM Address" body={nemAddressTemplate} align="left"></Column>
			<Column field="nemBalance" header="NEM Balance" body={nemBalanceTemplate} align="right"/>
			<Column field="symbolAddress" header="Symbol Address" body={symbolAddressTemplate} align="left"></Column>
			<Column field="symbolBalance" header="Symbol Balance" body={symbolBalanceTemplate} align="right"></Column>
		</DataTable>
	);
};

export default Completed;
