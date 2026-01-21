import { walletControllers } from '@/app/lib/controller';
import * as localization from '@/app/localization';
import { Settings } from '@/app/screens/settings/Settings';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';

// Mocks

jest.mock('@/app/config', () => ({
	...jest.requireActual('@/app/config'),
	config: {
		marketCurrencies: ['USD', 'EUR', 'JPY']
	}
}));

jest.mock('@/app/localization', () => ({
	...jest.requireActual('@/app/localization'),
	$t: jest.fn(key => key),
	getLanguages: jest.fn(() => ({
		en: 'English',
		ja: '日本語',
		ko: '한국어'
	})),
	setCurrentLanguage: jest.fn(),
	initLocalization: jest.fn()
}));

jest.mock('@/app/lib/controller', () => ({
	walletControllers: {
		main: {
			clear: jest.fn()
		},
		additional: []
	}
}));

// Constants

const SCREEN_TEXT = {
	// Settings items - Network
	textNetworkTitle: 's_settings_item_network_title',
	textNetworkDescription: 's_settings_item_network_description',
	// Settings items - Language
	textLanguageTitle: 's_settings_item_language_title',
	textLanguageDescription: 's_settings_item_language_description',
	// Settings items - Security
	textSecurityTitle: 's_settings_item_security_title',
	textSecurityDescription: 's_settings_item_security_description',
	// Settings items - Currency
	textCurrencyTitle: 's_settings_item_currency_title',
	textCurrencyDescription: 's_settings_item_currency_description',
	// Settings items - About
	textAboutTitle: 's_settings_item_about_title',
	textAboutDescription: 's_settings_item_about_description',
	// Settings items - Logout
	textLogoutTitle: 's_settings_item_logout_title',
	textLogoutDescription: 's_settings_item_logout_description',
	// Logout dialog
	textLogoutDialogTitle: 'settings_logout_confirm_title',
	textLogoutDialogText: 'settings_logout_confirm_text',
	// Buttons
	buttonCancel: 'button_cancel',
	buttonConfirm: 'button_confirm'
};

const LANGUAGES = {
	ENGLISH: { code: 'en', label: 'English' },
	JAPANESE: { code: 'ja', label: '日本語' },
	KOREAN: { code: 'ko', label: '한국어' }
};

const CURRENCIES = {
	USD: 'USD',
	EUR: 'EUR',
	JPY: 'JPY'
};

// Wallet Controller Mock

const mockWalletControllerConfigured = (overrides = {}) => {
	const selectUserCurrencyMock = jest.fn();

	const walletControllerMock = mockWalletController({
		modules: {
			market: {
				price: {
					currency: overrides.userCurrency ?? CURRENCIES.USD
				},
				selectUserCurrency: selectUserCurrencyMock
			},
			localization: {
				currentLanguage: overrides.userLanguage ?? LANGUAGES.ENGLISH.code
			}
		},
		...overrides
	});

	walletControllerMock.modules.market.selectUserCurrency = selectUserCurrencyMock;

	return walletControllerMock;
};

describe('screens/settings/Settings', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders all settings items', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const expectedTexts = [
				SCREEN_TEXT.textNetworkTitle,
				SCREEN_TEXT.textNetworkDescription,
				SCREEN_TEXT.textLanguageTitle,
				SCREEN_TEXT.textLanguageDescription,
				SCREEN_TEXT.textSecurityTitle,
				SCREEN_TEXT.textSecurityDescription,
				SCREEN_TEXT.textCurrencyTitle,
				SCREEN_TEXT.textCurrencyDescription,
				SCREEN_TEXT.textAboutTitle,
				SCREEN_TEXT.textAboutDescription,
				SCREEN_TEXT.textLogoutTitle,
				SCREEN_TEXT.textLogoutDescription
			];

			// Act:
			const screenTester = new ScreenTester(Settings);

			// Assert:
			screenTester.expectText(expectedTexts);
		});
	});

	describe('navigation actions', () => {
		const runNavigationTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletControllerConfigured();
				const routerMock = mockRouter({ [expected.routerMethod]: jest.fn() });
				const screenTester = new ScreenTester(Settings);

				// Act:
				screenTester.pressButton(config.buttonText);

				// Assert:
				expect(routerMock[expected.routerMethod]).toHaveBeenCalledTimes(1);
			});
		};

		const navigationTests = [
			{
				description: 'navigates to network settings when network item is pressed',
				config: { buttonText: SCREEN_TEXT.textNetworkTitle },
				expected: { routerMethod: 'goToSettingsNetwork' }
			},
			{
				description: 'navigates to security settings when security item is pressed',
				config: { buttonText: SCREEN_TEXT.textSecurityTitle },
				expected: { routerMethod: 'goToSettingsSecurity' }
			},
			{
				description: 'navigates to about settings when about item is pressed',
				config: { buttonText: SCREEN_TEXT.textAboutTitle },
				expected: { routerMethod: 'goToSettingsAbout' }
			}
		];

		navigationTests.forEach(test => {
			runNavigationTest(test.description, test.config, test.expected);
		});
	});

	describe('language selector', () => {
		it('opens language selector modal when language item is pressed', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textLanguageTitle);

			// Assert:
			screenTester.expectText([
				LANGUAGES.ENGLISH.label,
				LANGUAGES.JAPANESE.label,
				LANGUAGES.KOREAN.label
			]);
		});

		const runLanguageChangeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletControllerConfigured({ userLanguage: config.currentLanguage });
				mockRouter({ goToWelcome: jest.fn() });
				const screenTester = new ScreenTester(Settings);

				// Act:
				screenTester.pressButton(SCREEN_TEXT.textLanguageTitle);
				screenTester.pressButton(config.selectedLanguageLabel);

				// Assert:
				expect(localization.setCurrentLanguage).toHaveBeenCalledWith(expected.languageCode);
			});
		};

		const languageChangeTests = [
			{
				description: 'changes language to Japanese',
				config: {
					currentLanguage: LANGUAGES.ENGLISH.code,
					selectedLanguageLabel: LANGUAGES.JAPANESE.label
				},
				expected: { languageCode: LANGUAGES.JAPANESE.code }
			},
			{
				description: 'changes language to Korean',
				config: {
					currentLanguage: LANGUAGES.ENGLISH.code,
					selectedLanguageLabel: LANGUAGES.KOREAN.label
				},
				expected: { languageCode: LANGUAGES.KOREAN.code }
			},
			{
				description: 'changes language to English',
				config: {
					currentLanguage: LANGUAGES.JAPANESE.code,
					selectedLanguageLabel: LANGUAGES.ENGLISH.label
				},
				expected: { languageCode: LANGUAGES.ENGLISH.code }
			}
		];

		languageChangeTests.forEach(test => {
			runLanguageChangeTest(test.description, test.config, test.expected);
		});

		it('navigates to welcome screen after language change', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const routerMock = mockRouter({ goToWelcome: jest.fn() });
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textLanguageTitle);
			screenTester.pressButton(LANGUAGES.JAPANESE.label);

			// Assert:
			expect(routerMock.goToWelcome).toHaveBeenCalledTimes(1);
		});
	});

	describe('currency selector', () => {
		it('opens currency selector modal when currency item is pressed', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textCurrencyTitle);

			// Assert:
			screenTester.expectText([CURRENCIES.USD, CURRENCIES.EUR, CURRENCIES.JPY]);
		});

		const runCurrencyChangeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const walletControllerMock = mockWalletControllerConfigured({
					userCurrency: config.currentCurrency
				});
				const screenTester = new ScreenTester(Settings);

				// Act:
				screenTester.pressButton(SCREEN_TEXT.textCurrencyTitle);
				screenTester.pressButton(config.selectedCurrency);

				// Assert:
				expect(walletControllerMock.modules.market.selectUserCurrency).toHaveBeenCalledWith(expected.currency);
			});
		};

		const currencyChangeTests = [
			{
				description: 'changes currency to EUR',
				config: { currentCurrency: CURRENCIES.USD, selectedCurrency: CURRENCIES.EUR },
				expected: { currency: CURRENCIES.EUR }
			},
			{
				description: 'changes currency to JPY',
				config: { currentCurrency: CURRENCIES.USD, selectedCurrency: CURRENCIES.JPY },
				expected: { currency: CURRENCIES.JPY }
			},
			{
				description: 'changes currency to USD',
				config: { currentCurrency: CURRENCIES.EUR, selectedCurrency: CURRENCIES.USD },
				expected: { currency: CURRENCIES.USD }
			}
		];

		currencyChangeTests.forEach(test => {
			runCurrencyChangeTest(test.description, test.config, test.expected);
		});
	});

	describe('logout', () => {
		it('shows logout confirmation dialog when logout item is pressed', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textLogoutTitle);

			// Assert:
			screenTester.expectText([
				SCREEN_TEXT.textLogoutDialogTitle,
				SCREEN_TEXT.textLogoutDialogText
			]);
		});

		it('hides logout confirmation dialog when cancel is pressed', () => {
			// Arrange:
			mockWalletControllerConfigured();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textLogoutTitle);
			screenTester.pressButton(SCREEN_TEXT.buttonCancel);

			// Assert:
			screenTester.notExpectText([SCREEN_TEXT.textLogoutDialogText]);
		});

		it('clears main wallet controller on logout', () => {
			// Arrange:
			mockWalletControllerConfigured();
			mockPasscode();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textLogoutTitle);
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);

			// Assert:
			expect(walletControllers.main.clear).toHaveBeenCalledTimes(1);
		});

		it('clears all wallet controllers including additional on logout', () => {
			// Arrange:
			const additionalControllerMock = { clear: jest.fn() };
			walletControllers.additional = [additionalControllerMock];
			mockWalletControllerConfigured();
			mockPasscode();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textLogoutTitle);
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);

			// Assert:
			expect(walletControllers.main.clear).toHaveBeenCalledTimes(1);
			expect(additionalControllerMock.clear).toHaveBeenCalledTimes(1);
		});

		it('reinitializes localization after logout', () => {
			// Arrange:
			mockWalletControllerConfigured();
			mockPasscode();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SCREEN_TEXT.textLogoutTitle);
			screenTester.pressButton(SCREEN_TEXT.buttonConfirm);

			// Assert:
			expect(localization.initLocalization).toHaveBeenCalledTimes(1);
		});
	});
});
