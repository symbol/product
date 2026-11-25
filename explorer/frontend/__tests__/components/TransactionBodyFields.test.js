import '@testing-library/jest-dom';
import { expectTexts, runTestCases } from '../test-utils/page';
import TransactionBodyFields from '@/app/components/TransactionBodyFields';
import { render, screen } from '@testing-library/react';

// Constants

const transactionType = 'TRANSFER';
const accountAddress = 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV';
const secondAccountAddress = 'NCDZDXLTPSSHGWDGBWCNC67GDM7VU6ZQM4KJLXWZ';
const publicKey = 'FE68F61CF3B6B4E533F5CF2E01D782B736CDF1EE20871F00A4C37D023F72A149';
const mosaicId = 'my_namespace.token';
const namespaceId = 'my_namespace';
const messageText = 'Hello';
const plainMessage = {
	type: 'plain',
	text: messageText
};
const emptyListText = '-';
const moreButtonTextPattern = /button_more/;
const fiveAliasNames = ['alias1', 'alias2', 'alias3', 'alias4', 'alias5'];
const sixAliasNames = [...fiveAliasNames, 'alias6'];

// Tests

describe('components/TransactionBodyFields', () => {
	const runTransactionBodyFieldsTest = (description, config, expected) => {
		it(description, async () => {
			// Act:
			render(<TransactionBodyFields transaction={config.transaction} fields={config.fields} />);

			// Assert:
			await expectTexts(expected);
		});
	};

	describe('renderers', () => {
		const rendererCases = [
			{
				description: 'renders the title and the address when the renderer is account',
				config: {
					transaction: { recipient: accountAddress },
					fields: [{ name: 'recipient', renderer: 'account' }]
				},
				expected: { texts: ['field_recipient', accountAddress] }
			},
			{
				description: 'renders the title and the translated value when the renderer is boolean',
				config: {
					transaction: { transferable: true },
					fields: [{ name: 'transferable', renderer: 'boolean' }]
				},
				expected: { texts: ['field_transferable', 'value_true'] }
			},
			{
				description: 'renders the title and the text when the renderer is copy',
				config: {
					transaction: { linkedPublicKey: publicKey },
					fields: [{ name: 'linkedPublicKey', renderer: 'copy' }]
				},
				expected: { texts: ['field_linkedPublicKey', publicKey] }
			},
			{
				description: 'renders the title and the increase text when the renderer is delta and the value is positive',
				config: {
					transaction: { delta: 500 },
					fields: [{ name: 'delta', renderer: 'delta' }]
				},
				expected: { texts: ['field_delta', 'value_deltaIncrease::delta:500'] }
			},
			{
				description: 'renders the title and the decrease text when the renderer is delta and the value is negative',
				config: {
					transaction: { delta: -500 },
					fields: [{ name: 'delta', renderer: 'delta' }]
				},
				expected: { texts: ['field_delta', 'value_deltaDecrease::delta:500'] }
			},
			{
				description: 'renders the title and the amount when the renderer is fee',
				config: {
					transaction: { rentalFee: 100 },
					fields: [{ name: 'rentalFee', renderer: 'fee' }]
				},
				expected: { texts: ['field_rentalFee', '100'] }
			},
			{
				description: 'renders the title and the message text when the renderer is message',
				config: {
					transaction: { message: plainMessage },
					fields: [{ name: 'message', renderer: 'message' }]
				},
				expected: { texts: ['field_message', messageText] }
			},
			{
				description: 'renders the title and the mosaic id when the renderer is mosaic',
				config: {
					transaction: { mosaicId },
					fields: [{ name: 'mosaicId', renderer: 'mosaic' }]
				},
				expected: { texts: ['field_mosaicId', mosaicId] }
			},
			{
				description: 'renders the title, the amount and the mosaic name when the renderer is mosaicAmount',
				config: {
					transaction: {
						mosaics: [
							{
								id: mosaicId,
								name: mosaicId,
								amount: 12
							}
						]
					},
					fields: [{ name: 'mosaics', renderer: 'mosaicAmount' }]
				},
				expected: { texts: ['field_mosaics', '12', mosaicId] }
			},
			{
				description: 'renders the title and the namespace id when the renderer is namespace',
				config: {
					transaction: { namespaceId },
					fields: [{ name: 'namespaceId', renderer: 'namespace' }]
				},
				expected: { texts: ['field_namespaceId', namespaceId] }
			},
			{
				description: 'renders the title and the value when the renderer is text',
				config: {
					transaction: { divisibility: 6 },
					fields: [{ name: 'divisibility', renderer: 'text' }]
				},
				expected: { texts: ['field_divisibility', '6'] }
			},
			{
				description: 'renders the title and the type name when the renderer is transactionType',
				config: {
					transaction: { restrictionOperationAdditions: [transactionType] },
					fields: [{ name: 'restrictionOperationAdditions', renderer: 'transactionType' }]
				},
				expected: { texts: ['field_restrictionOperationAdditions', 'transactionType_transfer'] }
			},
			{
				description: 'renders the title and the translated value when the renderer is translate',
				config: {
					transaction: { linkAction: 'link' },
					fields: [{ name: 'linkAction', renderer: 'translate' }]
				},
				expected: { texts: ['field_linkAction', 'value_link'] }
			}
		];

		runTestCases(runTransactionBodyFieldsTest, rendererCases);
	});

	describe('empty values', () => {
		const emptyValueCases = [
			{
				description: 'renders the field when the value is zero',
				config: {
					transaction: { delta: 0 },
					fields: [{ name: 'delta', renderer: 'delta' }]
				},
				expected: { texts: ['field_delta', 'value_deltaUnchanged::delta:0'] }
			},
			{
				description: 'renders the field when the value is false',
				config: {
					transaction: { transferable: false },
					fields: [{ name: 'transferable', renderer: 'boolean' }]
				},
				expected: { texts: ['field_transferable', 'value_false'] }
			},
			{
				description: 'does not render the field when the value is null',
				config: {
					transaction: { message: null },
					fields: [{ name: 'message', renderer: 'message' }]
				},
				expected: { hiddenTexts: ['field_message'] }
			},
			{
				description: 'does not render the field when the value is not set',
				config: {
					transaction: {},
					fields: [{ name: 'message', renderer: 'message' }]
				},
				expected: { hiddenTexts: ['field_message'] }
			}
		];

		runTestCases(runTransactionBodyFieldsTest, emptyValueCases);
	});

	describe('lists', () => {
		const listCases = [
			{
				description: 'renders each item when the value is a list',
				config: {
					transaction: { addressAdditions: [accountAddress, secondAccountAddress] },
					fields: [{ name: 'addressAdditions', renderer: 'account' }]
				},
				expected: { texts: ['field_addressAdditions', accountAddress, secondAccountAddress] }
			},
			{
				description: 'renders the empty list text when the value is an empty list',
				config: {
					transaction: { addressAdditions: [] },
					fields: [{ name: 'addressAdditions', renderer: 'account' }]
				},
				expected: { texts: ['field_addressAdditions', emptyListText] }
			},
			{
				description: 'renders the more button when the list is longer than five items',
				config: {
					transaction: { mosaicAliasNames: sixAliasNames },
					fields: [{ name: 'mosaicAliasNames', renderer: 'text' }]
				},
				expected: {
					texts: [...fiveAliasNames, 'button_more::count:1'],
					hiddenTexts: ['alias6']
				}
			},
			{
				description: 'does not render the more button when the list has five items',
				config: {
					transaction: { mosaicAliasNames: fiveAliasNames },
					fields: [{ name: 'mosaicAliasNames', renderer: 'text' }]
				},
				expected: {
					texts: fiveAliasNames,
					hiddenTexts: [moreButtonTextPattern]
				}
			}
		];

		runTestCases(runTransactionBodyFieldsTest, listCases);
	});

	describe('order', () => {
		it('renders the fields in the fields list order', () => {
			// Arrange:
			const transaction = {
				linkAction: 'link',
				message: plainMessage,
				recipient: accountAddress
			};
			const fields = [
				{ name: 'recipient', renderer: 'account' },
				{ name: 'message', renderer: 'message' },
				{ name: 'linkAction', renderer: 'translate' }
			];
			const expectedTitles = ['field_recipient', 'field_message', 'field_linkAction'];

			// Act:
			render(<TransactionBodyFields transaction={transaction} fields={fields} />);
			const titles = screen.getAllByText(/^field_/).map(element => element.textContent);

			// Assert:
			expect(titles).toEqual(expectedTitles);
		});
	});
});
