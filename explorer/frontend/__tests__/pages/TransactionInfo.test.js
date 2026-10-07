import '@testing-library/jest-dom';
import {
	accountKeyLinkConfirmedTransaction,
	multisigConfirmedTransaction,
	transferConfirmedTransaction,
	transferUnconfirmedTransaction
} from '../../__fixtures__/local/transaction';
import { runGetServerSidePropsTests, runRenderScenarioTests } from '../test-utils/page';
import * as StatsService from '@/app/api/stats';
import * as TransactionService from '@/app/api/transactions';
import TransactionInfo, { getServerSideProps } from '@/app/pages/transactions/[hash]';
import { render } from '@testing-library/react';

// Mocks

jest.mock('@/app/api/transactions', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/transactions')
	};
});

jest.mock('@/app/api/stats', () => {
	return {
		__esModule: true,
		...jest.requireActual('@/app/api/stats')
	};
});

beforeEach(() => {
	jest.spyOn(StatsService, 'fetchPriceByDate').mockResolvedValue(mockedMosaicPrice);
});

// Constants

const SCREEN_TEXT = {
	sectionTransaction: 'section_transaction',
	sectionTransactionBody: 'section_transactionBody',
	sectionAccountStateChange: 'section_accountStateChange',
	sectionSignatures: 'section_signatures',
	sectionFeesBreakdown: 'section_feesBreakdown',
	fieldType: 'field_type',
	fieldStatus: 'field_status',
	fieldTimestamp: 'field_timestamp',
	fieldTimestampUTC: 'field_timestampUTC',
	fieldAmount: 'field_amount',
	fieldAmountInUserCurrency: 'field_amountInUserCurrency',
	fieldFee: 'field_fee',
	fieldTransactionHash: 'field_transaction_hash',
	fieldSigner: 'field_signer',
	fieldTransactionBlock: 'field_transaction_block',
	fieldSize: 'field_size',
	fieldVersion: 'field_version',
	fieldSignature: 'field_signature',
	fieldSender: 'field_sender',
	fieldRecipient: 'field_recipient',
	fieldMosaics: 'field_mosaics',
	fieldMessage: 'field_message',
	fieldMultisigFee: 'field_multisigFee',
	fieldEmbeddedTransactionsFee: 'field_embeddedTransactionsFee',
	fieldSignaturesFee: 'field_signaturesFee',
	fieldTotalFee: 'field_totalFee',
	labelConfirmed: 'label_confirmed',
	labelUnconfirmed: 'label_unconfirmed',
	labelSend: 'label_send',
	labelReceive: 'label_receive',
	typeTransfer: 'transactionType_TRANSFER',
	tableFieldAddress: 'table_field_address',
	tableFieldAction: 'table_field_action',
	tableFieldMosaic: 'table_field_mosaic',
	tableFieldSigner: 'table_field_signer',
	tableFieldSignature: 'table_field_signature'
};

const mockedMosaicPrice = 2;
const timestampTitleText = `${SCREEN_TEXT.fieldTimestampUTC}::title:${SCREEN_TEXT.fieldTimestamp}`;
const amountInUserCurrencyFieldText = `${SCREEN_TEXT.fieldAmountInUserCurrency}::currency:USD`;
const expectedUserCurrencyAmountText = `~${transferConfirmedTransaction.amount * mockedMosaicPrice}`;
const cosignerSignature = multisigConfirmedTransaction.signatures[0];

// Tests

describe('TransactionInfo', () => {
	describe('getServerSideProps', () => {
		const requests = { transactionInfo: [TransactionService, 'fetchTransactionInfo'] };

		const getServerSidePropsCases = [
			{
				description: 'returns the transaction info',
				config: {
					responses: { transactionInfo: transferConfirmedTransaction }
				},
				expected: {
					requestArguments: { transactionInfo: [transferConfirmedTransaction.hash] },
					result: {
						props: { transactionInfo: transferConfirmedTransaction }
					}
				}
			},
			{
				description: 'returns not found when the transaction does not exist',
				config: {
					responses: { transactionInfo: null }
				},
				expected: {
					requestArguments: { transactionInfo: [transferConfirmedTransaction.hash] },
					result: { notFound: true }
				}
			}
		];

		runGetServerSidePropsTests({
			getServerSideProps,
			params: { hash: transferConfirmedTransaction.hash },
			requests,
			cases: getServerSidePropsCases
		});
	});

	describe('render', () => {
		const renderPage = config => render(<TransactionInfo transactionInfo={config.transactionInfo} />);

		describe('section: transaction', () => {
			const transactionCases = [
				{
					description: 'renders the type, timestamp, fee and transaction details',
					config: { transactionInfo: transferConfirmedTransaction },
					expected: {
						texts: [
							SCREEN_TEXT.sectionTransaction,
							SCREEN_TEXT.fieldType,
							SCREEN_TEXT.fieldStatus,
							timestampTitleText,
							SCREEN_TEXT.fieldFee,
							SCREEN_TEXT.fieldTransactionHash,
							SCREEN_TEXT.fieldSigner,
							SCREEN_TEXT.fieldTransactionBlock,
							SCREEN_TEXT.fieldSize,
							`${transferConfirmedTransaction.size} B`,
							SCREEN_TEXT.fieldVersion,
							SCREEN_TEXT.fieldSignature,
							transferConfirmedTransaction.signature
						],
						// The body repeats the type, and the signer also renders as the sender in the body and the state change rows.
						textOccurrences: {
							[SCREEN_TEXT.typeTransfer]: 2,
							[transferConfirmedTransaction.signer]: 3
						}
					}
				},
				{
					description: 'renders status, hash and block height for a confirmed transaction',
					config: { transactionInfo: transferConfirmedTransaction },
					expected: {
						texts: [
							SCREEN_TEXT.labelConfirmed,
							transferConfirmedTransaction.hash,
							transferConfirmedTransaction.height
						],
						hiddenTexts: [SCREEN_TEXT.labelUnconfirmed]
					}
				},
				{
					description: 'renders status and placeholders for an unconfirmed transaction',
					config: { transactionInfo: transferUnconfirmedTransaction },
					expected: {
						texts: [SCREEN_TEXT.labelUnconfirmed],
						hiddenTexts: [SCREEN_TEXT.labelConfirmed],
						// The dash-only placeholders are the hash and the block height.
						textOccurrences: { '-': 2 }
					}
				},
				{
					description: 'renders the amount and the amount in user currency',
					config: { transactionInfo: transferConfirmedTransaction },
					expected: {
						texts: [
							SCREEN_TEXT.fieldAmount,
							amountInUserCurrencyFieldText
						],
						// The amount also renders in the body mosaic list and both account state change rows.
						textOccurrences: { [transferConfirmedTransaction.amount]: 4 },
						asyncTexts: [expectedUserCurrencyAmountText]
					}
				},
				{
					description: 'does not render the amount and the amount in user currency for a zero-amount transaction',
					config: { transactionInfo: accountKeyLinkConfirmedTransaction },
					expected: {
						hiddenTexts: [
							SCREEN_TEXT.fieldAmount,
							amountInUserCurrencyFieldText
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: transactionCases });
		});

		describe('section: transaction body', () => {
			const transactionBodyCases = [
				{
					description: 'renders the transfer graphic',
					config: { transactionInfo: transferConfirmedTransaction },
					expected: {
						texts: [
							SCREEN_TEXT.sectionTransactionBody,
							SCREEN_TEXT.fieldSender,
							SCREEN_TEXT.fieldRecipient,
							SCREEN_TEXT.fieldMosaics,
							SCREEN_TEXT.fieldMessage,
							transferConfirmedTransaction.body[0].message.text
						],
						// The account state change table repeats the recipient address.
						textOccurrences: { [transferConfirmedTransaction.recipient]: 2 }
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: transactionBodyCases });
		});

		describe('section: account state change', () => {
			const accountStateChangeCases = [
				{
					description: 'renders the sender and recipient state change rows',
					config: { transactionInfo: transferConfirmedTransaction },
					expected: {
						texts: [
							SCREEN_TEXT.sectionAccountStateChange,
							SCREEN_TEXT.tableFieldAddress,
							SCREEN_TEXT.tableFieldAction,
							SCREEN_TEXT.tableFieldMosaic,
							SCREEN_TEXT.labelSend,
							SCREEN_TEXT.labelReceive
						]
					}
				},
				{
					description: 'is rendered for a multisig transaction',
					config: { transactionInfo: multisigConfirmedTransaction },
					expected: {
						texts: [SCREEN_TEXT.sectionAccountStateChange]
					}
				},
				{
					description: 'is not rendered for an account key link transaction',
					config: { transactionInfo: accountKeyLinkConfirmedTransaction },
					expected: {
						hiddenTexts: [
							SCREEN_TEXT.sectionAccountStateChange,
							SCREEN_TEXT.tableFieldAction
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: accountStateChangeCases });
		});

		describe('section: signatures', () => {
			const signaturesCases = [
				{
					description: 'renders the cosignatory signature rows for a multisig transaction',
					config: { transactionInfo: multisigConfirmedTransaction },
					expected: {
						texts: [
							SCREEN_TEXT.sectionSignatures,
							SCREEN_TEXT.tableFieldSigner,
							SCREEN_TEXT.tableFieldSignature,
							cosignerSignature.signer,
							cosignerSignature.signature
						]
					}
				},
				{
					description: 'is not rendered for a transfer transaction',
					config: { transactionInfo: transferConfirmedTransaction },
					expected: {
						hiddenTexts: [
							SCREEN_TEXT.sectionSignatures,
							SCREEN_TEXT.tableFieldSigner
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: signaturesCases });
		});

		describe('section: fees breakdown', () => {
			const feesBreakdownCases = [
				{
					description: 'renders the fee rows for a multisig transaction',
					config: { transactionInfo: multisigConfirmedTransaction },
					expected: {
						texts: [
							SCREEN_TEXT.sectionFeesBreakdown,
							SCREEN_TEXT.fieldMultisigFee,
							SCREEN_TEXT.fieldEmbeddedTransactionsFee,
							SCREEN_TEXT.fieldSignaturesFee,
							SCREEN_TEXT.fieldTotalFee
						],
						titles: ['0.1 XEM'],
						// The multisig and signatures fees are equal, and the total fee also renders in the fee field.
						titleOccurrences: {
							'0.15 XEM': 2,
							'0.4 XEM': 2
						}
					}
				},
				{
					description: 'is not rendered for a transfer transaction',
					config: { transactionInfo: transferConfirmedTransaction },
					expected: {
						hiddenTexts: [
							SCREEN_TEXT.sectionFeesBreakdown,
							SCREEN_TEXT.fieldMultisigFee
						]
					}
				}
			];

			runRenderScenarioTests({ renderPage, cases: feesBreakdownCases });
		});
	});
});
