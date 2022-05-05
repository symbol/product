/* eslint-disable testing-library/no-node-access */
import DateTransacationHash from './';
import Helper from '../../utils/helper';
import {render, screen} from '@testing-library/react';

jest.mock('./../ResponsiveText', () => props => <div>{props.value}</div>);
jest.mock('./../ResponsiveList', () => ({children}) => <div>{children}</div>);

test('render date transaction hash component', () => {
	// Arrange:
	const transactionHashes = ['f24f32738b32b7d6f798cddb065ab2974d387c83a8a4b03385c8f2c8dc8b1bf7',
		'b825082702295438cc331a0bcc8ad698d22cce848661be55c4389140c36c67ee', 
		'598ef664f3b7f48ecd13486e29269f4d55949505a901d25c8ea619344bc17671'];
	const timestamps = [1615853185, 1622028574.019, 1622028511.145];
	const linkBaseUrl = 'http://localhost/';

	// Act:
	render(<DateTransacationHash values={transactionHashes} linkBaseUrl={linkBaseUrl} timestamps={timestamps}/>);

	// Assert:
	transactionHashes.forEach((hash, index)  => {
		const element = screen.getByText(hash);
		expect(element.textContent).toBe(hash);
		expect(element.parentElement.href).toBe(`${linkBaseUrl}${hash.toLowerCase()}`);
		expect(element.parentElement.parentElement.querySelector('button.p-button-text')).toBeInTheDocument();

		expect(element.parentElement.parentElement.querySelector('span.timestamp').textContent)
			.toMatch(new RegExp(Helper.convertTimestampToDate(timestamps[index], true)));
	});
});
