import ReportTable from '@/components/ReportTable';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

const REQUEST_TAB = {
	resource: 'requests',
	sourceAsset: { ticker: 'XYM', divisibility: 6 },
	destinationAsset: { ticker: 'WXYM', divisibility: 6 },
	sourceNetwork: 'nativeNetwork',
	destinationNetwork: 'wrappedNetwork'
};

const ERROR_TAB = {
	...REQUEST_TAB,
	resource: 'errors'
};

const CONFIGURATION = {
	nativeNetwork: {
		blockchain: 'symbol',
		explorerUrl: 'https://symbol.example'
	},
	wrappedNetwork: {
		blockchain: 'ethereum',
		explorerUrl: 'https://ethereum.example'
	}
};

const REQUEST_ROW = {
	destinationAddress: '0x1f533cd9711049fA7604D0F49C45B6e5Af30ef8e',
	errorMessage: null,
	payoutConversionRate: '1000000',
	payoutNetAmount: '299642570825',
	payoutSentTimestamp: 4,
	payoutStatus: 2,
	payoutTimestamp: 3,
	payoutTotalFee: '357429175',
	payoutTransactionHash: 'A'.repeat(64),
	payoutTransactionHeight: '11',
	requestAmount: '300000000000',
	requestTimestamp: 2,
	requestTransactionHash: 'B'.repeat(64),
	requestTransactionHeight: '10',
	requestTransactionSubindex: -1,
	senderAddress: 'TCONKG47FW2ZEZBPV6G7F422LXBDSMVT3JMYM4I'
};

const ERROR_ROW = {
	errorMessage: 'Required message is missing',
	requestTimestamp: 5,
	requestTransactionHash: 'C'.repeat(64),
	requestTransactionHeight: '13',
	requestTransactionSubindex: -1,
	senderAddress: 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY'
};

const renderTable = ({
	configuration = CONFIGURATION,
	onSortChange = jest.fn(),
	rows = [REQUEST_ROW],
	sort = 0,
	tab = REQUEST_TAB
} = {}) => {
	const reportTable = (
		<ReportTable
			configuration={configuration}
			onSortChange={onSortChange}
			rows={rows}
			sort={sort}
			tab={tab}
		/>
	);
	const result = render(reportTable);

	return {
		...result,
		onSortChange,
		table: screen.getByRole('table'),
		mobileCard: screen.getByRole('article')
	};
};

describe('ReportTable', () => {
	it('renders and formats request report fields', () => {
		// Arrange:
		const { table } = renderTable();

		// Act:
		const tableView = within(table);

		// Assert:
		expect(tableView.getByText('Completed')).toBeInTheDocument();
		expect(tableView.getByText('TCONKG47F…JMYM4I')).toHaveAttribute('title', 'TCONKG47FW2ZEZBPV6G7F422LXBDSMVT3JMYM4I');
		expect(tableView.getByText('AAAAAAAA…AAAAAA')).toHaveAttribute('title', 'A'.repeat(64));
		expect(tableView.getByText('300000')).toBeInTheDocument();
		expect(tableView.getByText('0x1f533cd…30ef8e')).toHaveAttribute('title', '0x1f533cd9711049fA7604D0F49C45B6e5Af30ef8e');
		expect(tableView.getByText('BBBBBBBB…BBBBBB')).toHaveAttribute('title', 'B'.repeat(64));
		expect(tableView.getByText('1')).toHaveAttribute('title', '1000000 PPM');
		expect(tableView.getByText('357.429175')).toBeInTheDocument();
		expect(tableView.getByText('299642.570825')).toBeInTheDocument();
		expect(tableView.getByText('1970-01-01 00:00:02 UTC')).toBeInTheDocument();
		expect(tableView.getByText('1970-01-01 00:00:03 UTC')).toBeInTheDocument();
	});

	it('renders failed status details through an accessible tooltip', () => {
		// Arrange:
		const { table } = renderTable({
			rows: [{
				...REQUEST_ROW,
				errorMessage: 'Payout rejected',
				payoutStatus: 3
			}]
		});

		// Act:
		const failedStatus = within(table).getByLabelText('Failed: Payout rejected');

		// Assert:
		expect(failedStatus).toHaveTextContent('Failed');
		expect(failedStatus).toHaveAttribute('data-tooltip', 'Payout rejected');
	});

	it('renders links addresses and transactions to their configured explorers', () => {
		// Arrange:
		const { table } = renderTable();
		const tableView = within(table);
		const symbolTransactionUrl = `https://symbol.example/transactions/${REQUEST_ROW.requestTransactionHash}`;
		const ethereumTransactionUrl = `https://ethereum.example/tx/0x${REQUEST_ROW.payoutTransactionHash}`;

		// Act:
		const senderLink = tableView.getByTitle(REQUEST_ROW.senderAddress);
		const requestLink = tableView.getByTitle(REQUEST_ROW.requestTransactionHash);
		const destinationLink = tableView.getByTitle(REQUEST_ROW.destinationAddress);
		const payoutLink = tableView.getByTitle(REQUEST_ROW.payoutTransactionHash);

		// Assert:
		expect(senderLink).toHaveAttribute(
			'href',
			`https://symbol.example/accounts/${REQUEST_ROW.senderAddress}`
		);
		expect(requestLink).toHaveAttribute('href', symbolTransactionUrl);
		expect(destinationLink).toHaveAttribute(
			'href',
			`https://ethereum.example/address/${REQUEST_ROW.destinationAddress}`
		);
		expect(payoutLink).toHaveAttribute('href', ethereumTransactionUrl);
	});

	it('renders the active sort direction and handles sort changes', () => {
		// Arrange:
		const onSortChange = jest.fn();
		const { table } = renderTable({ onSortChange });
		const sortButton = within(table).getByRole('button', {
			name: 'Sort by request block height ascending'
		});

		// Act:
		fireEvent.click(sortButton);

		// Assert:
		expect(onSortChange).toHaveBeenCalledTimes(1);
		expect(sortButton.closest('th')).toHaveAttribute('aria-sort', 'descending');
	});

	const runDescendingSortTest = (params) => {
		// Arrange:
		const { table } = renderTable(params);

		// Act:
		const sortButton = within(table).getByRole('button', {
			name: 'Sort by request block height descending'
		});

		// Assert:
		expect(sortButton).toHaveTextContent('↑');
		expect(sortButton.closest('th')).toHaveAttribute('aria-sort', 'ascending');
	}

	it('renders the descending sort direction for request reports', () => {
		runDescendingSortTest({sort: 1})
	});

	it('renders the descending sort direction for error reports', () => {
		runDescendingSortTest({
			rows: [ERROR_ROW],
			sort: 1,
			tab: ERROR_TAB
		})
	});

	it('renders and formats errors report fields', () => {
		// Arrange:
		const { table } = renderTable({
			rows: [ERROR_ROW],
			tab: ERROR_TAB
		});

		// Act:
		const tableView = within(table);

		// Assert:
		expect(tableView.getByText('TARDV42KT…IXVJQY')).toHaveAttribute('title', 'TARDV42KTAIZEF64EQT4NXT7K55DHWBEFIXVJQY');
		expect(tableView.getByText('CCCCCCCC…CCCCCC')).toHaveAttribute('title', 'C'.repeat(64));
		expect(tableView.getByText('Required message is missing')).toBeInTheDocument();
	});

	it('renders and formats request mobile card fields', () => {
		// Arrange:
		const { mobileCard } = renderTable();

		// Act:
		const cardView = within(mobileCard);

		// Assert:
		expect(cardView.getByText('#10')).toBeInTheDocument();
		expect(cardView.getByText('Completed')).toBeInTheDocument();
		expect(cardView.getByText('Sender')).toBeInTheDocument();
		expect(cardView.getByText('TCONKG47F…JMYM4I')).toHaveAttribute('title', REQUEST_ROW.senderAddress);
		expect(cardView.getByText('Request')).toBeInTheDocument();
		expect(cardView.getByText('BBBBBBBB…BBBBBB')).toHaveAttribute('title', REQUEST_ROW.requestTransactionHash);
		expect(cardView.getByText('300000')).toBeInTheDocument();
		expect(cardView.getByText('Payout Address')).toBeInTheDocument();
		expect(cardView.getByText('0x1f533cd…30ef8e')).toHaveAttribute('title', REQUEST_ROW.destinationAddress);
		expect(cardView.getByText('AAAAAAAA…AAAAAA')).toHaveAttribute('title', REQUEST_ROW.payoutTransactionHash);
		expect(cardView.getByText('1')).toHaveAttribute('title', '1000000 PPM');
		expect(cardView.getByText('357.429175')).toBeInTheDocument();
		expect(cardView.getByText('299642.570825')).toBeInTheDocument();
	});

	it('renders and formats errors mobile card fields', () => {
		// Arrange:
		const { mobileCard } = renderTable({
			rows: [ERROR_ROW],
			tab: ERROR_TAB
		});

		// Act:
		const cardView = within(mobileCard);

		// Assert:
		expect(cardView.getByText('#13')).toBeInTheDocument();
		expect(cardView.getByText('Error')).toBeInTheDocument();
		expect(cardView.getByText('Sender')).toBeInTheDocument();
		expect(cardView.getByText('TARDV42KT…IXVJQY')).toHaveAttribute('title', ERROR_ROW.senderAddress);
		expect(cardView.getByText('Request')).toBeInTheDocument();
		expect(cardView.getByText('CCCCCCCC…CCCCCC')).toHaveAttribute('title', ERROR_ROW.requestTransactionHash);
		expect(cardView.getByText('1970-01-01 00:00:05 UTC')).toBeInTheDocument();
		expect(cardView.getByText('Required message is missing')).toBeInTheDocument();
	});

	it('renders unknown payout status', () => {
		// Arrange:
		const row = {
			...REQUEST_ROW,
			payoutStatus: 99
		};

		// Act:
		renderTable({ rows: [row] });

		// Assert:
		expect(screen.getAllByText('Unknown')).toHaveLength(2);
	});

	it('renders values without links when explorer URLs are unavailable', () => {
		// Arrange:
		const configuration = {
			nativeNetwork: { blockchain: 'symbol' },
			wrappedNetwork: { blockchain: 'ethereum' }
		};
		const { table } = renderTable({ configuration });

		// Act:
		const tableView = within(table);
		const senderValue = tableView.getByTitle(REQUEST_ROW.senderAddress);
		const requestValue = tableView.getByTitle(REQUEST_ROW.requestTransactionHash);

		// Assert:
		expect(senderValue).not.toHaveAttribute('href');
		expect(requestValue).not.toHaveAttribute('href');
	});

	it('renders empty title when value is unavailable', () => {
		// Arrange:
		const row = {
			...REQUEST_ROW,
			payoutConversionRate: null,
			requestAmount: null,
			senderAddress: null
		};
		const { table } = renderTable({ rows: [row] });

		// Act:
		const cells = within(table).getAllByRole('cell');

		// Assert:
		expect(cells[1].firstChild).toHaveAttribute('title', '');
		expect(cells[3].firstChild).toHaveAttribute('title', '');
		expect(cells[6].firstChild).toHaveAttribute('title', '');
	});

	it('renders a placeholder when an error message is unavailable', () => {
		// Arrange:
		const row = {
			...ERROR_ROW,
			errorMessage: null
		};

		// Act:
		renderTable({
			rows: [row],
			tab: ERROR_TAB
		});

		// Assert:
		expect(screen.getAllByText('—')).toHaveLength(2);
	});
});
