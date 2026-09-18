import '@testing-library/jest-dom';
import { setDevice } from '../../../test-utils/device';
import * as BlockService from '@/app/api/blocks';
import * as StatsService from '@/app/api/stats';
import config from '@/app/config';
import BlockList, { getServerSideProps } from '@/app/pages/blocks/index';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { mockIsIntersecting } from 'react-intersection-observer/test-utils';

jest.mock('@/app/api/blocks', () => ({
	__esModule: true,
	fetchBlockPage: jest.fn(),
	fetchChainStatus: jest.fn().mockResolvedValue(null)
}));

jest.mock('@/app/api/stats', () => ({
	__esModule: true,
	fetchBlockStats: jest.fn()
}));

jest.mock('@/app/variants/page-config', () => ({
	__esModule: true,
	pageConfig: require('../../../../variants/symbol/config/pages').default
}));

jest.mock('@/app/variants/utils', () => ({
	__esModule: true,
	utils: require('../../../../variants/symbol/utils')
}));

const symbolNativeMosaicConfig = {
	PUBLIC_NATIVE_MOSAIC_ID: '72C0212E67A08BCE',
	PUBLIC_NATIVE_MOSAIC_TICKER: 'XYM',
	PUBLIC_NATIVE_MOSAIC_DIVISIBILITY: 6
};
const originalNativeMosaicConfig = {
	PUBLIC_NATIVE_MOSAIC_ID: config.PUBLIC_NATIVE_MOSAIC_ID,
	PUBLIC_NATIVE_MOSAIC_TICKER: config.PUBLIC_NATIVE_MOSAIC_TICKER,
	PUBLIC_NATIVE_MOSAIC_DIVISIBILITY: config.PUBLIC_NATIVE_MOSAIC_DIVISIBILITY
};

const createBlock = (height, overrides = {}) => ({
	height,
	harvester: `N${'A'.repeat(34)}${String(height).padStart(5, '0')}`,
	transactionCount: height + 1,
	statementCount: height + 2,
	totalFee: 8.125,
	blockReward: 12.5,
	timestamp: '2026-09-15T01:02:03Z',
	isFinalized: height === 100,
	...overrides
});

const blockPageData = [
	createBlock(100, {
		harvester: 'NAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
		transactionCount: 13,
		statementCount: 7,
		totalFee: 17.125,
		blockReward: null
	}),
	createBlock(99, {
		harvester: 'NBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
		transactionCount: 14,
		statementCount: 8,
		totalFee: 23.625,
		blockReward: 0,
		isFinalized: false
	}),
	createBlock(98, {
		transactionCount: 15,
		statementCount: 9,
		totalFee: 37.123456,
		blockReward: 191.997042,
		isFinalized: false
	}),
	...Array.from({ length: 7 }, (_, index) => createBlock(97 - index))
];

const blockPage = {
	data: blockPageData,
	pageNumber: 1,
	isLastPage: false,
	nextPageParams: { fromHeight: 90, sort: 'DESC' }
};

const getBlockContainer = (device, height) => {
	const selector = device === 'mobile' ? '[class*="itemBlockMobile"]' : '[class*="dataRow"]';
	return screen.getAllByText(String(height), { exact: true })
		.map(heightText => heightText.closest(selector))
		.find(Boolean);
};

const getDesktopColumn = (columnName, blockRow) => {
	const headerCell = screen.getByText(columnName, { exact: true }).closest('[class*="headerCell"]');
	const columnIndex = Array.from(headerCell.parentElement.children).indexOf(headerCell);
	return blockRow.children[columnIndex];
};

const getBlockRewardContainer = (device, height) => {
	const blockContainer = getBlockContainer(device, height);
	if (device === 'desktop')
		return getDesktopColumn('table_field_blockReward', blockContainer);

	return within(blockContainer).getByText('table_field_blockReward', { exact: true }).parentElement;
};

const getFeeContainer = (device, height) => {
	const blockContainer = getBlockContainer(device, height);
	if (device === 'desktop')
		return getDesktopColumn('table_field_totalFee', blockContainer);

	return blockContainer.querySelector('[class*="mainSection"]');
};

const expectMosaicAmount = (container, amount) => {
	const [integer, decimal] = String(amount).split('.');
	expect(within(container).getByText(integer, { exact: true })).toBeInTheDocument();
	if (decimal)
		expect(within(container).getByText(`.${decimal}`, { exact: true })).toBeInTheDocument();
};

const renderBlockPage = props => render(<BlockList {...props} />);

beforeAll(() => {
	jest.useFakeTimers();
});

describe('Symbol block list page', () => {
	beforeEach(() => {
		Object.assign(config, symbolNativeMosaicConfig);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.restoreAllMocks();
		Object.assign(config, originalNativeMosaicConfig);
	});

	it('does not fetch statistics and carries the SSR cursor state', async () => {
		// Arrange:
		const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage').mockResolvedValue(blockPage);
		const fetchBlockStats = jest.spyOn(StatsService, 'fetchBlockStats');

		// Act:
		const result = await getServerSideProps({ locale: 'en' });

		// Assert:
		expect(fetchBlockPage).toHaveBeenCalledWith();
		expect(fetchBlockStats).not.toHaveBeenCalled();
		expect(result.props).toEqual(expect.objectContaining({
			blocks: blockPage.data,
			blockPage,
			isBlockPageError: false,
			stats: null
		}));
	});

	it('passes the SSR cursor through the page hook and appends one continuation page', async () => {
		// Arrange:
		const nextBlockPage = {
			data: Array.from({ length: 10 }, (_, index) => createBlock(90 - index)),
			pageNumber: 2,
			isLastPage: false,
			nextPageParams: { fromHeight: 80, sort: 'DESC' }
		};
		const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage')
			.mockResolvedValueOnce(blockPage)
			.mockResolvedValueOnce(nextBlockPage);
		const serverResult = await getServerSideProps({ locale: 'en' });

		// Act: pass SSR props directly, then enter and leave the pagination sentinel once.
		const { container } = renderBlockPage(serverResult.props);
		await waitFor(() => expect(container.querySelector('[class*="tablePageLoader"] > div')).toBeInTheDocument());
		const paginationTarget = container.querySelector('[class*="tablePageLoader"] > div');
		act(() => mockIsIntersecting(paginationTarget, true));
		act(() => mockIsIntersecting(paginationTarget, false));
		act(() => {
			jest.runOnlyPendingTimers();
		});

		// Assert:
		await waitFor(() => expect(screen.getByText('81', { exact: true })).toBeInTheDocument());
		expect(fetchBlockPage).toHaveBeenNthCalledWith(1);
		expect(fetchBlockPage).toHaveBeenNthCalledWith(2, { fromHeight: 90, sort: 'DESC', pageNumber: 2 });
		const displayedHeights = screen.getAllByRole('link')
			.map(link => link.getAttribute('href'))
			.filter(href => /^\/blocks\/\d+$/.test(href))
			.map(href => Number(href.split('/').at(-1)));
		expect(displayedHeights).toHaveLength(20);
		expect(new Set(displayedHeights).size).toBe(20);
		expect(displayedHeights).toEqual(expect.arrayContaining([
			...Array.from({ length: 10 }, (_, index) => 100 - index),
			...Array.from({ length: 10 }, (_, index) => 90 - index)
		]));
	});

	it('renders finalized state and Symbol-only fields on desktop', () => {
		// Act:
		setDevice('desktop');
		renderBlockPage({ blocks: blockPage.data, blockPage, isBlockPageError: false, stats: null });

		// Assert:
		expect(screen.getByText('table_field_statementCount')).toBeInTheDocument();
		expect(screen.getByText('table_field_blockReward')).toBeInTheDocument();
		expect(within(getBlockContainer('desktop', 100)).getByAltText('label_finalized')).toBeInTheDocument();
		expect(within(getBlockContainer('desktop', 99)).getByAltText('label_created')).toBeInTheDocument();
		expect(screen.queryByText('field_blockGenerationTime')).not.toBeInTheDocument();
	});

	it('renders Symbol-only fields on mobile', () => {
		// Act:
		setDevice('mobile');
		renderBlockPage({ blocks: blockPage.data, blockPage, isBlockPageError: false, stats: null });

		// Assert:
		expect(screen.getAllByText('table_field_transactionCount').length).toBeGreaterThan(0);
		expect(screen.getAllByText('table_field_statementCount').length).toBeGreaterThan(0);
		expect(screen.getAllByText('table_field_blockReward').length).toBeGreaterThan(0);
		expect(within(getBlockContainer('mobile', 100)).getByAltText('label_finalized')).toBeInTheDocument();
	});

	it.each(['desktop', 'mobile'])('renders Symbol list navigation hrefs: %s', device => {
		// Arrange:
		setDevice(device);
		const { container } = renderBlockPage({ blocks: blockPage.data, blockPage, isBlockPageError: false, stats: null });

		// Assert the links match the displayed block and harvester, and use the Symbol testnet mosaic.
		const firstBlock = getBlockContainer(device, 100);
		expect(within(firstBlock).getByText('100', { exact: true }).closest('a')).toHaveAttribute('href', '/blocks/100');
		expect(within(firstBlock).getByText('NAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', { exact: true }).closest('a'))
			.toHaveAttribute('href', '/accounts/NAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
		expect(container.querySelector('a[href="/mosaics/72C0212E67A08BCE"]')).toBeInTheDocument();
		expect(config).toMatchObject(symbolNativeMosaicConfig);
	});

	it.each(['desktop', 'mobile'])('renders reward values in their block field and keeps fees distinct: %s', device => {
		// Arrange:
		setDevice(device);
		renderBlockPage({ blocks: blockPage.data, blockPage, isBlockPageError: false, stats: null });

		// Assert each reward in its own row/card field and distinguish its fee value.
		const cases = [
			{ height: 100, reward: null, fee: 17.125 },
			{ height: 99, reward: 0, fee: 23.625 },
			{ height: 98, reward: 191.997042, fee: 37.123456 }
		];
		cases.forEach(({ height, reward, fee }) => {
			const rewardContainer = getBlockRewardContainer(device, height);
			if (reward === null) {
				expect(within(rewardContainer).getByText('-', { exact: true })).toBeInTheDocument();
				expect(within(rewardContainer).queryByRole('link')).not.toBeInTheDocument();
			} else {
				expectMosaicAmount(rewardContainer, reward);
				expect(within(rewardContainer).getByRole('link')).toHaveAttribute('href', '/mosaics/72C0212E67A08BCE');
			}
			expectMosaicAmount(getFeeContainer(device, height), fee);
		});
	});

	it('keeps an SSR retrieval failure retryable instead of showing an empty success', async () => {
		// Arrange:
		const fetchBlockPage = jest.spyOn(BlockService, 'fetchBlockPage').mockRejectedValueOnce(Error('request failed'));
		const fetchBlockStats = jest.spyOn(StatsService, 'fetchBlockStats');
		const serverResult = await getServerSideProps({ locale: 'en' });
		fetchBlockPage.mockResolvedValueOnce(blockPage);

		// Act:
		renderBlockPage(serverResult.props);

		// Assert the initial failure is not an empty success, then retry the initial request.
		expect(fetchBlockPage).toHaveBeenCalledTimes(1);
		expect(screen.getByText('button_tryAgain')).toBeInTheDocument();
		expect(screen.queryByText('message_emptyTable')).not.toBeInTheDocument();
		fireEvent.click(screen.getByText('button_tryAgain'));
		act(() => {
			jest.runAllTimers();
		});
		await waitFor(() => expect(screen.getByText('100', { exact: true })).toBeInTheDocument());
		expect(fetchBlockPage).toHaveBeenCalledTimes(2);
		expect(fetchBlockStats).not.toHaveBeenCalled();
	});
});
