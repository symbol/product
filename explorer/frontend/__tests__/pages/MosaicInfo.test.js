import '@testing-library/jest-dom';
import 'react-intersection-observer/test-utils';
import { accountPageResult } from '../test-utils/account';
import { mosaicInfoResult } from '../test-utils/mosaics';
import { transactionPageResult } from '../test-utils/transactions';
import * as AccountService from '@/api/accounts';
import * as BlockService from '@/api/blocks';
import * as MosaicService from '@/api/mosaics';
import * as TransactionService from '@/api/transactions';
import MosaicInfo, { getServerSideProps } from '@/pages/mosaics/[id]';
import * as utils from '@/utils';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/api/accounts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/accounts')
	};
});

jest.mock('@/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blocks')
	};
});

jest.mock('@/api/mosaics', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/mosaics')
	};
});

jest.mock('@/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/transactions')
	};
});

describe('MosaicInfo', () => {
	describe('getServerSideProps', () => {
		const runTest = async (mosaicInfo, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { id: mosaicInfoResult.id };
			const fetchMosaicInfo = jest.spyOn(MosaicService, 'fetchMosaicInfo');
			fetchMosaicInfo.mockResolvedValue(mosaicInfo);
			const fetchAccountPage = jest.spyOn(AccountService, 'fetchAccountPage');
			fetchAccountPage.mockResolvedValue(accountPageResult);
			const fetchTransactionPage = jest.spyOn(TransactionService, 'fetchTransactionPage');
			fetchTransactionPage.mockResolvedValue(transactionPageResult);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchMosaicInfo).toHaveBeenCalledWith(params.id);
			expect(fetchAccountPage).toHaveBeenCalledWith({ mosaic: params.id });
			expect(fetchTransactionPage).toHaveBeenCalledWith({ mosaic: params.id });
			expect(result).toEqual(expectedResult);
		};

		it('returns mosaic info', async () => {
			// Arrange:
			const mosaicInfo = mosaicInfoResult;
			const expectedResult = {
				props: {
					mosaicInfo,
					preloadedTransactions: transactionPageResult.data,
					preloadedAccounts: accountPageResult.data
				}
			};

			// Act & Assert:
			await runTest(mosaicInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const mosaicInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act & Assert:
			await runTest(mosaicInfo, expectedResult);
		});
	});

	describe('mosaic information', () => {
		it('renders page with the information about the mosaic', () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				creator: 'creator-account-address'
			};
			const pageSectionText = 'section_mosaic';
			const mosaicNameText = mosaicInfo.name;
			const creatorText = mosaicInfo.creator;
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => 10000);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText(mosaicNameText)).toBeInTheDocument();
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(creatorText)).toBeInTheDocument();
		});
	});

	describe('mosaic expiration status', () => {
		const runStatusTest = async (chainHeight, namespaceExpirationHeight, isUnlimitedDuration, expectedText) => {
			// Arrange:
			const mosaicInfoExpired = {
				...mosaicInfoResult,
				namespaceExpirationHeight,
				isUnlimitedDuration
			};
			const spy = jest.spyOn(BlockService, 'fetchChainHight');
			spy.mockImplementation(() => chainHeight);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfoExpired} />);

			// Assert:
			await waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
		};

		it('renders status for active mosaic', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 10001;
			const isUnlimitedDuration = false;
			const expectedText = 'value_expiration';

			// Act & Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for expired mosaic', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 9999;
			const isUnlimitedDuration = false;
			const expectedText = 'value_expired';

			// Act & Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});

		it('renders status for mosaic which never expire', async () => {
			// Arrange:
			const chainHeight = 10000;
			const expirationHeight = 0;
			const isUnlimitedDuration = true;
			const expectedText = 'value_neverExpired';

			// Act & Assert:
			await runStatusTest(chainHeight, expirationHeight, isUnlimitedDuration, expectedText);
		});
	});

	describe('mosaic flags', () => {
		const runFlagTest = async (mosaicInfo, expectedLabelText, expectedIconAlt) => {
			// Arrange:
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 1000);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			const labelTextElement = screen.getByText(expectedLabelText);
			const labelIconElement = labelTextElement.previousSibling.childNodes[0];
			expect(labelTextElement).toBeInTheDocument();
			expect(labelIconElement).toHaveAttribute('alt', expectedIconAlt);
		};

		it('renders positive supply mutable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isSupplyMutable: true
			};
			const expectedLabelText = 'label_supplyMutable';
			const expectedIconAlt = 'true';

			// Act & Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});

		it('renders negative supply mutable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isSupplyMutable: false
			};
			const expectedLabelText = 'label_supplyMutable';
			const expectedIconAlt = 'false';

			// Act & Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});

		it('renders positive transferable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isTransferable: true
			};
			const expectedLabelText = 'label_transferable';
			const expectedIconAlt = 'true';

			// Act & Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});

		it('renders negative transferable flag', async () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				isTransferable: false
			};
			const expectedLabelText = 'label_transferable';
			const expectedIconAlt = 'false';

			// Act & Assert:
			await runFlagTest(mosaicInfo, expectedLabelText, expectedIconAlt);
		});
	});

	describe('mosaic distribution', () => {
		const runDistributionTest = async (tabToPress, expectedTextList) => {
			// Arrange:
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 1);
			const mosaicInfo = mosaicInfoResult;
			const preloadedTransactions = transactionPageResult.data;
			const preloadedAccounts = accountPageResult.data;

			// Act:
			render(
				<MosaicInfo mosaicInfo={mosaicInfo} preloadedTransactions={preloadedTransactions} preloadedAccounts={preloadedAccounts} />
			);
			fireEvent.click(await screen.findByText(tabToPress));

			// Assert:
			const assertionPromises = expectedTextList.map(expectedText => {
				return waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
			});
			await Promise.all(assertionPromises);
		};

		it('renders holders tab', async () => {
			// Arrange:
			const tabToPress = 'section_holders';
			const expectedTextList = [
				'table_field_address',
				'table_field_balance',
				...accountPageResult.data.map(account => account.address)
			];

			// Act & Assert:
			await runDistributionTest(tabToPress, expectedTextList);
		});

		it('renders transfers tab', async () => {
			// Arrange:
			const tabToPress = 'section_transfers';
			const expectedTextList = [
				'table_field_hash',
				'table_field_type',
				'table_field_sender',
				'table_field_recipient',
				...transactionPageResult.data.map(transaction => utils.truncateString(transaction.hash, 'hash'))
			];

			// Act & Assert:
			await runDistributionTest(tabToPress, expectedTextList);
		});
	});

	describe('mosaic description', () => {
		const runDescriptionTest = (mosaicInfo, expectedText) => {
			// Arrange:
			jest.spyOn(BlockService, 'fetchChainHight').mockImplementation(() => 1);

			// Act:
			render(<MosaicInfo mosaicInfo={mosaicInfo} />);

			// Assert:
			expect(screen.getByText(expectedText)).toBeInTheDocument();
		};

		it('renders description', () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				description: 'mosaic-description'
			};
			const expectedText = mosaicInfo.description;

			// Act & Assert:
			runDescriptionTest(mosaicInfo, expectedText);
		});

		it('renders no description', () => {
			// Arrange:
			const mosaicInfo = {
				...mosaicInfoResult,
				description: ''
			};
			const expectedText = 'No description';

			// Act & Assert:
			runDescriptionTest(mosaicInfo, expectedText);
		});
	});
});
