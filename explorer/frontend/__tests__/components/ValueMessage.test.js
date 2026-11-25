import '@testing-library/jest-dom';
import { expectTexts, runTestCases } from '../test-utils/page';
import ValueMessage from '@/app/components/ValueMessage';
import { render } from '@testing-library/react';

// Mocks

jest.mock('@/variant/config/value-message-config', () => ({
	valueMessageConfig: {
		labelLocaleKeys: {
			encrypted: 'label_encrypted',
			raw: 'label_hex'
		}
	}
}));

// Constants

const messageText = 'Hello';
const messagePayload = 'A1B2C3D4';
const labelTexts = ['label_encrypted', 'label_hex'];

// Tests

describe('components/ValueMessage', () => {
	const runValueMessageTest = (description, config, expected) => {
		it(description, async () => {
			// Act:
			render(<ValueMessage message={config.message} />);

			// Assert:
			await expectTexts(expected);
		});
	};

	const valueMessageCases = [
		{
			description: 'renders the label of the message type and the text when the message type has a label',
			config: {
				message: {
					type: 'encrypted',
					text: messagePayload
				}
			},
			expected: {
				texts: ['label_encrypted', messagePayload],
				hiddenTexts: ['label_hex']
			}
		},
		{
			description: 'renders the text and does not render a label when the message type has no label',
			config: {
				message: {
					type: 'plain',
					text: messageText
				}
			},
			expected: {
				texts: [messageText],
				hiddenTexts: labelTexts
			}
		}
	];

	runTestCases(runValueMessageTest, valueMessageCases);
});
