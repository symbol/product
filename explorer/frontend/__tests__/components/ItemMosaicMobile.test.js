import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import ItemMosaicMobile from '@/components/ItemMosaicMobile';
import { render, screen } from '@testing-library/react';

describe('ItemMosaicMobile', () => {
	describe('expiration status', () => {
		const runTest = (namespaceExpirationHeight, chainHeight, isUnlimitedDuration, expectedStatusText) => {
			// Arrange:
			const data = {
				name: 'mosaic.name',
				id: 'mosaic-id',
				registrationTimestamp: 123456,
				creator: 'creator-account-address',
				namespaceExpirationHeight,
				isUnlimitedDuration
			};
			const expectedLinkHref = '/mosaics/mosaic-id';

			// Act:
			render(<ItemMosaicMobile data={data} chainHeight={chainHeight} />);

			// Assert:
			expect(screen.getByText(expectedStatusText)).toBeInTheDocument();
			expect(screen.getByText('mosaic.name').closest('a')).toHaveAttribute('href', expectedLinkHref);
		};

		test('renders active mosaic', () => {
			// Arrange:
			const expirationHeight = 100;
			const chainHeight = 50;
			const isUnlimitedDuration = false;
			const expectedStatusText = 'label_active';

			// Act + Assert:
			runTest(expirationHeight, chainHeight, isUnlimitedDuration, expectedStatusText);
		});

		test('renders inactive mosaic', () => {
			// Arrange:
			const expirationHeight = 100;
			const chainHeight = 150;
			const isUnlimitedDuration = false;
			const expectedStatusText = 'label_expired';

			// Act + Assert:
			runTest(expirationHeight, chainHeight, isUnlimitedDuration, expectedStatusText);
		});

		test('renders active mosaic with unlimited duration', () => {
			// Arrange:
			const expirationHeight = 100;
			const chainHeight = 150;
			const isUnlimitedDuration = true;
			const expectedStatusText = 'label_active';

			// Act + Assert:
			runTest(expirationHeight, chainHeight, isUnlimitedDuration, expectedStatusText);
		});
	});
});
