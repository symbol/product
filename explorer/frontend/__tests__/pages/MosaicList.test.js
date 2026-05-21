import '@testing-library/jest-dom';
import { setDevice } from '../test-utils/device';
import { mosaicPageResult } from '../test-utils/mosaics';
import * as MosaicService from '@/api/mosaics';
import MosaicList, { getServerSideProps } from '@/pages/mosaics/index';
import { pageConfig } from '@/variants';
import { render, screen } from '@testing-library/react';

jest.mock('@/api/mosaics', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/mosaics')
	};
});

jest.mock('@/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/stats')
	};
});

describe('MosaicList', () => {
	const originalMosaicConfig = { ...pageConfig.mosaics };

	beforeEach(() => {
		setDevice('desktop');
		Object.assign(pageConfig.mosaics, originalMosaicConfig);
	});

	afterEach(() => {
		Object.assign(pageConfig.mosaics, originalMosaicConfig);
	});

	describe('getServerSideProps', () => {
		it('fetches mosaic list and statistics', async () => {
			// Arrange:
			const locale = 'en';
			const fetchMosaicPage = jest.spyOn(MosaicService, 'fetchMosaicPage');
			fetchMosaicPage.mockResolvedValue(mosaicPageResult);
			const expectedResult = {
				props: {
					mosaics: mosaicPageResult.data
				}
			};

			// Act:
			const result = await getServerSideProps({ locale });

			// Assert:
			expect(fetchMosaicPage).toHaveBeenCalledWith();
			expect(result).toEqual(expectedResult);
		});
	});

	describe('page', () => {
		const runTest = () => {
			// Arrange:
			const pageSectionText = 'section_mosaics';
			const mosaicIds = mosaicPageResult.data.map(mosaic => mosaic.id);

			// Act:
			render(<MosaicList mosaics={mosaicPageResult.data} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			mosaicIds.forEach(id => {
				expect(screen.getByText(id)).toBeInTheDocument();
			});
		};

		it('renders page with the list of mosaics on desktop', () => {
			// Act + Assert:
			runTest();
		});

		it('renders page with the list of mosaics on mobile', () => {
			// Arrange:
			setDevice('mobile');

			// Act + Assert:
			runTest();
		});

		it('keeps NEM mosaic columns unchanged', () => {
			// Act:
			render(<MosaicList mosaics={mosaicPageResult.data} />);

			// Assert:
			expect(screen.getByText('table_field_name')).toBeInTheDocument();
			expect(screen.getByText('field_timestampUTC')).toBeInTheDocument();
			expect(screen.queryByText('table_field_mosaicId')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_alias')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_flags')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_expirationHeight')).not.toBeInTheDocument();
		});

		it('renders Symbol mosaic columns on desktop', () => {
			// Arrange:
			Object.assign(pageConfig.mosaics, {
				nameColumnTitleKey: 'table_field_mosaicId',
				showAlias: true,
				showValue: true,
				showFlags: true,
				showRegistration: false,
				showExpiration: false,
				showStatus: true,
				showCreated: false
			});
			const mosaics = [
				{
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE',
					aliasNames: ['symbol.xym', 'currency'],
					creator: 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV',
					value: '1234.056',
					registrationHeight: 100,
					expirationHeight: 0,
					namespaceExpirationHeight: null,
					isUnlimitedDuration: true,
					isSupplyMutable: true,
					isTransferable: true,
					isRestrictable: true,
					isRevokable: true
				},
				{
					id: '78C3CDF0896248DB',
					name: '78C3CDF0896248DB',
					aliasNames: [],
					creator: 'NB3YL2NEVHIPZBVBBLLRWAU7CYBJEK4VMGSHLIHY',
					value: '10.00',
					registrationHeight: 200,
					expirationHeight: 250,
					namespaceExpirationHeight: 250,
					isUnlimitedDuration: false,
					isSupplyMutable: false,
					isTransferable: false,
					isRestrictable: false,
					isRevokable: false
				}
			];

			// Act:
			render(<MosaicList mosaics={mosaics} />);

			// Assert:
			expect(screen.getByText('table_field_mosaicId')).toBeInTheDocument();
			expect(screen.getByText('table_field_alias')).toBeInTheDocument();
			expect(screen.getByText('table_field_value')).toBeInTheDocument();
			expect(screen.getByText('table_field_flags')).toBeInTheDocument();
			expect(screen.getByText('table_field_status')).toBeInTheDocument();
			expect(screen.queryByText('table_field_registrationHeight')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_expirationHeight')).not.toBeInTheDocument();
			expect(screen.queryByText('field_timestampUTC')).not.toBeInTheDocument();
			expect(screen.getAllByText((_, element) => element.textContent === '1 234.056')).toHaveLength(2);
			expect(screen.getAllByText((_, element) => element.textContent === '10.00')).toHaveLength(2);
			expect(screen.queryByText('INFINITY')).not.toBeInTheDocument();
			expect(screen.getByText('N/A')).toBeInTheDocument();
			expect(screen.getByRole('link', { name: 'symbol.xym' })).toHaveAttribute('href', '/namespaces/symbol.xym');
			expect(screen.getByRole('link', { name: 'currency' })).toHaveAttribute('href', '/namespaces/currency');
			expect(screen.getByAltText('Supply mutable')).toBeInTheDocument();
			expect(screen.getByAltText('Transferable')).toBeInTheDocument();
			expect(screen.getByAltText('Restrictable')).toBeInTheDocument();
			expect(screen.getByAltText('Revokable')).toBeInTheDocument();
			expect(screen.getByAltText('Supply mutable').closest('[title]')).toHaveAttribute(
				'title',
				'tooltip_mosaicFlagSupplyMutable'
			);
			expect(screen.getByAltText('Transferable').closest('[title]')).toHaveAttribute(
				'title',
				'tooltip_mosaicFlagTransferable'
			);
			expect(screen.getByAltText('Restrictable').closest('[title]')).toHaveAttribute(
				'title',
				'tooltip_mosaicFlagRestrictable'
			);
			expect(screen.getByAltText('Revokable').closest('[title]')).toHaveAttribute(
				'title',
				'tooltip_mosaicFlagRevokable'
			);
			expect(screen.getAllByAltText('active')).toHaveLength(2);
			expect(screen.getByAltText('Supply mutable').compareDocumentPosition(screen.getByAltText('Transferable')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByAltText('Transferable').compareDocumentPosition(screen.getByAltText('Restrictable')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
			expect(screen.getByAltText('Restrictable').compareDocumentPosition(screen.getByAltText('Revokable')))
				.toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		});

		it('renders Symbol mosaic details on mobile', () => {
			// Arrange:
			setDevice('mobile');
			Object.assign(pageConfig.mosaics, {
				nameColumnTitleKey: 'table_field_mosaicId',
				showAlias: true,
				showValue: true,
				showFlags: true,
				showRegistration: false,
				showExpiration: false,
				showStatus: true,
				showCreated: false
			});
			const mosaics = [
				{
					id: '72C0212E67A08BCE',
					name: '72C0212E67A08BCE',
					aliasNames: ['symbol.xym'],
					creator: 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV',
					value: '1234.056',
					registrationHeight: 100,
					expirationHeight: 0,
					namespaceExpirationHeight: null,
					isUnlimitedDuration: true,
					isSupplyMutable: true,
					isTransferable: true,
					isRestrictable: true,
					isRevokable: true
				}
			];

			// Act:
			render(<MosaicList mosaics={mosaics} />);

			// Assert:
			expect(screen.getAllByText('table_field_alias')).toHaveLength(2);
			expect(screen.getAllByText('table_field_value')).toHaveLength(2);
			expect(screen.getAllByText('table_field_flags')).toHaveLength(2);
			expect(screen.getByText('label_active')).toBeInTheDocument();
			expect(screen.queryByText('table_field_registrationHeight')).not.toBeInTheDocument();
			expect(screen.queryByText('table_field_expirationHeight')).not.toBeInTheDocument();
			expect(screen.getAllByText((_, element) => element.textContent === '1 234.056')).toHaveLength(2);
			expect(screen.queryByText('INFINITY')).not.toBeInTheDocument();
			expect(screen.queryByText('field_timestampUTC')).not.toBeInTheDocument();
			expect(screen.getByRole('link', { name: 'symbol.xym' })).toHaveAttribute('href', '/namespaces/symbol.xym');
		});
	});
});
