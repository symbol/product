import Table from '../../components/Table';
import config from '../../config';
import { TablePagination } from '@trendmicro/react-paginations';
import React, { useState, useEffect } from 'react';
import '@trendmicro/react-paginations/dist/react-paginations.css';

const Balances = function () {
	const [balances, setBalances] = useState({
		data: [],
		pagination: {
			pageNumber: 1,
			pageSize: 25,
			totalRecord: 0
		}
	});

	const fetchBalances = async ({pageSize = 25, pageNumber = 1}) => {
		return await fetch(`/api/balances?pageSize=${pageSize}&pageNumber=${pageNumber}`).then(res => res.json());
	};

	const handlePageChange = async ({page, pageLength}) =>{
		const result = await fetchBalances({
			pageNumber: page,
			pageSize: pageLength
		});

		setBalances(result);
	};

	useEffect(() => {
		const getBalances = async () => {
			const result = await fetchBalances({
				pageNumber: 1
			});
			setBalances(result);
		};

		getBalances();
	}, []);

	return (
		<>
			<Table
				dataList={balances}
				formatting={config}
				filterable={false}
				pageable={false}
			/>
			<TablePagination
				className='pagination'
				type='full'
				page={balances.pagination.pageNumber}
				pageLength={balances.pagination.pageSize}
				totalRecords={balances.pagination.totalRecord}
				onPageChange={handlePageChange}
				prevPageRenderer={() => <i className='arrow left' />}
				nextPageRenderer={() => <i className='arrow right' />}
			/>
		</>

	);
};

export default Balances;
