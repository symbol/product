import Address from './';
import {render, screen} from '@testing-library/react';

jest.mock('./../ResponsiveText', () => props => <div>{props.value}</div>);
jest.mock('./../ResponsiveList', () => ({children}) => <div>{children}</div>);

describe('Address Component', () => {
	const testAddressComponent = addresses => {
		// Arrange:
		const linkBaseUrl = 'http://localhost/';

		// Act:
		render(<Address values={addresses} linkBaseUrl={linkBaseUrl}/>);

		// Assert:
		addresses.forEach(address => {
			const linkElement = screen.getByRole('link', {name: address});
			expect(linkElement).toBeInTheDocument();
			expect(linkElement).toHaveAttribute('href', linkBaseUrl + address);
		});
	};

	it('should render address component with single address value', () => {
		testAddressComponent(['TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY']);
	});

	it('should render address component with multiple address values', () => {
		testAddressComponent(['TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY', 'TDJN6PKYNBYGUNE73VT2MNWO4KW67A6YT3BQUAA',
			'TAK7WD42A4R5UDZS5YYVKTAQOBIVWAS3GFPAN4Q']);
	});
});
