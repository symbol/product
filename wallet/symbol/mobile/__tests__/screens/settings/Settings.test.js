import { walletControllers } from '@/app/lib/controller';
import * as localization from '@/app/localization';
import { Settings } from '@/app/screens/settings/Settings';
import { ScreenTester } from '__tests__/ScreenTester';
import { mockLocalization, mockPasscode, mockRouter, mockWalletController } from '__tests__/mock-helpers';

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

const SETTINGS_ITEMS = {
	network: {
		title: 's_settings_item_network_title',
		description: 's_settings_item_network_description'
	},
	language: {
		title: 's_settings_item_language_title',
		description: 's_settings_item_language_description'
	},
	security: {
		title: 's_settings_item_security_title',
		description: 's_settings_item_security_description'
	},
	currency: {
		title: 's_settings_item_currency_title',
		description: 's_settings_item_currency_description'
	},
	about: {
		title: 's_settings_item_about_title',
		description: 's_settings_item_about_description'
	},
	logout: {
		title: 's_settings_item_logout_title',
		description: 's_settings_item_logout_description'
	}
};

const LOGOUT_DIALOG = {
	title: 'settings_logout_confirm_title',
	text: 'settings_logout_confirm_text'
};

const createMockWalletController = (overrides = {}) => ({
	modules: {
		market: {
			price: {
				currency: overrides.userCurrency ?? 'USD'
			},
			selectUserCurrency: jest.fn()
		},
		localization: {
			currentLanguage: overrides.userLanguage ?? 'en'
		}
	},
	on: jest.fn(),
	removeListener: jest.fn(),
	...overrides
});


describe('screens/settings/Settings', () => {
	beforeEach(() => {
		mockLocalization();
		jest.clearAllMocks();
	});

	describe('render', () => {
		it('renders all settings items', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const expectedTexts = Object.values(SETTINGS_ITEMS).flatMap(item => [item.title, item.description]);

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
				mockWalletController(createMockWalletController());
				const routerMock = mockRouter({ [expected.actionName]: jest.fn() });
				const screenTester = new ScreenTester(Settings);

				// Act:
				screenTester.pressButton(config.buttonText);

				// Assert:
				expect(routerMock[expected.actionName]).toHaveBeenCalledTimes(1);
			});
		};

		const navigationTests = [
			{
				description: 'navigates to network settings when network item is pressed',
				config: { buttonText: SETTINGS_ITEMS.network.title },
				expected: { actionName: 'goToSettingsNetwork' }
			},
			{
				description: 'navigates to security settings when security item is pressed',
				config: { buttonText: SETTINGS_ITEMS.security.title },
				expected: { actionName: 'goToSettingsSecurity' }
			},
			{
				description: 'navigates to about settings when about item is pressed',
				config: { buttonText: SETTINGS_ITEMS.about.title },
				expected: { actionName: 'goToSettingsAbout' }
			}
		];

		navigationTests.forEach(test => {
			runNavigationTest(test.description, test.config, test.expected);
		});
	});

	describe('language selector', () => {
		it('opens language selector modal when language item is pressed', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.language.title);

			// Assert:
			screenTester.expectText(['English', '日本語', '한국어']);
		});

		const runLanguageChangeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				mockWalletController(createMockWalletController({ userLanguage: config.currentLanguage }));
				mockRouter({ goToWelcome: jest.fn() });
				const screenTester = new ScreenTester(Settings);

				// Act:
				screenTester.pressButton(SETTINGS_ITEMS.language.title);
				screenTester.pressButton(config.selectedLanguage);

				// Assert:
				expect(localization.setCurrentLanguage).toHaveBeenCalledWith(expected.languageCode);
			});
		};

		const languageChangeTests = [
			{
				description: 'changes language to Japanese',
				config: { currentLanguage: 'en', selectedLanguage: '日本語' },
				expected: { languageCode: 'ja' }
			},
			{
				description: 'changes language to Korean',
				config: { currentLanguage: 'en', selectedLanguage: '한국어' },
				expected: { languageCode: 'ko' }
			},
			{
				description: 'changes language to English',
				config: { currentLanguage: 'ja', selectedLanguage: 'English' },
				expected: { languageCode: 'en' }
			}
		];

		languageChangeTests.forEach(test => {
			runLanguageChangeTest(test.description, test.config, test.expected);
		});

		it('navigates to welcome screen after language change', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const routerMock = mockRouter({ goToWelcome: jest.fn() });
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.language.title);
			screenTester.pressButton('日本語');

			// Assert:
			expect(routerMock.goToWelcome).toHaveBeenCalledTimes(1);
		});
	});

	describe('currency selector', () => {
		it('opens currency selector modal when currency item is pressed', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.currency.title);

			// Assert:
			screenTester.expectText(['USD', 'EUR', 'JPY']);
		});

		const runCurrencyChangeTest = (description, config, expected) => {
			it(description, () => {
				// Arrange:
				const walletControllerMock = createMockWalletController({ userCurrency: config.currentCurrency });
				mockWalletController(walletControllerMock);
				const screenTester = new ScreenTester(Settings);

				// Act:
				screenTester.pressButton(SETTINGS_ITEMS.currency.title);
				screenTester.pressButton(config.selectedCurrency);

				// Assert:
				expect(walletControllerMock.modules.market.selectUserCurrency).toHaveBeenCalledWith(expected.currency);
			});
		};

		const currencyChangeTests = [
			{
				description: 'changes currency to EUR',
				config: { currentCurrency: 'USD', selectedCurrency: 'EUR' },
				expected: { currency: 'EUR' }
			},
			{
				description: 'changes currency to JPY',
				config: { currentCurrency: 'USD', selectedCurrency: 'JPY' },
				expected: { currency: 'JPY' }
			},
			{
				description: 'changes currency to USD',
				config: { currentCurrency: 'EUR', selectedCurrency: 'USD' },
				expected: { currency: 'USD' }
			}
		];

		currencyChangeTests.forEach(test => {
			runCurrencyChangeTest(test.description, test.config, test.expected);
		});
	});

	describe('logout', () => {
		it('shows logout confirmation dialog when logout item is pressed', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.logout.title);

			// Assert:
			screenTester.expectText([LOGOUT_DIALOG.title, LOGOUT_DIALOG.text]);
		});

		it('hides logout confirmation dialog when cancel is pressed', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.logout.title);
			screenTester.pressButton('button_cancel');

			// Assert:
			screenTester.notExpectText([LOGOUT_DIALOG.text]);
		});

		it('shows passcode view when logout is confirmed', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			mockPasscode();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.logout.title);
			screenTester.pressButton('button_confirm');

			// Assert:
			expect(walletControllers.main.clear).toHaveBeenCalledTimes(1);
		});

		it('clears all wallet controllers on logout', () => {
			// Arrange:
			const additionalControllerMock = { clear: jest.fn() };
			walletControllers.additional = [additionalControllerMock];
			mockWalletController(createMockWalletController());
			mockPasscode();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.logout.title);
			screenTester.pressButton('button_confirm');

			// Assert:
			expect(walletControllers.main.clear).toHaveBeenCalledTimes(1);
			expect(additionalControllerMock.clear).toHaveBeenCalledTimes(1);
		});

		it('reinitializes localization after logout', () => {
			// Arrange:
			mockWalletController(createMockWalletController());
			mockPasscode();
			const screenTester = new ScreenTester(Settings);

			// Act:
			screenTester.pressButton(SETTINGS_ITEMS.logout.title);
			screenTester.pressButton('button_confirm');

			// Assert:
			expect(localization.initLocalization).toHaveBeenCalledTimes(1);
		});
	});
});
