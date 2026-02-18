import { SettingsAbout } from '@/app/screens/settings/SettingsAbout';
import { ScreenTester } from '__tests__/ScreenTester';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLink, mockLocalization } from '__tests__/mock-helpers';

jest.mock('../../../package.json', () => ({
	version: '1.0.0',
	dependencies: {
		'symbol-sdk': '2.0.0',
		'react-native': '3.0.0'
	}
}));

describe('screens/settings/SettingsAbout', () => {
	beforeEach(() => {
		mockLocalization();
	});

	runRenderTextTest(SettingsAbout, {
		textToRender: [
			{ type: 'text', value: 'settings_about_version_title' },
			{ type: 'text', value: 'fieldTitle_appVersion' },
			{ type: 'text', value: '1.0.0' },
			{ type: 'text', value: 'fieldTitle_symbolSdkVersion' },
			{ type: 'text', value: '2.0.0' },
			{ type: 'text', value: 'fieldTitle_reactNativeVersion' },
			{ type: 'text', value: '3.0.0' },
			{ type: 'text', value: 'settings_about_symbol_title' },
			{ type: 'text', value: 'settings_about_symbol_body' }
		]
	});

	const runSocialBadgesTest = (description, config, expected) => {
		it(description, () => {
			// Arrange:
			const linkMock = mockLink();

			// Act:
			const screenTester = new ScreenTester(SettingsAbout);
			screenTester.presButtonByLabel(config.badgeLabel);

			// Assert:
			expect(linkMock).toHaveBeenCalledWith(expected.linkUrl);
		});
	};

	const tests = [
		{
			description: 'opens Twitter link when Twitter badge is pressed',
			config: {
				badgeLabel: 'Link to twitter'
			},
			expected: {
				linkUrl: 'https://twitter.com/thesymbolchain'
			}
		},
		{
			description: 'opens Discord link when Discord badge is pressed',
			config: {
				badgeLabel: 'Link to discord'
			},
			expected: {
				linkUrl: 'https://discord.gg/xymcity'
			}
		},
		{
			description: 'opens Github link when Github badge is pressed',
			config: {
				badgeLabel: 'Link to github'
			},
			expected: {
				linkUrl: 'https://github.com/symbol'
			}
		}
	];

	tests.forEach(test => {
		runSocialBadgesTest(test.description, test.config, test.expected);
	});
});
