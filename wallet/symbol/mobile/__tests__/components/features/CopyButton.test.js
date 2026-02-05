import { CopyButton } from '@/app/components/features/CopyButton';
import { PlatformUtils } from '@/app/lib/platform/PlatformUtils';
import { showMessage } from '@/app/utils';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/app/lib/platform/PlatformUtils', () => ({
	PlatformUtils: {
		copyToClipboard: jest.fn()
	}
}));

jest.mock('@/app/utils', () => ({
	showMessage: jest.fn()
}));

describe('components/CopyButton', () => {
	const createDefaultProps = () => ({
		content: 'test-content-to-copy'
	});

	describe('render', () => {
		it('renders component without errors', () => {
			// Arrange:
			const props = createDefaultProps();

			// Act & Assert:
			expect(() => render(<CopyButton {...props} />)).not.toThrow();
		});
	});

	describe('copy to clipboard', () => {
		const runCopyToClipboardTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createDefaultProps();
				const errorMessage = 'Copy failed';

				if (config.shouldThrowError) {
					PlatformUtils.copyToClipboard.mockImplementation(() => {
						throw new Error(errorMessage);
					});
				} else {
					PlatformUtils.copyToClipboard.mockImplementation(() => {});
				}

				// Act:
				const { getByRole } = render(<CopyButton {...props} />);
				const button = getByRole('button');
				fireEvent.press(button);

				// Assert:
				if (expected.shouldCopyContent)
					expect(PlatformUtils.copyToClipboard).toHaveBeenCalledWith(props.content);

				if (expected.shouldShowSuccessMessage) {
					expect(showMessage).toHaveBeenCalledWith({
						message: props.content,
						type: 'info'
					});
				}

				if (expected.shouldShowErrorMessage) {
					expect(showMessage).toHaveBeenCalledWith({
						message: errorMessage,
						type: 'danger'
					});
				}
			});
		};

		const tests = [
			{
				description: 'copies content to clipboard on press',
				config: { shouldThrowError: false },
				expected: { shouldCopyContent: true }
			},
			{
				description: 'shows success message after copying',
				config: { shouldThrowError: false },
				expected: { shouldShowSuccessMessage: true }
			},
			{
				description: 'shows error message when copy fails',
				config: { shouldThrowError: true },
				expected: { shouldShowErrorMessage: true }
			}
		];

		tests.forEach(test => {
			runCopyToClipboardTest(test.description, test.config, test.expected);
		});
	});
});
