import { RootLayout } from '@/app/components/layout/RootLayout';
import { runRenderComponentTest, runRenderTextTest } from '__tests__/component-tests';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

jest.mock('@/app/components', () => {
	const actual = jest.requireActual('@/app/components');
	const React = require('react');
	const { Text } = require('react-native');

	return {
		__esModule: true,
		...actual,
		NetworkConnectionStatusBar: ({ networkStatus }) => (
			<Text>network-status-bar-{networkStatus}</Text>
		),
		PopupMessage: () => <Text>popup-message</Text>,
		SystemStatusBar: () => <Text>system-status-bar</Text>
	};
});

describe('components/RootLayout', () => {
	const createDefaultProps = () => ({
		isNetworkStatusShown: false,
		networkStatus: 'connected'
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	runRenderComponentTest(RootLayout, {
		props: createDefaultProps()
	});

	runRenderTextTest(RootLayout, {
		props: createDefaultProps(),
		textToRender: [
			{ type: 'text', value: 'system-status-bar' },
			{ type: 'text', value: 'popup-message' }
		]
	});

	describe('children', () => {
		it('renders children correctly', () => {
			// Arrange:
			const props = createDefaultProps();
			const childText = 'child-content';

			// Act:
			const { getByText } = render(<RootLayout {...props}>
				<Text>{childText}</Text>
			</RootLayout>);

			// Assert:
			expect(getByText(childText)).toBeTruthy();
		});
	});

	describe('network status bar visibility', () => {
		const runNetworkStatusBarVisibilityTest = (config, expected, description) => {
			it(description, () => {
				// Arrange:
				const props = {
					...createDefaultProps(),
					isNetworkStatusShown: config.isNetworkStatusShown,
					networkStatus: config.networkStatus
				};

				// Act:
				const { queryByText } = render(<RootLayout {...props} />);
				const statusBar = queryByText(`network-status-bar-${config.networkStatus}`);

				// Assert:
				if (expected.shouldRender)
					expect(statusBar).toBeTruthy();
				else
					expect(statusBar).toBeNull();
			});
		};

		const tests = [
			{
				description: 'renders NetworkConnectionStatusBar when isNetworkStatusShown=true',
				config: { isNetworkStatusShown: true, networkStatus: 'connected' },
				expected: { shouldRender: true }
			},
			{
				description: 'renders NetworkConnectionStatusBar when isNetworkStatusShown=true',
				config: { isNetworkStatusShown: true, networkStatus: 'connecting' },
				expected: { shouldRender: true }
			},
			{
				description: 'does not render NetworkConnectionStatusBar when isNetworkStatusShown=false',
				config: { isNetworkStatusShown: false, networkStatus: 'connected' },
				expected: { shouldRender: false }
			},
			{
				description: 'does not render NetworkConnectionStatusBar when isNetworkStatusShown=false',
				config: { isNetworkStatusShown: false, networkStatus: 'connecting' },
				expected: { shouldRender: false }
			}
		];

		tests.forEach(test => {
			runNetworkStatusBarVisibilityTest(test.config, test.expected, test.description);
		});
	});

	describe('network status prop', () => {
		const runNetworkStatusPropTest = (config, expected, description) => {
			it(description, () => {
				// Arrange:
				const props = {
					...createDefaultProps(),
					isNetworkStatusShown: true,
					networkStatus: config.networkStatus
				};

				// Act:
				const { getByText } = render(<RootLayout {...props} />);

				// Assert:
				expect(getByText(`network-status-bar-${expected.networkStatus}`)).toBeTruthy();
			});
		};

		const tests = [
			{
				description: 'passes networkStatus="connected" to NetworkConnectionStatusBar',
				config: { networkStatus: 'connected' },
				expected: { networkStatus: 'connected' }
			},
			{
				description: 'passes networkStatus="connecting" to NetworkConnectionStatusBar',
				config: { networkStatus: 'connecting' },
				expected: { networkStatus: 'connecting' }
			},
			{
				description: 'passes networkStatus="offline" to NetworkConnectionStatusBar',
				config: { networkStatus: 'offline' },
				expected: { networkStatus: 'offline' }
			}
		];

		tests.forEach(test => {
			runNetworkStatusPropTest(test.config, test.expected, test.description);
		});
	});
});
