import '@testing-library/jest-dom';
import { expectTexts, runTestCases } from '../test-utils/page';
import TransactionGraphic from '@/app/components/TransactionGraphic';
import { render } from '@testing-library/react';

// Constants

const transactionType = 'TRANSFER';
const senderAddress = 'NCDZDXLTPSSHGWDGBWCNC67GDM7VU6ZQM4KJLXWZ';
const recipientAddress = 'NDQXKN6REQRVT4WE6WIU2FXQLTJFEHKK5ITD2ZSV';
const mosaicId = 'my_namespace.token';
const namespaceId = 'my_namespace';
const lockAvatarAltText = 'Lock';
const accountTarget = { name: 'recipient', renderer: 'account', localeKey: 'field_recipient' };
const mosaicTarget = { name: 'mosaicId', renderer: 'mosaic', localeKey: 'field_targetMosaic' };
const namespaceTarget = { name: 'namespaceId', renderer: 'namespace', localeKey: 'field_targetNamespace' };
const lockTarget = { name: 'duration', renderer: 'lock', localeKey: 'field_lock' };

// Tests

describe('components/TransactionGraphic', () => {
	const runTransactionGraphicTest = (description, config, expected) => {
		it(description, async () => {
			// Arrange:
			const transaction = {
				type: transactionType,
				sender: senderAddress,
				...config.transaction
			};

			// Act:
			render(<TransactionGraphic transaction={transaction} target={config.target} />);

			// Assert:
			await expectTexts(expected);
		});
	};

	const transactionGraphicCases = [
		{
			description: 'renders the sender title, the sender and the transaction type',
			config: {
				transaction: { recipient: recipientAddress },
				target: accountTarget
			},
			expected: { texts: ['field_sender', senderAddress, 'transactionType_transfer'] }
		},
		{
			description: 'renders the target title and the address when the target renderer is account',
			config: {
				transaction: { recipient: recipientAddress },
				target: accountTarget
			},
			expected: {
				texts: ['field_recipient', recipientAddress],
				altOccurrences: { [lockAvatarAltText]: 0 }
			}
		},
		{
			description: 'renders the target title and the mosaic id when the target renderer is mosaic',
			config: {
				transaction: { mosaicId },
				target: mosaicTarget
			},
			expected: { texts: ['field_targetMosaic', mosaicId] }
		},
		{
			description: 'renders the target title and the namespace id when the target renderer is namespace',
			config: {
				transaction: { namespaceId },
				target: namespaceTarget
			},
			expected: { texts: ['field_targetNamespace', namespaceId] }
		},
		{
			description: 'renders the target title, the lock avatar and the duration when the target renderer is lock',
			config: {
				transaction: { duration: '480' },
				target: lockTarget
			},
			expected: {
				texts: ['field_lock', 'value_lockDuration::duration:480'],
				altOccurrences: { [lockAvatarAltText]: 1 }
			}
		},
		{
			description: 'renders the sender and does not render the target title and the address when the target is null',
			config: {
				transaction: { recipient: recipientAddress },
				target: null
			},
			expected: {
				texts: ['field_sender', senderAddress],
				hiddenTexts: ['field_recipient', recipientAddress]
			}
		}
	];

	runTestCases(runTransactionGraphicTest, transactionGraphicCases);
});
