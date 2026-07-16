import '@testing-library/jest-dom';
import { accountInfoResult } from '../test-utils/accounts';
import { transactionPageResult } from '../test-utils/transactions';
import * as AccountService from '@/app/api/accounts';
import * as TransactionService from '@/app/api/transactions';
import AccountInfo, { getServerSideProps } from '@/app/pages/accounts/[address]';
import * as utils from '@/app/utils';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/app/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/utils')
	};
});

jest.mock('@/app/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/transactions')
	};
});

jest.mock('@/app/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/accounts')
	};
});

beforeEach(() => {
	jest.spyOn(utils, 'useUserCurrencyAmount').mockReturnValue(1000);
	jest.spyOn(TransactionService, 'fetchTransactionPage').mockResolvedValue(transactionPageResult);
});

describe('AccountInfo', () => {
	describe('getServerSideProps', () => {
		const runTest = async (accountInfo, expectedResult, isTransactionPageFetched) => {
			// Arrange:
			const locale = 'en';
			const params = { address: accountInfoResult.address };
			const fetchAccountInfo = jest.spyOn(AccountService, 'fetchAccountInfo');
			fetchAccountInfo.mockResolvedValue(accountInfo);
			const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');
			fetchTransactionPage.mockResolvedValue(transactionPageResult);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchAccountInfo).toHaveBeenCalledWith(params.address);
			if (isTransactionPageFetched)
				expect(fetchTransactionPage).toHaveBeenCalledWith({ address: params.address });
			else
				expect(fetchTransactionPage).not.toHaveBeenCalled();
			expect(result).toEqual(expectedResult);
		};

		it('returns account info', async () => {
			// Arrange:
			const accountInfo = accountInfoResult;
			const expectedResult = {
				props: {
					accountInfo,
					preloadedTransactions: transactionPageResult.data
				}
			};

			// Act + Assert:
			await runTest(accountInfo, expectedResult, true);
		});

		it('returns not found without fetching transactions', async () => {
			// Arrange:
			const accountInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act + Assert:
			await runTest(accountInfo, expectedResult, false);
		});
	});

	describe('account information', () => {
		it('renders page with the information about the account', () => {
			// Arrange:
			const pageSectionText = 'section_account';
			const addressText = accountInfoResult.address;
			const { balance } = accountInfoResult;
			const descriptionText = accountInfoResult.description;
			const publicKeyText = accountInfoResult.publicKey;
			const heightText = accountInfoResult.height;
			const importanceText = `${accountInfoResult.importance} %`;
			const { mosaics } = accountInfoResult;

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={[]} />);
			const [balanceElement, mosaicElement] = screen.getAllByText(balance);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(addressText)).toBeInTheDocument();
			expect(balanceElement).toBeInTheDocument();
			expect(mosaicElement).toBeInTheDocument();
			expect(screen.getByText(descriptionText)).toBeInTheDocument();
			expect(screen.getByText(publicKeyText)).toBeInTheDocument();
			expect(screen.getByText(heightText)).toBeInTheDocument();
			expect(screen.getByText(importanceText)).toBeInTheDocument();
			mosaics.forEach(mosaic => expect(screen.getByText(mosaic.id)).toBeInTheDocument());
		});

		it('renders page without account description', () => {
			// Arrange:
			const descriptionText = accountInfoResult.description;
			const accountInfoWithoutDescription = { ...accountInfoResult, description: null };
			const noDescriptionText = 'No description';

			// Act:
			render(<AccountInfo accountInfo={accountInfoWithoutDescription} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.queryByText(descriptionText)).not.toBeInTheDocument();
			expect(screen.getByText(noDescriptionText)).toBeInTheDocument();
		});

		it('renders linked account address when it exists', () => {
			// Arrange:
			const linkedAddress = 'NANQPLR63Z4ONDR3X6JQAC2HQCVPKI4ZDQ6OG6M4';
			const accountInfoWithLinkedAccount = { ...accountInfoResult, linkedAddress };

			// Act:
			render(<AccountInfo accountInfo={accountInfoWithLinkedAccount} preloadedTransactions={[]} />);
			fireEvent.click(screen.getByText('section_linkedKeys'));

			// Assert:
			expect(screen.getByText('field_linkedAccount')).toBeInTheDocument();
			expect(screen.getByText(linkedAddress)).toBeInTheDocument();
		});
	});

	describe('account transactions', () => {
		it('renders page with the list of transactions', () => {
			// Arrange:
			const pageSectionText = 'section_transactions';
			const transactionHashes = transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'));

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			transactionHashes.forEach(hash => expect(screen.getByText(hash)).toBeInTheDocument());
		});
	});

	describe('account multisig', () => {
		it('renders page with the information about the multisig account', () => {
			// Arrange:
			const cosignatories = ['NANGHZNOAFIKE5QTGOLWP66I2SPJSYLRXY63EODH', 'NAEF6OBWJLW3CBM7U6QVCDRS4XAKBIC4VWACEGVL'];
			const cosignatoryOf = ['NCYAVMNQOZ3MZETEBD34ACMAX3S57WUSWAZWY3DW'];
			const multisigAccountInfo = {
				...accountInfoResult,
				cosignatories,
				cosignatoryOf,
				isMultisig: true
			};
			const pageSectionText = 'section_multisig';
			const labelMultisigText = 'label_multisig';

			// Act:
			render(<AccountInfo accountInfo={multisigAccountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(labelMultisigText)).toBeInTheDocument();
			cosignatories.map(address => expect(screen.getByText(address)).toBeInTheDocument());
			cosignatoryOf.map(address => expect(screen.getByText(address)).toBeInTheDocument());
		});

		it('renders page with the information about non-multisig account', () => {
			// Arrange:
			const accountInfo = {
				...accountInfoResult,
				cosignatories: [],
				cosignatoryOf: [],
				isMultisig: false
			};
			const pageSectionText = 'section_multisig';
			const labelMultisigText = 'label_multisig';

			// Act:
			render(<AccountInfo accountInfo={accountInfo} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.queryByText(pageSectionText)).not.toBeInTheDocument();
			expect(screen.queryByText(labelMultisigText)).not.toBeInTheDocument();
		});
	});
});
