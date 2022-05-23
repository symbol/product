/* eslint-disable testing-library/no-node-access */
import DateTransacationHash from './';
import Helper from '../../utils/helper';
import {render, screen} from '@testing-library/react';

// Arrange:
jest.mock('./../ResponsiveText', () => props => <div>{props.value}</div>);
jest.mock('./../ResponsiveList', () => ({children}) => <div>{children}</div>);

describe('DateTransactionHash Component', () => {
	const expectedOffChainText = '(off chain)';
	const getNextUnvisitedElement = (elements, visitedElements) => {
		return elements.filter(element => !visitedElements.includes(element))[0] || null;
	};
	const testDateTransactionHashComponent = (transactionHashes, timestamps, expectedTransactionHashes) => {
		// Arrange:
		const linkBaseUrl = 'http://localhost/';

		// Act:
		render(<DateTransacationHash values={transactionHashes} linkBaseUrl={linkBaseUrl} timestamps={timestamps}/>);

		const visitedElements = [];

		// Assert:
		expectedTransactionHashes.forEach((hash, index)  => {
			const element = getNextUnvisitedElement(screen.getAllByText(hash), visitedElements);
			if (element) {
				visitedElements.push(element);
				expect(element.textContent).toBe(hash);
				if (transactionHashes[index]) {
					expect(element.parentElement.href).toBe(`${linkBaseUrl}${hash.toLowerCase()}`);
					expect(element.parentElement.parentElement.querySelector('button.p-button-text')).toBeInTheDocument();
					expect(element.parentElement.parentElement.querySelector('span.timestamp').textContent)
						.toMatch(new RegExp(Helper.convertTimestampToDate(timestamps[index], Helper.getLocalTimezone())));
				}
			}
		});
	};

	it('should render with single transaction hash (on-chain)', () => {
		// Arrange:
		const transactionHashes = ['f24f32738b32b7d6f798cddb065ab2974d387c83a8a4b03385c8f2c8dc8b1bf7'];
		const timestamps = [1615853185];

		testDateTransactionHashComponent(transactionHashes, timestamps, transactionHashes);
	});

	it('should render with single transaction hash (off-chain)', () => {
		// Arrange:
		const transactionHashes = [null];
		const timestamps = [null];
		const expectedTransactionHashes = [expectedOffChainText];

		testDateTransactionHashComponent(transactionHashes, timestamps, expectedTransactionHashes);
	});

	it('should render with multiple transaction hashes (all on-chain)', () => {
		// Arrange:
		const transactionHashes = ['f24f32738b32b7d6f798cddb065ab2974d387c83a8a4b03385c8f2c8dc8b1bf7',
			'b825082702295438cc331a0bcc8ad698d22cce848661be55c4389140c36c67ee',
			'598ef664f3b7f48ecd13486e29269f4d55949505a901d25c8ea619344bc17671'];
		const timestamps = [1615853185, 1622028574.019, 1622028511.145];

		testDateTransactionHashComponent(transactionHashes, timestamps, transactionHashes);
	});

	it('should render with multiple transaction hashes(all off-chain)', () => {
		// Arrange:
		const transactionHashes = [null, null, null];
		const timestamps = [null, null, null];
		const expectedTransactionHashes = [expectedOffChainText, expectedOffChainText, expectedOffChainText];

		testDateTransactionHashComponent(transactionHashes, timestamps, expectedTransactionHashes);
	});

	it('should render with multiple transaction hashes(on-chain and off-chain)', () => {
		// Arrange:
		const transactionHashes = ['f24f32738b32b7d6f798cddb065ab2974d387c83a8a4b03385c8f2c8dc8b1bf7',
			'b825082702295438cc331a0bcc8ad698d22cce848661be55c4389140c36c67ee',
			null];
		const timestamps = [1615853185, 1622028574.019, null];
		const expectedTransactionHashes = [transactionHashes[0], transactionHashes[1], expectedOffChainText];

		testDateTransactionHashComponent(transactionHashes, timestamps, expectedTransactionHashes);
	});
});
