import { symbolBlockInfoResult } from '../../../test-utils/blocks';
import { setDevice } from '../../../test-utils/device';
import * as BlockService from '@/app/api/blocks';
import * as TransactionService from '@/app/api/transactions';
import config from '@/app/config';
import BlockInfo from '@/app/pages/blocks/[height]';
import { act, render, screen, within } from '@testing-library/react';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';

jest.mock('@/app/api/blocks', () => ({
	__esModule: true,
	fetchChainStatus: jest.fn()
}));

jest.mock('@/app/api/transactions', () => ({
	__esModule: true,
	fetchTransactionPage: jest.fn()
}));

jest.mock('@/app/variants/page-config', () => ({
	__esModule: true,
	pageConfig: require('../../../../variants/symbol/config/pages').default
}));

jest.mock('@/app/variants/components', () => ({
	__esModule: true,
	variantComponents: require('../../../../variants/symbol/components').default
}));

jest.mock('@/app/variants/utils', () => ({
	__esModule: true,
	utils: require('../../../../variants/symbol/utils')
}));

const getFieldValue = name => screen.getByText(`field_${name}`, { exact: true }).parentElement.lastElementChild;

describe('Symbol block details', () => {
	const originalMosaicConfig = {
		PUBLIC_NATIVE_MOSAIC_ID: config.PUBLIC_NATIVE_MOSAIC_ID,
		PUBLIC_NATIVE_MOSAIC_TICKER: config.PUBLIC_NATIVE_MOSAIC_TICKER
	};

	beforeEach(() => {
		config.PUBLIC_NATIVE_MOSAIC_ID = '72C0212E67A08BCE';
		config.PUBLIC_NATIVE_MOSAIC_TICKER = 'XYM';
	});

	afterEach(() => {
		Object.assign(config, originalMosaicConfig);
	});

	const renderPage = async (overrides = {}) => {
		mockAllIsIntersecting(false);
		jest.spyOn(BlockService, 'fetchChainStatus').mockResolvedValue({ height: 720, finalizedHeight: 720 });
		jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue({ data: [], pageNumber: 1, isLastPage: true });

		let view;
		await act(async () => {
			view = render(<BlockInfo blockInfo={{ ...symbolBlockInfoResult, ...overrides }} />);
		});
		return view;
	};

	it.each(['desktop', 'mobile'])('renders the additional block fields on %s', async device => {
		// Arrange:
		setDevice(device);

		// Act:
		await renderPage();

		// Assert:
		expect(getFieldValue('blockType')).toHaveTextContent('value_blockType_importance');
		expect(within(getFieldValue('beneficiary')).getByRole('link'))
			.toHaveAttribute('href', `/accounts/${symbolBlockInfoResult.beneficiaryAddress}`);
		expect(getFieldValue('statementCount')).toHaveTextContent('7');
		['proofGamma', 'proofScalar', 'proofVerificationHash'].forEach(name => {
			expect(getFieldValue(name)).toHaveTextContent(symbolBlockInfoResult[name]);
			expect(within(getFieldValue(name)).getByAltText('Copy')).toBeInTheDocument();
		});
	});

	it.each(['importance', 'nemesis'])('renders voting and harvesting information for %s blocks', async blockType => {
		// Act:
		await renderPage({ blockType });

		// Assert:
		expect(screen.getByRole('heading', { name: 'section_blockImportance' })).toBeInTheDocument();
		expect(getFieldValue('votingEligibleAccountsCount')).toHaveTextContent('1 234');
		expect(getFieldValue('harvestingEligibleAccountsCount')).toHaveTextContent('5 678');
		expect(getFieldValue('totalVotingBalance')).toHaveTextContent('19 000 235.663367XYM');
		expect(within(getFieldValue('totalVotingBalance')).getByRole('link')).toHaveAttribute('href', '/mosaics/72C0212E67A08BCE');
		expect(getFieldValue('previousImportanceBlockHash')).toHaveTextContent(symbolBlockInfoResult.previousImportanceBlockHash);
		expect(within(getFieldValue('previousImportanceBlockHash')).getByAltText('Copy')).toBeInTheDocument();
	});

	it.each(['normal', 'importance', 'nemesis'])('renders Merkle information for %s blocks', async blockType => {
		// Act:
		await renderPage({ blockType });

		// Assert:
		expect(screen.getByRole('heading', { name: 'section_merkleInfo' })).toBeInTheDocument();
		['stateHash', 'receiptsHash', 'transactionsHash'].forEach(name => {
			expect(getFieldValue(name)).toHaveTextContent(symbolBlockInfoResult[name]);
			expect(within(getFieldValue(name)).getByAltText('Copy')).toBeInTheDocument();
		});
	});

	it.each(['desktop', 'mobile'])('renders every sub-cache root with its matching name on %s', async device => {
		// Arrange:
		setDevice(device);
		const names = [
			'AccountState', 'Namespace', 'Mosaic', 'Multisig', 'HashLockInfo',
			'SecretLockInfo', 'AccountRestriction', 'MosaicRestriction', 'Metadata'
		];

		// Act:
		await renderPage();

		// Assert: zero roots must remain present in their original positions.
		const rootFields = within(getFieldValue('stateHashSubCacheMerkleRoots'));
		expect(rootFields.getAllByRole('term').map(term => term.textContent)).toEqual(names);
		names.forEach((name, index) => {
			const row = rootFields.getByText(name, { exact: true }).parentElement;
			expect(within(row).getByRole('definition')).toHaveTextContent(symbolBlockInfoResult.stateHashSubCacheMerkleRoots[index]);
			expect(within(row).getByAltText('Copy')).toBeInTheDocument();
		});
	});

	it('does not render an empty importance card for normal blocks', async () => {
		// Act: leave the importance values present to verify visibility depends on the type.
		await renderPage({ blockType: 'normal' });

		// Assert:
		expect(getFieldValue('blockType')).toHaveTextContent('value_blockType_normal');
		expect(screen.queryByRole('heading', { name: 'section_blockImportance' })).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'section_merkleInfo' })).toBeInTheDocument();
	});

	it('renders zero counts and balance as values', async () => {
		// Act:
		await renderPage({
			statementCount: 0,
			votingEligibleAccountsCount: 0,
			harvestingEligibleAccountsCount: '0',
			totalVotingBalance: '0.000000'
		});

		// Assert:
		expect(getFieldValue('statementCount')).toHaveTextContent(/^0$/);
		expect(getFieldValue('votingEligibleAccountsCount')).toHaveTextContent(/^0$/);
		expect(getFieldValue('harvestingEligibleAccountsCount')).toHaveTextContent(/^0$/);
		expect(getFieldValue('totalVotingBalance')).toHaveTextContent('0.000000XYM');
	});
});
