import { addressTemplate, balanceTemplate, dateTransactionHashTemplate } from './pageUtils';
import { render } from '@testing-library/react';

beforeEach(() => {
	jest.resetModules();
});

const mockAddressComponent = jest.fn();
jest.mock('../components/Address', () => props => {
	mockAddressComponent(props);
	return <></>;
});
const mockBalanceComponent = jest.fn();
jest.mock('../components/Balance', () => props => {
	mockBalanceComponent(props);
	return <></>;
});
const mockDateTransacationHashComponent = jest.fn();
jest.mock('../components/DateTransacationHash', () => props => {
	mockDateTransacationHashComponent(props);
	return <></>;
});

describe('Page Utils', () => {
	describe('addressTemplate', () => {
		const testAddressTemplate = (addresses, expectedAddresses) => {
			const linkBaseUrl = 'http://localhost/';
			render(addressTemplate({nemAddress: addresses}, 'nemAddress', {keyRedirects: { nemAddress: linkBaseUrl } }));

			expect(mockAddressComponent).toHaveBeenCalledWith({
				values: expectedAddresses,
				linkBaseUrl
			});
		};

		it('should render address template for multiple addresses', () => {
			const addresses = ['TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY', 'TDJN6PKYNBYGUNE73VT2MNWO4KW67A6YT3BQUAA',
				'TAK7WD42A4R5UDZS5YYVKTAQOBIVWAS3GFPAN4Q'];
			testAddressTemplate(addresses, [...addresses, '']);
		});

		it('should render address template for single address', () => {
			const address = 'TDHLRYXKIT4QOEEL3PRBP4PWLJ6NWU3LSGB56BY';
			testAddressTemplate(address, [address]);
		});
	});

	describe('balanceTemplate', () => {
		const testBalanceTemplate = (balances, expectedBalances, renderTotal) => {
			render(balanceTemplate({nemBalance: balances}, 'nemBalance', renderTotal));

			expect(mockBalanceComponent).toHaveBeenCalledWith({
				values: expectedBalances,
				renderTotal
			});
		};

		it('balance template multiple balances', () => {
			const balances = [100_000_000, 200_180_000, 300_280_000];
			testBalanceTemplate(balances, balances, true);
		});

		it('balance template single balance', () => {
			const balance = 200_180_000;
			testBalanceTemplate(balance, [balance], false);
		});
	});

	describe('DateTransactionHashTemplate', () => {
		const testDateTransactionHashTemplate = (hashes, expectedHashes, timestamps, expectedTimestamps) => {
			const linkBaseUrl = 'http://localhost/';
			render(dateTransactionHashTemplate(
				{nemHashes: hashes, nemTimestamps: timestamps},
				'nemHashes', 'nemTimestamps', {keyRedirects: { nemHashes: linkBaseUrl }}
			));

			expect(mockDateTransacationHashComponent).toHaveBeenCalledWith({
				values: expectedHashes,
				timestamps: expectedTimestamps,
				linkBaseUrl
			});
		};

		it('should render date transaction hash template for multiple values', () => {
			const transactionHashes = ['f24f32738b32b7d6f798cddb065ab2974d387c83a8a4b03385c8f2c8dc8b1bf7',
				'b825082702295438cc331a0bcc8ad698d22cce848661be55c4389140c36c67ee',
				'598ef664f3b7f48ecd13486e29269f4d55949505a901d25c8ea619344bc17671'];
			const timestamps = [1615853185, 1622028574.019, 1622028511.145];
			testDateTransactionHashTemplate(transactionHashes, transactionHashes, timestamps, timestamps, true);
		});

		it('should render date transaction hash template for single value', () => {
			const transactionHash = 'f24f32738b32b7d6f798cddb065ab2974d387c83a8a4b03385c8f2c8dc8b1bf7';
			const timestamp = 1615853185;
			testDateTransactionHashTemplate(transactionHash, [transactionHash], timestamp, [timestamp], true);
		});
	});
});
