import { Router, navigationRef } from '@/app/Router';

jest.mock('@react-navigation/native', () => ({
	...jest.requireActual('@react-navigation/native'),
	createNavigationContainerRef: () => ({
		goBack: jest.fn(),
		navigate: jest.fn(),
		reset: jest.fn()
	})
}));

describe('Router', () => {
	describe('goBack', () => {
		it('calls navigationRef.goBack', () => {
			// Act:
			Router.goBack();

			// Assert:
			expect(navigationRef.goBack).toHaveBeenCalled();
		});
	});

	describe('navigate methods', () => {
		const runNavigateMethodTest = config => {
			// Arrange:
			const { screenName, shouldReset, hasParams } = config;
			const methodName = `goTo${screenName}`;
			const description = `navigates to ${screenName} screen${shouldReset ? ' with reset' : ''}`;
			const params = hasParams ? { testParam: 123 } : undefined;

			it(description, () => {
				// Act:
				Router[methodName](params);

				// Assert:
				if (shouldReset) {
					expect(navigationRef.reset).toHaveBeenCalledWith({
						index: 0,
						routes: [{ name: screenName }]
					});
				} else if (hasParams) {
					expect(navigationRef.navigate).toHaveBeenCalledWith(screenName, params);
				} else {
					expect(navigationRef.navigate).toHaveBeenCalledWith(screenName);
				}
			});
		};

		const tests = [
			{
				screenName: 'Welcome',
				shouldReset: true,
				hasParams: false
			},
			{
				screenName: 'CreateWallet',
				shouldReset: false,
				hasParams: false
			},
			{
				screenName: 'ImportWallet',
				shouldReset: false,
				hasParams: false
			},
			{
				screenName: 'Home',
				shouldReset: true,
				hasParams: false
			},
			{
				screenName: 'Send',
				shouldReset: false,
				hasParams: true
			},
			{
				screenName: 'AccountDetails',
				shouldReset: false,
				hasParams: true
			},
			{
				screenName: 'Settings',
				shouldReset: false,
				hasParams: true
			},
			{
				screenName: 'SettingsAbout',
				shouldReset: false,
				hasParams: true
			},
			{
				screenName: 'SettingsNetwork',
				shouldReset: false,
				hasParams: true
			},
			{
				screenName: 'SettingsSecurity',
				shouldReset: false,
				hasParams: true
			}
		];

		tests.forEach(runNavigateMethodTest);
	});
});
