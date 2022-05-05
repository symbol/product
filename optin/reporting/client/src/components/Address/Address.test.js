/* eslint-disable testing-library/no-node-access */
import Address from './';
import {render, screen} from '@testing-library/react';

jest.mock('./../ResponsiveText', () => props => <div>{props.value}</div>);
jest.mock('./../ResponsiveList', () => props => <div>{props.children}</div>);

test('render address component', () => {
	// Arrange:
	const addresses = ['TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY', 'TDJN6PKYNBYGUNE73VT2MNWO4KW67A6YT3BQUAA', 
		'TAK7WD42A4R5UDZS5YYVKTAQOBIVWAS3GFPAN4Q'];
	const linkBaseUrl = 'http://localhost/';
	
	// Act:
	render(<Address values={addresses} linkBaseUrl={linkBaseUrl}/>);

	// Assert:
	addresses.forEach(address => {
		const element = screen.getByText(address);
		expect(element.textContent).toBe(address);
		expect(element.parentElement.href).toBe(`${linkBaseUrl}${address}`);
		expect(element.parentElement.parentElement.querySelector('button.p-button-text')).toBeInTheDocument();
	});
});
