import { Passcode, PasscodeView } from '@/app/components/features/Passcode';
import { passcodeManager } from '@/app/lib/passcode';
import { mockLocalization } from '__tests__/mock-helpers';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/app/lib/passcode');
jest.mock('@haskkor/react-native-pincode', () => {
	const { Text, TouchableOpacity } = require('react-native');
	return {
		__esModule: true,
		default: ({ finishProcess }) => (
			<TouchableOpacity onPress={() => finishProcess()}>
				<Text>PINCode Mock</Text>
			</TouchableOpacity>
		)
	};
});

describe('components/Passcode', () => {
	const createDefaultProps = () => ({
		type: 'verify',
		onSuccess: jest.fn(),
		onCancel: jest.fn()
	});

	beforeEach(() => {
		mockLocalization();
	});

	describe('loading state', () => {
		it('renders loading indicator while checking passcode status', () => {
			// Arrange:
			passcodeManager.isPasscodeSet.mockImplementation(() => new Promise(() => {}));
			const props = createDefaultProps();

			// Act:
			const { queryByText, UNSAFE_getByType } = render(<Passcode {...props} />);
			const { ActivityIndicator } = require('react-native');

			// Assert:
			expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
			expect(queryByText('PINCode Mock')).toBeNull();
		});
	});

	describe('verify mode', () => {
		const runVerifyModeTest = (description, config, expected) => {
			it(description, async () => {
				// Arrange:
				passcodeManager.isPasscodeSet.mockResolvedValue(config.isPasscodeSet);
				const props = createDefaultProps();

				// Act:
				const { queryByText, queryByRole } = render(<Passcode {...props} type="verify" />);

				// Assert:
				await waitFor(() => {
					if (expected.shouldCallOnSuccess) {
						expect(props.onSuccess).toHaveBeenCalled();
					} else {
						expect(queryByRole('progressbar')).toBeNull();
						expect(queryByText('PINCode Mock')).toBeTruthy();
					}
				});
			});
		};

		const tests = [
			{
				description: 'calls onSuccess immediately when passcode is not set',
				config: { isPasscodeSet: false },
				expected: { shouldCallOnSuccess: true }
			},
			{
				description: 'renders PINCode component when passcode is set',
				config: { isPasscodeSet: true },
				expected: { shouldCallOnSuccess: false }
			}
		];

		tests.forEach(test => {
			runVerifyModeTest(test.description, test.config, test.expected);
		});
	});

	describe('create mode', () => {
		const runCreateModeTest = (description, config) => {
			it(description, async () => {
				// Arrange:
				passcodeManager.isPasscodeSet.mockResolvedValue(config.isPasscodeSet);
				const props = createDefaultProps();

				// Act:
				const { getByText, queryByRole } = render(<Passcode {...props} type="create" />);

				// Assert:
				await waitFor(() => {
					expect(queryByRole('progressbar')).toBeNull();
					expect(getByText('PINCode Mock')).toBeTruthy();
				});
			});
		};

		const tests = [
			{
				description: 'renders PINCode component when passcode is not set',
				config: { isPasscodeSet: false }
			},
			{
				description: 'renders PINCode component when passcode is set',
				config: { isPasscodeSet: true }
			}
		];

		tests.forEach(test => {
			runCreateModeTest(test.description, test.config);
		});
	});

	describe('onCancel button', () => {
		it('renders cancel button when onCancel callback is provided', async () => {
			// Arrange:
			passcodeManager.isPasscodeSet.mockResolvedValue(true);
			const props = createDefaultProps();

			// Act:
			const { getByText } = render(<Passcode {...props} />);

			// Assert:
			await waitFor(() => {
				expect(getByText('button_cancel')).toBeTruthy();
			});
		});

		it('does not render cancel button when onCancel callback is not provided', async () => {
			// Arrange:
			passcodeManager.isPasscodeSet.mockResolvedValue(true);
			const props = createDefaultProps();

			// Act:
			const { queryByText } = render(<Passcode {...props} onCancel={undefined} />);

			// Assert:
			await waitFor(() => {
				expect(queryByText('button_cancel')).toBeNull();
			});
		});

		it('calls onCancel when cancel button is pressed', async () => {
			// Arrange:
			passcodeManager.isPasscodeSet.mockResolvedValue(true);
			const props = createDefaultProps();

			// Act:
			const { getByText } = render(<Passcode {...props} />);

			// Assert:
			await waitFor(() => {
				expect(getByText('button_cancel')).toBeTruthy();
			});

			// Act:
			fireEvent.press(getByText('button_cancel'));

			// Assert:
			expect(props.onCancel).toHaveBeenCalled();
		});
	});

	describe('onSuccess callback', () => {
		it('calls onSuccess when PINCode finishProcess is triggered', async () => {
			// Arrange:
			passcodeManager.isPasscodeSet.mockResolvedValue(true);
			const props = createDefaultProps();

			// Act:
			const { getByText } = render(<Passcode {...props} />);

			// Assert:
			await waitFor(() => {
				expect(getByText('PINCode Mock')).toBeTruthy();
			});

			// Act:
			fireEvent.press(getByText('PINCode Mock'));

			// Assert:
			expect(props.onSuccess).toHaveBeenCalled();
		});
	});
});

describe('components/PasscodeView', () => {
	beforeEach(() => {
		mockLocalization();
		passcodeManager.isPasscodeSet.mockResolvedValue(true);
	});

	const runVisibilityTest = (description, config, expected) => {
		it(description, async () => {
			// Arrange:
			const props = {
				isVisible: config.isVisible,
				type: 'verify',
				onSuccess: jest.fn(),
				onCancel: jest.fn()
			};

			// Act:
			const { queryByText } = render(<PasscodeView {...props} />);

			// Assert:
			if (expected.shouldBeRendered) {
				await waitFor(() => {
					expect(queryByText('PINCode Mock')).toBeTruthy();
				});
			} else {
				expect(queryByText('PINCode Mock')).toBeNull();
			}
		});
	};

	describe('visibility', () => {
		const tests = [
			{
				description: 'renders component when isVisible is true',
				config: { isVisible: true },
				expected: { shouldBeRendered: true }
			},
			{
				description: 'does not render component when isVisible is false',
				config: { isVisible: false },
				expected: { shouldBeRendered: false }
			}
		];

		tests.forEach(test => {
			runVisibilityTest(test.description, test.config, test.expected);
		});
	});
});
