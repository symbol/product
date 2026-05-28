import '@testing-library/jest-dom';
import { blockInfoResult } from '../test-utils/blocks';
import * as BlockReceiptService from '@/api/blockReceipts';
import * as BlockService from '@/api/blocks';
import BlockInfo, { getServerSideProps } from '@/pages/blocks/[height]';
import * as utils from '@/utils';
import { pageConfig } from '@/variants';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('@/utils', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/utils')
	};
});

jest.mock('@/api/blocks', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blocks')
	};
});

jest.mock('@/api/blockReceipts', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/api/blockReceipts')
	};
});

describe('BlockInfo', () => {
	const originalShowFinalization = pageConfig.blocks.showFinalization;
	const originalShowBlockType = pageConfig.blocks.showBlockType;
	const originalShowBlockExtendedDetails = pageConfig.blocks.showBlockExtendedDetails;
	const originalShowBlockMerkleInfo = pageConfig.blocks.showBlockMerkleInfo;
	const originalShowBlockReceipts = pageConfig.blocks.showBlockReceipts;

	afterEach(() => {
		pageConfig.blocks.showFinalization = originalShowFinalization;
		pageConfig.blocks.showBlockType = originalShowBlockType;
		pageConfig.blocks.showBlockExtendedDetails = originalShowBlockExtendedDetails;
		pageConfig.blocks.showBlockMerkleInfo = originalShowBlockMerkleInfo;
		pageConfig.blocks.showBlockReceipts = originalShowBlockReceipts;
	});

	describe('getServerSideProps', () => {
		const runTest = async (blockInfoResult, expectedResult) => {
			// Arrange:
			const locale = 'en';
			const params = { height: '1111111' };

			const fetchBlockInfo = jest.spyOn(BlockService, 'fetchBlockInfo');
			fetchBlockInfo.mockResolvedValue(blockInfoResult);

			// Act:
			const result = await getServerSideProps({ locale, params });

			// Assert:
			expect(fetchBlockInfo).toHaveBeenCalledWith(params.height);
			expect(result).toEqual(expectedResult);
		};

		it('returns block info', async () => {
			// Arrange:
			const blockInfo = blockInfoResult;
			const expectedResult = {
				props: {
					blockInfo
				}
			};

			// Act + Assert:
			await runTest(blockInfo, expectedResult);
		});

		it('returns not found', async () => {
			// Arrange:
			const blockInfo = null;
			const expectedResult = {
				notFound: true
			};

			// Act + Assert:
			await runTest(blockInfo, expectedResult);
		});
	});

	describe('page', () => {
		it('renders page with the information about the block', () => {
			// Arrange:
			const pageSectionText = 'section_block';
			const heightText = blockInfoResult.height;
			const difficultyText = `${blockInfoResult.difficulty} %`;
			const sizeText = `${blockInfoResult.size} B`;
			const harvesterText = blockInfoResult.harvester;

			// Act:
			render(<BlockInfo blockInfo={blockInfoResult} />);

			// Assert:
			expect(screen.getByText(pageSectionText)).toBeInTheDocument();
			expect(screen.getByText(heightText)).toBeInTheDocument();
			expect(screen.getByText(difficultyText)).toBeInTheDocument();
			expect(screen.getByText(sizeText)).toBeInTheDocument();
			expect(screen.getByText(harvesterText)).toBeInTheDocument();
		});

		const runStatusLabelTest = (chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText) => {
			// Arrange:
			const spy = jest.spyOn(utils, 'useAsyncCall');
			spy.mockImplementation(() => blockInfoResult.height + chainHeightOffset);

			// Act:
			render(<BlockInfo blockInfo={blockInfoResult} />);

			// Assert:
			expect(screen.getByText(expectedShownLabelText)).toBeInTheDocument();
			expect(screen.queryByText(expectedHiddenLabelText)).not.toBeInTheDocument();
		};

		it('renders safe label', () => {
			// Arrange:
			const chainHeightOffset = 361;
			const expectedShownLabelText = 'label_safe';
			const expectedHiddenLabelText = 'label_unsafe';

			// Act + Assert:
			runStatusLabelTest(chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText);
		});

		it('renders created label', () => {
			// Arrange:
			const chainHeightOffset = 100;
			const expectedShownLabelText = 'label_created';
			const expectedHiddenLabelText = 'label_safe';

			// Act + Assert:
			runStatusLabelTest(chainHeightOffset, expectedShownLabelText, expectedHiddenLabelText);
		});

		it('renders finalized status and block type for Symbol blocks', async () => {
			// Arrange:
			pageConfig.blocks.showFinalization = true;
			pageConfig.blocks.showBlockType = true;
			pageConfig.blocks.showBlockExtendedDetails = true;
			pageConfig.blocks.showBlockMerkleInfo = true;
			pageConfig.blocks.showBlockReceipts = true;
			jest.spyOn(BlockReceiptService, 'fetchBlockReceiptPage').mockResolvedValue({
				data: [
					{
						version: 1,
						type: 'harvestFee',
						group: 'balanceChange',
						targetAddress: 'TTARGETADDRESS000000000000000000000',
						mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 1, isNative: true }]
					},
					{
						version: 1,
						type: 'inflation',
						group: 'inflation',
						mosaics: [{ id: '72C0212E67A08BCE', name: '72C0212E67A08BCE', amount: 2, isNative: true }]
					}
				],
				pageNumber: 1
			});
			const blockType = 'Normal Block';
			const symbolBlockInfo = {
				...blockInfoResult,
				blockType,
				isFinalized: true,
				beneficiaryAddress: 'TBENEFICIARYADDRESS000000000000000000',
				statementCount: 1,
				rawDifficulty: '10000000000000',
				feeMultiplier: 100,
				proofGamma: 'PROOF_GAMMA',
				proofScalar: 'PROOF_SCALAR',
				proofVerificationHash: 'PROOF_VERIFICATION_HASH',
				stateHash: 'STATE_HASH',
				stateHashSubCacheMerkleRoots: {
					accountState: 'ACCOUNT_STATE_ROOT',
					namespace: 'NAMESPACE_ROOT',
					mosaic: 'MOSAIC_ROOT',
					multisig: 'MULTISIG_ROOT',
					hashLockInfo: 'HASH_LOCK_ROOT',
					secretLookInfo: 'SECRET_LOOK_ROOT',
					accountRestriction: 'ACCOUNT_RESTRICTION_ROOT',
					mosaicRestriction: 'MOSAIC_RESTRICTION_ROOT',
					metadata: 'METADATA_ROOT'
				},
				receiptsHash: 'RECEIPTS_HASH',
				transactionsHash: 'TRANSACTIONS_HASH'
			};

			// Act:
			render(<BlockInfo blockInfo={symbolBlockInfo} />);

			// Assert:
			expect(screen.getByText('label_finalized')).toBeInTheDocument();
			expect(screen.queryByText('label_created')).not.toBeInTheDocument();
			expect(screen.getByText('field_blockType')).toBeInTheDocument();
			expect(screen.getByText(blockType)).toBeInTheDocument();
			expect(screen.getByText('field_beneficiaryAddress')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.beneficiaryAddress)).toBeInTheDocument();
			expect(screen.getByText('field_statements')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.statementCount)).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.rawDifficulty)).toBeInTheDocument();
			expect(screen.getByText('field_feeMultiplier')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.feeMultiplier)).toBeInTheDocument();
			expect(screen.getByText('field_proofGamma')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.proofGamma)).toBeInTheDocument();
			expect(screen.getByText('field_proofScalar')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.proofScalar)).toBeInTheDocument();
			expect(screen.getByText('field_proofVerificationHash')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.proofVerificationHash)).toBeInTheDocument();
			expect(screen.getByText('section_merkleInfo')).toBeInTheDocument();
			expect(screen.getByText('field_stateHash')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.stateHash)).toBeInTheDocument();
			expect(screen.getByText('field_stateHashSubCacheMerkleRoots')).toBeInTheDocument();
			expect(screen.getByText('field_accountState')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.stateHashSubCacheMerkleRoots.accountState)).toBeInTheDocument();
			expect(screen.getByText('field_secretLookInfo')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.stateHashSubCacheMerkleRoots.secretLookInfo)).toBeInTheDocument();
			expect(screen.getByText('field_receiptsHash')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.receiptsHash)).toBeInTheDocument();
			expect(screen.getByText('field_transactionHash')).toBeInTheDocument();
			expect(screen.getByText(symbolBlockInfo.transactionsHash)).toBeInTheDocument();
			expect(screen.getByText('section_receipts')).toBeInTheDocument();
			expect(screen.getByText('section_balanceChangeReceipt')).toBeInTheDocument();
			expect(screen.getByText('section_balanceTransferReceipt')).toBeInTheDocument();
			expect(screen.getByText('section_artifactExpiryReceipt')).toBeInTheDocument();
			expect(screen.getByText('section_inflationReceipt')).toBeInTheDocument();
			await waitFor(() => expect(screen.getByText('receiptType_harvestFee')).toBeInTheDocument());
			fireEvent.click(screen.getByText('section_inflationReceipt'));
			expect(screen.getByText('receiptType_inflation')).toBeInTheDocument();
		});

		it('renders created status for unfinalized Symbol blocks', () => {
			// Arrange:
			pageConfig.blocks.showFinalization = true;

			// Act:
			render(<BlockInfo blockInfo={{ ...blockInfoResult, isFinalized: false }} />);

			// Assert:
			expect(screen.getByText('label_created')).toBeInTheDocument();
			expect(screen.queryByText('label_finalized')).not.toBeInTheDocument();
		});
	});
});
