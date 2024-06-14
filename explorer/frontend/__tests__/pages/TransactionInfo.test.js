import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import { transactionInfoResult, transactionPageResult } from '../test-utils/transactions';
import * as TransactionService from '@/api/transactions';
import TransactionInfo, { getServerSideProps } from '@/pages/transactions/[hash].jsx';
import * as utils from '@/utils';
import { render, screen } from '@testing-library/react';

jest.mock('@/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils')
	};
});

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

beforeEach(() => {
	jest.spyOn(utils, 'useUserCurrencyAmount').mockReturnValue(1000);
});

describe('TransactionInfo', () => {
	describe('getServerSideProps', () => {
		const runTest = async (transactionInfo, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { hash: transactionInfoResult.hash };
			const fetchTransactionInfo = jest.spyOn(TransactionService, 'fetchTransactionInfo');
			fetchTransactionInfo.mockResolvedValue(transactionInfo);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchTransactionInfo).toHaveBeenCalledWith(params.hash);
			expect(result).toEqual(expectedResult);
		};

		it('returns transaction info', async () => {
			// Arrange:
			const transactionInfo = transactionInfoResult;
			const expectedResult = {
				props: {
					transactionInfo
				}
			};

			// Act & Assert:
			await runTest(transactionInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const transactionInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act & Assert:
			await runTest(transactionInfo, expectedResult);
		});
	});

	describe('transaction information', () => {
		transactionPageResult.data.map((transactionInfo, index) => {
			it(`renders page with the information about the transaction ${index}`, () => {
				// Arrange:
				const pageSectionText = 'section_transaction';
				const hashText = transactionInfo.hash;
				const typeText = `transactionType_${transactionInfo.body[0].type}`;
				const signerText = transactionInfo.signer;
				const signatureText = transactionInfo.signature;

				// Act:
				render(<TransactionInfo transactionInfo={transactionInfo} />);

				// Assert:
				expect(screen.getByText(pageSectionText)).toBeInTheDocument();
				expect(screen.getByText(hashText)).toBeInTheDocument();
				expect(screen.getAllByText(typeText)[0]).toBeInTheDocument();
				expect(screen.getAllByText(signerText)[0]).toBeInTheDocument();
				expect(screen.getByText(signatureText)).toBeInTheDocument();
			});
		});

		it('renders page with the state change information', () => {
			// Act:
			render(<TransactionInfo transactionInfo={transactionInfoResult} />);

			// Assert:
			transactionInfoResult.accountStateChange.map((accountStateChange, index) => {
				const addressText = accountStateChange.address;
				const actionText = accountStateChange.action.map(action => `label_${action}`);
				const amountText = accountStateChange.mosaic.map(mosaic => Math.abs(mosaic.amount));

				expect(screen.getAllByText(addressText)[index]).toBeInTheDocument();
				actionText.map((action, actionIndex) => {
					expect(screen.getAllByText(action)[actionIndex]).toBeInTheDocument();
				});
				amountText.map((amount, amountIndex) => {
					expect(screen.getAllByText(amount)[amountIndex]).toBeInTheDocument();
				});
			});
		});
	});
});
