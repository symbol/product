import { SettingsAbout } from '@/app/screens/settings/SettingsAbout';
import { ScreenTester } from '__tests__/ScreenTester';
import { runRenderTextTest } from '__tests__/component-tests';
import { mockLink, mockLocalization, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('../../../package.json', () => ({
	version: '1.0.0',
	dependencies: {
		'symbol-sdk': '2.0.0',
		'react-native': '3.0.0'
	}
}));

// Constants

const SCREEN_TEXT = {
	// About app
	textAboutAppTitle: 'screen_settings_title_aboutApp',
	textFieldAppVersion: 'fieldTitle_appVersion',
	textFieldSymbolSdkVersion: 'fieldTitle_symbolSdkVersion',
	textFieldReactNativeVersion: 'fieldTitle_reactNativeVersion',

	// About chain
	textAboutSymbolTitle: 'screen_settings_title_aboutChain Symbol',
	textAboutSymbolDescription: 'screen_settings_description_aboutChain Symbol',
	textAboutNemTitle: 'screen_settings_title_aboutChain NEM',
	textAboutNemDescription: 'screen_settings_description_aboutChain NEM',

	// Social badges
	linkDiscord: 'Link to discord',
	linkGithub: 'Link to github',
	linkTwitter: 'Link to twitter'
};

describe('screens/settings/SettingsAbout', () => {
	beforeEach(() => {
		mockLocalization((key, params) => (params ? `${key} ${Object.values(params).join(' ')}` : key));
		mockWalletController();
	});

	runRenderTextTest(SettingsAbout, {
		textToRender: [
			{ type: 'text', value: SCREEN_TEXT.textAboutAppTitle },
			{ type: 'text', value: SCREEN_TEXT.textFieldAppVersion },
			{ type: 'text', value: '1.0.0' },
			{ type: 'text', value: SCREEN_TEXT.textFieldSymbolSdkVersion },
			{ type: 'text', value: '2.0.0' },
			{ type: 'text', value: SCREEN_TEXT.textFieldReactNativeVersion },
			{ type: 'text', value: '3.0.0' }
		]
	});

	describe('chain about section', () => {
		const runChainAboutTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletController({ chainName: config.chainName });

				// Act:
				const screenTester = new ScreenTester(SettingsAbout);

				// Assert:
				screenTester.expectText([expected.title, expected.description]);
			});
		};

		const tests = [
			{
				description: 'renders Symbol name in the title and description when the main chain is Symbol',
				config: {
					chainName: 'symbol'
				},
				expected: {
					title: SCREEN_TEXT.textAboutSymbolTitle,
					description: SCREEN_TEXT.textAboutSymbolDescription
				}
			},
			{
				description: 'renders NEM name in the title and description when the main chain is NEM',
				config: {
					chainName: 'nem'
				},
				expected: {
					title: SCREEN_TEXT.textAboutNemTitle,
					description: SCREEN_TEXT.textAboutNemDescription
				}
			}
		];

		tests.forEach(test => {
			runChainAboutTest(test.description, test.config, test.expected);
		});
	});

	describe('social badges', () => {
		const runSocialBadgesTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletController({ chainName: config.chainName });
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
				description: 'opens Symbol Twitter link when Twitter badge is pressed on Symbol',
				config: {
					chainName: 'symbol',
					badgeLabel: SCREEN_TEXT.linkTwitter
				},
				expected: {
					linkUrl: 'https://twitter.com/thesymbolchain'
				}
			},
			{
				description: 'opens Symbol Discord link when Discord badge is pressed on Symbol',
				config: {
					chainName: 'symbol',
					badgeLabel: SCREEN_TEXT.linkDiscord
				},
				expected: {
					linkUrl: 'https://discord.gg/NMA9YQ55td'
				}
			},
			{
				description: 'opens Symbol Github link when Github badge is pressed on Symbol',
				config: {
					chainName: 'symbol',
					badgeLabel: SCREEN_TEXT.linkGithub
				},
				expected: {
					linkUrl: 'https://github.com/symbol'
				}
			},
			{
				description: 'opens NEM Twitter link when Twitter badge is pressed on NEM',
				config: {
					chainName: 'nem',
					badgeLabel: SCREEN_TEXT.linkTwitter
				},
				expected: {
					linkUrl: 'https://x.com/nemofficial'
				}
			},
			{
				description: 'opens NEM Discord link when Discord badge is pressed on NEM',
				config: {
					chainName: 'nem',
					badgeLabel: SCREEN_TEXT.linkDiscord
				},
				expected: {
					linkUrl: 'https://discord.gg/NMA9YQ55td'
				}
			},
			{
				description: 'opens NEM Github link when Github badge is pressed on NEM',
				config: {
					chainName: 'nem',
					badgeLabel: SCREEN_TEXT.linkGithub
				},
				expected: {
					linkUrl: 'https://github.com/NemProject'
				}
			}
		];

		tests.forEach(test => {
			runSocialBadgesTest(test.description, test.config, test.expected);
		});
	});
});
