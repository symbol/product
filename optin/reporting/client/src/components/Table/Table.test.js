import Table from './';
import Helper from '../../utils/helper';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import { Column } from 'primereact/column';
import React from 'react';

describe('Table Component', () => {
	const testTableComponentOnScroll = async ({allPagesLoaded, expectHandlePageChangeToBeCalled}) => {
		// Arrange:
		const expectedPostOptin = 'POST';
		const completed = {
			data: Helper.fillArray(100, {isPostoptin: expectedPostOptin}),
			pagination: {
				pageNumber: 0,
				pageSize: 20,
				totalRecord: 0
			}
		};
		const handlePageChange = jest.fn();
		const paginationType = 'scroll';
		const loading = false;
		const first = true;
		const headerPaneText = 'Filter Pane';
		const header = <div>{headerPaneText}</div>;

		const tableRef = React.createRef();
		render(<Table ref={tableRef} value={completed.data} rows={completed.pagination.pageSize}
			onPage={handlePageChange} loading={loading} totalRecords={completed.pagination.totalRecord}
			allPagesLoaded={allPagesLoaded} loadingMessage="Loading more items..."
			first={first} header={header} paginator={'paginator' === paginationType}>
			<Column field="isPostoptin" header="Type" align="center"/>
		</Table>);

		// Act:
		// scroll and test if handlePageChange is called
		// eslint-disable-next-line testing-library/no-node-access
		const scrollContainer = tableRef.current.el.lastChild;

		fireEvent.scroll(scrollContainer, { target: { scrollY: 1000} });

		// Assert:
		if (expectHandlePageChangeToBeCalled)
			await waitFor(() => {expect(handlePageChange).toHaveBeenCalled();});
		else
			await waitFor(() => {expect(handlePageChange).not.toHaveBeenCalled();});

	};

	it('should render table component', () => {
		// Arrange:
		const expectedPostOptin = 'POST';
		const completed = {
			data: [{isPostoptin: expectedPostOptin}],
			pagination: {
				pageNumber: 0,
				pageSize: 200,
				totalRecord: 0
			}
		};
		const handlePageChange = jest.fn();
		const paginationType = 'scroll';
		const loading = false;
		const allPagesLoaded = true;
		const first = true;
		const headerPaneText = 'Filter Pane';
		const header = <div>{headerPaneText}</div>;

		// Act:
		render(<Table value={completed.data} rows={completed.pagination.pageSize}
			onPage={handlePageChange} loading={loading} totalRecords={completed.pagination.totalRecord}
			allPagesLoaded={allPagesLoaded} loadingMessage="Loading more items..."
			first={first} header={header} paginator={'paginator' === paginationType}>
			<Column field="isPostoptin" header="Type" align="center"/>
		</Table>);

		// Assert:
		expect(screen.getByText(headerPaneText)).toBeInTheDocument();
		expect(screen.getByText(expectedPostOptin)).toBeInTheDocument();
	});

	it('should call page change handler on enough scroll', async () => {
		await testTableComponentOnScroll({allPagesLoaded: false, expectHandlePageChangeToBeCalled: true});
	});

	it('should not call page change handler on scroll when all pages are already loaded', async () => {
		await testTableComponentOnScroll({allPagesLoaded: true, expectHandlePageChangeToBeCalled: false});
	});
});
