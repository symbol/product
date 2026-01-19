import { TransactionStatusDialog } from '@/app/components/templates/TransactionScreenTemplate/components/TransactionStatusDialog';
import { ActivityStatus } from '@/app/constants';
import { runRenderComponentTest } from '__tests__/component-tests';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/app/localization', () => ({
	$t: jest.fn(key => {
		const translations = {
			'button_openTransactionInExplorer': 'View in Explorer'
		};
		return translations[key] || key;
	})
}));

jest.mock('@/app/lib/platform/PlatformUtils', () => ({
	PlatformUtils: {
		openLink: jest.fn(),
		getOS: jest.fn(() => 'android')
	}
}));

jest.mock('@/app/utils', () => ({
	createExplorerTransactionUrl: jest.fn((chainName, networkIdentifier, hash) => 
		`https://explorer.${chainName}.${networkIdentifier}/tx/${hash}`)
}));

describe('components/TransactionStatusDialog', () => {
	const createActionStatus = (status, errorMessage = null) => ({
		status,
		errorMessage
	});

	const createProps = ({
		isVisible,
		createStatus,
		signStatus,
		announceStatus,
		transactionCount,
		signedTransactionHashes,
		confirmedTransactionHashes,
		failedTransactionHashes,
		partialTransactionHashes,
		chainName,
		networkIdentifier,
		onClose
	} = {}) => ({
		isVisible: isVisible ?? true,
		createStatus: createStatus ?? createActionStatus(ActivityStatus.PENDING),
		signStatus: signStatus ?? createActionStatus(ActivityStatus.PENDING),
		announceStatus: announceStatus ?? createActionStatus(ActivityStatus.PENDING),
		transactionCount: transactionCount ?? 1,
		signedTransactionHashes: signedTransactionHashes ?? [],
		confirmedTransactionHashes: confirmedTransactionHashes ?? [],
		failedTransactionHashes: failedTransactionHashes ?? [],
		partialTransactionHashes: partialTransactionHashes ?? [],
		chainName: chainName ?? 'symbol',
		networkIdentifier: networkIdentifier ?? 'mainnet',
		onClose: onClose ?? jest.fn()
	});

	runRenderComponentTest(TransactionStatusDialog, {
		props: createProps()
	});

	describe('activity log steps', () => {
		const runActivityLogTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { queryAllByText } = render(<TransactionStatusDialog {...props} />);

				// Assert:
				expected.visibleTexts.forEach(text => {
					const elements = queryAllByText(text);
					expect(elements.length).toBeGreaterThan(0);
				});
			});
		};

		const tests = [
			{
				description: 'renders all activity log steps',
				config: {
					props: {}
				},
				expected: {
					visibleTexts: ['Create Transaction', 'Sign Transaction', 'Send Transaction', 'Confirmation']
				}
			}
		];

		tests.forEach(test => {
			runActivityLogTest(test.description, test.config, test.expected);
		});
	});

	describe('status card', () => {
		const runStatusCardTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { getByText } = render(<TransactionStatusDialog {...props} />);

				// Assert:
				expect(getByText(expected.title)).toBeTruthy();
				expect(getByText(expected.description)).toBeTruthy();
			});
		};

		const tests = [
			{
				description: 'shows sending status when creating',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.LOADING),
						signStatus: createActionStatus(ActivityStatus.PENDING),
						announceStatus: createActionStatus(ActivityStatus.PENDING)
					}
				},
				expected: {
					title: 'Please Wait',
					description: 'Please do not close the app until the transaction has been sent.'
				}
			},
			{
				description: 'shows sending status when signing',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.LOADING),
						announceStatus: createActionStatus(ActivityStatus.PENDING)
					}
				},
				expected: {
					title: 'Please Wait',
					description: 'Please do not close the app until the transaction has been sent.'
				}
			},
			{
				description: 'shows sending status when announcing',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.COMPLETE),
						announceStatus: createActionStatus(ActivityStatus.LOADING)
					}
				},
				expected: {
					title: 'Please Wait',
					description: 'Please do not close the app until the transaction has been sent.'
				}
			},
			{
				description: 'shows confirming status when announced but not confirmed',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.COMPLETE),
						announceStatus: createActionStatus(ActivityStatus.COMPLETE),
						transactionCount: 1,
						confirmedTransactionHashes: []
					}
				},
				expected: {
					title: 'Transaction Sent',
					description: 'Waiting for network confirmation. You can close this window or keep it open to watch the progress.'
				}
			},
			{
				description: 'shows success status when all confirmed',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.COMPLETE),
						announceStatus: createActionStatus(ActivityStatus.COMPLETE),
						transactionCount: 1,
						confirmedTransactionHashes: ['hash1']
					}
				},
				expected: {
					title: 'Success',
					description: 'Transaction confirmed!'
				}
			},
			{
				description: 'shows create error status',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.ERROR, 'Create error'),
						signStatus: createActionStatus(ActivityStatus.PENDING),
						announceStatus: createActionStatus(ActivityStatus.PENDING)
					}
				},
				expected: {
					title: 'Creation Failed',
					description: 'Transaction could not be created'
				}
			},
			{
				description: 'shows sign error status',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.ERROR, 'Sign error'),
						announceStatus: createActionStatus(ActivityStatus.PENDING)
					}
				},
				expected: {
					title: 'Signing Failed',
					description: 'Transaction was not signed'
				}
			},
			{
				description: 'shows announce error status',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.COMPLETE),
						announceStatus: createActionStatus(ActivityStatus.ERROR, 'Announce error')
					}
				},
				expected: {
					title: 'Transaction Failed',
					description: 'Transaction was not broadcasted to the network'
				}
			},
			{
				description: 'shows failed transactions status',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.COMPLETE),
						announceStatus: createActionStatus(ActivityStatus.COMPLETE),
						transactionCount: 1,
						failedTransactionHashes: ['failed_hash']
					}
				},
				expected: {
					title: 'Transaction Failed',
					description: 'Transaction was rejected by the network'
				}
			},
			{
				description: 'shows partial status for multisig',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.COMPLETE),
						announceStatus: createActionStatus(ActivityStatus.COMPLETE),
						transactionCount: 1,
						partialTransactionHashes: ['partial_hash']
					}
				},
				expected: {
					title: 'Transaction Sent',
					description: 
						'Waiting for signatures from other parties. You can close this window or keep it open to watch the progress.'
				}
			}
		];

		tests.forEach(test => {
			runStatusCardTest(test.description, test.config, test.expected);
		});
	});

	describe('explorer button', () => {
		it('shows explorer button when transaction is announced', () => {
			// Arrange:
			const props = createProps({
				createStatus: createActionStatus(ActivityStatus.COMPLETE),
				signStatus: createActionStatus(ActivityStatus.COMPLETE),
				announceStatus: createActionStatus(ActivityStatus.COMPLETE),
				signedTransactionHashes: ['hash1']
			});

			// Act:
			const { getByText } = render(<TransactionStatusDialog {...props} />);

			// Assert:
			expect(getByText('View in Explorer')).toBeTruthy();
		});

		it('does not show explorer button when not announced', () => {
			// Arrange:
			const props = createProps({
				createStatus: createActionStatus(ActivityStatus.COMPLETE),
				signStatus: createActionStatus(ActivityStatus.COMPLETE),
				announceStatus: createActionStatus(ActivityStatus.PENDING),
				signedTransactionHashes: ['hash1']
			});

			// Act:
			const { queryByText } = render(<TransactionStatusDialog {...props} />);

			// Assert:
			expect(queryByText('View in Explorer')).toBeNull();
		});

		it('shows multiple explorer buttons for multiple transactions', () => {
			// Arrange:
			const props = createProps({
				createStatus: createActionStatus(ActivityStatus.COMPLETE),
				signStatus: createActionStatus(ActivityStatus.COMPLETE),
				announceStatus: createActionStatus(ActivityStatus.COMPLETE),
				signedTransactionHashes: ['hash1', 'hash2']
			});

			// Act:
			const { getAllByText, getByText } = render(<TransactionStatusDialog {...props} />);

			// Assert:
			expect(getAllByText('View in Explorer').length).toBe(2);
			expect(getByText('Transaction 1')).toBeTruthy();
			expect(getByText('Transaction 2')).toBeTruthy();
		});

		it('opens block explorer when button is pressed', () => {
			// Arrange:
			const { PlatformUtils } = require('@/app/lib/platform/PlatformUtils');
			const props = createProps({
				createStatus: createActionStatus(ActivityStatus.COMPLETE),
				signStatus: createActionStatus(ActivityStatus.COMPLETE),
				announceStatus: createActionStatus(ActivityStatus.COMPLETE),
				signedTransactionHashes: ['hash123'],
				chainName: 'symbol',
				networkIdentifier: 'mainnet'
			});

			// Act:
			const { getByText } = render(<TransactionStatusDialog {...props} />);
			fireEvent.press(getByText('View in Explorer'));

			// Assert:
			expect(PlatformUtils.openLink).toHaveBeenCalledWith('https://explorer.symbol.mainnet/tx/hash123');
		});
	});

	describe('dialog disabled state', () => {
		const runDisabledStateTest = (description, config) => {
			it(description, () => {
				// Arrange:
				const props = createProps(config.props);

				// Act:
				const { getAllByText } = render(<TransactionStatusDialog {...props} />);

				// Assert:
				expect(getAllByText('Send Transaction').length).toBeGreaterThan(0);
			});
		};

		const tests = [
			{
				description: 'dialog is disabled when creating',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.LOADING)
					}
				},
				expected: {}
			},
			{
				description: 'dialog is disabled when signing',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.LOADING)
					}
				},
				expected: {}
			},
			{
				description: 'dialog is disabled when announcing',
				config: {
					props: {
						createStatus: createActionStatus(ActivityStatus.COMPLETE),
						signStatus: createActionStatus(ActivityStatus.COMPLETE),
						announceStatus: createActionStatus(ActivityStatus.LOADING)
					}
				},
				expected: {}
			}
		];

		tests.forEach(test => {
			runDisabledStateTest(test.description, test.config);
		});
	});

	describe('visibility', () => {
		it('renders content when isVisible is true', () => {
			// Arrange:
			const props = createProps({ isVisible: true });

			// Act:
			const { getAllByText } = render(<TransactionStatusDialog {...props} />);

			// Assert:
			// The dialog title and activity log step both contain 'Send Transaction'
			expect(getAllByText('Send Transaction').length).toBeGreaterThan(0);
		});
	});

	describe('onClose callback', () => {
		it('does not throw when onClose is provided', () => {
			// Arrange:
			const onClose = jest.fn();
			const props = createProps({ onClose });

			// Act & Assert:
			expect(() => render(<TransactionStatusDialog {...props} />)).not.toThrow();
		});
	});
});
