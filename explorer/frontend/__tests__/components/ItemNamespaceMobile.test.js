import '@testing-library/jest-dom';
import ItemNamespaceMobile from '@/components/ItemNamespaceMobile';
import { render, screen } from '@testing-library/react';

describe('ItemNamespaceMobile', () => {
	describe('expiration status', () => {
		const runTest = (expirationHeight, chainHeight, expectedStatusText) => {
			// Arrange:
			const data = {
				name: 'namespace.name',
				id: 'namespace-id',
				registrationTimestamp: 123456,
				creator: 'creator-account-address',
				expirationHeight
			};
			const expectedLinkHref = '/namespaces/namespace-id';

			// Act:
			render(<ItemNamespaceMobile data={data} chainHeight={chainHeight} />);

			// Assert:
			expect(screen.getByText(expectedStatusText)).toBeInTheDocument();
			expect(screen.getByText('namespace.name').closest('a')).toHaveAttribute('href', expectedLinkHref);
		};

		test('renders active namespace', () => {
			// Arrange:
			const expirationHeight = 100;
			const chainHeight = 50;
			const expectedStatusText = 'label_active';

			// Act + Assert:
			runTest(expirationHeight, chainHeight, expectedStatusText);
		});

		test('renders inactive namespace', () => {
			// Arrange:
			const expirationHeight = 100;
			const chainHeight = 150;
			const expectedStatusText = 'label_expired';

			// Act + Assert:
			runTest(expirationHeight, chainHeight, expectedStatusText);
		});
	});

	describe('timestamp', () => {
		test('does not render invalid timestamp text when registration timestamp is missing', () => {
			// Arrange:
			const data = {
				name: 'namespace.name',
				id: 'namespace-id',
				creator: 'creator-account-address',
				expirationHeight: 100
			};

			// Act:
			render(<ItemNamespaceMobile data={data} chainHeight={50} />);

			// Assert:
			expect(screen.queryByText(/month_undefined/)).toBeNull();
			expect(screen.queryByText(/NaN/)).toBeNull();
		});
	});

	describe('namespace name', () => {
		test('renders readable namespace name', () => {
			// Arrange:
			const data = {
				name: 'E1DF939840839027',
				id: 'E1DF939840839027',
				namespaceName: 'parent.child',
				creator: 'creator-account-address',
				expirationHeight: 100
			};

			// Act:
			render(<ItemNamespaceMobile data={data} chainHeight={50} />);

			// Assert:
			expect(screen.getByText('parent.child')).toBeInTheDocument();
		});
	});
});
