import { MessageView } from '@/app/components/display/MessageView';
import { MessageType } from '@/app/constants';
import { runRenderComponentTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';

const CUSTOM_MESSAGE_TYPE = 123;

describe('components/MessageView', () => {
	const createProps = ({ type, text, payload } = {}) => ({
		message: {
			type: type ?? MessageType.PLAIN_TEXT,
			text: text,
			payload: payload ?? ''
		}
	});

	runRenderComponentTest(MessageView, {
		props: createProps({ text: 'Test message' })
	});

	describe('text', () => {
		const runTextTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.message);

				// Act:
				const { queryByText } = render(<MessageView {...props} />);

				// Assert:
				if (expected.textShouldBeVisible)
					expect(queryByText(config.message.text)).toBeTruthy();
				else
					expect(queryByText('any text')).toBeNull();
			});
		};

		const tests = [
			{
				description: 'renders text when provided',
				config: {
					message: { type: MessageType.PLAIN_TEXT, text: 'Hello World' }
				},
				expected: {
					textShouldBeVisible: true
				}
			},
			{
				description: 'does not render text when not provided',
				config: {
					message: { type: MessageType.PLAIN_TEXT, payload: '0x1234' }
				},
				expected: {
					textShouldBeVisible: false
				}
			}
		];

		tests.forEach(test => {
			runTextTest(test.description, test.config, test.expected);
		});
	});

	describe('icon', () => {
		const runIconTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.message);

				// Act:
				const { queryByTestId } = render(<MessageView {...props} />);

				// Assert:
				if (expected.iconShouldBeVisible)
				{expect(queryByTestId(`icon-${expected.iconName}`)).toBeTruthy();}
				else {
					expect(queryByTestId('icon-message-encrypted')).toBeNull();
					expect(queryByTestId('icon-file-code')).toBeNull();
				}
			});
		};

		const tests = [
			{
				description: 'renders encrypted icon for encrypted message type',
				config: {
					message: { type: MessageType.ENCRYPTED_TEXT, text: 'Encrypted content' }
				},
				expected: {
					iconShouldBeVisible: true,
					iconName: 'message-encrypted'
				}
			},
			{
				description: 'renders raw icon for message with payload but no text',
				config: {
					message: { type: CUSTOM_MESSAGE_TYPE, payload: '0x1234abcd' }
				},
				expected: {
					iconShouldBeVisible: true,
					iconName: 'file-code'
				}
			},
			{
				description: 'does not render icon for plain text message with text',
				config: {
					message: { type: MessageType.PLAIN_TEXT, text: 'Plain message' }
				},
				expected: {
					iconShouldBeVisible: false
				}
			}
		];

		tests.forEach(test => {
			runIconTest(test.description, test.config, test.expected);
		});
	});
});
