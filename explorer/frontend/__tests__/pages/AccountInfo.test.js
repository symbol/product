import '@testing-library/jest-dom';
import { accountHarvestedBlockPageResult, accountInfoResult } from '../test-utils/accounts';
import { transactionPageResult } from '../test-utils/transactions';
import * as AccountService from '@/app/api/accounts';
import * as TransactionService from '@/app/api/transactions';
import AccountInfo, { getServerSideProps } from '@/app/pages/accounts/[address]';
import * as utils from '@/app/utils';
import { pageConfig } from '@/app/variants/page-config';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
	jest.spyOn(AccountService, 'fetchAccountHarvestedBlockPage').mockResolvedValue({
		data: accountHarvestedBlockPageResult.data,
		pageNumber: 1
	});
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

		it('renders main account address when account is a remote one', () => {
			// Arrange:
			const mainAddress = 'NANQPLR63Z4ONDR3X6JQAC2HQCVPKI4ZDQ6OG6M4';
			const accountInfoWithMainAccount = { ...accountInfoResult, mainAddress };

			// Act:
			render(<AccountInfo accountInfo={accountInfoWithMainAccount} preloadedTransactions={[]} />);
			fireEvent.click(screen.getByText('section_linkedKeys'));

			// Assert:
			expect(screen.getByText('field_mainAccount')).toBeInTheDocument();
			expect(screen.getByText(mainAddress)).toBeInTheDocument();
		});

		it('labels an account that another account harvests through', () => {
			// Arrange:
			const accountInfoWithMainAccount = { ...accountInfoResult, mainAddress: 'NANQPLR63Z4ONDR3X6JQAC2HQCVPKI4ZDQ6OG6M4' };

			// Act:
			render(<AccountInfo accountInfo={accountInfoWithMainAccount} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.getByText('label_linked')).toBeInTheDocument();
		});

		it('does not label an ordinary account as remote', () => {
			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={[]} />);

			// Assert:
			expect(screen.queryByText('label_linked')).not.toBeInTheDocument();
			expect(screen.queryByText('field_mainAccount')).not.toBeInTheDocument();
		});
	});

	describe('account history', () => {
		const runHistoryTabTest = async (tabToPress, expectedTextList) => {
			// Arrange:
			const pageSectionText = 'section_history';

			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);
			fireEvent.click(screen.getByText(tabToPress));

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			const assertionPromises = expectedTextList.map(expectedText => {
				return waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
			});
			await Promise.all(assertionPromises);
		};

		// The filter chip ignores clicks while the page is loading, so wait until it reports itself enabled.
		const openHarvestedTabAndAwaitEmptyBlockFilter = async () => {
			fireEvent.click(screen.getByText('section_harvested'));
			const emptyBlockFilter = screen.getByText('filter_hideEmptyBlocks').closest('[role="button"]');
			await waitFor(() => expect(emptyBlockFilter).toHaveAttribute('aria-disabled', 'false'));

			return emptyBlockFilter;
		};

		it('renders transactions tab', async () => {
			// Arrange:
			const tabToPress = 'section_transactions';
			const expectedTextList = transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'));

			// Act + Assert:
			await runHistoryTabTest(tabToPress, expectedTextList);
		});

		it('renders harvested tab', async () => {
			// Arrange:
			const tabToPress = 'section_harvested';
			const expectedTextList = [
				'table_field_height',
				'table_field_type',
				'table_field_amount',
				...accountHarvestedBlockPageResult.data.map(block => block.height)
			];

			// Act + Assert:
			await runHistoryTabTest(tabToPress, expectedTextList);
		});

		it('asks for every harvested block by default', async () => {
			// Act:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);

			// Assert: empty blocks stay in the list until the filter hides them
			await waitFor(() =>
				expect(AccountService.fetchAccountHarvestedBlockPage).toHaveBeenCalledWith({
					pageNumber: 1,
					address: accountInfoResult.address
				}));
		});

		it('leaves out empty blocks once the filter is selected', async () => {
			// Arrange:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);
			const emptyBlockFilter = await openHarvestedTabAndAwaitEmptyBlockFilter();

			// Act:
			fireEvent.click(emptyBlockFilter);

			// Assert: the address must survive the toggle, the backend rejects a request without it
			await waitFor(() =>
				expect(AccountService.fetchAccountHarvestedBlockPage).toHaveBeenCalledWith({
					pageNumber: 1,
					address: accountInfoResult.address,
					hideEmpty: true
				}));
		});

		it('shows empty blocks again when the filter is cleared', async () => {
			// Arrange:
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);
			const emptyBlockFilter = await openHarvestedTabAndAwaitEmptyBlockFilter();
			fireEvent.click(emptyBlockFilter);
			await waitFor(() =>
				expect(AccountService.fetchAccountHarvestedBlockPage).toHaveBeenLastCalledWith({
					pageNumber: 1,
					address: accountInfoResult.address,
					hideEmpty: true
				}));
			AccountService.fetchAccountHarvestedBlockPage.mockClear();

			// Act: the page renders a filter per history tab, so clear the one next to the empty block chip
			fireEvent.click(within(emptyBlockFilter.parentElement).getByText('button_clear'));

			// Assert: clearing drops the chip, which is what brings the empty blocks back
			await waitFor(() =>
				expect(AccountService.fetchAccountHarvestedBlockPage).toHaveBeenCalledWith({
					pageNumber: 1,
					address: accountInfoResult.address
				}));
		});

		it('does not render empty block filter when variant disables it', async () => {
			// Arrange:
			jest.replaceProperty(pageConfig.account, 'showEmptyBlockFilter', false);
			render(<AccountInfo accountInfo={accountInfoResult} preloadedTransactions={transactionPageResult.data} />);

			// Act:
			fireEvent.click(screen.getByText('section_harvested'));

			// Assert:
			await waitFor(() => expect(screen.getByText(accountHarvestedBlockPageResult.data[0].height)).toBeInTheDocument());
			expect(screen.queryByText('filter_hideEmptyBlocks')).not.toBeInTheDocument();
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
